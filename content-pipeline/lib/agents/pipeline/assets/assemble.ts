import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAgentCall } from "@/lib/logAgentCall";
import { searchPexelsPhoto } from "@/lib/integrations/pexels";
import { submitBrollClip, isKlingBrollEnabled } from "@/lib/integrations/kling";
import { submitRender } from "@/lib/integrations/shotstack";
import { probeMediaBestEffort } from "@/lib/integrations/ffprobe";
import { downloadToBuffer } from "@/lib/supabase/storage";
import { mergeAssetUrls, getAssetUrls } from "./assetUrls";
import { splitScriptIntoBeats, estimateDurationSecondsFromWordCount, beatImageQuery } from "./beats";
import { buildMainTimeline } from "./shotstackTimeline";
import type { BeatPlanEntry, BeatName } from "./types";

/** Generic fallback used only if a Pexels search comes back empty --
 * still thematic/non-identifying (a dim, unpopulated establishing shot). */
const FALLBACK_IMAGE_URL =
  "https://images.pexels.com/photos/1666021/pexels-photo-1666021.jpeg?auto=compress&cs=tinysrgb&h=1080&w=1920";

/** Up to 3 "hero" beats get an optional Kling B-roll clip instead of a
 * static image, per the brief's "2-3 of the most narratively important
 * beats" -- hook (cold open) and mechanism (the reveal) are called out by
 * name in the brief; unraveling rounds out the third. */
const KLING_HERO_BEATS: BeatName[] = ["hook", "mechanism", "unraveling"];

export async function runAssembleAgent(contentItemId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: item, error } = await supabase
    .from("content_items")
    .select("script_text")
    .eq("id", contentItemId)
    .single();

  if (error || !item?.script_text) {
    throw new Error(`runAssembleAgent: content_items row ${contentItemId} has no script_text`);
  }

  const assetUrls = await getAssetUrls(contentItemId);
  const voiceoverUrl = assetUrls.voiceover_url;
  if (!voiceoverUrl) {
    throw new Error(`runAssembleAgent: content_items row ${contentItemId} has no voiceover_url yet`);
  }

  const durationSeconds = await estimateVoiceoverDuration(voiceoverUrl, item.script_text);
  const beatDrafts = splitScriptIntoBeats(item.script_text, durationSeconds);

  const beatPlan: BeatPlanEntry[] = [];
  for (const draft of beatDrafts) {
    const imageQuery = beatImageQuery(draft.beat);
    const image = await searchPexelsImage(contentItemId, imageQuery);
    const entry: BeatPlanEntry = {
      beat: draft.beat,
      text: draft.text,
      startSeconds: draft.startSeconds,
      lengthSeconds: draft.lengthSeconds,
      imageUrl: image ?? FALLBACK_IMAGE_URL,
      imageQuery,
    };

    if (isKlingBrollEnabled() && KLING_HERO_BEATS.includes(draft.beat)) {
      try {
        const { jobId } = await submitBrollClip(brollPrompt(draft.beat, draft.text));
        entry.klingJobId = jobId;
        entry.klingStatus = "pending";
      } catch (klingError) {
        // Kling B-roll is optional -- a failed submission just means this
        // beat stays a static Pexels image, it must not block the pipeline.
        console.error(`runAssembleAgent: Kling submission failed for beat ${draft.beat}`, klingError);
        await logAgentCall({
          contentItemId,
          agentName: "asset",
          model: "kling-fal-v3-pro-t2v",
          costUsd: 0,
          status: "fail",
          outputSummary: `Kling B-roll submission failed for beat "${draft.beat}": ${(klingError as Error).message}`,
        });
      }
    }

    beatPlan.push(entry);
  }

  const hasPendingKlingJobs = beatPlan.some((b) => b.klingStatus === "pending");
  await mergeAssetUrls(contentItemId, { beat_plan: beatPlan, main_render_submitted: false });

  if (hasPendingKlingJobs) {
    // Don't submit the main Shotstack render yet -- the cron job polls
    // pending Kling jobs and submits the render once they all resolve
    // (see app/api/cron/check-renders). This keeps every "wait for an
    // async job" step on the submit-then-poll-via-cron pattern, no
    // exceptions, per the brief's constraint #11.
    return;
  }

  await submitMainRender(contentItemId, beatPlan, voiceoverUrl);
}

export async function submitMainRender(
  contentItemId: string,
  beatPlan: BeatPlanEntry[],
  voiceoverUrl: string
): Promise<void> {
  const timeline = buildMainTimeline(beatPlan, voiceoverUrl);

  let renderId: string;
  try {
    ({ renderId } = await submitRender(timeline, { format: "mp4", resolution: "1080", aspectRatio: "16:9" }));
  } catch (submitError) {
    // Nothing was billed for a failed submission -- 0 is a real cost
    // figure, not a placeholder null (see logAgentCall's costUsd contract).
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "shotstack-render",
      costUsd: 0,
      status: "fail",
      outputSummary: `Shotstack main render submission failed: ${(submitError as Error).message}`,
    });
    throw submitError;
  }

  await mergeAssetUrls(contentItemId, {
    shotstack_render_id: renderId,
    shotstack_render_status: "pending",
    main_render_submitted: true,
  });
  // The actual cost (billable seconds) is only known once Shotstack
  // finishes rendering -- logged by the cron job at resolution time
  // instead of guessed here (see app/api/cron/check-renders).
}

async function estimateVoiceoverDuration(voiceoverUrl: string, scriptText: string): Promise<number> {
  try {
    const buffer = await downloadToBuffer(voiceoverUrl);
    const probe = await probeMediaBestEffort(buffer);
    if (probe?.durationSeconds) return probe.durationSeconds;
  } catch (probeError) {
    console.warn("estimateVoiceoverDuration: ffprobe unavailable, falling back to word-count estimate", probeError);
  }
  return estimateDurationSecondsFromWordCount(scriptText);
}

async function searchPexelsImage(contentItemId: string, query: string): Promise<string | null> {
  try {
    const photo = await searchPexelsPhoto(query);
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "pexels-search-v1",
      costUsd: 0,
      status: photo ? "success" : "fail",
      outputSummary: photo ? `Found image for query "${query}"` : `No results for query "${query}"`,
    });
    return photo?.url ?? null;
  } catch (pexelsError) {
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "pexels-search-v1",
      costUsd: 0,
      status: "fail",
      outputSummary: `Pexels search errored for query "${query}": ${(pexelsError as Error).message}`,
    });
    return null;
  }
}

function brollPrompt(beat: BeatName, beatText: string): string {
  const theme = beatImageQuery(beat);
  return (
    `Slow, cinematic ${theme}. Mood and atmosphere only -- no people, no faces, no readable text, ` +
    `no specific individuals. Documentary B-roll style, muted colors, gentle camera movement. ` +
    `Context (do not depict any person mentioned): ${beatText.slice(0, 200)}`
  );
}

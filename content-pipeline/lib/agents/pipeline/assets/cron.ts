import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAgentCall } from "@/lib/logAgentCall";
import { getRenderStatus, costForRenderDuration } from "@/lib/integrations/shotstack";
import { getBrollClipStatus } from "@/lib/integrations/kling";
import { downloadToBuffer, uploadToStorage } from "@/lib/supabase/storage";
import { mergeAssetUrls, getAssetUrls } from "./assetUrls";
import { submitMainRender } from "./assemble";
import { generateVerticalAndThumbnail } from "./vertical";
import { runAssetQaCheck } from "./qa";
import { runVoiceoverAgent } from "./voiceover";
import type { AssetUrls, BeatPlanEntry } from "./types";

const RENDERED_VIDEO_BUCKET = "rendered-videos";

export interface CronSummary {
  itemsChecked: number;
  actions: string[];
}

/**
 * Core logic for GET /api/cron/check-renders (Phase 3 section 8). Runs
 * every 2 minutes per vercel.json. Does at most one unit of work per
 * content_items row per tick (resolve Kling jobs -> submit main render ->
 * poll main render -> poll vertical render -> run asset QA), so it always
 * terminates quickly and the next tick naturally picks up wherever this
 * one left off.
 */
export async function checkPendingRenders(): Promise<CronSummary> {
  const supabase = createServiceRoleClient();
  // Every row this pipeline actively works on is at stage='scheduled'
  // until asset QA passes and advances it to 'assets_generated' --
  // fetching by stage instead of by nested asset_urls fields sidesteps
  // jsonb path query syntax entirely and is more than fast enough at this
  // pipeline's (single-channel) volume.
  //
  // This was 'qa_passed' before Phase 7's section 0 fix: Phase 3 was
  // originally specced to fire the instant QA passed, before a human
  // ever reviewed the script -- defeating the entire point of a review
  // gate (assets, i.e. money, would already be spent by the time a human
  // saw the item). The review queue (app/dashboard/review) now gates
  // entry into this pipeline: only once a human calls the approve
  // endpoint does a row become 'scheduled', which is what this cron (and
  // the direct kickoff in the approve endpoint itself) now watches for.
  const { data: items, error } = await supabase
    .from("content_items")
    .select("id, asset_urls")
    .eq("stage", "scheduled");

  if (error) {
    throw new Error(`checkPendingRenders: failed to query content_items: ${error.message}`);
  }

  const summary: CronSummary = { itemsChecked: items?.length ?? 0, actions: [] };

  for (const item of items ?? []) {
    try {
      const action = await processItem(item.id as string, (item.asset_urls as AssetUrls) ?? {});
      if (action) summary.actions.push(`${item.id}: ${action}`);
    } catch (itemError) {
      console.error(`checkPendingRenders: error processing content_item ${item.id}`, itemError);
      summary.actions.push(`${item.id}: error - ${(itemError as Error).message}`);
    }
  }

  return summary;
}

async function processItem(contentItemId: string, assetUrls: AssetUrls): Promise<string | null> {
  // Safety net for the approve endpoint's direct runVoiceoverAgent call
  // (app/api/content-items/[id]/approve/route.ts): if that call failed,
  // or the request was interrupted before it ran, this item would
  // otherwise sit at 'scheduled' with an empty asset_urls forever. Once
  // any asset work has started (beat_plan exists), the branches below
  // take over -- this only ever fires for a genuinely un-started item.
  // runVoiceoverAgent itself is idempotent (checks voiceover_url first),
  // so this can never race-duplicate a generation that the direct call
  // already kicked off successfully.
  if (!assetUrls.voiceover_url && !assetUrls.beat_plan) {
    await runVoiceoverAgent(contentItemId);
    return "kicked off voiceover + assembly (safety net for a missed direct trigger on approve)";
  }

  if (assetUrls.beat_plan && assetUrls.main_render_submitted === false) {
    return resolveKlingThenSubmitMain(contentItemId, assetUrls.beat_plan, assetUrls.voiceover_url!);
  }

  if (assetUrls.shotstack_render_status === "pending" && assetUrls.shotstack_render_id) {
    return pollMainRender(contentItemId, assetUrls);
  }

  if (assetUrls.vertical_render_status === "pending" && assetUrls.vertical_render_id) {
    return pollVerticalRender(contentItemId, assetUrls.vertical_render_id);
  }

  if (
    assetUrls.main_video_url &&
    assetUrls.vertical_video_url &&
    assetUrls.thumbnail_url &&
    !assetUrls.qa_passed &&
    !assetUrls.qa_failure_reason &&
    assetUrls.shotstack_render_id &&
    assetUrls.vertical_render_id
  ) {
    return runQaNow(contentItemId, assetUrls.shotstack_render_id, assetUrls.vertical_render_id);
  }

  return null;
}

async function resolveKlingThenSubmitMain(
  contentItemId: string,
  beatPlan: BeatPlanEntry[],
  voiceoverUrl: string
): Promise<string> {
  const updatedBeatPlan: BeatPlanEntry[] = [];
  let anyStillPending = false;

  for (const beat of beatPlan) {
    if (beat.klingStatus !== "pending" || !beat.klingJobId) {
      updatedBeatPlan.push(beat);
      continue;
    }

    try {
      const jobStatus = await getBrollClipStatus(beat.klingJobId, 5);
      if (jobStatus.status === "COMPLETED" && jobStatus.videoUrl) {
        await logAgentCall({
          contentItemId,
          agentName: "asset",
          model: "kling-fal-v3-pro-t2v",
          costUsd: jobStatus.costUsd ?? 0,
          status: "success",
          outputSummary: `Kling B-roll clip ready for beat "${beat.beat}".`,
        });
        updatedBeatPlan.push({ ...beat, klingStatus: "done", klingVideoUrl: jobStatus.videoUrl });
      } else if (jobStatus.status === "FAILED") {
        await logAgentCall({
          contentItemId,
          agentName: "asset",
          model: "kling-fal-v3-pro-t2v",
          costUsd: 0,
          status: "fail",
          outputSummary: `Kling B-roll clip failed for beat "${beat.beat}": ${jobStatus.error ?? "unknown error"}. Falling back to the Pexels image for this beat.`,
        });
        updatedBeatPlan.push({ ...beat, klingStatus: "failed" });
      } else {
        anyStillPending = true;
        updatedBeatPlan.push(beat);
      }
    } catch (statusError) {
      console.error(`resolveKlingThenSubmitMain: status check failed for job ${beat.klingJobId}`, statusError);
      anyStillPending = true;
      updatedBeatPlan.push(beat);
    }
  }

  await mergeAssetUrls(contentItemId, { beat_plan: updatedBeatPlan });

  if (anyStillPending) {
    return "waiting on Kling B-roll job(s)";
  }

  await submitMainRender(contentItemId, updatedBeatPlan, voiceoverUrl);
  return "all Kling jobs resolved, submitted main Shotstack render";
}

async function pollMainRender(contentItemId: string, assetUrls: AssetUrls): Promise<string> {
  const status = await getRenderStatus(assetUrls.shotstack_render_id!);

  if (status.status === "done" && status.url) {
    const buffer = await downloadToBuffer(status.url);
    const publicUrl = await uploadToStorage(RENDERED_VIDEO_BUCKET, `${contentItemId}/main.mp4`, buffer, "video/mp4");
    await mergeAssetUrls(contentItemId, { main_video_url: publicUrl, shotstack_render_status: "done" });
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "shotstack-render",
      costUsd: costForRenderDuration(status.durationSeconds ?? 0),
      status: "success",
      outputSummary: `Main video render complete (${status.durationSeconds ?? "unknown"}s), mirrored to Supabase Storage.`,
    });

    try {
      await generateVerticalAndThumbnail(contentItemId, assetUrls.beat_plan ?? [], assetUrls.voiceover_url!);
    } catch (verticalError) {
      console.error(`pollMainRender: failed to kick off vertical+thumbnail for ${contentItemId}`, verticalError);
    }

    return "main render done, mirrored to storage, started vertical + thumbnail";
  }

  if (status.status === "failed") {
    await mergeAssetUrls(contentItemId, { shotstack_render_status: "failed" });
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "shotstack-render",
      costUsd: 0,
      status: "fail",
      outputSummary: `Main render failed: ${status.error ?? "no error detail returned"}.`,
    });
    // stage is intentionally left unchanged so this surfaces as stuck,
    // per the brief, instead of silently disappearing.
    return "main render failed";
  }

  return `main render still ${status.status}`;
}

async function pollVerticalRender(contentItemId: string, verticalRenderId: string): Promise<string> {
  const status = await getRenderStatus(verticalRenderId);

  if (status.status === "done" && status.url) {
    const buffer = await downloadToBuffer(status.url);
    const publicUrl = await uploadToStorage(
      RENDERED_VIDEO_BUCKET,
      `${contentItemId}/vertical.mp4`,
      buffer,
      "video/mp4"
    );
    await mergeAssetUrls(contentItemId, { vertical_video_url: publicUrl, vertical_render_status: "done" });
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "shotstack-render",
      costUsd: costForRenderDuration(status.durationSeconds ?? 0),
      status: "success",
      outputSummary: `Vertical render complete (${status.durationSeconds ?? "unknown"}s), mirrored to Supabase Storage.`,
    });
    return "vertical render done, mirrored to storage";
  }

  if (status.status === "failed") {
    await mergeAssetUrls(contentItemId, { vertical_render_status: "failed" });
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "shotstack-render",
      costUsd: 0,
      status: "fail",
      outputSummary: `Vertical render failed: ${status.error ?? "no error detail returned"}.`,
    });
    return "vertical render failed";
  }

  return `vertical render still ${status.status}`;
}

async function runQaNow(contentItemId: string, mainRenderId: string, verticalRenderId: string): Promise<string> {
  const [mainStatus, verticalStatus] = await Promise.all([
    getRenderStatus(mainRenderId),
    getRenderStatus(verticalRenderId),
  ]);

  await runAssetQaCheck(contentItemId, {
    mainDurationSeconds: mainStatus.durationSeconds ?? 0,
    verticalDurationSeconds: verticalStatus.durationSeconds ?? 0,
  });

  const refreshed = await getAssetUrls(contentItemId);
  return refreshed.qa_passed ? "asset QA passed, stage -> assets_generated" : "asset QA failed";
}

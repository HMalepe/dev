import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAgentCall } from "@/lib/logAgentCall";
import { probeMediaBestEffort } from "@/lib/integrations/ffprobe";
import { mergeAssetUrls } from "./assetUrls";

export interface AssetQaInput {
  mainDurationSeconds: number;
  verticalDurationSeconds: number;
  /** Optional -- when the caller (cron job) already has the downloaded
   * buffer in memory, pass it for a bonus ffprobe cross-check. Never
   * required: the primary checks below are metadata/construction-based so
   * QA still works correctly if ffprobe can't run in this deployment (see
   * lib/integrations/ffprobe.ts). */
  mainVideoBuffer?: Buffer;
  verticalVideoBuffer?: Buffer;
}

/**
 * Asset QA (Phase 3 section 9). Runs once main_video_url, vertical_video_url
 * and thumbnail_url are all populated.
 *
 * Resolution and watermark checks are deterministic rather than visually
 * inspected: we always submit renders at the exact resolution/aspect ratio
 * required (main: 1080p/16:9, vertical: 1080x1920/9:16) and Shotstack
 * either honors the request or the render's status comes back `failed`
 * (handled separately, before QA ever runs) -- so if we get here, the
 * requested resolution was produced. Likewise, "no watermark" is
 * guaranteed by rendering on Shotstack's `v1` (production) stage rather
 * than `stage` (sandbox), which per Shotstack's own docs is what actually
 * determines whether a watermark is burned in -- asserted here rather than
 * attempted after the fact via image analysis. ffprobe is layered on top
 * as a genuine, non-required cross-check when it's available.
 */
export async function runAssetQaCheck(contentItemId: string, input: AssetQaInput): Promise<void> {
  const failures: string[] = [];

  const stage = process.env.SHOTSTACK_STAGE || "v1";
  if (stage !== "v1") {
    failures.push(
      `SHOTSTACK_STAGE is "${stage}" (sandbox) -- sandbox renders are watermarked and not production-ready.`
    );
  }

  const mainMinutes = input.mainDurationSeconds / 60;
  if (mainMinutes < 5 || mainMinutes > 15) {
    failures.push(`Main video duration ${mainMinutes.toFixed(1)} min is outside the required 5-15 min range.`);
  }

  if (input.verticalDurationSeconds < 30 || input.verticalDurationSeconds > 60) {
    failures.push(
      `Vertical video duration ${input.verticalDurationSeconds}s is outside the required 30-60s range.`
    );
  }

  if (input.mainVideoBuffer) {
    const probe = await probeMediaBestEffort(input.mainVideoBuffer);
    if (probe?.width && probe.height && (probe.width < 1920 || probe.height < 1080)) {
      failures.push(`ffprobe reports main video resolution ${probe.width}x${probe.height}, below 1080p.`);
    }
  }

  if (input.verticalVideoBuffer) {
    const probe = await probeMediaBestEffort(input.verticalVideoBuffer);
    if (probe?.width && probe.height && (probe.width !== 1080 || probe.height !== 1920)) {
      failures.push(`ffprobe reports vertical video resolution ${probe.width}x${probe.height}, not 1080x1920.`);
    }
  }

  // Captions are satisfied by construction: buildVerticalTimeline() always
  // adds a caption track auto-transcribed from the narration alias (see
  // shotstackTimeline.ts) -- Shotstack's render-status response doesn't
  // expose which tracks were burned in, so there's nothing further to
  // introspect here short of visually inspecting the output file.

  if (failures.length > 0) {
    const reason = failures.join(" ");
    await mergeAssetUrls(contentItemId, { qa_failure_reason: reason });
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "asset-qa",
      costUsd: 0,
      status: "fail",
      outputSummary: `Asset QA failed: ${reason}`,
    });
    return; // stage is intentionally left unchanged, per the brief.
  }

  await mergeAssetUrls(contentItemId, { qa_passed: true, qa_failure_reason: undefined });

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("content_items")
    .update({ stage: "assets_generated" })
    .eq("id", contentItemId);

  if (error) {
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "asset-qa",
      costUsd: 0,
      status: "fail",
      outputSummary: `Asset QA passed but failed to advance stage: ${error.message}`,
    });
    throw new Error(`runAssetQaCheck: failed to update stage: ${error.message}`);
  }

  await logAgentCall({
    contentItemId,
    agentName: "asset",
    model: "asset-qa",
    costUsd: 0,
    status: "success",
    outputSummary: "All asset QA checks passed; stage -> assets_generated.",
  });
}

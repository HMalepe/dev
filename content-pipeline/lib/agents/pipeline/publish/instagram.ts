import { createReelContainer, getContainerStatus, publishContainer } from "@/lib/integrations/instagram";
import { logAgentCall } from "@/lib/logAgentCall";
import { getPlatformToken } from "@/lib/platformTokens";
import { getContentItemForPublish, getOrCreatePlatformPost, isRateLimited, updatePlatformPost, type PlatformPostRow } from "./shared";

/** Exported so the Phase 7 calendar's rate-limit headroom indicator shows
 * the exact same ceiling actually enforced here -- never a separately
 * hardcoded, driftable copy of the same number. */
export const RATE_LIMIT_CEILING = 25;

/**
 * Instagram publish agent (Phase 5, section 4). Two-step Meta publish
 * flow (create container -> poll until FINISHED -> media_publish), spread
 * across separate scheduler ticks rather than polled synchronously in one
 * request -- video containers can take a few minutes to process, and
 * "no synchronous polling inside any request/response cycle" is the same
 * submit-then-poll-via-cron discipline Phase 3 established for Shotstack
 * renders. provider_job_id (the container id) persists across ticks so a
 * later attempt resumes polling instead of creating a duplicate
 * container.
 */
export async function runInstagramPublishAgent(contentItemId: string): Promise<void> {
  const post = await getOrCreatePlatformPost(contentItemId, "instagram");

  if (post.status === "posted" || post.status === "failed") return;

  // A container is already in flight from a prior tick -- resume polling
  // it rather than submitting a duplicate.
  if (post.status === "pending" && post.provider_job_id) {
    await pollAndPublish(contentItemId, post);
    return;
  }

  // Nothing submitted yet (fresh 'pending' row, or a previous tick
  // deferred this with 'rate_limited') -- check the rolling 24h limit
  // *before* attempting a post, not after a failed API call, per the
  // brief's explicit requirement.
  if (await isRateLimited("instagram", RATE_LIMIT_CEILING)) {
    await updatePlatformPost(post.id, { status: "rate_limited" });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "instagram-graph-api",
      costUsd: 0,
      status: "fail",
      outputSummary: `Instagram's ${RATE_LIMIT_CEILING}/24hr rolling limit reached -- deferred to next scheduler tick.`,
    });
    return;
  }

  await submitContainer(contentItemId, post);
}

async function submitContainer(contentItemId: string, post: PlatformPostRow): Promise<void> {
  const item = await getContentItemForPublish(contentItemId);
  const videoUrl = item.asset_urls?.vertical_video_url;

  if (!videoUrl) {
    const message = "content_items.asset_urls.vertical_video_url is not set (Reels needs the short vertical cut, not the long-form main video).";
    await updatePlatformPost(post.id, { status: "failed", error_message: message });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "instagram-graph-api",
      costUsd: 0,
      status: "fail",
      outputSummary: `Instagram publish failed: ${message}`,
    });
    return;
  }

  try {
    const token = await getPlatformToken("instagram");
    const igUserId = requireIgUserId();

    const containerId = await createReelContainer({
      igUserId,
      accessToken: token.access_token,
      videoUrl,
      caption: item.platform_variants?.ig_caption ?? "",
    });

    await updatePlatformPost(post.id, { status: "pending", provider_job_id: containerId, error_message: null });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "instagram-graph-api",
      costUsd: 0,
      status: "success",
      outputSummary: `Submitted Instagram Reels container ${containerId}, polling for FINISHED on a later tick.`,
    });
  } catch (error) {
    const message = (error as Error).message;
    await updatePlatformPost(post.id, { status: "failed", error_message: message });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "instagram-graph-api",
      costUsd: 0,
      status: "fail",
      outputSummary: `Instagram container submission failed: ${message}`,
    });
  }
}

async function pollAndPublish(contentItemId: string, post: PlatformPostRow): Promise<void> {
  const containerId = post.provider_job_id!;

  try {
    const token = await getPlatformToken("instagram");
    const statusCode = await getContainerStatus(containerId, token.access_token);

    if (statusCode === "FINISHED") {
      const igUserId = requireIgUserId();
      const mediaId = await publishContainer(igUserId, containerId, token.access_token);
      await updatePlatformPost(post.id, {
        status: "posted",
        platform_post_id: mediaId,
        posted_at: new Date().toISOString(),
        error_message: null,
      });
      await logAgentCall({
        contentItemId,
        agentName: "publish",
        model: "instagram-graph-api",
        costUsd: 0,
        status: "success",
        outputSummary: `Published Instagram Reel, media id ${mediaId}.`,
      });
      return;
    }

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      const message = `Instagram container ${containerId} ended in status ${statusCode}.`;
      await updatePlatformPost(post.id, { status: "failed", error_message: message });
      await logAgentCall({
        contentItemId,
        agentName: "publish",
        model: "instagram-graph-api",
        costUsd: 0,
        status: "fail",
        outputSummary: message,
      });
      return;
    }

    // IN_PROGRESS (or an already-PUBLISHED container from a race with a
    // prior tick) -- leave status = 'pending' and check again next tick.
  } catch (error) {
    // A transient failure polling status shouldn't mark the whole publish
    // as 'failed' -- the container is still valid and can be polled again
    // next tick. Log it, but leave the row 'pending'.
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "instagram-graph-api",
      costUsd: 0,
      status: "fail",
      outputSummary: `Instagram container status check failed (will retry next tick): ${(error as Error).message}`,
    });
  }
}

function requireIgUserId(): string {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!igUserId) {
    throw new Error("INSTAGRAM_BUSINESS_ACCOUNT_ID must be set.");
  }
  return igUserId;
}

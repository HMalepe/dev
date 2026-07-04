import { fetchPublishStatus, initVideoPublish, queryCreatorInfo } from "@/lib/integrations/tiktok";
import { logAgentCall } from "@/lib/logAgentCall";
import { getPlatformToken } from "@/lib/platformTokens";
import { getContentItemForPublish, getOrCreatePlatformPost, isRateLimited, updatePlatformPost, type PlatformPostRow } from "./shared";

/** Community-reported TikTok caps land around 15-25/day per creator (not
 * officially documented) -- 15 is the brief's own explicit "stay safely
 * under whatever the actual enforced number is" ceiling. */
/** Exported so the Phase 7 calendar's rate-limit headroom indicator shows
 * the exact same ceiling actually enforced here -- never a separately
 * hardcoded, driftable copy of the same number. */
export const RATE_LIMIT_CEILING = 15;

/**
 * TikTok publish agent (Phase 5, section 5). Branches its entire behavior
 * on TIKTOK_AUDITED. When audited, uses the same submit-then-poll-via-
 * cron pattern as Instagram: TikTok's PULL_FROM_URL download alone can
 * take up to an hour per TikTok's own docs, which structurally cannot fit
 * inside one bounded serverless request -- provider_job_id (the
 * publish_id) persists across scheduler ticks so a later attempt resumes
 * polling instead of submitting a duplicate post.
 */
export async function runTiktokPublishAgent(contentItemId: string): Promise<void> {
  const post = await getOrCreatePlatformPost(contentItemId, "tiktok");

  // 'ready' is also terminal here: once TIKTOK_AUDITED=false has deferred
  // an item to manual posting, it stays deferred even if the flag later
  // flips to true -- re-attempting via the API after a human may already
  // have posted it manually risks a duplicate. Only items that reach
  // assets_generated *after* the flip go through the audited path.
  if (post.status === "posted" || post.status === "failed" || post.status === "ready") return;

  const audited = process.env.TIKTOK_AUDITED === "true";

  if (!audited) {
    // Unaudited clients can only post private/SELF_ONLY, useless for a
    // public channel -- don't attempt the API at all. This branch IS the
    // correct, successful outcome (deferring to Phase 7's "tap to post
    // manually" queue), not a failure, per the brief's explicit
    // instruction to log it as such.
    await updatePlatformPost(post.id, { status: "ready" });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "tiktok-content-posting-api-v2",
      costUsd: 0,
      status: "success",
      outputSummary: "TIKTOK_AUDITED=false -- correctly deferred to manual posting instead of attempting an unaudited (private-only) API post.",
    });
    return;
  }

  if (post.status === "pending" && post.provider_job_id) {
    await pollPublishStatus(contentItemId, post);
    return;
  }

  if (await isRateLimited("tiktok", RATE_LIMIT_CEILING)) {
    await updatePlatformPost(post.id, { status: "rate_limited" });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "tiktok-content-posting-api-v2",
      costUsd: 0,
      status: "fail",
      outputSummary: `TikTok's conservative ${RATE_LIMIT_CEILING}/24hr limit reached -- deferred to next scheduler tick.`,
    });
    return;
  }

  await submitPost(contentItemId, post);
}

async function submitPost(contentItemId: string, post: PlatformPostRow): Promise<void> {
  const item = await getContentItemForPublish(contentItemId);
  const videoUrl = item.asset_urls?.vertical_video_url;

  if (!videoUrl) {
    const message = "content_items.asset_urls.vertical_video_url is not set (TikTok needs the short vertical cut, not the long-form main video).";
    await updatePlatformPost(post.id, { status: "failed", error_message: message });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "tiktok-content-posting-api-v2",
      costUsd: 0,
      status: "fail",
      outputSummary: `TikTok publish failed: ${message}`,
    });
    return;
  }

  try {
    const token = await getPlatformToken("tiktok");

    // Required before every post, never cached across posts -- account
    // settings can change between calls, per TikTok's own API rules.
    const creatorInfo = await queryCreatorInfo(token.access_token);
    const privacyLevel = creatorInfo.privacyLevelOptions.includes("PUBLIC_TO_EVERYONE")
      ? "PUBLIC_TO_EVERYONE"
      : creatorInfo.privacyLevelOptions[0];

    if (!privacyLevel) {
      throw new Error("TikTok creator_info returned no privacy_level_options to post with.");
    }

    const publishId = await initVideoPublish({
      accessToken: token.access_token,
      videoUrl,
      caption: item.platform_variants?.tiktok_caption ?? "",
      privacyLevel,
    });

    await updatePlatformPost(post.id, { status: "pending", provider_job_id: publishId, error_message: null });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "tiktok-content-posting-api-v2",
      costUsd: 0,
      status: "success",
      outputSummary: `Submitted TikTok post ${publishId} (privacy_level: ${privacyLevel}), polling for PUBLISH_COMPLETE on a later tick.`,
    });
  } catch (error) {
    const message = (error as Error).message;
    await updatePlatformPost(post.id, { status: "failed", error_message: message });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "tiktok-content-posting-api-v2",
      costUsd: 0,
      status: "fail",
      outputSummary: `TikTok post submission failed: ${message}`,
    });
  }
}

async function pollPublishStatus(contentItemId: string, post: PlatformPostRow): Promise<void> {
  const publishId = post.provider_job_id!;

  try {
    const token = await getPlatformToken("tiktok");
    const result = await fetchPublishStatus(token.access_token, publishId);

    if (result.status === "PUBLISH_COMPLETE") {
      await updatePlatformPost(post.id, {
        status: "posted",
        platform_post_id: publishId,
        posted_at: new Date().toISOString(),
        error_message: null,
      });
      await logAgentCall({
        contentItemId,
        agentName: "publish",
        model: "tiktok-content-posting-api-v2",
        costUsd: 0,
        status: "success",
        outputSummary: `TikTok post ${publishId} is live (PUBLISH_COMPLETE).`,
      });
      return;
    }

    if (result.status === "FAILED") {
      const message = `TikTok post ${publishId} failed: ${result.failReason ?? "no fail_reason returned"}.`;
      await updatePlatformPost(post.id, { status: "failed", error_message: message });
      await logAgentCall({
        contentItemId,
        agentName: "publish",
        model: "tiktok-content-posting-api-v2",
        costUsd: 0,
        status: "fail",
        outputSummary: message,
      });
      return;
    }

    // PROCESSING_DOWNLOAD / PROCESSING_UPLOAD / SEND_TO_USER_INBOX --
    // leave 'pending' and check again next tick. TikTok's own docs allow
    // up to an hour for the PULL_FROM_URL download alone, so this can
    // legitimately span several 15-minute scheduler ticks.
  } catch (error) {
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "tiktok-content-posting-api-v2",
      costUsd: 0,
      status: "fail",
      outputSummary: `TikTok publish status check failed (will retry next tick): ${(error as Error).message}`,
    });
  }
}

import { uploadVideoToYoutube } from "@/lib/integrations/youtube";
import { logAgentCall } from "@/lib/logAgentCall";
import { downloadToBuffer } from "@/lib/supabase/storage";
import { getContentItemForPublish, getOrCreatePlatformPost, updatePlatformPost } from "./shared";

/**
 * YouTube publish agent (Phase 5, section 3). Unlike Instagram/TikTok,
 * `videos.insert` returns the final, published video resource in one
 * call -- no submit-then-poll state machine needed here, this either
 * succeeds or fails on a single attempt.
 */
export async function runYoutubePublishAgent(contentItemId: string): Promise<void> {
  const post = await getOrCreatePlatformPost(contentItemId, "youtube");

  // Already terminal (posted or a prior, un-retried failure) -- nothing
  // to do. No automatic retries, per the brief's own constraint.
  if (post.status === "posted" || post.status === "failed") return;

  const item = await getContentItemForPublish(contentItemId);
  const videoUrl = item.asset_urls?.main_video_url;

  if (!videoUrl) {
    const message = "content_items.asset_urls.main_video_url is not set.";
    await updatePlatformPost(post.id, { status: "failed", error_message: message });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "youtube-data-api-v3",
      costUsd: 0,
      status: "fail",
      outputSummary: `YouTube publish failed: ${message}`,
    });
    return;
  }

  try {
    const videoBuffer = await downloadToBuffer(videoUrl);

    const { videoId } = await uploadVideoToYoutube({
      videoBuffer,
      title: item.case_title,
      description: item.platform_variants?.youtube_desc ?? "",
      publishAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
    });

    await updatePlatformPost(post.id, {
      status: "posted",
      platform_post_id: videoId,
      posted_at: new Date().toISOString(),
      error_message: null,
    });

    // Free in dollar terms -- log cost_usd: 0 rather than null so Phase
    // 6's cost model doesn't have to special-case it, per the brief.
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "youtube-data-api-v3",
      costUsd: 0,
      status: "success",
      outputSummary: `Uploaded to YouTube, video id ${videoId}.`,
    });
  } catch (error) {
    const message = (error as Error).message;
    await updatePlatformPost(post.id, { status: "failed", error_message: message });
    await logAgentCall({
      contentItemId,
      agentName: "publish",
      model: "youtube-data-api-v3",
      costUsd: 0,
      status: "fail",
      outputSummary: `YouTube publish failed: ${message}`,
    });
  }
}

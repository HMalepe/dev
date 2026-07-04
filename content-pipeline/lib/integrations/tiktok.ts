import "server-only";

const TIKTOK_BASE = "https://open.tiktokapis.com/v2";

async function tiktokRequest<T>(path: string, accessToken: string, body?: unknown): Promise<T> {
  const response = await fetch(`${TIKTOK_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!response.ok || (json.error && json.error.code !== "ok")) {
    throw new Error(`TikTok API request failed (${path}): ${JSON.stringify(json.error ?? json)}`);
  }
  return json as T;
}

export interface TiktokTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

/** Daily token-refresh cron's core call. TikTok rotates the refresh_token
 * on every use -- the caller must persist the *returned* refresh_token,
 * not reuse the one it was called with (see the note in
 * platformTokens.ts and TikTok's own docs on this). */
export async function refreshTiktokAccessToken(currentRefreshToken: string): Promise<TiktokTokenSet> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET must be set to refresh the TikTok token.");
  }

  const response = await fetch(`${TIKTOK_BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: currentRefreshToken,
    }),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`TikTok token refresh failed: ${JSON.stringify(body.error ?? body)}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresInSeconds: body.expires_in,
  };
}

export interface TiktokCreatorInfo {
  privacyLevelOptions: string[];
  maxVideoPostDurationSec: number;
}

/** Required before every single post per TikTok's own API rules --
 * deliberately never cached across posts, account settings (privacy
 * options, duration caps) can change between calls. */
export async function queryCreatorInfo(accessToken: string): Promise<TiktokCreatorInfo> {
  const body = await tiktokRequest<{
    data: { privacy_level_options: string[]; max_video_post_duration_sec: number };
  }>("/post/publish/creator_info/query/", accessToken);
  return {
    privacyLevelOptions: body.data.privacy_level_options,
    maxVideoPostDurationSec: body.data.max_video_post_duration_sec,
  };
}

/** Initializes a direct post via PULL_FROM_URL -- TikTok downloads the
 * video itself from videoUrl (Supabase Storage's public URL). Requires
 * that URL's domain/prefix to have been verified as a TikTok Developer
 * "URL property" ahead of time (a one-time manual step, see README) --
 * unverified URLs are rejected outright, this isn't optional. Returns a
 * publish_id to poll via fetchPublishStatus. */
export async function initVideoPublish(params: {
  accessToken: string;
  videoUrl: string;
  caption: string;
  privacyLevel: string;
}): Promise<string> {
  const body = await tiktokRequest<{ data: { publish_id: string } }>("/post/publish/video/init/", params.accessToken, {
    post_info: {
      title: params.caption,
      privacy_level: params.privacyLevel,
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: params.videoUrl,
    },
  });
  return body.data.publish_id;
}

export type TiktokPublishStatus =
  | "PROCESSING_DOWNLOAD"
  | "PROCESSING_UPLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

export interface TiktokPublishStatusResult {
  status: TiktokPublishStatus;
  failReason?: string;
}

/** Poll target: PUBLISH_COMPLETE means the direct post actually went
 * live. Rate-limited to 30 requests/minute per access_token per TikTok's
 * own docs -- the scheduler's 15-minute tick interval is nowhere near
 * that ceiling. */
export async function fetchPublishStatus(accessToken: string, publishId: string): Promise<TiktokPublishStatusResult> {
  const body = await tiktokRequest<{ data: { status: TiktokPublishStatus; fail_reason?: string } }>(
    "/post/publish/status/fetch/",
    accessToken,
    { publish_id: publishId }
  );
  return { status: body.data.status, failReason: body.data.fail_reason };
}

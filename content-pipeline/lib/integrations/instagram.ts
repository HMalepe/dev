import "server-only";

/** Meta deprecates Graph API versions on a rolling schedule; keep this
 * bumpable without a code change rather than hardcoding it inline
 * everywhere a URL gets built. */
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function metaRequest<T>(url: URL, method: "GET" | "POST"): Promise<T> {
  const response = await fetch(url.toString(), { method });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`Meta Graph API request failed (${url.pathname}): ${JSON.stringify(body.error ?? body)}`);
  }
  return body as T;
}

/** Step 1 of Meta's Reels publish flow: POST /{ig-user-id}/media with
 * media_type=REELS. video_url must be publicly fetchable -- Meta's
 * servers pull it themselves rather than accepting a direct upload here
 * (Supabase Storage's public bucket URL from Phase 3 satisfies this). */
export async function createReelContainer(params: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/${params.igUserId}/media`);
  url.searchParams.set("media_type", "REELS");
  url.searchParams.set("video_url", params.videoUrl);
  url.searchParams.set("caption", params.caption);
  url.searchParams.set("access_token", params.accessToken);

  const body = await metaRequest<{ id: string }>(url, "POST");
  return body.id;
}

export type InstagramContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

/** Step 2: poll until FINISHED. Never call media_publish before this --
 * video containers need real processing time (typically well under the
 * scheduler's own 15-minute tick interval, but not instant). */
export async function getContainerStatus(containerId: string, accessToken: string): Promise<InstagramContainerStatus> {
  const url = new URL(`${GRAPH_BASE}/${containerId}`);
  url.searchParams.set("fields", "status_code");
  url.searchParams.set("access_token", accessToken);

  const body = await metaRequest<{ status_code: InstagramContainerStatus }>(url, "GET");
  return body.status_code;
}

/** Step 3: publish a FINISHED container. Returns the published media id. */
export async function publishContainer(igUserId: string, containerId: string, accessToken: string): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/${igUserId}/media_publish`);
  url.searchParams.set("creation_id", containerId);
  url.searchParams.set("access_token", accessToken);

  const body = await metaRequest<{ id: string }>(url, "POST");
  return body.id;
}

export interface ExchangedToken {
  accessToken: string;
  expiresInSeconds: number;
}

/** Weekly token-refresh cron's core call -- exchanges the *current*
 * long-lived token for a fresh 60-day one via fb_exchange_token. Requires
 * the app id/secret (not just the token itself), which is why
 * INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET exist as env vars beyond the
 * original Phase 0 list -- see .env.local.example. */
export async function exchangeForLongLivedToken(currentAccessToken: string): Promise<ExchangedToken> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET must be set to refresh the Instagram token.");
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", currentAccessToken);

  const body = await metaRequest<{ access_token: string; expires_in: number }>(url, "GET");
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in };
}

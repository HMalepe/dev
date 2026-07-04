import { refreshTiktokAccessToken } from "@/lib/integrations/tiktok";
import { logAgentCall } from "@/lib/logAgentCall";
import { getPlatformToken, setPlatformToken } from "@/lib/platformTokens";

/**
 * Vercel Cron Job, daily (see vercel.json). TikTok access tokens expire
 * every 24 hours; refresh tokens last 365 days. Runs unconditionally on
 * schedule, well before each 24-hour expiry, per the brief. TikTok
 * rotates the refresh_token on every use -- always persists the
 * *returned* refresh_token, never reuses the one that was passed in (see
 * lib/integrations/tiktok.ts's own note on this).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const current = await getPlatformToken("tiktok");
    if (!current.refresh_token) {
      throw new Error("No TikTok refresh_token stored -- complete the one-time OAuth consent flow first (see README).");
    }

    const { accessToken, refreshToken, expiresInSeconds } = await refreshTiktokAccessToken(current.refresh_token);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await setPlatformToken("tiktok", accessToken, refreshToken, expiresAt);

    await logAgentCall({
      contentItemId: null,
      agentName: "publish",
      model: "tiktok-content-posting-api-v2",
      costUsd: 0,
      status: "success",
      outputSummary: `Refreshed TikTok access token, new expiry ${expiresAt.toISOString()}.`,
    });

    return Response.json({ ok: true, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    const message = (error as Error).message;
    await logAgentCall({
      contentItemId: null,
      agentName: "publish",
      model: "tiktok-content-posting-api-v2",
      costUsd: 0,
      status: "fail",
      outputSummary: `TikTok token refresh failed: ${message}`,
    });
    console.error("refresh-tiktok-token cron failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

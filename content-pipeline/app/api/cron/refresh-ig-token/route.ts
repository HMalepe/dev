import { exchangeForLongLivedToken } from "@/lib/integrations/instagram";
import { logAgentCall } from "@/lib/logAgentCall";
import { getPlatformToken, setPlatformToken } from "@/lib/platformTokens";

/**
 * Vercel Cron Job, weekly (see vercel.json). Exchanges the current
 * long-lived Instagram token for a fresh 60-day one via fb_exchange_token
 * -- well before the 60-day expiry actually hits, per the brief. Runs
 * unconditionally on schedule rather than checking expires_at first: a
 * weekly cadence against a 60-day token has enormous margin regardless.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const current = await getPlatformToken("instagram");
    const { accessToken, expiresInSeconds } = await exchangeForLongLivedToken(current.access_token);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await setPlatformToken("instagram", accessToken, null, expiresAt);

    await logAgentCall({
      contentItemId: null,
      agentName: "publish",
      model: "instagram-graph-api",
      costUsd: 0,
      status: "success",
      outputSummary: `Refreshed Instagram long-lived token, new expiry ${expiresAt.toISOString()}.`,
    });

    return Response.json({ ok: true, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    const message = (error as Error).message;
    await logAgentCall({
      contentItemId: null,
      agentName: "publish",
      model: "instagram-graph-api",
      costUsd: 0,
      status: "fail",
      outputSummary: `Instagram token refresh failed: ${message}`,
    });
    console.error("refresh-ig-token cron failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

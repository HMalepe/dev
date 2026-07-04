import { checkPendingRenders } from "@/lib/agents/pipeline/assets/cron";

// Downloading + re-uploading finished renders can take a while; this needs
// a paid Vercel plan for durations beyond the Hobby tier's 60s cap (see
// README "Deviations"). Submit-then-poll-via-cron still means no single
// render blocks a request/response cycle -- this route only does bounded,
// already-finished-or-not-yet work per content_items row per tick.
export const maxDuration = 300;

/**
 * Vercel Cron Jobs send a GET request (see vercel.json's schedule, every
 * two minutes) with an `Authorization: Bearer $CRON_SECRET` header when
 * CRON_SECRET is set as a project env var. This route is exempted from the
 * Supabase-session auth proxy (see lib/supabase/middleware.ts) since it
 * has no user session -- it enforces its own, stronger check below
 * instead.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await checkPendingRenders();
    return Response.json(summary);
  } catch (error) {
    console.error("check-renders cron failed", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

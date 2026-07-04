import { runWeeklyReview } from "@/lib/agents/pipeline/weeklyReview";

/**
 * Vercel Cron Job, Monday 6am (see vercel.json's schedule). Same auth
 * pattern as app/api/cron/check-renders/route.ts: exempted from the
 * Supabase-session auth proxy (lib/supabase/middleware.ts), enforces its
 * own CRON_SECRET bearer-token check instead.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runWeeklyReview();
    return Response.json(summary);
  } catch (error) {
    console.error("weekly-review cron failed", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

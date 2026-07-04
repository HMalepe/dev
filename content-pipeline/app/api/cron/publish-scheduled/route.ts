import { runPublishScheduler } from "@/lib/agents/pipeline/publish/scheduler";

// Up to 3 platform attempts (video download/upload, container polling)
// per content_item per tick -- same generous ceiling as Phase 3's
// asset-rendering cron, for the same reason (requires a paid Vercel plan
// beyond Hobby's 60s cap).
export const maxDuration = 300;

/**
 * Vercel Cron Job, every 15 minutes (see vercel.json). Same CRON_SECRET
 * bearer-token auth pattern as every other cron route in this codebase --
 * exempted from the Supabase-session auth proxy in
 * lib/supabase/middleware.ts, which already matches any /api/cron/*
 * path.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runPublishScheduler();
    return Response.json(summary);
  } catch (error) {
    console.error("publish-scheduled cron failed", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

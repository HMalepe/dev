import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Companion to the reject endpoint (Phase 4, section 3) — the review queue
 * needs both actions to exist symmetrically, even though this one doesn't
 * generate feedback-loop data itself.
 *
 * Originally set stage = 'scheduled' here (the Phase 4 brief's own
 * fallback: "or whatever the next stage is per your scheduling logic from
 * Phase 5", written before Phase 5 existed). Phase 5's actual publish
 * scheduler (app/api/cron/publish-scheduled) queries
 * `stage = 'assets_generated' AND scheduled_at <= now()` and never looks
 * for stage = 'scheduled' at all -- so the original behavior here would
 * have made every approved item permanently invisible to the publish
 * cron. Corrected post-Phase-5 to set `scheduled_at` instead of advancing
 * `stage`: approving means "publish as soon as it's ready", which for an
 * item already at 'assets_generated' means immediately (next cron tick),
 * and for an item still at 'qa_passed' means as soon as Phase 3's asset
 * pipeline finishes it. `stage = 'scheduled'` is left unused in the
 * content_items.stage enum for now -- if Phase 7's dashboard later wants
 * a distinct "editorially scheduled for a specific future date, but not
 * yet in today's publish window" state, that's a Phase 7 decision to
 * introduce, not one to invent speculatively here.
 *
 * Optional body: { scheduledAt?: string } (ISO timestamp) to schedule for
 * a specific future time instead of immediately; defaults to "now" (i.e.
 * eligible for the very next publish-scheduled cron tick) when omitted or
 * absent, since Phase 4/5 don't define any review-queue UI for picking a
 * date yet (that's Phase 7) and approve must still work standalone.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { scheduledAt?: string } | null;
  const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : new Date();

  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "`scheduledAt`, if provided, must be a valid ISO timestamp." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: existing, error: fetchError } = await supabase
    .from("content_items")
    .select("id, stage")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "content_item not found." }, { status: 404 });
  }

  // Same rationale as the reject endpoint's guard: approving only makes
  // sense once an item has passed automated QA, whether or not assets have
  // been generated yet.
  const approvableStages = ["qa_passed", "assets_generated"];
  if (!approvableStages.includes(existing.stage)) {
    return NextResponse.json(
      {
        error: `content_item is at stage '${existing.stage}' — only items at ${approvableStages.map((s) => `'${s}'`).join(" or ")} (i.e. already passed automated QA) can be approved.`,
      },
      { status: 409 }
    );
  }

  const { data, error: updateError } = await supabase
    .from("content_items")
    .update({ scheduled_at: scheduledAt.toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

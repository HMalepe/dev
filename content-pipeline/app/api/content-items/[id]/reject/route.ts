import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Manual rejection capture (Phase 4, section 3). This is the endpoint the
 * Phase 7 review queue calls when a human rejects content that already
 * passed automated QA. Every rejection here is required to carry a
 * `reason` — a reason-less rejection is silent noise the feedback loop can
 * never act on later, so this is enforced as a hard 400, not a "should".
 *
 * Deliberately does NOT touch qa_result: qa_result must keep reflecting
 * the QA agent's own, untouched verdict so section 5's
 * "qa_pass_rate on first QA agent pass (not counting human overrides)"
 * stays computable after a human override. See lib/getRecentRejections.ts
 * for the corresponding read-side note.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { reason?: string } | null;
  const reason = body?.reason?.trim();

  if (!reason) {
    return NextResponse.json(
      { error: "`reason` is required and cannot be empty — unreasoned rejections aren't usable feedback signal." },
      { status: 400 }
    );
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

  // Guardrail beyond the brief's literal minimum: rejecting only makes
  // sense for something that actually passed automated QA -- that's either
  // 'qa_passed' itself, or 'assets_generated' (Phase 3 only ever generates
  // assets for items that already passed QA, so it's still "something that
  // already passed automated QA" per this endpoint's own description, just
  // further along). Anything else means the review queue is calling this
  // out of order.
  const rejectableStages = ["qa_passed", "assets_generated"];
  if (!rejectableStages.includes(existing.stage)) {
    return NextResponse.json(
      {
        error: `content_item is at stage '${existing.stage}' — only items at ${rejectableStages.map((s) => `'${s}'`).join(" or ")} (i.e. already passed automated QA) can be manually rejected.`,
      },
      { status: 409 }
    );
  }

  const { data, error: updateError } = await supabase
    .from("content_items")
    .update({
      stage: "qa_rejected",
      rejected_by: "human",
      rejection_reason: reason,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

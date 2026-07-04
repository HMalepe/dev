import { NextResponse } from "next/server";
import { runVoiceoverAgent } from "@/lib/agents/pipeline/assets/voiceover";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Companion to the reject endpoint (Phase 4, section 3) — the review queue
 * needs both actions to exist symmetrically.
 *
 * Sequencing history (see Phase 7 brief, section 0, for the authoritative
 * fix this implements): originally set `stage = 'scheduled'` (Phase 4's
 * own written-before-Phase-5 fallback), then corrected post-Phase-5 to
 * set only `scheduled_at` because Phase 5's publish scheduler queries
 * `stage = 'assets_generated'`, not `'scheduled'`. That second version
 * had its own bug, caught by Phase 7: Phase 3's asset pipeline was specced
 * to fire on `stage = 'qa_passed'` -- meaning assets would already be
 * generating automatically the instant QA passed, *before* this endpoint
 * (or any human) ever got a say. A review queue that "approves" scripts
 * after the money's already been spent generating video/audio isn't a
 * review gate at all.
 *
 * Corrected, final sequencing:
 *   qa_passed (script only) --[this endpoint]--> scheduled --[asset
 *   pipeline, retriggered to fire on 'scheduled' -- see
 *   lib/agents/pipeline/assets/cron.ts]--> assets_generated
 *   --[Phase 5's publish-scheduled cron, unchanged]--> published
 *
 * So this endpoint now does two things: (1) sets `scheduled_at` (defaults
 * to "now" if omitted) and `stage = 'scheduled'`, and (2) immediately
 * kicks off the asset pipeline itself (`runVoiceoverAgent`) rather than
 * waiting for a polling cron to notice -- human review happens once, on
 * the cheap artifact (the script), and *then* money gets spent, exactly
 * once, right after approval. A failure here is logged and swallowed
 * (doesn't fail the approve request -- the schedule change itself is a
 * legitimate, already-persisted action) because
 * `lib/agents/pipeline/assets/cron.ts` also has a safety-net branch that
 * retries kicking off asset generation for any `'scheduled'` item that
 * doesn't have a `voiceover_url` yet, in case this direct call fails or
 * the request itself gets interrupted.
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

  // Only 'qa_passed' now -- this is the one and only gate the asset
  // pipeline waits behind, per the corrected sequencing above. An item
  // already at 'scheduled'/'assets_generated' has already been approved
  // once; approving it again would re-trigger asset generation on an item
  // that may already have (or be generating) assets.
  const approvableStages = ["qa_passed"];
  if (!approvableStages.includes(existing.stage)) {
    return NextResponse.json(
      {
        error: `content_item is at stage '${existing.stage}' — only items at 'qa_passed' (i.e. awaiting your review, before any assets are generated) can be approved.`,
      },
      { status: 409 }
    );
  }

  const { data, error: updateError } = await supabase
    .from("content_items")
    .update({ scheduled_at: scheduledAt.toISOString(), stage: "scheduled" })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    await runVoiceoverAgent(id);
  } catch (assetError) {
    // Log-and-continue, same contract as every other internal chain call
    // in this codebase (Research -> Draft -> QA, Voiceover -> Assemble):
    // the approve action itself already succeeded and is already
    // persisted. lib/agents/pipeline/assets/cron.ts's safety-net branch
    // will retry this on its next tick.
    console.error(`approve: failed to kick off asset pipeline for ${id}`, assetError);
  }

  return NextResponse.json(data);
}

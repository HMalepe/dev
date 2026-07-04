import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface PlatformVariantsPatch {
  youtube_desc?: string;
  ig_caption?: string;
  tiktok_caption?: string;
}

interface PatchBody {
  scriptText?: string;
  platformVariants?: PlatformVariantsPatch;
}

/**
 * Phase 7's review queue inline-edit endpoint (section 1: "saved via PATCH
 * before approve/reject, not a separate 'edit mode'"). Partial update --
 * only touches whichever of `scriptText`/`platformVariants` is present in
 * the body, merging `platformVariants` onto the existing jsonb rather than
 * replacing it wholesale (so editing just the YouTube description, say,
 * doesn't blank out the IG caption).
 *
 * Restricted to `stage = 'qa_passed'` -- the only stage the review queue
 * ever shows an item at (see app/dashboard/review). Editing the script
 * after approval would desync it from whatever's already been voiced over
 * and rendered, or already published.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body || (body.scriptText === undefined && body.platformVariants === undefined)) {
    return NextResponse.json(
      { error: "Request body must include at least one of `scriptText` or `platformVariants`." },
      { status: 400 }
    );
  }

  if (body.scriptText !== undefined && !body.scriptText.trim()) {
    return NextResponse.json({ error: "`scriptText` cannot be blank." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: existing, error: fetchError } = await supabase
    .from("content_items")
    .select("id, stage, platform_variants")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "content_item not found." }, { status: 404 });
  }

  if (existing.stage !== "qa_passed") {
    return NextResponse.json(
      {
        error: `content_item is at stage '${existing.stage}' — only items at 'qa_passed' (in the review queue) can be edited.`,
      },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> = {};
  if (body.scriptText !== undefined) {
    update.script_text = body.scriptText;
  }
  if (body.platformVariants !== undefined) {
    update.platform_variants = {
      ...(existing.platform_variants as PlatformVariantsPatch | null),
      ...body.platformVariants,
    };
  }

  const { data, error: updateError } = await supabase
    .from("content_items")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

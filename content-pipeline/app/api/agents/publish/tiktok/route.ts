import { NextResponse } from "next/server";
import { runTiktokPublishAgent } from "@/lib/agents/pipeline/publish/tiktok";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Standalone entry point for manually re-triggering the TikTok publish
 * agent on a single content_item. With TIKTOK_AUDITED=false this is a
 * one-shot call that sets status='ready'; with it =true, one call is one
 * step of the submit-then-poll state machine (submit, or check status). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { contentItemId?: string } | null;
  if (!body?.contentItemId) {
    return NextResponse.json({ error: "Request body must include { contentItemId }." }, { status: 400 });
  }

  try {
    await runTiktokPublishAgent(body.contentItemId);
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("platform_posts")
      .select("*")
      .eq("content_item_id", body.contentItemId)
      .eq("platform", "tiktok")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

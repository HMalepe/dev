import { NextResponse } from "next/server";
import { runInstagramPublishAgent } from "@/lib/agents/pipeline/publish/instagram";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/** Standalone entry point for manually re-triggering the Instagram
 * publish agent on a single content_item -- one call here is one step of
 * its submit-then-poll state machine (submit a container, or check an
 * existing one), same as a single publish-scheduled tick would do. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { contentItemId?: string } | null;
  if (!body?.contentItemId) {
    return NextResponse.json({ error: "Request body must include { contentItemId }." }, { status: 400 });
  }

  try {
    await runInstagramPublishAgent(body.contentItemId);
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("platform_posts")
      .select("*")
      .eq("content_item_id", body.contentItemId)
      .eq("platform", "instagram")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

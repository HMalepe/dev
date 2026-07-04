import { NextResponse } from "next/server";
import { runYoutubePublishAgent } from "@/lib/agents/pipeline/publish/youtube";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Downloading the source video from Supabase Storage and uploading it to
// YouTube can take a while for a longer-form video; matches the
// generous maxDuration precedent set by Phase 3's asset-rendering cron.
export const maxDuration = 300;

/** Standalone entry point for manually re-triggering the YouTube publish
 * agent on a single content_item, mirroring Phase 2/3's route pattern.
 * The normal path is app/api/cron/publish-scheduled, not this route. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { contentItemId?: string } | null;
  if (!body?.contentItemId) {
    return NextResponse.json({ error: "Request body must include { contentItemId }." }, { status: 400 });
  }

  try {
    await runYoutubePublishAgent(body.contentItemId);
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("platform_posts")
      .select("*")
      .eq("content_item_id", body.contentItemId)
      .eq("platform", "youtube")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

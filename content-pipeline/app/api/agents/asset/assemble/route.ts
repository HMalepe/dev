import { createServiceRoleClient } from "@/lib/supabase/server";
import { runAssembleAgent } from "@/lib/agents/pipeline/assets/assemble";

/**
 * Standalone re-trigger for the assemble step (Phase 3 section 6) --
 * useful if voiceover_url already exists (e.g. a prior run got that far)
 * and you want to retry image sourcing / render submission without paying
 * for another ElevenLabs call. Normal end-to-end runs should go through
 * app/api/agents/asset/voiceover, which chains into this automatically.
 */
export async function POST(request: Request) {
  let contentItemId: string;
  try {
    const body = await request.json();
    contentItemId = body.contentItemId;
    if (!contentItemId || typeof contentItemId !== "string") {
      return Response.json({ error: "contentItemId (string) is required." }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    await runAssembleAgent(contentItemId);
  } catch (error) {
    return Response.json({ error: `Assemble agent failed: ${(error as Error).message}` }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("content_items")
    .select("id, stage, asset_urls")
    .eq("id", contentItemId)
    .single();

  if (error) {
    return Response.json({ error: `Failed to fetch updated content_items row: ${error.message}` }, { status: 500 });
  }

  return Response.json(data);
}

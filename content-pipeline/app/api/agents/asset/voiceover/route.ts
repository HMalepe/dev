import { createServiceRoleClient } from "@/lib/supabase/server";
import { runVoiceoverAgent } from "@/lib/agents/pipeline/assets/voiceover";

/**
 * Entry point for the Phase 3 asset pipeline. Expects a content_items row
 * already at stage='qa_passed' with a finished script_text (Phase 2's
 * output). Internally chains voiceover -> assemble, same pattern as Phase
 * 2's research -> draft -> qa. The rest of the pipeline (render polling,
 * vertical cut, thumbnail, asset QA) happens asynchronously via the
 * app/api/cron/check-renders cron job -- this route only kicks things off
 * and returns once the voiceover + initial assembly work is done.
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
    await runVoiceoverAgent(contentItemId);
  } catch (error) {
    return Response.json(
      { error: `Voiceover agent failed: ${(error as Error).message}` },
      { status: 500 }
    );
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

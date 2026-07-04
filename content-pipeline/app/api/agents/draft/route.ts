import { NextResponse } from "next/server";
import { runDraftAgent } from "@/lib/agents/pipeline/draft";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AgentParseError, type ResearchBrief } from "@/lib/agents/pipeline/types";

/**
 * Standalone entry point for re-running the Draft agent on an existing
 * content_item. The case brief isn't persisted anywhere (by design — see
 * the Research agent), so it must be supplied in the request body here.
 * The normal path is the internal chain from the Research agent, not this
 * route.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    contentItemId?: string;
    brief?: ResearchBrief;
  } | null;

  if (!body?.contentItemId || !body?.brief) {
    return NextResponse.json(
      { error: "Request body must include { contentItemId, brief }." },
      { status: 400 }
    );
  }

  try {
    await runDraftAgent(body.contentItemId, body.brief);

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("content_items")
      .select("*")
      .eq("id", body.contentItemId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AgentParseError) {
      return NextResponse.json(
        { error: error.message, raw: error.rawText },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

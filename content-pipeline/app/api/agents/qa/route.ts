import { NextResponse } from "next/server";
import { runQaAgent } from "@/lib/agents/pipeline/qa";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AgentParseError } from "@/lib/agents/pipeline/types";

/**
 * Standalone entry point for re-running QA on an existing content_item
 * (e.g. after a manual script edit). The normal path is the internal chain
 * from the Draft agent, not this route.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { contentItemId?: string } | null;

  if (!body?.contentItemId) {
    return NextResponse.json(
      { error: "Request body must include { contentItemId }." },
      { status: 400 }
    );
  }

  try {
    await runQaAgent(body.contentItemId);

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

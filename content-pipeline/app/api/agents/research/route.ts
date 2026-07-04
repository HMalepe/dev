import { NextResponse } from "next/server";
import { runResearchAgent } from "@/lib/agents/pipeline/research";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AgentParseError } from "@/lib/agents/pipeline/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const seedTopic = typeof body.seedTopic === "string" ? body.seedTopic : undefined;
  const seedRegion = typeof body.seedRegion === "string" ? body.seedRegion : undefined;

  try {
    const { contentItemId } = await runResearchAgent(seedTopic, seedRegion);

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("content_items")
      .select("*")
      .eq("id", contentItemId)
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

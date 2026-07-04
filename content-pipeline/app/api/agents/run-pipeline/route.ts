import { NextResponse } from "next/server";
import { runResearchAgent } from "@/lib/agents/pipeline/research";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AgentParseError } from "@/lib/agents/pipeline/types";

/**
 * The only endpoint the Phase 7 dashboard's "Generate New Case" button
 * needs to call. Triggers Research, which internally chains through Draft
 * and QA, then returns the final content_items row.
 *
 * If the chain stops partway (Draft or QA fails), this still returns 200
 * with the row as it currently stands — its `stage` honestly reflects how
 * far the pipeline got, and the failure itself is recorded in agent_logs.
 * Only a Research-agent failure (nothing to show yet) returns a 500.
 */
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
        {
          error: `${error.message} Pipeline stopped before any content_items row was created.`,
          raw: error.rawText,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

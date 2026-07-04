import { anthropic, MODELS } from "@/lib/anthropic";
import { logAgentCall } from "@/lib/logAgentCall";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runDraftAgent } from "./draft";
import { extractResponseText } from "./extractText";
import { AgentParseError, type ResearchBrief } from "./types";

// Embedded verbatim per the Phase 2 brief. Do not paraphrase — flag any
// wording change back before making it.
const RESEARCH_SYSTEM_PROMPT = `You are a research agent for a South African/African true crime documentary channel. Find one real, publicly documented case (unsolved, cold, or resolved-but-underreported) suitable for a narrated case-study video.

Requirements:
- The case must be sourced from public record: court proceedings, inquest testimony, published news coverage, or official police statements. Never invent or embellish facts.
- Prefer cases with a clear timeline, a documented forensic/investigative detail, and enough public source material to write an accurate 8-10 minute script.
- Check South African legislation: if the case involves a minor victim or witness whose identity is restricted under the 2019/2022 naming-restriction amendments, flag this explicitly — do not include the restricted name anywhere in your output, refer to them by role only (e.g., "the victim," "a witness").
- Cite every source URL you used.

Output valid JSON matching this exact shape, nothing else before or after the JSON:
{
  "case_title": string,
  "case_region": string,
  "source_urls": string[],
  "timeline_summary": string,
  "key_forensic_or_investigative_detail": string,
  "hook_angle": string,
  "compliance_flags": { "minor_restricted": boolean, "notes": string }
}`;

function buildSystemPrompt(seedTopic?: string, seedRegion?: string): string {
  if (seedTopic && seedRegion) {
    return `${RESEARCH_SYSTEM_PROMPT}\n\nFocus your search on: ${seedTopic} in ${seedRegion}.`;
  }
  // Brief only specifies the both-provided case verbatim; these two are a
  // minor, natural extension for the single-field cases, not a rubric change.
  if (seedTopic) {
    return `${RESEARCH_SYSTEM_PROMPT}\n\nFocus your search on: ${seedTopic}.`;
  }
  if (seedRegion) {
    return `${RESEARCH_SYSTEM_PROMPT}\n\nFocus your search on cases in: ${seedRegion}.`;
  }
  return RESEARCH_SYSTEM_PROMPT;
}

export interface RunResearchAgentResult {
  contentItemId: string;
}

export async function runResearchAgent(
  seedTopic?: string,
  seedRegion?: string
): Promise<RunResearchAgentResult> {
  const systemPrompt = buildSystemPrompt(seedTopic, seedRegion);
  const model = MODELS.SONNET;

  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [
        {
          role: "user",
          content:
            "Find one case per the system prompt's requirements and return the JSON object described there.",
        },
      ],
    });
  } catch (error) {
    await logAgentCall({
      contentItemId: null,
      agentName: "research",
      model,
      inputTokens: 0,
      outputTokens: 0,
      status: "fail",
      outputSummary: `Anthropic API call failed: ${(error as Error).message}`,
    });
    throw error;
  }

  const rawText = extractResponseText(response);
  let parsed: ResearchBrief;
  try {
    parsed = JSON.parse(rawText) as ResearchBrief;
  } catch (error) {
    await logAgentCall({
      contentItemId: null,
      agentName: "research",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "fail",
      outputSummary: `Failed to parse research agent JSON output: ${(error as Error).message}`,
    });
    throw new AgentParseError("Research agent returned unparseable JSON.", rawText);
  }

  const supabase = createServiceRoleClient();
  const { data, error: insertError } = await supabase
    .from("content_items")
    .insert({
      case_title: parsed.case_title,
      case_region: parsed.case_region,
      source_urls: parsed.source_urls,
      stage: "researched",
      compliance_flags: parsed.compliance_flags,
    })
    .select("id")
    .single();

  if (insertError || !data) {
    await logAgentCall({
      contentItemId: null,
      agentName: "research",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "fail",
      outputSummary: `Research succeeded but failed to insert content_items row: ${insertError?.message ?? "unknown error"}`,
    });
    throw new Error(`Failed to insert content_items row: ${insertError?.message ?? "unknown error"}`);
  }

  const contentItemId = data.id as string;

  await logAgentCall({
    contentItemId,
    agentName: "research",
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    status: "success",
    outputSummary: `Found case "${parsed.case_title}" (${parsed.case_region}).`,
  });

  // Immediately invoke the Draft agent — internal function call, not a
  // separate HTTP round-trip. If the downstream chain fails, Research's own
  // work still succeeded, so we log-and-continue rather than throw: the row
  // simply stays at its last successful stage ('researched'), which is
  // exactly how a human is meant to notice incomplete processing.
  try {
    await runDraftAgent(contentItemId, {
      case_title: parsed.case_title,
      case_region: parsed.case_region,
      source_urls: parsed.source_urls,
      timeline_summary: parsed.timeline_summary,
      key_forensic_or_investigative_detail: parsed.key_forensic_or_investigative_detail,
      hook_angle: parsed.hook_angle,
      compliance_flags: parsed.compliance_flags,
    });
  } catch (chainError) {
    console.error(
      `Pipeline chain stopped after research for content_item ${contentItemId}:`,
      chainError
    );
  }

  return { contentItemId };
}

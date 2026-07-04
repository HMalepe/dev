import { anthropic, MODELS } from "@/lib/anthropic";
import { getRecentRejectionsContext } from "@/lib/getRecentRejections";
import { logAgentCall } from "@/lib/logAgentCall";
import { RUBRIC_TEXT } from "@/lib/rubric";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { runQaAgent } from "./qa";
import { extractResponseText } from "./extractText";
import { AgentParseError, type DraftOutput, type ResearchBrief } from "./types";

// Embedded verbatim per the Phase 2 brief (with {RUBRIC_TEXT} substituted).
// Do not paraphrase — flag any wording change back before making it.
const DRAFT_SYSTEM_PROMPT = `You are a script-writing agent for a South African/African true crime documentary channel. Write a narration script for the case brief provided, following this exact voice and structure specification:

${RUBRIC_TEXT}

Also generate platform-specific copy:
- YouTube description (150-300 words, includes 2-3 relevant keywords naturally, no clickbait)
- Instagram caption (under 200 words, same tone, ends with a soft CTA)
- TikTok caption (under 150 characters, hook-forward)

Output valid JSON matching this exact shape, nothing else before or after the JSON:
{
  "script_text": string,
  "platform_variants": {
    "youtube_desc": string,
    "ig_caption": string,
    "tiktok_caption": string
  }
}`;

export async function runDraftAgent(contentItemId: string, brief: ResearchBrief): Promise<void> {
  const model = MODELS.SONNET;
  const userMessage = JSON.stringify(brief, null, 2);

  // Phase 4, section 4: rolling "avoid these patterns" context, cached
  // separately from the (even-more-static) rubric/instructions block below
  // since it changes daily-ish rather than "almost never". Note this is
  // wired in lib/agents/pipeline/draft.ts rather than the literal
  // app/api/agents/draft/route.ts path the brief names -- in this codebase
  // the route is a thin wrapper (see that file's own comment) and all
  // actual prompt construction already lived here from Phase 2 onward.
  const rejectionsContext = await getRecentRejectionsContext();

  // Deviation from the brief's exact two-block sample (which caches
  // RUBRIC_TEXT alone as its own block): DRAFT_SYSTEM_PROMPT already
  // embeds RUBRIC_TEXT inline as one static compile-time string, and it
  // never changes independently of the rest of the prompt around it, so
  // caching it as a single block is functionally identical to caching
  // RUBRIC_TEXT separately -- Anthropic's cache breakpoints cache
  // everything up to that point as one unit either way. Splitting it back
  // out into prefix/RUBRIC_TEXT/suffix fragments would add complexity with
  // no caching benefit.
  const systemPrompt: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    { type: "text", text: DRAFT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ...(rejectionsContext
      ? [{ type: "text" as const, text: rejectionsContext, cache_control: { type: "ephemeral" as const } }]
      : []),
  ];

  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (error) {
    await logAgentCall({
      contentItemId,
      agentName: "draft",
      model,
      inputTokens: 0,
      outputTokens: 0,
      status: "fail",
      outputSummary: `Anthropic API call failed: ${(error as Error).message}`,
    });
    throw error;
  }

  // DoD (section 6): don't just assume cache_control did something --
  // response.usage.cache_read_input_tokens > 0 is the actual confirmation
  // that a prior cached block was reused. Surfaced in the success log
  // below so this is checkable from agent_logs without re-running with a
  // debugger attached.
  const cacheReadTokens = response.usage.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = response.usage.cache_creation_input_tokens ?? 0;

  const rawText = extractResponseText(response);
  let parsed: DraftOutput;
  try {
    parsed = JSON.parse(rawText) as DraftOutput;
  } catch (error) {
    await logAgentCall({
      contentItemId,
      agentName: "draft",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: cacheCreationTokens,
      cacheReadInputTokens: cacheReadTokens,
      status: "fail",
      outputSummary: `Failed to parse draft agent JSON output: ${(error as Error).message}`,
    });
    throw new AgentParseError("Draft agent returned unparseable JSON.", rawText);
  }

  const supabase = createServiceRoleClient();
  const { error: updateError } = await supabase
    .from("content_items")
    .update({
      stage: "scripted",
      script_text: parsed.script_text,
      platform_variants: parsed.platform_variants,
    })
    .eq("id", contentItemId);

  if (updateError) {
    await logAgentCall({
      contentItemId,
      agentName: "draft",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: cacheCreationTokens,
      cacheReadInputTokens: cacheReadTokens,
      status: "fail",
      outputSummary: `Draft succeeded but failed to update content_items: ${updateError.message}`,
    });
    throw new Error(`Failed to update content_items row: ${updateError.message}`);
  }

  await logAgentCall({
    contentItemId,
    agentName: "draft",
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheCreationInputTokens: cacheCreationTokens,
    cacheReadInputTokens: cacheReadTokens,
    status: "success",
    outputSummary: `Drafted script (${parsed.script_text.length} chars) + platform variants. Rejections context: ${rejectionsContext ? "included" : "none (no prior rejections)"}. Cache: ${cacheReadTokens} read / ${cacheCreationTokens} written.`,
  });

  // Immediately invoke the QA agent — internal function call. Same
  // log-and-continue rationale as Research -> Draft: Draft's own work
  // already succeeded and is already persisted/logged.
  try {
    await runQaAgent(contentItemId);
  } catch (chainError) {
    console.error(
      `Pipeline chain stopped after draft for content_item ${contentItemId}:`,
      chainError
    );
  }
}

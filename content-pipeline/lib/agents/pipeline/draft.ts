import { anthropic, MODELS } from "@/lib/anthropic";
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

  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: DRAFT_SYSTEM_PROMPT,
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
    status: "success",
    outputSummary: `Drafted script (${parsed.script_text.length} chars) + platform variants.`,
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

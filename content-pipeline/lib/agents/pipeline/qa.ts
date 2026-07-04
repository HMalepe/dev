import { anthropic, MODELS } from "@/lib/anthropic";
import { logAgentCall } from "@/lib/logAgentCall";
import { QA_AXES } from "@/lib/rubric";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractResponseText } from "./extractText";
import { AgentParseError, type QaOutput } from "./types";

function renderAxesList(): string {
  return QA_AXES.map(
    (axis, index) =>
      `${index + 1}. ${axis.name}\n   Pass: ${axis.passCriteria}\n   Fail: ${axis.failCriteria}`
  ).join("\n");
}

// Embedded verbatim per the Phase 2 brief (with {QA_AXES rendered...}
// substituted). Do not paraphrase — flag any wording change back first.
function buildSystemPrompt(): string {
  return `You are a QA agent scoring a true-crime narration script against a fixed rubric. Score each axis 1-5. Any axis scoring 1-2 is an automatic overall FAIL.

Rubric axes:
${renderAxesList()}

Output valid JSON matching this exact shape, nothing else before or after the JSON:
{
  "overall_result": "pass" | "fail",
  "axis_scores": { "<axis_name>": number, ... },
  "failing_axes": [ { "axis": string, "reason": string } ]
}`;
}

export async function runQaAgent(contentItemId: string): Promise<void> {
  // Model: Haiku 4.5 — fixed-rubric discrimination, not open-ended
  // reasoning. Do not swap in Sonnet here; this is a deliberate cost
  // decision from the master plan, not a suggestion.
  const model = MODELS.HAIKU;

  const supabase = createServiceRoleClient();
  const { data: item, error: fetchError } = await supabase
    .from("content_items")
    .select("script_text")
    .eq("id", contentItemId)
    .single();

  if (fetchError || !item?.script_text) {
    await logAgentCall({
      contentItemId,
      agentName: "qa",
      model,
      inputTokens: 0,
      outputTokens: 0,
      status: "fail",
      outputSummary: `Could not load script_text for QA: ${fetchError?.message ?? "script_text is empty"}`,
    });
    throw new Error(`Could not load script_text for content_item ${contentItemId}`);
  }

  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: item.script_text }],
    });
  } catch (error) {
    await logAgentCall({
      contentItemId,
      agentName: "qa",
      model,
      inputTokens: 0,
      outputTokens: 0,
      status: "fail",
      outputSummary: `Anthropic API call failed: ${(error as Error).message}`,
    });
    throw error;
  }

  const rawText = extractResponseText(response);
  let parsed: QaOutput;
  try {
    parsed = JSON.parse(rawText) as QaOutput;
  } catch (error) {
    await logAgentCall({
      contentItemId,
      agentName: "qa",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "fail",
      outputSummary: `Failed to parse QA agent JSON output: ${(error as Error).message}`,
    });
    throw new AgentParseError("QA agent returned unparseable JSON.", rawText);
  }

  const rejectionReason =
    parsed.failing_axes && parsed.failing_axes.length > 0
      ? parsed.failing_axes.map((f) => `${f.axis}: ${f.reason}`).join("; ")
      : null;

  const stage = parsed.overall_result === "pass" ? "qa_passed" : "qa_rejected";

  const { error: updateError } = await supabase
    .from("content_items")
    .update({
      qa_score: parsed.axis_scores,
      qa_result: parsed.overall_result,
      rejection_reason: rejectionReason,
      stage,
    })
    .eq("id", contentItemId);

  if (updateError) {
    await logAgentCall({
      contentItemId,
      agentName: "qa",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "fail",
      outputSummary: `QA scored but failed to update content_items: ${updateError.message}`,
    });
    throw new Error(`Failed to update content_items row: ${updateError.message}`);
  }

  await logAgentCall({
    contentItemId,
    agentName: "qa",
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    status: "success",
    outputSummary: `QA ${parsed.overall_result}. ${rejectionReason ?? "No issues found."}`,
  });
}

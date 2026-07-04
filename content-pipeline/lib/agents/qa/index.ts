import Anthropic from "@anthropic-ai/sdk";
import { QA_AXES, QA_AXIS_IDS, type QaAxisId, scanForBannedPhrases } from "./rubric";
import { QA_SYSTEM_PROMPT, QA_TOOL_NAME, QA_TOOL_SCHEMA } from "./prompt";

export interface QaAxisResult {
  axisId: QaAxisId;
  label: string;
  score: number;
  verdict: "pass" | "fail";
  reason: string;
}

export interface QaResult {
  verdict: "PASS" | "FAIL";
  summary: string;
  axisResults: QaAxisResult[];
  failingAxes: QaAxisId[];
  usage: {
    modelUsed: string;
    inputTokens: number;
    outputTokens: number;
  };
}

const DEFAULT_MODEL = process.env.ANTHROPIC_QA_MODEL || "claude-sonnet-4-5";

function axisVerdict(score: number): "pass" | "fail" {
  return score <= 2 ? "fail" : "pass";
}

/**
 * Runs a script draft through the QA agent described in
 * docs/brand-voice-qa-rubric.md.
 *
 * This function is intentionally standalone: nothing in the app calls it
 * yet. Per the rubric's own instructions, QA does not get wired into the
 * live pipeline until `npm run qa:calibrate` demonstrates the rubric
 * actually discriminates between good and bad scripts.
 */
export async function runQaCheck(scriptText: string): Promise<QaResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.local.example) to run the QA agent."
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2000,
    system: QA_SYSTEM_PROMPT,
    tools: [QA_TOOL_SCHEMA],
    tool_choice: { type: "tool", name: QA_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Evaluate this script draft against the rubric:\n\n---\n${scriptText}\n---`,
      },
    ],
  });

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUseBlock) {
    throw new Error("QA agent did not return a tool_use response; cannot parse a verdict.");
  }

  const input = toolUseBlock.input as {
    axis_scores: { axis_id: string; score: number; reason: string }[];
    summary: string;
  };

  const scoresByAxis = new Map(input.axis_scores.map((entry) => [entry.axis_id, entry]));

  const axisResults: QaAxisResult[] = QA_AXES.map((axis) => {
    const modelEntry = scoresByAxis.get(axis.id);
    if (!modelEntry) {
      throw new Error(`QA agent response is missing a score for axis "${axis.id}".`);
    }
    return {
      axisId: axis.id,
      label: axis.label,
      score: modelEntry.score,
      verdict: axisVerdict(modelEntry.score),
      reason: modelEntry.reason,
    };
  });

  // The banned-phrase axis is decided deterministically, not by the model:
  // exact string matching is a task code does reliably and LLMs sometimes
  // don't (missed matches, or "corrected" paraphrases that no longer match
  // what's actually in the script).
  const bannedMatches = scanForBannedPhrases(scriptText);
  if (bannedMatches.length > 0) {
    const bannedAxisIndex = axisResults.findIndex((r) => r.axisId === "banned_phrase_scan");
    axisResults[bannedAxisIndex] = {
      axisId: "banned_phrase_scan",
      label: "Banned phrase scan",
      score: 1,
      verdict: "fail",
      reason: `Contains banned phrase(s): ${bannedMatches.map((p) => `"${p}"`).join(", ")}.`,
    };
  }

  const failingAxes = axisResults.filter((r) => r.verdict === "fail").map((r) => r.axisId);

  return {
    verdict: failingAxes.length > 0 ? "FAIL" : "PASS",
    summary: input.summary,
    axisResults,
    failingAxes,
    usage: {
      modelUsed: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

export { QA_AXES, QA_AXIS_IDS };
export type { QaAxisId };

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Current per-million-token pricing, hardcoded as of this build.
 *
 * Flag to the user if pricing needs updating later — don't silently guess.
 * Sonnet 5's $2.00/$10.00 rate is an introductory rate through Aug 31, 2026.
 */
const PRICING = {
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
} as const;

export interface LogAgentCallParams {
  /**
   * Null when the Research agent's own API call or JSON parse fails before
   * any content_items row exists yet to attach the log to (agent_logs.
   * content_item_id has no NOT NULL constraint precisely to allow this).
   */
  contentItemId: string | null;
  agentName: "research" | "draft" | "qa" | "asset" | "publish";
  model: string;
  /** Omit for non-token-based APIs (ElevenLabs, Shotstack, Kling, Pexels) —
   * there's nothing meaningful to put here, so the column is left null
   * rather than conflating characters/seconds/requests with "tokens". */
  inputTokens?: number;
  outputTokens?: number;
  /**
   * Pre-computed cost in USD for calls that aren't priced per-token
   * (ElevenLabs is per-character, Shotstack/Kling are per-second/per-
   * render, Pexels is free). When provided, this is used as-is instead of
   * the token-based PRICING lookup below, which only covers Anthropic
   * models.
   */
  costUsd?: number;
  status: "success" | "fail" | "retry";
  outputSummary: string;
}

export async function logAgentCall({
  contentItemId,
  agentName,
  model,
  inputTokens,
  outputTokens,
  costUsd: explicitCostUsd,
  status,
  outputSummary,
}: LogAgentCallParams): Promise<void> {
  const rates = PRICING[model as keyof typeof PRICING];
  const costUsd =
    explicitCostUsd !== undefined
      ? explicitCostUsd
      : rates
        ? ((inputTokens ?? 0) / 1_000_000) * rates.input + ((outputTokens ?? 0) / 1_000_000) * rates.output
        : null;

  const supabase = createServiceRoleClient(); // service role — server-only, bypasses RLS for logging

  const { error } = await supabase.from("agent_logs").insert({
    content_item_id: contentItemId,
    agent_name: agentName,
    model_used: model,
    input_tokens: inputTokens ?? null,
    output_tokens: outputTokens ?? null,
    cost_usd: costUsd,
    status,
    output_summary: outputSummary,
  });

  if (error) {
    // The agent_logs write failing should never crash the agent that
    // triggered it, but it must not be silent either.
    console.error("logAgentCall: failed to write agent_logs row", error, {
      contentItemId,
      agentName,
      status,
    });
  }
}

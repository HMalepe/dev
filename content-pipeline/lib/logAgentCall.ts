import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Current per-million-token pricing, hardcoded as of this build.
 *
 * Flag to the user if pricing needs updating later — don't silently guess.
 * Sonnet 5's $2.00/$10.00 rate is an introductory rate through Aug 31, 2026.
 *
 * cacheRead/cacheWrite cover Anthropic prompt caching (Phase 4's rolling
 * rejection context + rubric caching in the Draft agent, see
 * lib/agents/pipeline/draft.ts). cacheRead for Sonnet 5 ($0.30/M vs the
 * $2.00/M base input rate) is the number given directly in the Phase 4
 * brief. cacheWrite isn't specified there; it's set at the standard
 * Anthropic 5-minute-TTL cache-write multiplier (1.25x base input) and
 * should be corrected if that convention doesn't hold for these models.
 */
const PRICING = {
  "claude-sonnet-5": { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.3 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
} as const;

export interface LogAgentCallParams {
  /**
   * Null when the Research agent's own API call or JSON parse fails before
   * any content_items row exists yet to attach the log to (agent_logs.
   * content_item_id has no NOT NULL constraint precisely to allow this).
   * Also null for the weekly review's clustering call, which isn't tied to
   * any single content_item.
   */
  contentItemId: string | null;
  agentName: "research" | "draft" | "qa" | "asset" | "publish" | "weekly_review";
  model: string;
  /** Omit for non-token-based APIs (ElevenLabs, Shotstack, Kling, Pexels) —
   * there's nothing meaningful to put here, so the column is left null
   * rather than conflating characters/seconds/requests with "tokens". */
  inputTokens?: number;
  outputTokens?: number;
  /**
   * Anthropic prompt-caching token counts from response.usage
   * (cache_creation_input_tokens / cache_read_input_tokens). These are
   * additive with inputTokens/outputTokens, not overlapping with them --
   * Anthropic's `input_tokens` already excludes cached tokens. Only
   * relevant for the Draft agent currently (see draft.ts).
   */
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
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
  cacheCreationInputTokens,
  cacheReadInputTokens,
  costUsd: explicitCostUsd,
  status,
  outputSummary,
}: LogAgentCallParams): Promise<void> {
  const rates = PRICING[model as keyof typeof PRICING];
  const costUsd =
    explicitCostUsd !== undefined
      ? explicitCostUsd
      : rates
        ? ((inputTokens ?? 0) / 1_000_000) * rates.input +
          ((outputTokens ?? 0) / 1_000_000) * rates.output +
          ((cacheCreationInputTokens ?? 0) / 1_000_000) * rates.cacheWrite +
          ((cacheReadInputTokens ?? 0) / 1_000_000) * rates.cacheRead
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

import { anthropic, MODELS } from "@/lib/anthropic";
import { logAgentCall } from "@/lib/logAgentCall";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extractResponseText } from "./extractText";
import type { RejectionTheme, WeeklyReviewSummary } from "./types";

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildClusteringPrompt(reasons: string[]): string {
  return `You are analyzing content rejection reasons from a true-crime content pipeline to find recurring patterns.

Each line below is a rejection reason, prefixed with its source: "[qa_agent]" means an automated rubric check failed (a fixed, mechanical rule); "[human]" means a person rejected content that had already passed automated QA (a taste/judgment call the rubric doesn't capture). These mean different things -- keep qa_agent-driven rubric misses and human taste calls as separate themes whenever they represent genuinely different concerns. Do not merge them just because the wording looks superficially similar.

Group these into 3-5 recurring themes. Every theme must be genuinely distinct from every other theme -- do not split one underlying issue into multiple near-duplicate categories just to hit a higher count. If the data only supports fewer than 3 genuinely distinct themes, return fewer than 3; do not manufacture filler themes to pad the count.

Rejection reasons:
${reasons.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Output valid JSON matching this exact shape, nothing else before or after the JSON:
[
  { "theme": string, "count": number }
]`;
}

async function clusterRejectionThemes(reasons: string[]): Promise<RejectionTheme[]> {
  if (reasons.length === 0) return [];

  const model = MODELS.HAIKU;
  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: buildClusteringPrompt(reasons),
      messages: [{ role: "user", content: "Return the JSON now." }],
    });
  } catch (error) {
    await logAgentCall({
      contentItemId: null,
      agentName: "weekly_review",
      model,
      inputTokens: 0,
      outputTokens: 0,
      status: "fail",
      outputSummary: `Rejection-theme clustering call failed: ${(error as Error).message}`,
    });
    return [];
  }

  const rawText = extractResponseText(response);
  let themes: RejectionTheme[];
  try {
    const parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
    themes = parsed;
  } catch (error) {
    await logAgentCall({
      contentItemId: null,
      agentName: "weekly_review",
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      status: "fail",
      outputSummary: `Failed to parse rejection-theme clustering output: ${(error as Error).message}`,
    });
    return [];
  }

  await logAgentCall({
    contentItemId: null,
    agentName: "weekly_review",
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    status: "success",
    outputSummary: `Clustered ${reasons.length} rejection reasons into ${themes.length} themes.`,
  });

  return themes;
}

/**
 * Phase 4, section 5: weekly QA-effectiveness snapshot. Meant to run via
 * the Monday-6am cron (app/api/cron/weekly-review/route.ts), but is a
 * plain exported function so it can also be called manually/from a script.
 */
export async function runWeeklyReview(): Promise<WeeklyReviewSummary> {
  const weekEnd = new Date();
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const supabase = createServiceRoleClient();

  // "Created/updated in the trailing 7 days" (section 5.1) -- updated_at
  // now actually refreshes on every UPDATE (see the 0002 migration's
  // trigger), and defaults to created_at on INSERT, so a single updated_at
  // range filter captures both "created this week" and "touched this
  // week" without a separate created_at OR clause.
  const { data: items, error } = await supabase
    .from("content_items")
    .select("qa_result, rejected_by, rejection_reason")
    .gte("updated_at", weekStart.toISOString())
    .lt("updated_at", weekEnd.toISOString());

  if (error) {
    throw new Error(`Failed to query content_items for weekly review: ${error.message}`);
  }

  const rows = items ?? [];

  // content_items.stage never actually parks at 'qa_pending' in this
  // codebase's synchronous Draft-then-QA chain (see lib/agents/pipeline/
  // draft.ts -- QA runs immediately in-process, so any 'qa_pending' write
  // would be overwritten by the same function call before it's ever
  // observable). qa_result being non-null is the practical equivalent of
  // "reached at least qa_pending": it's set exactly once, exactly when the
  // QA agent actually scores the item, regardless of pass/fail.
  const itemsProcessed = rows.filter((r) => r.qa_result !== null).length;
  const qaPassed = rows.filter((r) => r.qa_result === "pass");

  const qaPassRate = itemsProcessed > 0 ? round2((100 * qaPassed.length) / itemsProcessed) : 0;

  // "Of items that passed QA, percentage you didn't subsequently reject" --
  // qa_result stays 'pass' after a human override (see
  // app/api/content-items/[id]/reject/route.ts), so this reads rejected_by
  // rather than qa_result to detect the override.
  const humanApprovalRate =
    qaPassed.length > 0
      ? round2((100 * qaPassed.filter((r) => r.rejected_by !== "human").length) / qaPassed.length)
      : 0;

  const { data: priorReview } = await supabase
    .from("weekly_reviews")
    .select("qa_pass_rate")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const priorWeekQaPassRate = priorReview?.qa_pass_rate ?? null;

  // Both qa_agent and human rejection reasons go into the clustering
  // corpus (still tagged by source, per buildClusteringPrompt above) --
  // "don't conflate" (section 7) governs the *rates* above and how themes
  // get grouped, not whether human-sourced text is allowed into the corpus
  // at all.
  const rejectionReasons = rows
    .filter((r): r is typeof r & { rejection_reason: string } => Boolean(r.rejection_reason))
    .map((r) => `[${r.rejected_by ?? "unknown"}] ${r.rejection_reason}`);

  const topRejectionThemes = await clusterRejectionThemes(rejectionReasons);

  const summary: WeeklyReviewSummary = {
    week_start: toDateOnly(weekStart),
    week_end: toDateOnly(weekEnd),
    items_processed: itemsProcessed,
    qa_pass_rate: qaPassRate,
    human_approval_rate: humanApprovalRate,
    prior_week_qa_pass_rate: priorWeekQaPassRate,
    top_rejection_themes: topRejectionThemes,
  };

  const { error: insertError } = await supabase.from("weekly_reviews").insert({
    week_start: summary.week_start,
    week_end: summary.week_end,
    items_processed: summary.items_processed,
    qa_pass_rate: summary.qa_pass_rate,
    human_approval_rate: summary.human_approval_rate,
    prior_week_qa_pass_rate: summary.prior_week_qa_pass_rate,
    top_rejection_themes: summary.top_rejection_themes,
  });

  if (insertError) {
    throw new Error(`Failed to insert weekly_reviews row: ${insertError.message}`);
  }

  return summary;
}

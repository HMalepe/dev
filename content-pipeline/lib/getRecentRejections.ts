import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Builds the "recently rejected, avoid these patterns" block injected into
 * the Draft agent's system prompt (see lib/agents/pipeline/draft.ts).
 *
 * Each line is tagged with its rejection source ([qa_agent] vs [human]) —
 * per the Phase 4 brief, these are never conflated: a qa_agent rejection
 * means the fixed rubric caught something (an agent miss the Draft agent
 * should learn to stop repeating); a human rejection means something
 * passed the rubric but didn't match actual editorial taste (a judgment
 * call the rubric doesn't capture yet). Keeping the label on each line lets
 * the Draft agent (and, in the weekly clustering job, Haiku) tell these
 * apart instead of averaging them into generic advice.
 */
export async function getRecentRejectionsContext(): Promise<string> {
  const supabase = createServiceRoleClient();
  // Deviation from the brief's literal `.eq('qa_result', 'fail')` filter:
  // a human rejection (app/api/content-items/[id]/reject) deliberately does
  // NOT overwrite qa_result — see that route's comment for why. qa_result
  // has to keep reflecting the QA agent's original, untouched verdict, or
  // section 5's "qa_pass_rate on first QA agent pass (not counting human
  // overrides)" becomes uncomputable once a human override has happened.
  // That means a plain `qa_result = 'fail'` filter here would only ever
  // surface qa_agent rejections and silently drop every human rejection,
  // which contradicts this same file's job per section 2 ("both are real
  // signal for the feedback loop"). Matching on rejected_by = 'human' as
  // well restores that signal without touching qa_result's meaning.
  const { data } = await supabase
    .from("content_items")
    .select("case_title, rejection_reason, rejected_by")
    .not("rejection_reason", "is", null)
    .or("qa_result.eq.fail,rejected_by.eq.human")
    .order("updated_at", { ascending: false })
    .limit(15);

  if (!data || data.length === 0) return "";

  const formatted = data
    .map((item, i) => `${i + 1}. [${item.rejected_by}] "${item.case_title}": ${item.rejection_reason}`)
    .join("\n");

  return `Recently rejected drafts and why — avoid repeating these specific patterns:\n${formatted}`;
}

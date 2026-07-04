import { createServiceRoleClient } from "@/lib/supabase/server";
import { runInstagramPublishAgent } from "./instagram";
import { runTiktokPublishAgent } from "./tiktok";
import { runYoutubePublishAgent } from "./youtube";

const TERMINAL_STATUSES = new Set(["posted", "ready", "failed"]);

export interface PublishSchedulerSummary {
  itemsConsidered: number;
  itemsPublished: number;
}

/**
 * Phase 5, section 6: the publish-scheduled cron's core logic, run every
 * 15 minutes. For each content_item at stage='assets_generated' whose
 * scheduled_at has passed, attempts all three platforms independently --
 * a rate limit or failure on one should never block the others, so each
 * agent's own errors are already caught internally (never thrown past
 * this point) and additionally wrapped here as defense-in-depth against a
 * genuinely unexpected crash (e.g. a Supabase outage) in one agent
 * stopping the other two from being attempted this tick.
 */
export async function runPublishScheduler(): Promise<PublishSchedulerSummary> {
  const supabase = createServiceRoleClient();

  const { data: items, error } = await supabase
    .from("content_items")
    .select("id")
    .eq("stage", "assets_generated")
    .lte("scheduled_at", new Date().toISOString());

  if (error) {
    throw new Error(`Failed to query content_items for publish-scheduled: ${error.message}`);
  }

  let itemsPublished = 0;

  for (const item of items ?? []) {
    await Promise.allSettled([
      runYoutubePublishAgent(item.id).catch((err) =>
        console.error(`publish-scheduled: unexpected YouTube agent crash for ${item.id}`, err)
      ),
      runInstagramPublishAgent(item.id).catch((err) =>
        console.error(`publish-scheduled: unexpected Instagram agent crash for ${item.id}`, err)
      ),
      runTiktokPublishAgent(item.id).catch((err) =>
        console.error(`publish-scheduled: unexpected TikTok agent crash for ${item.id}`, err)
      ),
    ]);

    const { data: posts } = await supabase
      .from("platform_posts")
      .select("status")
      .eq("content_item_id", item.id);

    // Only advance stage once every applicable platform (all three, in
    // this single-content-type pipeline) has reached a terminal state --
    // never on just the first one to succeed, and never prematurely just
    // because two of three are done while the third is still
    // 'pending'/'rate_limited'. Those items simply stay at
    // 'assets_generated' and get re-attempted on the next tick.
    const allTerminal = (posts ?? []).length === 3 && (posts ?? []).every((p) => TERMINAL_STATUSES.has(p.status));

    if (allTerminal) {
      const { error: stageError } = await supabase
        .from("content_items")
        .update({ stage: "published" })
        .eq("id", item.id);
      if (!stageError) itemsPublished++;
    }
  }

  return { itemsConsidered: items?.length ?? 0, itemsPublished };
}

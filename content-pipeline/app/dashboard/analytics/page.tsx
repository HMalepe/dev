import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatWeekRangeLabel, resolveWeekStart, formatDateKey } from "@/lib/dateRange";
import { PLATFORM_COLORS, PLATFORM_LABELS, type Platform } from "@/lib/platformCaps";
import { LineChart, BarChart, type LineSeries, type BarDatum } from "./charts";

const AGENT_LABELS: Record<string, string> = {
  research: "Research",
  draft: "Draft",
  qa: "QA",
  asset: "Asset",
  publish: "Publish",
  weekly_review: "Weekly review",
};

const AGENT_COLORS: Record<string, string> = {
  research: "#0ea5e9",
  draft: "#8b5cf6",
  qa: "#f59e0b",
  asset: "#10b981",
  publish: "#ef4444",
  weekly_review: "#6b7280",
};

/**
 * Phase 7, section 3: analytics. Pulls from three tables already
 * populated by earlier phases -- weekly_reviews (Phase 4), agent_logs
 * (every agent since Phase 2), platform_posts (Phase 5). All charts are
 * hand-rolled SVG per section 5's constraint against a charting library
 * dependency.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = resolveWeekStart(week);
  const weekEnd = addDays(weekStart, 7);

  const supabase = await createClient();

  const [weeklyReviewsResult, agentLogsResult, platformPostsResult] = await Promise.all([
    supabase
      .from("weekly_reviews")
      .select("week_start, qa_pass_rate, human_approval_rate")
      .order("week_start", { ascending: true }),
    supabase.from("agent_logs").select("content_item_id, agent_name, cost_usd"),
    supabase
      .from("platform_posts")
      .select("platform, status, created_at")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString()),
  ]);

  const weeklyReviews = weeklyReviewsResult.data ?? [];
  const agentLogs = agentLogsResult.data ?? [];
  const platformPosts = platformPostsResult.data ?? [];

  const weeklyReviewsError = weeklyReviewsResult.error?.message ?? null;
  const agentLogsError = agentLogsResult.error?.message ?? null;
  const platformPostsError = platformPostsResult.error?.message ?? null;

  // -- Cost-per-published-post: sum agent_logs.cost_usd per content_item_id,
  // then average across every content_item that has at least one logged,
  // costed call. Deliberately not restricted to stage='published' items
  // only -- that would silently exclude the real, sunk cost of every
  // rejected/failed attempt along the way, understating the true
  // per-content-item cost this pipeline actually runs at.
  const costByContentItem = new Map<string, number>();
  const costByAgent = new Map<string, number>();
  for (const log of agentLogs) {
    const cost = log.cost_usd ?? 0;
    if (log.content_item_id) {
      costByContentItem.set(log.content_item_id, (costByContentItem.get(log.content_item_id) ?? 0) + cost);
    }
    const agentName = log.agent_name as string;
    costByAgent.set(agentName, (costByAgent.get(agentName) ?? 0) + cost);
  }
  const perItemCosts = Array.from(costByContentItem.values());
  const avgCostPerItem =
    perItemCosts.length > 0 ? perItemCosts.reduce((a, b) => a + b, 0) / perItemCosts.length : null;

  const agentBreakdown: BarDatum[] = Array.from(costByAgent.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([agentName, cost]) => ({
      label: AGENT_LABELS[agentName] ?? agentName,
      value: Number(cost.toFixed(2)),
      color: AGENT_COLORS[agentName] ?? "#71717a",
    }));

  // -- QA pass rate / human approval rate trend
  const qaSeries: LineSeries = {
    label: "QA pass rate",
    color: "#0ea5e9",
    points: weeklyReviews.map((r) => ({ x: r.week_start, y: r.qa_pass_rate })),
  };
  const approvalSeries: LineSeries = {
    label: "Human approval rate",
    color: "#10b981",
    points: weeklyReviews.map((r) => ({ x: r.week_start, y: r.human_approval_rate })),
  };
  const weekLabels = weeklyReviews.map((r) =>
    new Date(`${r.week_start}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  );

  // -- Posts by platform this range, and failures called out separately
  const platforms: Platform[] = ["youtube", "instagram", "tiktok"];
  const postedByPlatform: BarDatum[] = platforms.map((platform) => ({
    label: PLATFORM_LABELS[platform],
    value: platformPosts.filter((p) => p.platform === platform && p.status === "posted").length,
    color: PLATFORM_COLORS[platform].border.includes("red")
      ? "#ef4444"
      : PLATFORM_COLORS[platform].border.includes("pink")
        ? "#ec4899"
        : "#3f3f46",
  }));
  const failedCount = platformPosts.filter((p) => p.status === "failed").length;

  const prevWeekHref = `/dashboard/analytics?week=${formatDateKey(addDays(weekStart, -7))}`;
  const nextWeekHref = `/dashboard/analytics?week=${formatDateKey(addDays(weekStart, 7))}`;
  const todayHref = "/dashboard/analytics";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          QA/approval trends and real agent_logs cost data, plus publishing activity for the selected
          week.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">QA pass rate vs. human approval rate</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          From weekly_reviews. Divergence between the two means the QA rubric and actual human taste
          have drifted apart.
        </p>
        {weeklyReviewsError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Failed to load weekly_reviews: {weeklyReviewsError}
          </p>
        )}
        {weeklyReviews.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No weekly reviews yet -- this fills in once the Phase 4 weekly review cron has run at
            least once.
          </p>
        ) : (
          <div className="mt-4">
            <LineChart series={[qaSeries, approvalSeries]} xLabels={weekLabels} />
            <div className="mt-2 flex gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: qaSeries.color }} />
                QA pass rate
              </span>
              <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: approvalSeries.color }} />
                Human approval rate
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cost per content item</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          From agent_logs: total cost_usd summed per content_item_id, then averaged. This is your
          real, actual cost -- not an estimate.
        </p>
        {agentLogsError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Failed to load agent_logs: {agentLogsError}
          </p>
        )}
        {perItemCosts.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No costed agent_logs rows yet -- run the pipeline on at least one case to populate this.
          </p>
        ) : (
          <>
            <p className="mt-4 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              ${avgCostPerItem!.toFixed(2)}
              <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                average across {perItemCosts.length} content item{perItemCosts.length === 1 ? "" : "s"}
              </span>
            </p>
            <div className="mt-6">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cost breakdown by agent</h3>
              <div className="mt-2">
                <BarChart data={agentBreakdown} />
              </div>
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Posts by platform</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              From platform_posts, {formatWeekRangeLabel(weekStart)}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={prevWeekHref}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              &larr;
            </Link>
            <Link
              href={todayHref}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              This week
            </Link>
            <Link
              href={nextWeekHref}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              &rarr;
            </Link>
          </div>
        </div>

        {platformPostsError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Failed to load platform_posts: {platformPostsError}
          </p>
        )}
        {platformPosts.length === 0 ? (
          <p className="mt-6 rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No publishing activity in this week yet.
          </p>
        ) : (
          <div className="mt-4">
            <BarChart data={postedByPlatform} />
          </div>
        )}

        <div
          className={`mt-4 flex items-center gap-2 rounded-md border p-3 text-sm ${
            failedCount > 0
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
          }`}
        >
          <span className="font-semibold">{failedCount}</span>
          <span>failed publish attempt{failedCount === 1 ? "" : "s"} this week</span>
        </div>
      </section>
    </div>
  );
}

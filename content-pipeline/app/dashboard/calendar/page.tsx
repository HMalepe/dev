import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDateKey, formatWeekRangeLabel, resolveWeekStart } from "@/lib/dateRange";
import { PLATFORM_DAILY_CAPS, PLATFORM_LABELS, PLATFORM_COLORS, type Platform } from "@/lib/platformCaps";
import { PostCard } from "./post-card";

export interface CalendarPost {
  id: string;
  platform: Platform;
  status: "pending" | "ready" | "posted" | "failed" | "rate_limited";
  posted_at: string | null;
  error_message: string | null;
  content_item_id: string;
  case_title: string;
  scheduled_at: string | null;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLATFORMS: Platform[] = ["youtube", "instagram", "tiktok"];

/**
 * Phase 7, section 2: the scheduling calendar. A plain CSS grid, per the
 * brief's own constraint against reaching for a heavy calendar library --
 * seven day columns for the selected week, each showing that day's
 * platform_posts cards plus a rate-limit headroom indicator.
 *
 * Each row's displayed date is `posted_at` if it's already posted,
 * otherwise the parent content_item's `scheduled_at` (still pending) --
 * exactly per the brief. Fetches a generously wide window (60 days back /
 * 30 forward from the visible week) and buckets everything into day
 * columns in memory rather than trying to express an OR-across-a-join
 * filter in supabase-js -- simple, and more than fast enough at this
 * pipeline's single-channel volume.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = resolveWeekStart(week);
  const weekEnd = addDays(weekStart, 7);

  const fetchWindowStart = addDays(weekStart, -60);
  const fetchWindowEnd = addDays(weekStart, 37);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_posts")
    .select(
      "id, platform, status, posted_at, error_message, content_item_id, content_items(case_title, scheduled_at)"
    )
    .gte("created_at", fetchWindowStart.toISOString())
    .lte("created_at", fetchWindowEnd.toISOString());

  const posts: CalendarPost[] = (data ?? [])
    .map((row) => {
      const contentItem = Array.isArray(row.content_items) ? row.content_items[0] : row.content_items;
      return {
        id: row.id as string,
        platform: row.platform as Platform,
        status: row.status as CalendarPost["status"],
        posted_at: row.posted_at as string | null,
        error_message: row.error_message as string | null,
        content_item_id: row.content_item_id as string,
        case_title: contentItem?.case_title ?? "(untitled)",
        scheduled_at: contentItem?.scheduled_at ?? null,
      };
    })
    .filter((post) => {
      const effectiveDate = post.posted_at ?? post.scheduled_at;
      if (!effectiveDate) return false;
      const d = new Date(effectiveDate);
      return d >= weekStart && d < weekEnd;
    });

  const postsByDay = new Map<string, CalendarPost[]>();
  const postedCountByDayAndPlatform = new Map<string, number>();

  for (const post of posts) {
    const effectiveDate = new Date(post.posted_at ?? post.scheduled_at!);
    const dayKey = formatDateKey(effectiveDate);
    postsByDay.set(dayKey, [...(postsByDay.get(dayKey) ?? []), post]);

    if (post.status === "posted" && post.posted_at) {
      const postedDayKey = formatDateKey(new Date(post.posted_at));
      const counterKey = `${postedDayKey}:${post.platform}`;
      postedCountByDayAndPlatform.set(counterKey, (postedCountByDayAndPlatform.get(counterKey) ?? 0) + 1);
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const prevWeekHref = `/dashboard/calendar?week=${formatDateKey(addDays(weekStart, -7))}`;
  const nextWeekHref = `/dashboard/calendar?week=${formatDateKey(addDays(weekStart, 7))}`;
  const todayHref = "/dashboard/calendar";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Scheduling Calendar</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{formatWeekRangeLabel(weekStart)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={prevWeekHref}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            &larr; Previous week
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
            Next week &rarr;
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Failed to load the calendar: {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
        {days.map((day, i) => {
          const dayKey = formatDateKey(day);
          const isToday = dayKey === formatDateKey(new Date());
          const dayPosts = postsByDay.get(dayKey) ?? [];

          return (
            <div
              key={dayKey}
              className={`flex min-h-64 flex-col gap-2 rounded-lg border p-3 ${
                isToday
                  ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-950"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {WEEKDAY_LABELS[i]}
                </span>
                <span className={`text-sm ${isToday ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400"}`}>
                  {day.getDate()}
                </span>
              </div>

              <div className="flex flex-col gap-1 border-b border-zinc-100 pb-2 text-[10px] leading-tight text-zinc-500 dark:border-zinc-900 dark:text-zinc-400">
                {PLATFORMS.map((platform) => {
                  const used = postedCountByDayAndPlatform.get(`${dayKey}:${platform}`) ?? 0;
                  const cap = PLATFORM_DAILY_CAPS[platform];
                  const nearCap = used >= cap;
                  return (
                    <span key={platform} className={nearCap ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                      {PLATFORM_LABELS[platform].slice(0, 2).toUpperCase()}: {used}/{cap} used
                    </span>
                  );
                })}
              </div>

              <div className="flex flex-1 flex-col gap-1.5">
                {dayPosts.length === 0 ? (
                  <span className="text-xs text-zinc-400 dark:text-zinc-600">Nothing scheduled</span>
                ) : (
                  dayPosts.map((post) => <PostCard key={post.id} post={post} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {posts.length === 0 && !error && (
        <div className="rounded-md border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nothing scheduled or posted this week. Approve an item in the review queue to get it onto
          this calendar.
        </div>
      )}

      <div className={`flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400`}>
        {PLATFORMS.map((platform) => (
          <span key={platform} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm border ${PLATFORM_COLORS[platform].bg} ${PLATFORM_COLORS[platform].border}`} />
            {PLATFORM_LABELS[platform]}
          </span>
        ))}
        <span className="ml-4">Solid border = posted &middot; Dashed = ready for manual post &middot; Dotted = rate-limited &middot; Lower opacity = pending &middot; Red ring = failed</span>
      </div>
    </div>
  );
}

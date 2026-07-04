import { createClient } from "@/lib/supabase/server";
import { ReviewCard } from "./review-card";

export interface ReviewQueueItem {
  id: string;
  case_title: string;
  case_region: string | null;
  source_urls: string[] | null;
  script_text: string | null;
  platform_variants: { youtube_desc?: string; ig_caption?: string; tiktok_caption?: string } | null;
  qa_score: Record<string, number> | null;
  created_at: string;
}

/**
 * Phase 7, section 1: the review queue. Server Component -- reads
 * directly via the session-aware Supabase client (RLS grants
 * 'authenticated' full access), same pattern established for every other
 * read in this codebase. Approve/reject/edit are all mutations, handled
 * by the ReviewCard Client Component calling the existing (Phase 4/7)
 * API routes.
 *
 * Ordered oldest-first per the brief ("don't let items sit unreviewed
 * indefinitely without visibility") -- created_at ascending puts whatever
 * has been waiting longest at the top.
 */
export default async function ReviewQueuePage() {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("content_items")
    .select("id, case_title, case_region, source_urls, script_text, platform_variants, qa_score, created_at")
    .eq("stage", "qa_passed")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Review Queue</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Scripts that passed automated QA and are waiting on your review, before any assets are
          generated.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Failed to load the review queue: {error.message}
        </div>
      )}

      {!error && (!items || items.length === 0) && (
        <div className="rounded-md border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nothing waiting on review right now. Generate a new case from the dashboard home to get
          one into this queue.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {(items as ReviewQueueItem[] | null)?.map((item) => <ReviewCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

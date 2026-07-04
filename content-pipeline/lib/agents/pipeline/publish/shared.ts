import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

export type Platform = "youtube" | "instagram" | "tiktok";
export type PlatformPostStatus = "pending" | "ready" | "posted" | "failed" | "rate_limited";

export interface PlatformPostRow {
  id: string;
  content_item_id: string;
  platform: Platform;
  status: PlatformPostStatus;
  platform_post_id: string | null;
  provider_job_id: string | null;
  posted_at: string | null;
  error_message: string | null;
  created_at: string;
}

/** Every publish agent's entry point starts here: find (or create, on the
 * very first attempt) this content_item's row for this platform, so
 * repeated scheduler ticks resume the same row's state machine instead of
 * creating duplicates. */
export async function getOrCreatePlatformPost(contentItemId: string, platform: Platform): Promise<PlatformPostRow> {
  const supabase = createServiceRoleClient();

  const { data: existing } = await supabase
    .from("platform_posts")
    .select("*")
    .eq("content_item_id", contentItemId)
    .eq("platform", platform)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("platform_posts")
    .insert({ content_item_id: contentItemId, platform, status: "pending" })
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to create platform_posts row for ${platform}: ${error?.message}`);
  }
  return created;
}

export async function updatePlatformPost(
  id: string,
  fields: Partial<
    Pick<PlatformPostRow, "status" | "platform_post_id" | "provider_job_id" | "posted_at" | "error_message">
  >
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("platform_posts").update(fields).eq("id", id);
  if (error) {
    throw new Error(`Failed to update platform_posts row ${id}: ${error.message}`);
  }
}

/** Instagram's 25/24hr and TikTok's conservative 15/24hr caps are both a
 * rolling window, not a calendar-day reset -- mirrors the brief's own
 * `posted_at >= now() - 24h` sample exactly, generalized across both
 * platforms rather than duplicated per-file. Only counts already-`posted`
 * rows: an in-flight (`pending`, already-submitted) container/publish job
 * doesn't count against today's quota yet, so it's always safe to keep
 * polling one that's already submitted even if the limit gets hit in the
 * meantime -- the limit only gates *new* submissions. */
export async function isRateLimited(platform: "instagram" | "tiktok", ceiling: number): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("platform_posts")
    .select("*", { count: "exact", head: true })
    .eq("platform", platform)
    .eq("status", "posted")
    .gte("posted_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return (count ?? 0) >= ceiling;
}

export interface ContentItemForPublish {
  case_title: string;
  scheduled_at: string | null;
  platform_variants: { youtube_desc?: string; ig_caption?: string; tiktok_caption?: string } | null;
  asset_urls: { main_video_url?: string; vertical_video_url?: string } | null;
}

export async function getContentItemForPublish(contentItemId: string): Promise<ContentItemForPublish> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("content_items")
    .select("case_title, scheduled_at, platform_variants, asset_urls")
    .eq("id", contentItemId)
    .single();

  if (error || !data) {
    throw new Error(`Could not load content_item ${contentItemId} for publishing: ${error?.message ?? "not found"}`);
  }
  return data;
}

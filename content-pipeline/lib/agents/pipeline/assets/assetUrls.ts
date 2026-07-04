import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AssetUrls } from "./types";

/** Reads the current asset_urls jsonb, merges in `patch`, and writes it
 * back. Centralized so every step (voiceover/assemble/vertical/cron/qa)
 * does a read-modify-write instead of clobbering fields written by a
 * previous step. */
export async function mergeAssetUrls(
  contentItemId: string,
  patch: Partial<AssetUrls>
): Promise<AssetUrls> {
  const supabase = createServiceRoleClient();

  const { data, error: fetchError } = await supabase
    .from("content_items")
    .select("asset_urls")
    .eq("id", contentItemId)
    .single();

  if (fetchError) {
    throw new Error(`mergeAssetUrls: failed to fetch content_items row ${contentItemId}: ${fetchError.message}`);
  }

  const merged: AssetUrls = { ...(data?.asset_urls as AssetUrls | null), ...patch };

  const { error: updateError } = await supabase
    .from("content_items")
    .update({ asset_urls: merged })
    .eq("id", contentItemId);

  if (updateError) {
    throw new Error(`mergeAssetUrls: failed to update content_items row ${contentItemId}: ${updateError.message}`);
  }

  return merged;
}

export async function getAssetUrls(contentItemId: string): Promise<AssetUrls> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("content_items")
    .select("asset_urls")
    .eq("id", contentItemId)
    .single();

  if (error) {
    throw new Error(`getAssetUrls: failed to fetch content_items row ${contentItemId}: ${error.message}`);
  }

  return (data?.asset_urls as AssetUrls | null) ?? {};
}

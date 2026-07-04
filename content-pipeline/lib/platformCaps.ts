import { RATE_LIMIT_CEILING as INSTAGRAM_RATE_LIMIT_CEILING } from "@/lib/agents/pipeline/publish/instagram";
import { RATE_LIMIT_CEILING as TIKTOK_RATE_LIMIT_CEILING } from "@/lib/agents/pipeline/publish/tiktok";

export type Platform = "youtube" | "instagram" | "tiktok";

/**
 * Known daily post caps, for the Phase 7 calendar's rate-limit headroom
 * indicator (section 2). Instagram and TikTok are imported directly from
 * the publish agents that actually enforce them (lib/agents/pipeline/
 * publish/{instagram,tiktok}.ts) so the displayed number can never drift
 * from the real ceiling. YouTube has no enforced check anywhere in this
 * codebase -- Phase 5's brief explicitly said its quota (~100 units/
 * upload against a dedicated 10,000-unit/day bucket, i.e. ~100 uploads/
 * day) "will not bind at any realistic weekly volume, no need to build
 * quota-conservation logic for YouTube specifically" -- so this is a
 * display-only constant, matching Phase 7's own brief text ("YouTube
 * ~100/day"), not backed by any runtime enforcement.
 */
export const PLATFORM_DAILY_CAPS: Record<Platform, number> = {
  youtube: 100,
  instagram: INSTAGRAM_RATE_LIMIT_CEILING,
  tiktok: TIKTOK_RATE_LIMIT_CEILING,
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** Per the brief: "red=YouTube, pink=Instagram, black=TikTok". */
export const PLATFORM_COLORS: Record<Platform, { bg: string; text: string; border: string }> = {
  youtube: { bg: "bg-red-100 dark:bg-red-950", text: "text-red-800 dark:text-red-300", border: "border-red-400 dark:border-red-700" },
  instagram: { bg: "bg-pink-100 dark:bg-pink-950", text: "text-pink-800 dark:text-pink-300", border: "border-pink-400 dark:border-pink-700" },
  tiktok: { bg: "bg-zinc-200 dark:bg-zinc-800", text: "text-zinc-900 dark:text-zinc-100", border: "border-zinc-600 dark:border-zinc-400" },
};

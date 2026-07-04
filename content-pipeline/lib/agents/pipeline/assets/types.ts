export const BEAT_NAMES = [
  "hook",
  "setup",
  "mechanism",
  "unraveling",
  "resolution",
  "cta",
] as const;

export type BeatName = (typeof BEAT_NAMES)[number];

/** Target proportion of total runtime for each beat, derived from the
 * Phase 1 structural template's timestamps (hook 0:00-0:15, setup
 * 0:15-2:00, mechanism 2:00-5:00, unraveling 5:00-8:00, resolution
 * 8:00-end, cta short) scaled against a nominal ~9-minute episode. Used to
 * proportionally split script_text into beats when it isn't already
 * cleanly paragraph-delimited 1:1 with the 6 beats -- see beats.ts for
 * why this is a heuristic, not an exact science. */
export const BEAT_TARGET_PROPORTIONS: Record<BeatName, number> = {
  hook: 0.03,
  setup: 0.19,
  mechanism: 0.28,
  unraveling: 0.28,
  resolution: 0.18,
  cta: 0.04,
};

export interface BeatPlanEntry {
  beat: BeatName;
  text: string;
  startSeconds: number;
  lengthSeconds: number;
  /** Always populated -- the Pexels fallback used if no Kling clip is
   * generated (or Kling is disabled/fails) for this beat. */
  imageUrl: string;
  imageQuery: string;
  /** Set only for the 2-3 "hero" beats when ENABLE_KLING_BROLL=true. */
  klingJobId?: string;
  klingVideoUrl?: string;
  klingStatus?: "pending" | "done" | "failed";
}

export interface AssetUrls {
  // --- Exact shape specified by the Phase 3 brief ---
  voiceover_url?: string;
  shotstack_render_id?: string;
  shotstack_render_status?: "pending" | "done" | "failed";
  main_video_url?: string;
  vertical_render_id?: string;
  vertical_render_status?: "pending" | "done" | "failed";
  vertical_video_url?: string;
  thumbnail_url?: string;
  qa_passed?: boolean;

  // --- Internal bookkeeping additions (asset_urls is unconstrained jsonb;
  // see README "Deviations" for why these exist beyond the specified
  // shape) ---
  /** The per-beat plan built during assembly, needed by the cron job to
   * finish Kling-pending beats and later build the vertical cut +
   * thumbnail without re-deriving everything from scratch. */
  beat_plan?: BeatPlanEntry[];
  /** True once every beat's Kling job (if any) has resolved and the main
   * Shotstack render has actually been submitted. Distinguishes "waiting
   * on Kling before we can submit Shotstack" from "waiting on Shotstack
   * itself" -- both look like shotstack_render_status is unset/pending
   * otherwise. */
  main_render_submitted?: boolean;
  qa_failure_reason?: string;
}

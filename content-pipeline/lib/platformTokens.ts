import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

export type RefreshablePlatform = "instagram" | "tiktok";

export interface PlatformTokenRow {
  platform: RefreshablePlatform;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
}

/** Env var names that seed platform_tokens on first use -- the one-time
 * OAuth consent flow's output (see README) has to land somewhere before
 * the refresh crons take over as the durable source of truth. */
const SEED_ENV_VARS: Record<RefreshablePlatform, { accessToken: string; refreshToken?: string }> = {
  instagram: { accessToken: "INSTAGRAM_ACCESS_TOKEN" },
  tiktok: { accessToken: "TIKTOK_ACCESS_TOKEN", refreshToken: "TIKTOK_REFRESH_TOKEN" },
};

/** Instagram's long-lived tokens run ~60 days; TikTok's access tokens run
 * 24 hours. These are only used to populate expires_at on the very first
 * (seeded) row -- actual refresh cadence is unconditional (weekly for
 * Instagram, daily for TikTok, see the two refresh crons), not gated on
 * this estimate, so it being approximate (we don't know exactly when the
 * seed token was actually issued) doesn't affect correctness. */
const SEED_TTL_MS: Record<RefreshablePlatform, number> = {
  instagram: 60 * 24 * 60 * 60 * 1000,
  tiktok: 24 * 60 * 60 * 1000,
};

/** Reads the current token for a platform, bootstrapping platform_tokens
 * from the seed env vars on first use if no row exists yet. After the
 * first call, the table (kept fresh by the refresh crons) is the sole
 * source of truth -- the env var is never read again once a row exists. */
export async function getPlatformToken(platform: RefreshablePlatform): Promise<PlatformTokenRow> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("platform_tokens").select("*").eq("platform", platform).maybeSingle();
  if (data) return data;

  const seedVars = SEED_ENV_VARS[platform];
  const accessToken = process.env[seedVars.accessToken];
  const refreshToken = seedVars.refreshToken ? process.env[seedVars.refreshToken] : undefined;

  if (!accessToken) {
    throw new Error(
      `No ${platform} token in platform_tokens and no seed value in ${seedVars.accessToken} -- complete the one-time OAuth consent flow first (see README).`
    );
  }

  const seeded: PlatformTokenRow = {
    platform,
    access_token: accessToken,
    refresh_token: refreshToken ?? null,
    expires_at: new Date(Date.now() + SEED_TTL_MS[platform]).toISOString(),
  };

  const { error } = await supabase.from("platform_tokens").upsert(seeded);
  if (error) {
    // Non-fatal -- worst case we re-seed from the env var again next call.
    console.error(`platformTokens: failed to persist seeded ${platform} token`, error);
  }

  return seeded;
}

/** Called by the refresh crons once a new token has actually been
 * obtained. */
export async function setPlatformToken(
  platform: RefreshablePlatform,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("platform_tokens").upsert({
    platform,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt.toISOString(),
  });
  if (error) {
    throw new Error(`Failed to store refreshed ${platform} token: ${error.message}`);
  }
}

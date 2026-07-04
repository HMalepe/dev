import "server-only";

/**
 * Shotstack has two "stages" behind the same base URL: `v1` (production --
 * billed, no watermark) and `stage` (free sandbox -- watermarked, per
 * Shotstack's own docs). This is exactly the mechanism the Phase 3 brief's
 * "no watermarks" QA check leans on: we assert `SHOTSTACK_STAGE=v1` in
 * production rather than trying to detect a watermark visually after the
 * fact (see lib/agents/pipeline/assets/qa.ts).
 */
function shotstackBaseUrl(): string {
  const stage = process.env.SHOTSTACK_STAGE || "v1";
  return `https://api.shotstack.io/edit/${stage}`;
}

function shotstackApiKey(): string {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  if (!apiKey) throw new Error("SHOTSTACK_API_KEY is not set.");
  return apiKey;
}

export interface ShotstackClip {
  asset:
    | { type: "image"; src: string }
    | { type: "video"; src: string; volume?: number }
    | { type: "audio"; src: string; trim?: number; volume?: number }
    | {
        type: "caption";
        src: string;
        font?: Record<string, unknown>;
        background?: Record<string, unknown>;
      };
  start: number;
  length: number;
  effect?: string;
  transition?: { in?: string; out?: string };
  /** Lets other clips reference this one's audio via `alias://<name>` --
   * used for Shotstack's auto-caption transcription. */
  alias?: string;
}

export interface ShotstackTimeline {
  soundtrack?: { src: string; effect?: string };
  background?: string;
  tracks: { clips: ShotstackClip[] }[];
}

export interface ShotstackOutput {
  format: "mp4";
  resolution: "sd" | "hd" | "1080" | "4k";
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5" | "4:3";
}

export interface SubmitRenderResult {
  renderId: string;
}

export async function submitRender(
  timeline: ShotstackTimeline,
  output: ShotstackOutput
): Promise<SubmitRenderResult> {
  const response = await fetch(`${shotstackBaseUrl()}/render`, {
    method: "POST",
    headers: {
      "x-api-key": shotstackApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ timeline, output }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(
      `Shotstack render submission failed (${response.status}): ${JSON.stringify(body)}`
    );
  }

  return { renderId: body.response.id as string };
}

export type ShotstackRenderStatus = "queued" | "fetching" | "rendering" | "saving" | "done" | "failed";

export interface RenderStatusResult {
  status: ShotstackRenderStatus;
  url: string | null;
  durationSeconds: number | null;
  error: string | null;
}

/** $0.30/minute is Shotstack's published pay-as-you-go rate as of this
 * build; subscription plans are cheaper ($0.20/min) -- override via
 * SHOTSTACK_COST_PER_MINUTE_USD to match your actual plan, same rationale
 * as ELEVENLABS_COST_PER_1K_CHARS_USD. */
export function costForRenderDuration(durationSeconds: number): number {
  const costPerMinute = Number(process.env.SHOTSTACK_COST_PER_MINUTE_USD) || 0.3;
  return (durationSeconds / 60) * costPerMinute;
}

export async function getRenderStatus(renderId: string): Promise<RenderStatusResult> {
  const response = await fetch(`${shotstackBaseUrl()}/render/${renderId}`, {
    method: "GET",
    headers: { "x-api-key": shotstackApiKey() },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(
      `Shotstack render status check failed (${response.status}): ${JSON.stringify(body)}`
    );
  }

  const data = body.response;
  return {
    status: data.status as ShotstackRenderStatus,
    url: data.url ?? null,
    durationSeconds: typeof data.duration === "number" ? data.duration : null,
    error: data.error || null,
  };
}

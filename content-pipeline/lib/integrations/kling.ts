import "server-only";

/**
 * "The Kling API" has no single canonical public spec -- Kling (by
 * Kuaishou) is accessed through third-party hosts, and fal.ai is the
 * highest-trust, best-documented one (see README "Deviations" for why this
 * was chosen over a generic/unverifiable endpoint). KLING_API_KEY is used
 * as the fal.ai API key (`Authorization: Key <KLING_API_KEY>`).
 *
 * This integration is gated behind ENABLE_KLING_BROLL (default off) --
 * B-roll clips are explicitly "optional" per the Phase 3 brief, and the
 * pipeline runs fully on Pexels images alone with this disabled.
 */
const FAL_QUEUE_BASE = "https://queue.fal.run";

function klingModelId(): string {
  return process.env.KLING_FAL_MODEL_ID || "fal-ai/kling-video/v3/pro/text-to-video";
}

function falApiKey(): string {
  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) throw new Error("KLING_API_KEY is not set.");
  return apiKey;
}

export function isKlingBrollEnabled(): boolean {
  return process.env.ENABLE_KLING_BROLL === "true" || process.env.ENABLE_KLING_BROLL === "1";
}

export interface SubmitBrollClipResult {
  jobId: string;
  statusUrl: string;
  responseUrl: string;
}

/**
 * Submits a short, non-identifying B-roll clip generation job. `prompt`
 * must describe mood/location/objects only -- never a specific person's
 * likeness (see docs/asset-pipeline-safety.md, enforced by the callers of
 * this function, not by this wrapper itself).
 */
export async function submitBrollClip(
  prompt: string,
  durationSeconds: 5 | 10 = 5
): Promise<SubmitBrollClipResult> {
  const model = klingModelId();
  const response = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      duration: String(durationSeconds),
      aspect_ratio: "16:9",
      generate_audio: false, // narration track already carries all audio
      negative_prompt: "people, faces, identifiable individuals, text, watermark, low quality",
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.request_id) {
    throw new Error(`Kling (fal.ai) job submission failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return {
    jobId: body.request_id as string,
    statusUrl: body.status_url as string,
    responseUrl: body.response_url as string,
  };
}

export type BrollJobStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface BrollJobStatusResult {
  status: BrollJobStatus;
  videoUrl: string | null;
  costUsd: number | null;
  error: string | null;
}

/** $0.112/sec for Kling v3 Pro text-to-video with audio off, per fal.ai's
 * published pricing as of this build -- flag to the user if it changes. */
const KLING_COST_PER_SECOND_USD = 0.112;

export async function getBrollClipStatus(
  jobId: string,
  durationSeconds: number
): Promise<BrollJobStatusResult> {
  const model = klingModelId();
  const statusResponse = await fetch(
    `${FAL_QUEUE_BASE}/${model}/requests/${jobId}/status`,
    { headers: { Authorization: `Key ${falApiKey()}` } }
  );
  const statusBody = await statusResponse.json().catch(() => null);
  if (!statusResponse.ok || !statusBody?.status) {
    throw new Error(
      `Kling (fal.ai) status check failed (${statusResponse.status}): ${JSON.stringify(statusBody)}`
    );
  }

  const status = statusBody.status as BrollJobStatus;
  if (status !== "COMPLETED") {
    return { status, videoUrl: null, costUsd: null, error: statusBody.error ?? null };
  }

  if (statusBody.error) {
    return { status: "FAILED", videoUrl: null, costUsd: null, error: String(statusBody.error) };
  }

  const resultResponse = await fetch(`${FAL_QUEUE_BASE}/${model}/requests/${jobId}`, {
    headers: { Authorization: `Key ${falApiKey()}` },
  });
  const resultBody = await resultResponse.json().catch(() => null);
  const videoUrl = resultBody?.video?.url ?? null;

  if (!resultResponse.ok || !videoUrl) {
    return {
      status: "FAILED",
      videoUrl: null,
      costUsd: null,
      error: `Completed but no video URL in result: ${JSON.stringify(resultBody)}`,
    };
  }

  return {
    status: "COMPLETED",
    videoUrl,
    costUsd: durationSeconds * KLING_COST_PER_SECOND_USD,
    error: null,
  };
}

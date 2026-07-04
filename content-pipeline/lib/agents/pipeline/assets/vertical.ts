import sharp from "sharp";
import { logAgentCall } from "@/lib/logAgentCall";
import { submitRender } from "@/lib/integrations/shotstack";
import { downloadToBuffer, uploadToStorage } from "@/lib/supabase/storage";
import { mergeAssetUrls } from "./assetUrls";
import { buildVerticalTimeline } from "./shotstackTimeline";
import type { BeatPlanEntry, BeatName } from "./types";

const THUMBNAIL_BUCKET = "thumbnails";

/** "The single strongest 30-60 second beat (usually the hook or the
 * mechanism reveal)" -- mechanism is the dramatic reveal, so it's
 * preferred; hook is the fallback if the mechanism beat somehow isn't in
 * the 30-60s range or is missing. */
const VERTICAL_BEAT_PREFERENCE: BeatName[] = ["mechanism", "hook", "unraveling"];

function pickVerticalBeat(beatPlan: BeatPlanEntry[]): BeatPlanEntry {
  for (const beatName of VERTICAL_BEAT_PREFERENCE) {
    const beat = beatPlan.find((b) => b.beat === beatName && b.lengthSeconds >= 15);
    if (beat) return beat;
  }
  return beatPlan[0];
}

/** Called by the cron job once the main video's Shotstack render reaches
 * `done` (Phase 3 section 7: "same route or a sibling route, after main
 * video status is 'done'"). Submits the vertical cut as a second Shotstack
 * render (polled the same way as the main video) and generates the
 * thumbnail synchronously via direct image composition, since the brief
 * says not to overbuild that part with a second Shotstack round-trip. */
export async function generateVerticalAndThumbnail(
  contentItemId: string,
  beatPlan: BeatPlanEntry[],
  voiceoverUrl: string
): Promise<void> {
  const chosenBeat = pickVerticalBeat(beatPlan);
  // Clamp to the 30-60s window the brief requires for the vertical cut.
  const clampedBeat: BeatPlanEntry = {
    ...chosenBeat,
    lengthSeconds: Math.min(60, Math.max(30, chosenBeat.lengthSeconds)),
  };

  const timeline = buildVerticalTimeline(clampedBeat, voiceoverUrl);

  let renderId: string;
  try {
    ({ renderId } = await submitRender(timeline, { format: "mp4", resolution: "1080", aspectRatio: "9:16" }));
  } catch (submitError) {
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "shotstack-render",
      costUsd: 0,
      status: "fail",
      outputSummary: `Shotstack vertical render submission failed: ${(submitError as Error).message}`,
    });
    throw submitError;
  }

  await mergeAssetUrls(contentItemId, {
    vertical_render_id: renderId,
    vertical_render_status: "pending",
  });

  await generateThumbnail(contentItemId, beatPlan);
}

/**
 * Direct image composition (sharp + an SVG text overlay) rather than a
 * third Shotstack render -- per the brief, "don't overbuild this part".
 * sharp is the same image library Next.js itself relies on for
 * next/image, so unlike ffmpeg/ffprobe it's well-supported in Vercel's
 * Node.js serverless runtime (see README "Deviations").
 */
async function generateThumbnail(contentItemId: string, beatPlan: BeatPlanEntry[]): Promise<void> {
  const hookBeat = beatPlan.find((b) => b.beat === "hook") ?? beatPlan[0];
  const hookLine = firstSentence(hookBeat.text) || "A case that shocked a nation.";

  try {
    const baseImageBuffer = await downloadToBuffer(hookBeat.imageUrl);
    const composited = await sharp(baseImageBuffer)
      .resize(1920, 1080, { fit: "cover" })
      .composite([{ input: buildTextOverlaySvg(hookLine), top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toBuffer();

    const publicUrl = await uploadToStorage(THUMBNAIL_BUCKET, `${contentItemId}.jpg`, composited, "image/jpeg");
    await mergeAssetUrls(contentItemId, { thumbnail_url: publicUrl });

    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "sharp-composite",
      costUsd: 0,
      status: "success",
      outputSummary: `Composited thumbnail from hook-beat image + hook line "${hookLine}"`,
    });
  } catch (thumbnailError) {
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "sharp-composite",
      costUsd: 0,
      status: "fail",
      outputSummary: `Thumbnail composition failed: ${(thumbnailError as Error).message}`,
    });
    throw thumbnailError;
  }
}

function firstSentence(text: string): string {
  const match = text.trim().match(/^[^.!?]*[.!?]/);
  return (match ? match[0] : text).trim();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTextOverlaySvg(hookLine: string): Buffer {
  const words = escapeXml(hookLine).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 28) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  const lineHeight = 96;
  const startY = 1080 - 120 - lines.length * lineHeight;
  const textSpans = lines
    .map((line, index) => `<tspan x="80" y="${startY + index * lineHeight}">${line}</tspan>`)
    .join("");

  const svg = `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.85" />
        </linearGradient>
      </defs>
      <rect x="0" y="620" width="1920" height="460" fill="url(#fade)" />
      <text font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="72" fill="#ffffff">
        ${textSpans}
      </text>
    </svg>
  `;
  return Buffer.from(svg);
}

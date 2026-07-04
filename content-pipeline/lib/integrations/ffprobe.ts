import "server-only";

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- ffprobe-static has no type declarations
const ffprobeStatic = require("ffprobe-static") as { path: string };

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

/**
 * Best-effort media probe (works for both audio and video files -- width/
 * height are naturally null for audio-only input). Bundling ffprobe's
 * native binary reliably inside
 * a Vercel serverless Function is genuinely fragile (path resolution and
 * function-size issues are a known, widely-reported problem -- see README
 * "Deviations" for sources). Rather than make the whole asset QA step
 * depend on a binary that might not run in your specific deployment, this
 * is a secondary cross-check: it never throws, returns null on any
 * failure, and QA's primary checks (Shotstack's own render request/status
 * metadata) do not depend on it succeeding.
 */
export async function probeMediaBestEffort(videoBuffer: Buffer): Promise<ProbeResult | null> {
  let tempFilePath: string | null = null;
  try {
    tempFilePath = path.join(os.tmpdir(), `probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    await fs.writeFile(tempFilePath, videoBuffer);

    const { stdout } = await execFileAsync(ffprobeStatic.path, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      tempFilePath,
    ]);

    const parsed = JSON.parse(stdout);
    const stream = parsed.streams?.[0];
    const durationRaw = parsed.format?.duration;

    return {
      width: stream?.width ?? null,
      height: stream?.height ?? null,
      durationSeconds: durationRaw ? Number(durationRaw) : null,
    };
  } catch (error) {
    console.warn(
      "probeMediaBestEffort: ffprobe unavailable or failed, falling back to metadata-only QA checks",
      error
    );
    return null;
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }
  }
}

import "server-only";

import { Readable } from "node:stream";
import { google } from "googleapis";

/** Defensive truncation to YouTube's documented field limits -- case_title
 * and the Draft agent's youtube_desc are both well under these in
 * practice, but a silent 400 on an edge-case long title is worse than a
 * truncated one. */
const TITLE_MAX_CHARS = 100;
const DESCRIPTION_MAX_CHARS = 5000;

function getOAuthClient() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN must all be set -- see README for the one-time OAuth consent flow."
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export interface YoutubeUploadParams {
  videoBuffer: Buffer;
  title: string;
  description: string;
  /** null/undefined => publish immediately (privacyStatus: 'public'). A
   * future timestamp => privacyStatus: 'private' + status.publishAt,
   * which YouTube auto-publishes at that time on its own. A past
   * timestamp is treated the same as immediate (the scheduler in this
   * codebase only ever calls this once scheduled_at <= now() anyway, see
   * app/api/cron/publish-scheduled). */
  publishAt?: Date | null;
}

export interface YoutubeUploadResult {
  videoId: string;
}

/** Wraps `videos.insert` (part=snippet,status). Uses the official
 * `googleapis` client rather than hand-rolled multipart/resumable HTTP,
 * for the same reason `@anthropic-ai/sdk` is used elsewhere in this
 * codebase instead of raw fetch against a hand-verified request shape --
 * resumable upload semantics (chunking, retry-on-interruption) are easy
 * to get subtly wrong by hand and Google maintains this client
 * specifically to encode them correctly. */
export async function uploadVideoToYoutube(params: YoutubeUploadParams): Promise<YoutubeUploadResult> {
  const auth = getOAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const isFutureSchedule = Boolean(params.publishAt && params.publishAt.getTime() > Date.now());

  const status = isFutureSchedule
    ? { privacyStatus: "private" as const, publishAt: params.publishAt!.toISOString() }
    : { privacyStatus: "public" as const };

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: params.title.slice(0, TITLE_MAX_CHARS),
        description: params.description.slice(0, DESCRIPTION_MAX_CHARS),
      },
      status,
    },
    media: {
      mimeType: "video/mp4",
      body: Readable.from(params.videoBuffer),
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error("YouTube videos.insert returned a 2xx response with no video id.");
  }
  return { videoId };
}

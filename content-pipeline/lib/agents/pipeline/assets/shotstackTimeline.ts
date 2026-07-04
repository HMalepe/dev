import type { ShotstackClip, ShotstackTimeline } from "@/lib/integrations/shotstack";
import type { BeatPlanEntry } from "./types";

const ZOOM_EFFECTS = ["zoomIn", "zoomOut"] as const;

/** One clip (or two, if a Kling B-roll clip is shorter than its beat's
 * allotted time and needs a trailing image to fill the remainder) per
 * beat. Kling clips never get a zoom effect (they're already moving
 * footage); static Pexels images always get a Ken Burns pan-zoom, per the
 * brief's "Ken Burns pan-zoom on static images". */
function clipsForBeat(beat: BeatPlanEntry, beatIndex: number, timeOffset: number): ShotstackClip[] {
  const clips: ShotstackClip[] = [];
  const effect = ZOOM_EFFECTS[beatIndex % ZOOM_EFFECTS.length];

  if (beat.klingVideoUrl) {
    // fal.ai/Kling clip durations are fixed at submission time (see
    // lib/integrations/kling.ts) -- 5s by default.
    const klingLength = Math.min(5, beat.lengthSeconds);
    clips.push({
      asset: { type: "video", src: beat.klingVideoUrl, volume: 0 },
      start: timeOffset,
      length: klingLength,
      transition: { in: "fade", out: beat.lengthSeconds > klingLength ? undefined : "fade" },
    });

    if (beat.lengthSeconds > klingLength) {
      clips.push({
        asset: { type: "image", src: beat.imageUrl },
        start: timeOffset + klingLength,
        length: beat.lengthSeconds - klingLength,
        effect,
        transition: { out: "fade" },
      });
    }
    return clips;
  }

  clips.push({
    asset: { type: "image", src: beat.imageUrl },
    start: timeOffset,
    length: beat.lengthSeconds,
    effect,
    transition: { in: "fade", out: "fade" },
  });
  return clips;
}

export function buildMainTimeline(beatPlan: BeatPlanEntry[], voiceoverUrl: string): ShotstackTimeline {
  const clips = beatPlan.flatMap((beat, index) => clipsForBeat(beat, index, beat.startSeconds));

  return {
    soundtrack: { src: voiceoverUrl },
    background: "#000000",
    tracks: [{ clips }],
  };
}

/** Vertical cut timeline for a single beat, re-based to start at t=0 (it's
 * a standalone render, not a slice of the main timeline). Includes an
 * aliased narration audio clip (trimmed to the beat's slice of the full
 * voiceover) plus an auto-generated caption track that references it via
 * Shotstack's `alias://` auto-transcription, satisfying "burned-in
 * captions ... use the voiceover audio's timing to sync". */
export function buildVerticalTimeline(beat: BeatPlanEntry, voiceoverUrl: string): ShotstackTimeline {
  const visualClips = clipsForBeat(beat, 0, 0);

  const narrationAudioClip: ShotstackClip = {
    asset: { type: "audio", src: voiceoverUrl, trim: beat.startSeconds, volume: 1 },
    start: 0,
    length: beat.lengthSeconds,
    alias: "narration",
  };

  const captionClip: ShotstackClip = {
    asset: {
      type: "caption",
      src: "alias://narration",
      font: { family: "Montserrat", color: "#ffffff", size: 32 },
      background: { color: "#000000", opacity: 0.6, padding: 12, borderRadius: 6 },
    },
    start: 0,
    length: beat.lengthSeconds,
  };

  return {
    background: "#000000",
    tracks: [{ clips: [captionClip] }, { clips: visualClips }, { clips: [narrationAudioClip] }],
  };
}

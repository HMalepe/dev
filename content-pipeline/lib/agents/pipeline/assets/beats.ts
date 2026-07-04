import { BEAT_NAMES, BEAT_TARGET_PROPORTIONS, type BeatName } from "./types";

export interface BeatDraft {
  beat: BeatName;
  text: string;
  startSeconds: number;
  lengthSeconds: number;
}

/**
 * Splits script_text into the 6 structural beats from Phase 1.
 *
 * script_text is free-form narration prose with no explicit beat markers
 * (the Draft agent's output schema is a single string, per the Phase 2
 * brief), so recovering beat boundaries is inherently a heuristic -- the
 * Phase 3 brief specifies WHAT to split into, not HOW to split a plain
 * string back into it. This is flagged in the README.
 *
 * Strategy:
 * 1. If the script has exactly 6 blank-line-separated paragraphs (the
 *    natural result of a writer/model following a 6-beat instruction),
 *    map them 1:1 in order -- this is the common case and needs no
 *    guessing.
 * 2. Otherwise, fall back to a proportional split: walk sentence by
 *    sentence, assigning each beat a share of the script proportional to
 *    its target share of runtime (from the Phase 1 template's own
 *    timestamps), so a beat meant to be ~28% of the episode gets ~28% of
 *    the words.
 *
 * Timing (startSeconds/lengthSeconds) is always proportional to
 * `totalDurationSeconds` -- pass the actual voiceover audio duration once
 * known (see assemble.ts) for accurate sync; a word-count-based estimate
 * is used only if that isn't available yet.
 */
export function splitScriptIntoBeats(scriptText: string, totalDurationSeconds: number): BeatDraft[] {
  const paragraphs = scriptText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const beatTexts: string[] =
    paragraphs.length === BEAT_NAMES.length ? paragraphs : proportionalSplit(scriptText);

  let cursor = 0;
  return BEAT_NAMES.map((beat, index) => {
    const lengthSeconds = Math.max(1, Math.round(totalDurationSeconds * BEAT_TARGET_PROPORTIONS[beat]));
    const startSeconds = cursor;
    cursor += lengthSeconds;
    return {
      beat,
      text: beatTexts[index] || "",
      startSeconds,
      lengthSeconds,
    };
  });
}

function proportionalSplit(scriptText: string): string[] {
  const sentences = scriptText
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) || 1;

  const beatTexts: string[] = [];
  let sentenceIndex = 0;

  for (const beat of BEAT_NAMES) {
    const targetWords = totalWords * BEAT_TARGET_PROPORTIONS[beat];
    const beatSentences: string[] = [];
    let beatWords = 0;

    while (
      sentenceIndex < sentences.length &&
      (beatWords < targetWords || beatTexts.length === BEAT_NAMES.length - 1)
    ) {
      // Always leave at least one sentence for every remaining beat.
      const remainingBeats = BEAT_NAMES.length - beatTexts.length - 1;
      const remainingSentences = sentences.length - sentenceIndex;
      if (remainingBeats > 0 && remainingSentences <= remainingBeats) break;

      const sentence = sentences[sentenceIndex];
      beatSentences.push(sentence);
      beatWords += sentence.split(/\s+/).length;
      sentenceIndex++;

      if (beatWords >= targetWords) break;
    }

    beatTexts.push(beatSentences.join(" "));
  }

  // Any leftover sentences (rounding) go to the final beat (cta).
  if (sentenceIndex < sentences.length) {
    beatTexts[beatTexts.length - 1] += " " + sentences.slice(sentenceIndex).join(" ");
  }

  return beatTexts;
}

/** Rough duration estimate from word count, used only until the real
 * voiceover audio duration is known (see lib/integrations/ffprobe.ts). 140
 * words/minute approximates a calm, measured narration pace. */
export function estimateDurationSecondsFromWordCount(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = 140;
  return Math.round((wordCount / wordsPerMinute) * 60);
}

/** Short, generic image-search query for a beat -- thematic only, never a
 * named person, per the Phase 3 hard constraint. */
export function beatImageQuery(beat: BeatName): string {
  const queries: Record<BeatName, string> = {
    hook: "dark empty street night mystery",
    setup: "small town South Africa quiet street",
    mechanism: "forensic evidence bag police investigation",
    unraveling: "police case files documents desk",
    resolution: "courthouse exterior South Africa",
    cta: "film reel documentary studio dark",
  };
  return queries[beat];
}

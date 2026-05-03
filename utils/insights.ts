import type { Recording } from '../types';

// Returns a text label for a confidence score bucket
export function confidenceLabel(score: number): string {
  if (score >= 85) return 'Exceptional';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Moderate';
  if (score >= 40) return 'Developing';
  return 'Needs Work';
}

// Returns a label for a talk ratio
export function talkRatioLabel(ratio: number): string {
  if (ratio > 75) return 'Dominating';
  if (ratio > 65) return 'Heavy';
  if (ratio >= 45) return 'Balanced';
  if (ratio >= 35) return 'Listening';
  return 'Reserved';
}

// Picks the recording with the highest confidence index from a list
export function bestSession(recordings: Recording[]): Recording | undefined {
  return recordings.reduce<Recording | undefined>((best, r) =>
    !best || r.confidenceIndex > best.confidenceIndex ? r : best,
    undefined
  );
}

// Calculates a rolling average of a numeric field across recordings
export function rollingAverage(
  recordings: Recording[],
  field: keyof Pick<Recording, 'confidenceIndex' | 'talkRatio' | 'fillerWordCount' | 'questionsAsked'>
): number {
  if (recordings.length === 0) return 0;
  const sum = recordings.reduce((acc, r) => acc + (r[field] as number), 0);
  return Math.round((sum / recordings.length) * 10) / 10;
}

// Returns true if the value is improving given the trend direction and whether higher is better
export function isImproving(
  direction: 'up' | 'down' | 'flat',
  higherIsBetter: boolean
): boolean {
  return (direction === 'up' && higherIsBetter) ||
         (direction === 'down' && !higherIsBetter);
}

// ─── Insight Tags ────────────────────────────────────────────────────────────

export type InsightTagType = 'emotion' | 'topic' | 'behavior';

export interface InsightTag {
  emoji: string;
  label: string;
  type: InsightTagType;
}

// ─── Energy Arc ──────────────────────────────────────────────────────────────

export interface EnergyPoint {
  position: number; // 0–100 (% through recording)
  level: number;    // 0–100
}

// ─── Tone Breakdown ───────────────────────────────────────────────────────────

export interface ToneSegment {
  emoji: string;
  label: string;
  percentage: number; // 0–100
}

// ─── Key Moment ───────────────────────────────────────────────────────────────

export type MomentType = 'confidence' | 'hesitation' | 'deflection' | 'rapport' | 'insight';

export interface RecordingMoment {
  id: string;
  startTimeSeconds: number;
  type: MomentType;
  title: string;
  description: string;
  quote?: string; // exact words from transcript
}

// ─── Question Analysis ────────────────────────────────────────────────────────

export interface QuestionAnalysis {
  question: string;
  insight: string; // AI interpretation of what the question reveals
}

// ─── Recording ───────────────────────────────────────────────────────────────

export interface Recording {
  id: string;
  timestamp: Date;
  duration: number;         // seconds
  title: string;
  summary: string;          // one-line TL;DR — the "sting"
  tags: InsightTag[];
  talkRatio: number;        // % of time YOU spoke
  keyTopics: string[];
  energyArc: EnergyPoint[];
  wordCount: number;
  questionsAsked: number;
  speakingPace: number;     // words per minute
  fillerWordCount: number;
  repeatedThemes: Array<{ theme: string; count: number }>;
  // ── Detail-screen fields ──
  toneBreakdown: ToneSegment[];
  moments: RecordingMoment[];
  questionsAnalysis: QuestionAnalysis[];
  confidenceIndex: number;       // 0–100 composite score
  confidenceIndexDelta: number;  // vs. user's rolling average
  energyArcLabel: string;        // AI label for the arc shape
  actionItems: string[];         // things you committed to
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export type TranscriptSpeaker = 'YOU' | 'THEM';

export interface TranscriptLine {
  id: string;
  speaker: TranscriptSpeaker;
  startTimeSeconds: number;
  text: string;
  // Indices in text that are filler words (for subtle highlighting)
  fillerRanges?: Array<{ start: number; end: number }>;
  momentId?: string; // links to a RecordingMoment
}

export interface Transcript {
  recordingId: string;
  lines: TranscriptLine[];
}

// ─── Week Stats ───────────────────────────────────────────────────────────────

export interface WeekStats {
  sessionCount: number;
  totalDurationSeconds: number;
  topTopic: string;
  moodSummary: string;
  assertivenessChangePct: number;
  recordedDays: boolean[];
  avgTalkRatio: number;
  avgFillerWordsPerMin: number;
}

// ─── Trend data point (for InsightsOverview) ─────────────────────────────────

export interface TrendPoint {
  label: string; // e.g. "Apr W3"
  value: number;
}

export interface InsightTrend {
  metric: string;
  unit: string;
  points: TrendPoint[];
  changeDirection: 'up' | 'down' | 'flat';
  changeLabel: string; // e.g. "+12% vs last month"
  higherIsBetter: boolean;
}

// ─── Watch ───────────────────────────────────────────────────────────────────

export type WatchConnectionStatus =
  | 'not-paired'
  | 'not-reachable'
  | 'connected'
  | 'recording'
  | 'syncing';

export interface WatchState {
  status: WatchConnectionStatus;
  lastSyncedAt: Date | null;
  recordingDurationSeconds: number;
}

// ─── Pattern Alert ────────────────────────────────────────────────────────────

export interface PatternAlert {
  id: string;
  title: string;
  description: string;
  occurrences: number;
  totalSessions: number;
  severity: 'observation' | 'notable' | 'critical';
}

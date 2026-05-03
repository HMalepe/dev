// Claude API (Anthropic) — used for all insight generation
// Model: claude-sonnet-4-20250514
// Docs: https://docs.anthropic.com/

import type { Recording, TranscriptLine } from '../types';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: 'text'; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const messages: ClaudeMessage[] = [{ role: 'user', content: userMessage }];

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as ClaudeResponse;
  return data.content[0]?.text ?? '';
}

// ─── System prompts ───────────────────────────────────────────────────────────

const INSIGHT_SYSTEM_PROMPT = `You are a world-class executive communication coach and behavioral analyst.
You analyse conversation transcripts and extract precise, actionable insights about the speaker's communication patterns.

Rules:
- Be specific, not generic. Reference exact moments from the transcript.
- The "summary" should be a one-sentence sting — the thing they most need to hear, not just what happened.
- Tone: direct, intelligent, non-judgmental. Like a coach who respects your intelligence.
- Never use corporate jargon or fluffy language.
- JSON only in your response — no markdown, no commentary.`;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GeneratedInsights {
  summary: string;
  talkRatio: number;
  confidenceIndex: number;
  fillerWordCount: number;
  questionsAsked: number;
  speakingPace: number;
  keyTopics: string[];
  toneBreakdown: Array<{ emoji: string; label: string; percentage: number }>;
  repeatedThemes: Array<{ theme: string; count: number }>;
  moments: Array<{
    startTimeSeconds: number;
    type: string;
    title: string;
    description: string;
    quote?: string;
  }>;
  questionsAnalysis: Array<{ question: string; insight: string }>;
  actionItems: string[];
  energyArcLabel: string;
}

export async function generateInsights(
  apiKey: string,
  transcript: TranscriptLine[]
): Promise<GeneratedInsights> {
  const transcriptText = transcript
    .map((l) => `[${l.speaker} ${Math.floor(l.startTimeSeconds / 60)}:${String(l.startTimeSeconds % 60).padStart(2, '0')}] ${l.text}`)
    .join('\n');

  const userMessage = `Analyse this conversation transcript and return a JSON object matching the GeneratedInsights interface.

TRANSCRIPT:
${transcriptText}

Return only valid JSON. No markdown fences.`;

  const raw = await callClaude(apiKey, INSIGHT_SYSTEM_PROMPT, userMessage);

  try {
    return JSON.parse(raw) as GeneratedInsights;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}

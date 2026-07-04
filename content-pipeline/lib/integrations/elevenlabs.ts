import "server-only";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

/**
 * ElevenLabs bills per character, not per token, and the rate depends on
 * which plan tier you're on (see README "ElevenLabs cost tracking"). There
 * is no single universal rate the way there is for Anthropic's token
 * pricing, so this is configurable rather than hardcoded -- set
 * ELEVENLABS_COST_PER_1K_CHARS_USD to match your actual plan.
 *
 * Default of $0.10/1k chars approximates a typical Multilingual v2
 * pay-as-you-go rate as of this build -- treat it as a placeholder, not a
 * verified number, until you set the env var to your real rate.
 */
const DEFAULT_COST_PER_1K_CHARS_USD = 0.1;

export interface TextToSpeechResult {
  audioBuffer: Buffer;
  characterCount: number;
  costUsd: number;
  model: string;
}

/**
 * Calm/measured voice preset per the Phase 1 tone rubric: low stability
 * variance (steady, not "emotional"), no style exaggeration, no
 * speaker-boost theatrics. These are ElevenLabs voice_settings, applied on
 * top of whichever voice (ELEVENLABS_VOICE_ID) you've picked -- the voice
 * itself still needs to be a calm-toned one; these settings tune delivery,
 * they don't change the voice's inherent character.
 */
const CALM_MEASURED_VOICE_SETTINGS = {
  stability: 0.75,
  similarity_boost: 0.75,
  style: 0.15,
  speed: 0.95,
  use_speaker_boost: false,
};

export async function textToSpeech(text: string): Promise<TextToSpeechResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set.");
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set.");

  const model = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: CALM_MEASURED_VOICE_SETTINGS,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`ElevenLabs TTS request failed (${response.status}): ${errorBody}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const characterCount = text.length;
  const costPer1k = Number(process.env.ELEVENLABS_COST_PER_1K_CHARS_USD) || DEFAULT_COST_PER_1K_CHARS_USD;
  const costUsd = (characterCount / 1000) * costPer1k;

  return {
    audioBuffer: Buffer.from(arrayBuffer),
    characterCount,
    costUsd,
    model,
  };
}

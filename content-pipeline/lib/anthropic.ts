import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODELS = {
  SONNET: "claude-sonnet-5",
  HAIKU: "claude-haiku-4-5-20251001",
} as const;

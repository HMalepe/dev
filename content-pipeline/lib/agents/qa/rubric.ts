/**
 * Structured form of docs/brand-voice-qa-rubric.md (section 6 + the banned
 * phrase list from section 4). Keep this in sync with that document — it is
 * the source of truth; this file is its machine-readable projection.
 */

export const QA_AXIS_IDS = [
  "persona_compliance",
  "instructional_content_check",
  "sourcing_accuracy",
  "sa_legal_compliance",
  "tone_match",
  "structure_adherence",
  "banned_phrase_scan",
] as const;

export type QaAxisId = (typeof QA_AXIS_IDS)[number];

export interface QaAxisDefinition {
  id: QaAxisId;
  label: string;
  passDescription: string;
  failDescription: string;
}

export const QA_AXES: readonly QaAxisDefinition[] = [
  {
    id: "persona_compliance",
    label: "Persona compliance",
    passDescription: "Zero identifying details, credential-only framing intact.",
    failDescription: "Any real-name/employer/location leak, or the narrator claims a personal/professional credential.",
  },
  {
    id: "instructional_content_check",
    label: "Instructional-content check",
    passDescription: "Purely retrospective/documentary.",
    failDescription: "Any actionable \"how-to\" framing, including specific dosages/quantities presented as actionable.",
  },
  {
    id: "sourcing_accuracy",
    label: "Sourcing accuracy",
    passDescription: "Every material claim traceable to a cited public record/report.",
    failDescription: "Uncited claims, vague hand-waving, factually wrong statements, or unsupported speculation about guilt in an ongoing/unresolved case.",
  },
  {
    id: "sa_legal_compliance",
    label: "SA legal compliance",
    passDescription: "No naming of restricted minors/victims/witnesses.",
    failDescription: "Any identifying detail on a legally restricted individual under SA publication-restriction legislation.",
  },
  {
    id: "tone_match",
    label: "Tone match",
    passDescription: "Calm, detached, matter-of-fact.",
    failDescription: "Sensationalized, exclamatory, clickbait tone.",
  },
  {
    id: "structure_adherence",
    label: "Structure adherence",
    passDescription: "Hits all 6 beats in order (hook, setup, mechanism, unraveling, resolution/status, CTA).",
    failDescription: "Skips the mechanism section or buries it, or otherwise omits/misorders a required beat.",
  },
  {
    id: "banned_phrase_scan",
    label: "Banned phrase scan",
    passDescription: "Clean.",
    failDescription: "Contains any banned phrase (see BANNED_PHRASES) or FTC-flavored guarantee language.",
  },
];

/**
 * Exact/near-exact banned phrases from section 4. Matched case-insensitively
 * as a deterministic pre-check — the QA agent's LLM judgment can be
 * inconsistent about verbatim string matches, so this axis is decided by
 * code, not by the model (see lib/agents/qa/index.ts).
 */
export const BANNED_PHRASES: readonly string[] = [
  "you won't believe",
  "you wont believe",
  "what happened next will shock you",
  "guaranteed",
  "100% proven",
  "proven to",
];

export function scanForBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase.toLowerCase()));
}

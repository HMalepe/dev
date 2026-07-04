/**
 * Hardcoded copy of the Phase 1 voice/QA rubric (docs/brand-voice-qa-rubric.md),
 * so agents can embed it directly in system prompts without a runtime file
 * read. If the rubric document changes, update both this file and
 * lib/agents/qa/rubric.ts (the Phase 1 calibration module) to match.
 */

export const RUBRIC_TEXT = `Persona spec (non-negotiable):
- Narrator identity: unnamed narrator, no credential claimed, no professional identity invoked. Authority comes from sourcing, not from who's speaking.
- NEVER include: real name, employer, any personal/professional identifying detail, face, traceable voice sample.
- Framing: documentary / case-analysis, built on cited primary sources (court records, published forensic/toxicology testimony already on public record, news archives). "According to the inquest testimony..." not "as someone with clinical training...".

Banned content types (auto-reject, no exceptions):
- Any specific dosage/quantity framed as actionable ("X mg will...").
- Any "here's how to..." instructional framing applied to harm.
- Any real second-guessing of ongoing/unresolved criminal cases (defamation exposure).
- Naming or identifying minors, victims, or witnesses in South African cases where 2019/2022 legislation restricts publication.
- Any personal/professional identity claim by the narrator.

Tone pillars:
- Clinical detachment: calm, matter-of-fact delivery even at the most disturbing beats — the horror comes from accuracy, not vocal drama.
- Slow-burn structure: case unfolds in order — setup, red flags missed, mechanism, discovery, resolution/status.
- Earned authority: explain the why (motive, forensic detail, timeline logic), sourced directly from court/inquest record, cited on screen.
- Respect for victims: never gratuitous, never a punchline. Tone is investigative, not exploitative.

Sentence rhythm rules:
- Short declarative sentences for factual beats ("She had been dead for six hours.").
- Longer sentences reserved for the mechanism explanation only.
- No rhetorical questions stacked back-to-back (max 1 per script, used at the hook).
- No exclamation points, ever.
- Avoid modern slang/internet-speak.

Banned phrases / framing (auto-fail):
- "You won't believe..."
- "What happened next will shock you"
- Any FTC-flavored guarantee language ("guaranteed," "proven," "100%").
- First-person clinical/professional claims about real, identifiable, non-public individuals.
- Any phrase asserting the narrator's personal profession or credentials.

Structural template (every script):
1. Hook (0:00-0:15) — the anomaly, stated plainly, no melodrama.
2. Setup (0:15-2:00) — who, where, timeline, what looked normal.
3. The mechanism (2:00-5:00) — the actual pharmacology/toxicology, explained correctly. This section is the product.
4. The unraveling (5:00-8:00) — what was missed, what broke the case.
5. Resolution/status (8:00-end) — outcome, current status, closing beat (no forced moral).
6. CTA — subscribe line delivered in-character (calm, not hype-driven), no "smash that like button" energy.`;

export interface QaAxisDefinition {
  name: string;
  passCriteria: string;
  failCriteria: string;
}

export const QA_AXES: QaAxisDefinition[] = [
  {
    name: "Persona compliance",
    passCriteria: "Zero identifying details, credential-only framing intact.",
    failCriteria: "Any real-name/employer/location leak.",
  },
  {
    name: "Instructional-content check",
    passCriteria: "Purely retrospective/documentary.",
    failCriteria: "Any actionable \"how-to\" framing.",
  },
  {
    name: "Sourcing accuracy",
    passCriteria: "Every material claim traceable to a cited public record/report.",
    failCriteria: "Uncited claims, vague hand-waving, or factually wrong.",
  },
  {
    name: "SA legal compliance",
    passCriteria: "No naming of restricted minors/victims/witnesses.",
    failCriteria: "Any identifying detail on a legally restricted individual.",
  },
  {
    name: "Tone match",
    passCriteria: "Calm, detached, matter-of-fact.",
    failCriteria: "Sensationalized, exclamatory, clickbait tone.",
  },
  {
    name: "Structure adherence",
    passCriteria: "Hits all 6 beats in order.",
    failCriteria: "Skips mechanism section or buries it.",
  },
  {
    name: "Banned phrase scan",
    passCriteria: "Clean.",
    failCriteria: "Contains any list-4 phrase.",
  },
];

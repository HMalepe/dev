# Phase 1 — Brand Voice & QA Rubric

**Channel:** South African / African True Crime & Unsolved Mysteries — Faceless AI-Narrated

This is the source-of-truth spec for the channel's persona, tone, and QA
scoring rubric. It feeds every downstream prompt (draft agent, QA agent) and
is implemented in code at `lib/agents/qa/rubric.ts` and
`lib/agents/qa/prompt.ts`. If you change this document, update those files
to match, and re-run the calibration harness (`npm run qa:calibrate`)
before trusting the QA agent again.

## 1. Persona Spec (non-negotiable, feeds every prompt downstream)

- **Narrator identity:** unnamed narrator, no credential claimed, no
  professional identity invoked. Authority comes from sourcing, not from
  who's speaking.
- **NEVER include:** real name, employer, any personal/professional
  identifying detail, face, traceable voice sample.
- **Framing:** documentary / case-analysis, built on cited primary sources
  (court records, published forensic/toxicology testimony already on public
  record, news archives) — this replaces personal-credential authority as
  the differentiator. "According to the inquest testimony…" not "as someone
  with clinical training…"
- **Differentiator:**
  1. South African/African case focus — thin competitive field vs.
     oversaturated US/UK true crime.
  2. Full AI-narrated/animated faceless production — no existing SA
     true-crime creator is running this format at volume yet.

### BANNED content types (auto-reject in QA, no exceptions)

- Any specific dosage/quantity framed as actionable ("X mg will…")
- Any "here's how to…" instructional framing applied to harm
- Any real second-guessing of ongoing/unresolved criminal cases
  (defamation exposure)
- Naming or identifying minors, victims, or witnesses in South African
  cases where 2019/2022 legislation restricts publication — **verify
  case-by-case before scripting, this is a hard legal line specific to SA
  cases, not a style call**
- Any personal/professional identity claim by the narrator

## 2. Tone Pillars

| Pillar | Description | Reference |
| --- | --- | --- |
| Clinical detachment | Calm, matter-of-fact delivery even at the most disturbing beats — the horror comes from accuracy, not vocal drama | Lazy Masquerade's flat, unsettling narration style |
| Slow-burn structure | Case unfolds in order: setup → red flags missed → mechanism → discovery → resolution/status | Dark5's cinematic pacing |
| Earned authority | Explain the why — motive, forensic detail, timeline logic — sourced directly from court/inquest record, cited on screen | Dark5's declassified-document sourcing style |
| Respect for victims | Never gratuitous, never a punchline. Tone is investigative, not exploitative | True-crime editorial best practice |

## 3. Sentence Rhythm Rules

- Short declarative sentences for factual beats ("She had been dead for six
  hours.")
- Longer sentences reserved for the mechanism explanation — this is the one
  place complexity is earned.
- No rhetorical questions stacked back-to-back (max 1 per script, used at
  the hook).
- No exclamation points, ever.
- Avoid modern slang/internet-speak — breaks the clinical-authority
  illusion.

## 4. Banned Phrases / Framing (auto-fail list)

- "You won't believe…"
- "What happened next will shock you"
- Any FTC-flavored guarantee language ("guaranteed," "proven," "100%") —
  not applicable to affiliate content here but keep the discipline.
- First-person clinical/professional claims about real, identifiable,
  non-public individuals.
- Any phrase asserting the narrator's personal profession or credentials.

## 5. Structural Template (every script)

1. **Hook** (0:00–0:15) — the anomaly, stated plainly, no melodrama.
2. **Setup** (0:15–2:00) — who, where, timeline, what looked normal.
3. **The mechanism** (2:00–5:00) — the actual pharmacology/toxicology,
   explained correctly. This section is the product.
4. **The unraveling** (5:00–8:00) — what was missed, what broke the case.
5. **Resolution/status** (8:00–end) — outcome, current status, closing beat
   (no forced moral).
6. **CTA** — subscribe line delivered in-character (calm, not hype-driven),
   no "smash that like button" energy.

## 6. QA Agent Scoring Rubric (pass/fail + reason)

Score each draft 1–5 on each axis. **Any axis scoring 1–2 = automatic
reject.**

| Axis | 5 (pass) | 1 (fail) |
| --- | --- | --- |
| Persona compliance | Zero identifying details, credential-only framing intact | Any real-name/employer/location leak |
| Instructional-content check | Purely retrospective/documentary | Any actionable "how-to" framing |
| Sourcing accuracy | Every material claim traceable to a cited public record/report | Uncited claims, vague hand-waving, or factually wrong |
| SA legal compliance | No naming of restricted minors/victims/witnesses | Any identifying detail on a legally restricted individual |
| Tone match | Calm, detached, matter-of-fact | Sensationalized, exclamatory, clickbait tone |
| Structure adherence | Hits all 6 beats in order | Skips mechanism section or buries it |
| Banned phrase scan | Clean | Contains any list-5 phrase |

The QA agent prompt returns **PASS / FAIL + specific axis + one-sentence
reason**. No silent rejections — every fail needs a reason a draft agent
can act on.

## 7. Next Step to Close Out Phase 1

Pull 10 scripts you'd call genuinely good (can be your own drafts or
heavily-annotated competitor scripts you admire the structure of, not
content to copy) and 10 you'd reject, run them through the QA prompt above,
confirm the rubric actually discriminates. **Until that test passes, don't
wire QA into the live pipeline** — a rubber-stamp QA agent is worse than no
QA agent.

### How this repo implements that step

- `qa-calibration/good/*.txt` and `qa-calibration/bad/*.txt` — 10 + 10
  short, entirely fictional calibration scripts (fictional cases, fictional
  names — calibration fixtures should never touch real, potentially legally
  restricted individuals). `qa-calibration/manifest.json` records the
  expected verdict for each, and, for the "bad" set, the one axis each
  fixture is designed to fail on.
- `npm run qa:calibrate` runs every fixture through the real QA agent
  (`lib/agents/qa`, backed by the Claude API — requires `ANTHROPIC_API_KEY`)
  and reports whether the rubric's verdicts match the manifest's
  expectations.
- The QA agent code in `lib/agents/qa/` is a standalone module. It is
  **not called from any route or Server Action yet** — per this document's
  own instruction, it stays disconnected from the live pipeline until the
  calibration run above passes.

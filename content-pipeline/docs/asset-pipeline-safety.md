# Asset pipeline safety constraint (Phase 3)

Transcribed from the Phase 3 brief's hard constraint (section 2) so the
rule is easy to find from code comments without re-reading the PDF.

## The rule

**Never generate a photorealistic AI depiction of a real, identifiable
individual connected to any case** -- no AI-generated "face" of a real
victim, suspect, or witness, no matter how the case brief describes them.
This applies to every image/video generation step in the asset pipeline
(Pexels sourcing queries, Kling B-roll prompts, thumbnail composition).

This isn't a style preference. Fabricating a photorealistic likeness of a
real person in the context of a criminal accusation is a real legal/ethical
exposure (defamation, right-of-publicity), independent of how accurate the
surrounding facts are.

## Practical rule for every visual asset

- **People:** never generate their likeness. Use silhouettes, blurred/
  obscured figures, generic stock imagery of unnamed people, or simply
  don't depict them -- narrate over B-roll instead (locations, documents,
  objects, hands, generic crowd/city shots).
- **Everything else** (locations, weather, objects, document mockups,
  generic mood shots): fair game for AI generation or stock imagery.
- A legitimately licensed real archival press photo is a different,
  editorial-judgment decision from generating a fake one -- sourcing real
  archival photos is out of scope for this automated pipeline. Default to
  generic/non-identifying imagery only.

## How this build enforces it

- `lib/agents/pipeline/assets/beats.ts` (`beatImageQuery`) -- Pexels
  queries are theme/location/object phrases only, never a case's
  named individuals.
- `lib/agents/pipeline/assets/assemble.ts` (`brollPrompt`) -- Kling prompts
  are built from the same generic theme phrases, explicitly instructed
  ("no people, no faces ... no specific individuals") and given a matching
  negative prompt, with the beat's narration text included only as loose
  mood context, never as a request to depict anyone in it.
- Kling B-roll defaults to **off** (`ENABLE_KLING_BROLL`), so the pipeline
  runs on Pexels stock imagery alone unless a human operator deliberately
  opts in.

Before turning `ENABLE_KLING_BROLL` on for real, spot-check a sample of the
actual prompts your case briefs produce (per the Phase 3 Definition of
Done) -- this file documents the intent and the code-level guardrails, not
a runtime content filter.

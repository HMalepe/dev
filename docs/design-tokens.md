# Design Token System — Global Config

Single source of truth for all 50 hero concept modules. Concepts reference these
tokens by name and **never redefine them locally**.

- CSS custom properties + type classes: [`styles/tokens.css`](../styles/tokens.css)
- Programmatic values (GSAP / R3F / cursor): [`lib/tokens.ts`](../lib/tokens.ts)

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--ink-black` | `#0B0B0C` | Primary background — near-black with a warm undertone, not pure `#000` |
| `--warm-bone` | `#F5F1EA` | Primary text on dark backgrounds |
| `--barber-gold` | `#B8945F` | Accent / CTA / interactive highlight |
| `--blade-steel` | `#C7CDD1` | Metal specular highlight color reference |
| `--signal-red` | `#C0392B` | Barber-pole red — sparingly, accent only, never a base color |
| `--deep-navy` | `#10131C` | Secondary background / gradient stop for section transitions |
| `--success-green` | `#4A7C59` | Rare — confirmation states only (e.g. booking success) |

## Type scale

| Role | Stack | Spec |
|---|---|---|
| Display/H1 (`.type-display`) | Right Grotesk → Neue Haas Grotesk → Helvetica Neue → sans | 600 / `clamp(3rem, 9vw, 8.75rem)` (48–140px) / lh 0.9 / ls −0.02em / `--warm-bone` |
| Kicker/Eyebrow (`.type-kicker`) | Suisse Int'l Mono → IBM Plex Mono → mono | 500 / 12px / ls 0.24em / uppercase / `--barber-gold` |
| Subhead (`.type-subhead`) | Suisse Int'l → Inter → system-ui | `clamp(1rem, 1.4vw, 1.25rem)` (16–20px) / lh 1.5 / max-width 32ch / `rgba(245,241,234,0.64)` |
| UI Label (`.type-ui`) | body stack | 600 / 13px / ls 0.08em / uppercase |

## Spacing / grid

Base unit **8px**. Hero content baseline: **62vh** desktop, **58vh** mobile (thumb-reach zone).

| Breakpoint | Container | Columns | Gutter | Outer margin |
|---|---|---|---|---|
| Desktop ≥1024px | 1440px max | 12 | 32px | 80px |
| Tablet 768–1023px | — | 8 | 24px | 48px |
| Mobile <768px | — | 4 | 16px | 20px |

## Easing tokens

| Token | Value | Use |
|---|---|---|
| `ease-premium-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | All one-shot entrance reveals |
| `ease-scroll-scrub` | none (GSAP `scrub: true`) | Scrollbar position IS the easing input — never layer additional easing on a scrubbed tween; layering causes drift |
| `ease-snap` | `back.out(1.7)` (GSAP-only) | Magnetic snaps, settle-into-place moments |
| `ease-soft-inout` | `cubic-bezier(0.45, 0, 0.55, 1)` | Ambient looping/breathing motion |
| `ease-impact` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Stamp/impact/collision punches |

## Cursor base spec

Inherited by every concept unless it explicitly overrides it.

- Default: 6px solid dot (`--warm-bone`) + trailing 36px ring, 1px stroke, opacity 0.4.
  Ring position lerped at **0.14/frame via requestAnimationFrame** — never a CSS transition.
- Hover: ring scales to 60px over 220ms `ease-premium-out`, fills `--barber-gold` at 100%,
  dot hides, `mix-blend-mode: difference`.
- Disabled entirely <768px; native cursor there.

## Responsive contract

- **Desktop ≥1024px** — full fidelity, all effects as specified.
- **Tablet 768–1023px** — instance/particle counts reduced 50%, custom cursor disabled,
  scroll choreography kept but pin durations reduced 30%.
- **Mobile <768px** — WebGL-heavy scenes replaced by a static poster-frame image +
  CSS fade/translate entrance only; pinned scroll-jacking disabled entirely;
  hover-only interactions become tap-triggered equivalents.

## Accessibility contract

- `prefers-reduced-motion` respected globally: every concept's motion collapses to a single
  400ms opacity 0→1 + translateY 8px→0 entrance. No parallax, no autoplay 3D rotation,
  no scroll-jacking.
- Text contrast ≥4.5:1 against the **lightest point** of any animated/gradient background —
  validate at both extremes of any color sweep, not just the resting state.
- Every interactive element keeps a visible 2px `--barber-gold` focus ring for keyboard
  navigation, independent of the custom cursor (global rule in `styles/tokens.css`).
- Any concept using audio ships muted by default with an explicit opt-in toggle;
  never autoplays with sound.

## Performance contract

- 60fps target desktop, 30fps minimum tablet. DPR capped to `[1, 2]`.
- WebGL canvas lazy-mounted after LCP-critical DOM paints; never blocks first paint.
- All GLTF assets Draco-compressed, under 2MB each.
- Hero code lives in its own code-split chunk, not bundled with the rest of the app.

## Deliverable file convention (all 50 concepts)

```
/components/hero/[ConceptSlug]/HeroCanvas.tsx           — R3F/WebGL scene
/components/hero/[ConceptSlug]/HeroContent.tsx          — DOM text layer
/components/hero/[ConceptSlug]/useHeroScrollTimeline.ts — single GSAP timeline, commented per phase
/components/hero/[ConceptSlug]/useLenis.ts              — smooth-scroll hook synced to GSAP ticker
/components/hero/[ConceptSlug]/CustomCursor.tsx         — omit only if concept explicitly specifies none
/components/hero/[ConceptSlug]/shaders/*.glsl           — custom GLSL, one file per shader stage
```

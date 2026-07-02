/**
 * GLOBAL DESIGN TOKENS — programmatic mirror of styles/tokens.css.
 * For GSAP timelines, R3F scenes, and cursor logic that need raw values.
 * CSS-consuming code should use the custom properties in styles/tokens.css;
 * these constants exist for JS/WebGL contexts only. Keep the two in sync.
 */

export const colors = {
  inkBlack: '#0B0B0C',
  warmBone: '#F5F1EA',
  barberGold: '#B8945F',
  bladeSteel: '#C7CDD1',
  signalRed: '#C0392B',
  deepNavy: '#10131C',
  successGreen: '#4A7C59',
} as const;

/**
 * Easing tokens.
 * - CSS contexts: use the cubic-bezier strings.
 * - GSAP contexts: use the `gsap` variants.
 * - Scroll-scrubbed tweens (scrub: true) take NO easing — the scrollbar
 *   position is the easing input; layering easing on top causes drift.
 *   Always pass `ease: 'none'` on scrubbed tweens.
 */
export const easing = {
  premiumOut: 'cubic-bezier(0.16, 1, 0.3, 1)', // one-shot entrance reveals
  premiumOutGsap: [0.16, 1, 0.3, 1] as const,
  scrollScrub: 'none', // GSAP scrub:true — never layer additional easing
  snapGsap: 'back.out(1.7)', // magnetic snaps, settle-into-place moments
  softInOut: 'cubic-bezier(0.45, 0, 0.55, 1)', // ambient looping/breathing motion
  softInOutGsap: [0.45, 0, 0.55, 1] as const,
  impact: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // stamp/impact/collision punches
  impactGsap: [0.34, 1.56, 0.64, 1] as const,
} as const;

export const breakpoints = {
  /** below this: mobile contract (static poster, no scroll-jacking, no custom cursor) */
  tablet: 768,
  /** at or above this: full-fidelity desktop contract */
  desktop: 1024,
} as const;

export const grid = {
  baseUnit: 8,
  desktop: { containerMax: 1440, columns: 12, gutter: 32, margin: 80 },
  tablet: { columns: 8, gutter: 24, margin: 48 },
  mobile: { columns: 4, gutter: 16, margin: 20 },
  heroBaseline: { desktop: '62vh', mobile: '58vh' },
} as const;

/**
 * Cursor base spec — inherited by every concept unless it explicitly
 * overrides it. Ring position must be lerped per-frame via
 * requestAnimationFrame, never a CSS transition. Disabled entirely below
 * breakpoints.tablet (native cursor there).
 */
export const cursor = {
  dotSize: 6, // px, solid, colors.warmBone
  ringSize: 36, // px trailing ring
  ringStroke: 1, // px
  ringOpacity: 0.4,
  ringLerp: 0.14, // per rAF frame
  hover: {
    ringSize: 60, // px
    duration: 220, // ms, easing.premiumOut
    fill: colors.barberGold, // 100%, dot hides
    blendMode: 'difference',
  },
} as const;

/**
 * Responsive + performance contract values.
 * Tablet: instance/particle counts −50%, pin durations −30%, custom cursor off.
 * Mobile: WebGL replaced by static poster frame, pinned scroll-jacking off,
 * hover interactions become tap-triggered.
 */
export const perf = {
  targetFpsDesktop: 60,
  minFpsTablet: 30,
  dprRange: [1, 2] as const,
  tabletInstanceScale: 0.5,
  tabletPinDurationScale: 0.7,
  maxGltfBytes: 2 * 1024 * 1024, // Draco-compressed, per asset
} as const;

/** Reduced-motion fallback: single entrance, no parallax/autoplay/scroll-jack. */
export const reducedMotionEntrance = {
  duration: 0.4, // s
  from: { opacity: 0, y: 8 },
  to: { opacity: 1, y: 0 },
  ease: easing.premiumOutGsap,
} as const;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

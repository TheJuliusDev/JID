/**
 * JID Mobile design tokens.
 *
 * The raw palette is lifted verbatim from the JID website's Tailwind v4
 * `@theme` block (`src/index.css`) so the mobile product is unmistakably the
 * same brand:
 *
 *   emerald  — jewel green, the primary action colour (`--color-emerald-600`)
 *   amber    — ratings, "boosted"/featured, warm highlights
 *   sand     — the WARM light neutral ramp (the website's remapped `zinc`)
 *   charcoal — the WARM dark neutral ramp
 *
 * Tailwind's CSS custom properties and `color-mix()` cannot cross the React
 * Native bridge, so instead of a runtime CSS engine we resolve every token to
 * a flat hex string here, per colour scheme. That gives us a fully typed,
 * compile-checked design system with zero style-resolution cost at runtime.
 */

/** Raw brand ramps. Exposed so gradients and shadows can interpolate freely. */
export const palette = {
  emerald: {
    50: '#ECF8F3',
    100: '#D0EEE2',
    200: '#A3DEC8',
    300: '#6CC7A8',
    400: '#38AC88',
    500: '#1B8E6E',
    600: '#0F7358',
    700: '#0B5B47',
    800: '#094A3B',
    850: '#06352A',
    900: '#073B30',
    950: '#04241D',
  },
  amber: {
    50: '#FDF6EA',
    100: '#F9E7C4',
    200: '#F2D294',
    300: '#EBB95C',
    400: '#E5A63C',
    500: '#D68C1F',
    600: '#B57015',
    700: '#8C5511',
    800: '#6E430D',
    900: '#5A360B',
    950: '#351F06',
  },
  sand: {
    0: '#FFFFFF',
    50: '#FBFAF8',
    100: '#F4F3F0',
    150: '#ECEAE5',
    200: '#E9E7E2',
    300: '#DBD8D1',
    400: '#C3BFB6',
    500: '#A8A79C',
    600: '#8A897F',
    700: '#5B5A54',
    800: '#3A3A35',
    900: '#1A1A17',
  },
  charcoal: {
    50: '#F5F4F0',
    100: '#D8D6CF',
    200: '#B4B2AA',
    300: '#85837B',
    400: '#67655E',
    500: '#4A4844',
    600: '#3A3936',
    700: '#2C2B28',
    750: '#232220',
    800: '#201F1D',
    850: '#1A1917',
    900: '#151412',
    950: '#0E0D0C',
  },
  // Supporting hues, tuned to sit beside the warm neutrals.
  rose: { 50: '#FEF2F2', 100: '#FDE2E2', 500: '#E5484D', 600: '#CC3339', 700: '#A82A2F' },
  blue: { 50: '#EFF6FF', 100: '#DBEAFE', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' },
  violet: { 50: '#F5F3FF', 100: '#EDE9FE', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9' },
} as const;

/** 4pt base spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

/**
 * Corner radii. JID leans generous but not pill-shaped — the website uses
 * `rounded-2xl` / `rounded-3xl` heavily.
 */
export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
  pill: 999,
} as const;

/**
 * Type ramp. Inter is loaded via `@expo-google-fonts/inter` and carries the
 * website's `-0.03em` display tracking.
 */
export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const, letterSpacing: -0.6 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  subheading: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: -0.1 },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: -0.1 },
  small: { fontSize: 12.5, lineHeight: 17, fontWeight: '400' as const, letterSpacing: 0 },
  smallStrong: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' as const, letterSpacing: 0 },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '500' as const, letterSpacing: 0.1 },
  overline: { fontSize: 10, lineHeight: 13, fontWeight: '700' as const, letterSpacing: 0.7 },
  price: { fontSize: 17, lineHeight: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  priceLarge: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.6 },
} as const;

export type TypographyVariant = keyof typeof typography;

export interface ThemeColors {
  isDark: boolean;

  /** Primary action colour. */
  brand: string;
  brandPressed: string;
  brandText: string;
  brandSoft: string;
  brandSoftBorder: string;
  brandGlow: string;

  /** Secondary / attention. */
  accent: string;
  accentText: string;
  accentSoft: string;
  accentSoftBorder: string;

  /** Backgrounds, back-to-front. */
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  /** Card gradient endpoints used by hero surfaces. */
  heroFrom: string;
  heroTo: string;
  heroGlow: string;
  /** Search field sitting *inside* a dark hero. */
  heroSearchBg: string;

  /** Hairlines. */
  border: string;
  borderStrong: string;

  /** Foreground text. */
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  onBrand: string;

  /** Status. */
  success: string;
  successSoft: string;
  successBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  info: string;
  infoSoft: string;
  infoBorder: string;

  /** Skeleton shimmer base + highlight. */
  skeleton: string;
  skeletonHighlight: string;

  /** Native tab bar / header material. */
  chrome: string;
  chromeBorder: string;
  scrim: string;

  // --- Glass ------------------------------------------------------------
  /**
   * Translucent surface tints for the frosted layer.
   *
   * `glass` is the working tint — sheets, menus, floating controls. It is
   * deliberately *not* white: a pure-white frost reads as a rendering fault on
   * Android, where the blur underneath is warmer and lower contrast. Tinting
   * towards the scheme's own neutral keeps the frost looking like a pane of glass
   * rather than a hole punched in the screen.
   *
   * `glassStrong` is for surfaces that must stay readable over unpredictable
   * content (a sheet over a photo, a menu over text) where the blur alone cannot
   * guarantee contrast. Two steps, no more: a third would invite the kind of
   * stacking-opacity noise that makes an app look cheap.
   */
  glass: string;
  glassStrong: string;
  /** Hairline for a glass edge. */
  glassBorder: string;
  /** A brighter inner hairline, used to fake a lit top edge on glass. */
  glassHighlight: string;

  /**
   * Dimming layer behind an overlay.
   *
   * Separate from `scrim` because the two do different jobs: `scrim` sits *on*
   * photography to keep a white icon legible (it must be dark enough to guarantee
   * contrast against an arbitrary photo), while a backdrop has to dim a screen
   * the user is trying to read. Too dark and dismissing the overlay feels like
   * relief rather than a choice, so this is a gentler value.
   */
  backdrop: string;

  /** Drag handle on a sheet or modal. */
  handle: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const lightColors: ThemeColors = {
  isDark: false,

  brand: palette.emerald[600],
  brandPressed: palette.emerald[700],
  brandText: palette.emerald[700],
  brandSoft: palette.emerald[50],
  brandSoftBorder: palette.emerald[200],
  brandGlow: 'rgba(15,115,88,0.20)',

  accent: palette.amber[500],
  accentText: palette.amber[700],
  accentSoft: palette.amber[50],
  accentSoftBorder: palette.amber[200],

  bg: palette.sand[50],
  bgElevated: palette.sand[0],
  surface: palette.sand[0],
  surfaceAlt: palette.sand[100],
  surfaceSunken: palette.sand[100],
  heroFrom: '#151412',
  heroTo: '#242220',
  heroGlow: 'rgba(15,115,88,0.28)',
  heroSearchBg: 'rgba(255,255,255,0.10)',

  border: palette.sand[200],
  borderStrong: palette.sand[300],

  text: palette.sand[900],
  textMuted: '#78766D',
  textSubtle: '#A8A79C',
  textInverse: palette.sand[50],
  onBrand: '#FFFFFF',

  success: palette.emerald[600],
  successSoft: palette.emerald[50],
  successBorder: palette.emerald[200],
  warning: palette.amber[600],
  warningSoft: palette.amber[50],
  warningBorder: palette.amber[200],
  danger: palette.rose[600],
  dangerSoft: palette.rose[50],
  dangerBorder: palette.rose[100],
  info: palette.blue[600],
  infoSoft: palette.blue[50],
  infoBorder: palette.blue[100],

  skeleton: palette.sand[150],
  skeletonHighlight: palette.sand[100],

  chrome: 'rgba(255,255,255,0.94)',
  chromeBorder: palette.sand[200],
  scrim: 'rgba(20,20,18,0.55)',

  // Warm, low-contrast frost. Tinted towards the sand neutrals rather than pure
  // white so it sits in the palette instead of glowing against it.
  glass: 'rgba(251,250,248,0.72)',
  glassStrong: 'rgba(251,250,248,0.90)',
  glassBorder: 'rgba(26,26,23,0.09)',
  glassHighlight: 'rgba(255,255,255,0.85)',
  backdrop: 'rgba(20,20,18,0.34)',
  handle: 'rgba(26,26,23,0.18)',
};

const darkColors: ThemeColors = {
  isDark: true,

  brand: palette.emerald[400],
  brandPressed: palette.emerald[300],
  brandText: palette.emerald[300],
  brandSoft: 'rgba(27,142,110,0.16)',
  brandSoftBorder: 'rgba(54,172,136,0.32)',
  brandGlow: 'rgba(27,142,110,0.28)',

  accent: palette.amber[400],
  accentText: palette.amber[300],
  accentSoft: 'rgba(229,166,60,0.16)',
  accentSoftBorder: 'rgba(235,185,92,0.30)',

  bg: palette.charcoal[950],
  bgElevated: palette.charcoal[900],
  surface: palette.charcoal[900],
  surfaceAlt: palette.charcoal[800],
  surfaceSunken: palette.charcoal[950],
  heroFrom: '#111110',
  heroTo: '#1C1B19',
  heroGlow: 'rgba(27,142,110,0.24)',
  heroSearchBg: 'rgba(255,255,255,0.08)',

  border: palette.charcoal[800],
  borderStrong: palette.charcoal[700],

  text: palette.charcoal[50],
  textMuted: '#A8A79C',
  textSubtle: '#67655E',
  textInverse: palette.charcoal[950],
  onBrand: '#04241D',

  success: palette.emerald[300],
  successSoft: 'rgba(27,142,110,0.16)',
  successBorder: 'rgba(54,172,136,0.30)',
  warning: palette.amber[300],
  warningSoft: 'rgba(229,166,60,0.16)',
  warningBorder: 'rgba(235,185,92,0.30)',
  danger: '#FF6369',
  dangerSoft: 'rgba(229,72,77,0.16)',
  dangerBorder: 'rgba(229,72,77,0.32)',
  info: '#60A5FA',
  infoSoft: 'rgba(59,130,246,0.16)',
  infoBorder: 'rgba(59,130,246,0.30)',

  skeleton: palette.charcoal[800],
  skeletonHighlight: palette.charcoal[750],

  chrome: 'rgba(21,20,18,0.94)',
  chromeBorder: palette.charcoal[800],
  scrim: 'rgba(0,0,0,0.65)',

  // Slightly lifted off pure black: a black frost loses the blur entirely, because
  // there is no luminance difference for it to work with.
  glass: 'rgba(32,31,29,0.74)',
  glassStrong: 'rgba(42,41,38,0.92)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassHighlight: 'rgba(255,255,255,0.14)',
  backdrop: 'rgba(0,0,0,0.55)',
  handle: 'rgba(255,255,255,0.24)',
};

export const lightTheme: Theme = { colors: lightColors, spacing, radius, typography };
export const darkTheme: Theme = { colors: darkColors, spacing, radius, typography };

/**
 * Spring/timing presets mirroring the website's `motion` transitions, so the
 * two products feel like the same family.
 */
export const motion = {
  /** The website's bottom-nav spring. */
  nav: { damping: 36, stiffness: 420, mass: 0.8 },
  /** The website's active-pill spring. */
  pill: { damping: 32, stiffness: 400, mass: 0.7 },
  /** The website's lightbox spring. */
  sheet: { damping: 30, stiffness: 320, mass: 0.9 },
  /** Card press / button tap. */
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  /** Content entrance. */
  enter: { damping: 26, stiffness: 260, mass: 0.9 },
  /** Micro-interaction bounce (hearts, tags, badges). */
  bounce: { damping: 12, stiffness: 350, mass: 0.5 },
  /** Modal entrance. */
  modal: { damping: 28, stiffness: 300, mass: 0.8 },
  fast: 150,
  base: 220,
  slow: 320,
} as const;

/** Standard elevations, tuned warm and subtle so shadows never read as heavy or muddy. */
export const shadows = {
  none: {},
  subtle: {
    shadowColor: '#1A1A17',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: '#1A1A17',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  card: {
    shadowColor: '#1A1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1A17',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#1A1A17',
    shadowOpacity: 0.09,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  brand: {
    shadowColor: palette.emerald[600],
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
} as const;

/** Page gutter, used everywhere so content never hugs the screen edge. */
export const GUTTER = spacing.base;

/**
 * Blur strength presets.
 *
 * Android and iOS do not take the same number for the same look: Android's blur is
 * a runtime render-target effect whose cost scales with the blurred area, so the
 * same `intensity` that looks right on iOS looks washed out and costs more on a
 * mid-range device. iOS gets a lower number that produces the same apparent frost.
 *
 * `none` exists for full-screen or full-width surfaces, where a large blur is the
 * single most expensive thing on the screen. Those use a strong tint instead —
 * translucency alone reads as depth, and the blur is what costs.
 */
export const blur = {
  /** Floating chrome: tab bar, FABs, compact controls. */
  chrome: { ios: 36, android: 70 },
  /** Sheets and menus. A small area, so it can afford more. */
  sheet: { ios: 44, android: 85 },
  /** Full-width / full-screen. Tinted, not blurred. */
  none: 0,
} as const;

/**
 * Picks the blur intensity for the current platform.
 *
 * A plain number passes straight through, so a caller that has already measured
 * or tuned its own value does not have to wrap it in a preset object. `0` is
 * meaningful and is *not* treated as "no preset" — it is how the no-blur case is
 * spelled.
 */
export function blurIntensity(
  preset: number | { ios: number; android: number },
  platform: string,
): number {
  if (typeof preset === 'number') return preset;
  // Anything that is not iOS uses the Android number: it is the conservative
  // choice, and web/desktop have no true native blur anyway.
  return platform === 'ios' ? preset.ios : preset.android;
}

/**
 * Height reserved at the bottom of tab-screen scroll content.
 *
 * The floating dock is ~62pt plus the safe-area inset and sits on top of the
 * scroll view, so without this the last card is permanently half-hidden behind
 * it.
 */
export const TAB_BAR_CLEARANCE = 110;

/** Minimum touch target per Apple HIG / Material guidance. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TOUCH = 44;

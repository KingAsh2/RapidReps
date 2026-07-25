/**
 * theme/ladder.ts — iter106ax "Performance Pro" design system.
 *
 * Ladder-app-inspired premium aesthetic per /app/design_guidelines.json.
 * Editorial serif display (Instrument Serif) + tight sans body (Inter Tight)
 * over a near-black canvas. Reserved for the ongoing UI refresh — NOT a
 * replacement for `theme/premium.ts`, which existing screens still depend on.
 *
 * Migrate a screen at a time: import `LADDER` and `LADDER_TYPE` from here
 * as you redesign, leaving other screens on their current tokens.
 */
import { Platform, TextStyle } from 'react-native';

export const LADDER = {
  // Surfaces — near-black canvas, depth via layering not shadows
  bgBase: '#0A0A0A',
  bgSurface: '#121212',
  bgCard: '#1C1C1E',
  bgElevated: '#2C2C2E',

  // Text — hierarchy through weight/size, not color
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',

  // Accent — kept from brand, used sparingly (CTAs, live indicators)
  accent: '#FF6A00',
  accentBright: '#FF3B30',
  accentSoft: '#FF9F1C',

  // Borders — 1px inner strokes replace drop shadows
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',
  borderFocus: 'rgba(255, 106, 0, 0.65)',

  // Overlays
  overlayDark: 'rgba(0, 0, 0, 0.6)',
  overlayMid: 'rgba(0, 0, 0, 0.35)',

  // Semantic
  success: '#00C853',
  warning: '#FFA502',
  error: '#FF4757',
};

// Font-family names as they're registered via useFonts() in _layout.tsx.
export const LADDER_FONTS = {
  serifDisplay: Platform.select({
    ios: 'InstrumentSerif_400Regular',
    android: 'InstrumentSerif_400Regular',
    default: 'Georgia',
  }) as string,
  sans: Platform.select({
    ios: 'InterTight_400Regular',
    android: 'InterTight_400Regular',
    default: 'system-ui, -apple-system, sans-serif',
  }) as string,
  sansMedium: Platform.select({
    ios: 'InterTight_500Medium',
    android: 'InterTight_500Medium',
    default: 'system-ui, -apple-system, sans-serif',
  }) as string,
  sansSemibold: Platform.select({
    ios: 'InterTight_600SemiBold',
    android: 'InterTight_600SemiBold',
    default: 'system-ui, -apple-system, sans-serif',
  }) as string,
  sansBold: Platform.select({
    ios: 'InterTight_700Bold',
    android: 'InterTight_700Bold',
    default: 'system-ui, -apple-system, sans-serif',
  }) as string,
  sansBlack: Platform.select({
    ios: 'InterTight_900Black',
    android: 'InterTight_900Black',
    default: 'system-ui, -apple-system, sans-serif',
  }) as string,
};

export const LADDER_TYPE: Record<string, TextStyle> = {
  h1: {
    fontFamily: LADDER_FONTS.serifDisplay,
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -1,
    color: LADDER.textPrimary,
  },
  h2: {
    fontFamily: LADDER_FONTS.serifDisplay,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.5,
    color: LADDER.textPrimary,
  },
  h3: {
    fontFamily: LADDER_FONTS.sansBold,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.2,
    color: LADDER.textPrimary,
  },
  bodyLg: {
    fontFamily: LADDER_FONTS.sans,
    fontSize: 18,
    lineHeight: 27,
    color: LADDER.textPrimary,
  },
  body: {
    fontFamily: LADDER_FONTS.sans,
    fontSize: 16,
    lineHeight: 24,
    color: LADDER.textPrimary,
  },
  bodyMuted: {
    fontFamily: LADDER_FONTS.sans,
    fontSize: 16,
    lineHeight: 24,
    color: LADDER.textSecondary,
  },
  bodySmall: {
    fontFamily: LADDER_FONTS.sans,
    fontSize: 14,
    lineHeight: 20,
    color: LADDER.textSecondary,
  },
  label: {
    fontFamily: LADDER_FONTS.sansSemibold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: LADDER.textSecondary,
  },
  button: {
    fontFamily: LADDER_FONTS.sansBold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  stats: {
    fontFamily: LADDER_FONTS.sansBlack,
    fontSize: 64,
    lineHeight: 64,
    letterSpacing: -2,
    color: LADDER.textPrimary,
  },
};

export const LADDER_MOTION = {
  quick: 150,
  base: 250,
  slow: 400,
};

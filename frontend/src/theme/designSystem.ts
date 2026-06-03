/**
 * RapidReps Unified Design System (iter94).
 *
 * Single source of truth for visual styling tokens across ALL screens.
 * Goal: cohesive premium-fitness-marketplace look (Uber × Nike × Future).
 *
 * Usage:
 *   import { DS } from '../theme/designSystem';
 *   <View style={{ borderRadius: DS.radii.card, padding: DS.spacing.lg }} />
 *
 * Compose with the existing premium theme tokens (../theme/premium.ts).
 * This file is additive — does NOT replace existing styles, just unifies them.
 */
import { ViewStyle, TextStyle } from 'react-native';

// ── Color tokens (extends premium theme) ─────────────────────────────
export const DSColors = {
  // Base
  bg: '#06080F',                // primary dark background
  bgRaised: '#0E121C',          // elevated card layer
  bgRaised2: '#161C2A',         // 2nd-level elevation
  surface: 'rgba(255,255,255,0.045)', // glass card fill
  surfaceHover: 'rgba(255,255,255,0.07)',

  // Brand
  orange: '#FF7A00',
  orangeGlow: '#FF9B2F',
  orangeSoft: 'rgba(255,122,0,0.12)',
  orangeRing: 'rgba(255,155,47,0.4)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#C6CBD9',
  textMuted: '#7C8295',
  textHint: '#5A6072',

  // Borders
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  borderAccent: 'rgba(255,122,0,0.35)',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  errorSoft: 'rgba(239,68,68,0.1)',
} as const;

// ── Spacing rhythm (4-pt base) ───────────────────────────────────────
export const DSSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

// ── Border radii ─────────────────────────────────────────────────────
export const DSRadii = {
  pill: 9999,
  xl: 28,
  lg: 22,
  card: 18,    // ← preferred for all cards
  input: 14,   // ← preferred for inputs
  sm: 10,
  xs: 6,
} as const;

// ── Shadows (premium depth) ──────────────────────────────────────────
export const DSShadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  } as ViewStyle,
  cardHover: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  } as ViewStyle,
  orangeGlow: {
    shadowColor: DSColors.orange,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  } as ViewStyle,
  subtle: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } as ViewStyle,
} as const;

// ── Typography hierarchy ─────────────────────────────────────────────
export const DSText = {
  // Display (hero / large brand moments)
  display: {
    fontSize: 64,
    fontWeight: '900' as const,
    letterSpacing: -1.2,
    lineHeight: 64,
    color: DSColors.textPrimary,
  } as TextStyle,
  h1: {
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: -0.4,
    lineHeight: 34,
    color: DSColors.textPrimary,
  } as TextStyle,
  h2: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
    lineHeight: 28,
    color: DSColors.textPrimary,
  } as TextStyle,
  h3: {
    fontSize: 18,
    fontWeight: '800' as const,
    lineHeight: 24,
    color: DSColors.textPrimary,
  } as TextStyle,
  // Section header (the "WORKOUTS NEAR YOU" style stencil)
  sectionHeader: {
    fontSize: 14,
    fontWeight: '900' as const,
    letterSpacing: 2.2,
    color: DSColors.textPrimary,
    textTransform: 'uppercase' as const,
  } as TextStyle,
  body: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: DSColors.textSecondary,
  } as TextStyle,
  bodyStrong: {
    fontSize: 15,
    fontWeight: '700' as const,
    lineHeight: 22,
    color: DSColors.textPrimary,
  } as TextStyle,
  caption: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    color: DSColors.textMuted,
  } as TextStyle,
  // Small uppercase labels (e.g., "TRAINER · 60 MIN")
  label: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
    color: DSColors.textMuted,
    textTransform: 'uppercase' as const,
  } as TextStyle,
  helper: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: DSColors.textHint,
  } as TextStyle,
} as const;

// ── Pre-composed card style (use across all screens) ─────────────────
export const DSCard = {
  base: {
    backgroundColor: DSColors.bgRaised,
    borderRadius: DSRadii.card,
    borderWidth: 1,
    borderColor: DSColors.border,
    padding: DSSpacing.lg,
    ...DSShadows.card,
  } as ViewStyle,
  glass: {
    backgroundColor: DSColors.surface,
    borderRadius: DSRadii.card,
    borderWidth: 1,
    borderColor: DSColors.borderStrong,
    padding: DSSpacing.lg,
    ...DSShadows.subtle,
  } as ViewStyle,
} as const;

// ── Bottom-sheet / Modal token ───────────────────────────────────────
export const DSOverlay = {
  scrim: 'rgba(2,4,12,0.62)',
  blur: 18,
} as const;

// ── Convenience grab-bag ─────────────────────────────────────────────
export const DS = {
  colors: DSColors,
  spacing: DSSpacing,
  radii: DSRadii,
  shadows: DSShadows,
  text: DSText,
  card: DSCard,
  overlay: DSOverlay,
} as const;

export default DS;

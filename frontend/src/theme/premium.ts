/**
 * RapidReps Premium Design System tokens (Iteration 89)
 *
 * Single source of truth for the "Premium Redesign" version.
 * Inspired by Nike Training Club × Uber × Gymshark × Apple Fitness.
 *
 * Rollback: flip EXPO_PUBLIC_UI_VERSION in /app/frontend/.env to "classic"
 *           and restart Expo. All redesigned screens fall back to the
 *           original *.classic.tsx implementations.
 */

export const PremiumColors = {
  // Brand
  orange: '#FF7A00',
  orangeGlow: '#FF9B2F',
  orangeDeep: '#E55A00',
  orangeEmber: '#FFB347',

  // Surfaces
  navy: '#091A3A',
  navyDeep: '#050D22',
  navySoft: '#10254F',
  black: '#0A0A0A',
  blackOverlay: 'rgba(10,10,10,0.55)',

  // Glass / inputs
  glassBg: 'rgba(255,255,255,0.06)',
  glassBgStrong: 'rgba(9,26,58,0.55)',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassBorderFocus: '#FF7A00',
  glassBorderGlow: 'rgba(255,122,0,0.45)',

  // Text
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.65)',
  textDim: 'rgba(255,255,255,0.42)',
  textOrangeAccent: '#FF9B2F',
};

export const PremiumGradients = {
  // Welcome screen — deep orange embers fading to navy/black
  welcomeBg: ['#1B0700', '#3A0F00', '#5C1800', '#0A0A0A'] as const,
  welcomeBgRadial: ['rgba(255,122,0,0.55)', 'rgba(255,122,0,0.18)', 'transparent'] as const,

  // Login screen — fiery orange wash with navy bottom
  loginBg: ['#3A0F00', '#7A2100', '#FF7A00', '#7A2100', '#0A0A0A'] as const,
  loginBgRadial: ['rgba(255,155,47,0.4)', 'rgba(255,122,0,0.2)', 'transparent'] as const,

  // Signup screen — deep navy → orange ember
  signupBg: ['#091A3A', '#10254F', '#3A0F00', '#0A0A0A'] as const,

  // Primary CTA — navy ↘ orange (the "FIND A TRAINER" pill from the mockup)
  ctaPrimary: ['#0E1F3D', '#1B2E5C', '#FF7A00', '#FFB347'] as const,

  // Login CTA — fiery orange with glow tips
  ctaLogin: ['#FF6A00', '#FF9B2F', '#FFB347', '#FF9B2F', '#FF6A00'] as const,

  // Secondary CTA — matte black with orange glow border (BECOME A TRAINER)
  ctaSecondary: ['rgba(10,10,10,0.92)', 'rgba(9,26,58,0.85)'] as const,

  // Feature badge ring glow
  featureRing: ['rgba(255,122,0,0.6)', 'rgba(255,122,0,0)'] as const,
};

export const PremiumShadow = {
  glow: {
    shadowColor: '#FF7A00',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  glowSoft: {
    shadowColor: '#FF9B2F',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  deep: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
};

export const PremiumRadii = {
  pill: 999,
  card: 22,
  input: 14,
  ring: 999,
};

export const PremiumSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 44,
};

export const PremiumType = {
  // Mock screenshots use a bold italic stencil style for the hero.
  // RN doesn't ship one by default — we fake it with weight 900 + italic
  // + tight letterSpacing. Real font swap can come later.
  heroLine: {
    fontSize: 56,
    fontWeight: '900' as const,
    fontStyle: 'italic' as const,
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  heroLineAccent: {
    fontSize: 56,
    fontWeight: '900' as const,
    fontStyle: 'italic' as const,
    letterSpacing: -1.5,
    lineHeight: 56,
    color: PremiumColors.orange,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 4,
    color: PremiumColors.white,
  },
  ctaLabel: {
    fontSize: 17,
    fontWeight: '900' as const,
    letterSpacing: 2,
    color: PremiumColors.white,
  },
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: PremiumColors.textMuted,
  },
  link: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: PremiumColors.orangeGlow,
    textDecorationLine: 'underline' as const,
  },
};

/**
 * UI Version gate — used by the *.tsx switcher files
 * to choose between Classic and Premium implementations.
 */
export const UI_VERSION: 'classic' | 'premium' =
  (process.env.EXPO_PUBLIC_UI_VERSION as 'classic' | 'premium') || 'premium';

export const isPremium = () => UI_VERSION === 'premium';

/**
 * Welcome A/B test variant — only consulted when UI_VERSION === 'premium'.
 *   'A' (default) → the iter89 cinematic "DELIVERED RAPIDLY" hero.
 *   'B'           → the iter95 community-first "TRAINERS NEAR YOU" hero.
 * Flip via /app/frontend/.env (EXPO_PUBLIC_WELCOME_VARIANT=B) and restart Expo.
 */
export const WELCOME_VARIANT: 'A' | 'B' =
  (process.env.EXPO_PUBLIC_WELCOME_VARIANT as 'A' | 'B') || 'A';


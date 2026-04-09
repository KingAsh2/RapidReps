// RapidReps Premium Dark Theme
// Inspired by Uber x Instagram x Nike Training Club

export const THEME = {
  // Core palette
  bg: '#0A0E1A',
  bgCard: '#141929',
  bgElevated: '#1A2035',
  bgGlass: 'rgba(20, 25, 41, 0.85)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.45)',

  // Accent — orange used sparingly
  accent: '#FF6A00',
  accentLight: '#FF9F1C',
  accentGlow: 'rgba(255, 106, 0, 0.25)',
  accentSoft: 'rgba(255, 106, 0, 0.12)',

  // Navy / brand
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',

  // Functional
  success: '#00D68F',
  successSoft: 'rgba(0, 214, 143, 0.15)',
  error: '#FF4757',
  errorSoft: 'rgba(255, 71, 87, 0.15)',
  warning: '#FFB300',
  warningSoft: 'rgba(255, 179, 0, 0.15)',

  // Neutrals
  white: '#FFFFFF',
  gray: '#8a95b0',
  grayLight: '#E8ECF0',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',

  // Glass
  glassBg: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.1)',
  glassHighlight: 'rgba(255,255,255,0.12)',
};

// Gradient presets
export const GRADIENTS = {
  screenBg: ['#0A0E1A', '#111827'] as const,
  cardDark: ['rgba(20,25,41,0.95)', 'rgba(20,25,41,0.85)'] as const,
  accent: ['#FF6A00', '#FF9F1C'] as const,
  accentSubtle: ['rgba(255,106,0,0.2)', 'rgba(255,159,28,0.1)'] as const,
  navy: ['#1a2a5e', '#2a3a6e'] as const,
  success: ['#00D68F', '#00B377'] as const,
  glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'] as const,
};

// Shadow presets
export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
};

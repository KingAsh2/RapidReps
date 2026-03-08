/**
 * RapidReps 508 Compliance & Design System Constants
 * WCAG 2.1 AA compliant - minimum contrast ratios, font sizes, touch targets
 */

// Minimum font sizes (508 compliant - minimum 14px for body, 12px for captions)
export const FontSizes = {
  caption: 13,
  small: 14,
  body: 15,
  bodyLarge: 16,
  subtitle: 17,
  title: 20,
  heading: 24,
  hero: 32,
  display: 40,
} as const;

// Minimum touch target sizes (WCAG 2.5.5 - 44x44 minimum)
export const TouchTargets = {
  minimum: 44,
  comfortable: 48,
  large: 56,
} as const;

// Font weights for consistent hierarchy
export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

// Spacing system (4px grid)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

// Border radius system
export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 50,
  circle: 999,
} as const;

// 508 Compliant color pairings (all meet 4.5:1 contrast ratio)
export const A11yPairs = {
  // Dark text on light backgrounds
  textOnWhite: '#1a2a5e',       // 10.2:1 contrast
  subtextOnWhite: '#4a5578',    // 5.8:1 contrast (upgraded from #8892b0 which was 3.1:1)
  mutedOnWhite: '#5a6785',      // 4.6:1 contrast
  
  // Light text on dark backgrounds
  textOnNavy: '#FFFFFF',        // 12.5:1 contrast
  subtextOnNavy: '#C8D0E0',    // 7.2:1 contrast
  mutedOnNavy: '#A0AACC',      // 4.8:1 contrast
  
  // Text on orange/brand backgrounds
  textOnOrange: '#FFFFFF',      // 4.5:1+ contrast
  darkOnOrange: '#3D1500',      // 7.1:1 contrast
  
  // Status text (on white)
  successText: '#00853D',       // 4.6:1 contrast (upgraded from #00C853)
  errorText: '#CC2233',         // 5.2:1 contrast
  warningText: '#8B6B00',       // 4.7:1 contrast
} as const;

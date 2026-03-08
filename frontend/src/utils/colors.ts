// RapidReps Brand Colors - Unified Design System
// Used across all screens for consistent styling

export const Colors = {
  // PRIMARY - Athletic Orange (Main Brand)
  primary: '#FF7F00',
  primaryLight: '#FFA526',
  primaryDark: '#E65C00',
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  orangeHot: '#FF6A00',
  orangeGlow: '#FFB347',
  
  // SECONDARY - Teal Accent (Energy & Pop)
  secondary: '#1a2a5e',
  secondaryDark: '#2a3a6e',
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  tealDark: '#0D8B88',
  
  // BASE - Deep Navy (Strength & Authority)
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  navyDark: '#0f1a3e',
  
  // NEUTRAL
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  background: '#F5F6F8',
  lightGray: '#E8ECF0',
  grayLight: '#E8ECF0',
  
  // STATUS COLORS
  success: '#00C853',
  successLight: '#E8F5E9',
  error: '#FF4757',
  danger: '#FF4757',
  errorLight: '#FFEBEE',
  warning: '#FFB300',
  warningLight: '#FFF8E1',
  
  // TEXT (508 compliant - all meet 4.5:1 contrast ratio on white)
  text: '#1a2a5e',
  textPrimary: '#1a2a5e',
  textSecondary: '#4a5578',   // Upgraded from #5a6785 for better contrast
  textLight: '#5a6785',       // Upgraded from #8892b0 (was 3.1:1, now 4.6:1)
  textMuted: '#5a6785',       // Upgraded from #8892b0
  textWhite: '#FFFFFF',
  gray: '#5a6785',            // Upgraded from #8892b0
  
  // UI ELEMENTS
  border: '#E8ECF0',
  shadow: '#1a2a5e',
  
  // GRADIENTS (Array format for LinearGradient)
  gradientOrange: ['#FFA526', '#FF7F00', '#E65C00'],
  gradientTeal: ['#1a2a5e', '#2a3a6e'],
  gradientNavy: ['#2a3a6e', '#1a2a5e'],
  gradientMain: ['#FFA526', '#FF7F00', '#E65C00'],
  gradientTealStart: ['#1a2a5e', '#2a3a6e'],
  gradientOrangeStart: ['#FFA526', '#FF7F00'],
  
  // GLASS CARD EFFECTS
  cardBg: 'rgba(255,255,255,0.12)',
  cardBorder: 'rgba(255,255,255,0.2)',
};

// Export default for backwards compatibility
export default Colors;

// RapidReps EXPLOSIVE Brand Colors - BOLD, VIBRANT, HIGH-ENERGY!
// Navy-to-Orange gradients EVERYWHERE!

export const Colors = {
  // PRIMARY - Rapid Orange (Fiery Orange)
  primary: '#F26522',
  primaryLight: '#F9A825',
  primaryDark: '#EA3807',
  primaryYellow: '#FFC107',
  
  // SECONDARY - Teal (MINIMAL USE - mostly for subtle accents only)
  secondary: '#00BCD4',
  secondaryLight: '#26C6DA',
  secondaryDark: '#0097A7',
  
  // BASE - Deep Navy
  navy: '#1A2536',
  navyLight: '#22314B',
  navyDark: '#0E151E',
  navyCard: '#283C5C',
  
  // CARD BACKGROUNDS
  cardBg: '#22314B',
  cardBgDark: '#1A2536',
  inputBg: '#364C73',
  inputBgAlt: '#2D3E5A',
  
  // NEUTRAL
  white: '#FFFFFF',
  offWhite: '#F0F0F0',
  background: '#0E151E',
  lightGray: '#E0E0E0',
  mediumGray: '#C0C0C0',
  darkGray: '#111A2A',
  
  // STATUS COLORS
  success: '#4CAF50',
  error: '#FF4444',
  danger: '#FF4444',
  warning: '#F9A825',
  
  // TEXT
  text: '#FFFFFF',
  textLight: '#D0D0D0',
  textMuted: '#A0A0A0',
  textWhite: '#FFFFFF',
  textNavy: '#1A2536',
  textAccent: '#F26522',
  
  // UI ELEMENTS
  border: '#364C73',
  borderLight: 'rgba(54, 76, 115, 0.5)',
  borderAccent: '#F26522',
  borderOrange: '#F26522',
  shadow: 'rgba(14, 21, 30, 0.6)',
  
  // GRADIENTS - EXPLOSIVE ORANGE EVERYWHERE!
  
  // Main background - Navy to Orange (VISIBLE gradient!)
  gradientBackground: ['#0E151E', '#1A2536', '#2D1810', '#4A1A08'],
  gradientBackgroundAlt: ['#1A2536', '#3D2015', '#5A2810'],
  gradientBackgroundExplosive: ['#0E151E', '#2A1A10', '#4A2510', '#6B3000'],
  
  // Button gradients - ALL ORANGE!
  gradientButton: ['#F26522', '#F9A825'],
  gradientButtonAlt: ['#EA3807', '#F26522'],
  gradientButtonHot: ['#FF4500', '#FFA500'],
  
  // Card gradients - Orange accents
  gradientOrange: ['#F26522', '#F9A825'],
  gradientOrangeYellow: ['#E74C2B', '#FFC107'],
  gradientOrangeHot: ['#FF4500', '#FF8C00', '#FFA500'],
  gradientOrangeFire: ['#FF4500', '#FF6B35', '#FFA500'],
  
  // Navy with orange glow
  gradientNavyOrange: ['#1A2536', '#3A2520', '#5A3018'],
  gradientNavyFire: ['#0E151E', '#2A1A15', '#4A2A1A', '#6A3A1F'],
  
  // Card backgrounds with subtle orange
  gradientCard: ['#22314B', '#2A2520'],
  gradientCardOrange: ['#2A2015', '#3A2A1A'],
  
  // Legacy compatibility
  gradientMain: ['#F26522', '#F9A825'],
  gradientTeal: ['#00BCD4', '#26C6DA'],
  gradientTealStart: ['#00BCD4', '#26C6DA'],
  gradientOrangeStart: ['#F26522', '#F9A825'],
};

// Typography configuration
export const Typography = {
  headerWeight: '900',
  subheaderWeight: '700',
  bodyWeight: '500',
  labelWeight: '600',
  headerSize: 28,
  titleSize: 24,
  subtitleSize: 18,
  bodySize: 16,
  labelSize: 12,
  smallSize: 11,
};

// Shadow configurations
export const Shadows = {
  card: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  button: {
    shadowColor: '#F26522',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  input: {
    shadowColor: '#0E151E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  subtle: {
    shadowColor: '#F26522',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  glow: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
};

// Border radius values
export const BorderRadius = {
  button: 25,
  buttonLarge: 40,
  input: 12,
  card: 20,
  cardLarge: 25,
  small: 8,
  medium: 15,
};

// Spacing values
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  screenPadding: 24,
  cardPadding: 20,
  inputPadding: 16,
};

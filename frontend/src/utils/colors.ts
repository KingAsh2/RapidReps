// RapidReps Official Brand Colors - EXACT Match to Design Reference
// Bold, Energetic, High-Energy Fitness App

export const Colors = {
  // PRIMARY - Rapid Orange (Fiery Orange-Red)
  primary: '#F26522',
  primaryLight: '#F9A825',
  primaryDark: '#EA3807',
  primaryYellow: '#FFC107',
  
  // SECONDARY - Teal/Cyan Accent
  secondary: '#00BCD4',
  secondaryLight: '#26C6DA',
  secondaryDark: '#0097A7',
  
  // BASE - Deep Navy (Dark Blue)
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
  success: '#00BCD4',
  error: '#FF4444',
  danger: '#FF4444',
  warning: '#F9A825',
  
  // TEXT
  text: '#FFFFFF',
  textLight: '#D0D0D0',
  textMuted: '#C0C0C0',
  textWhite: '#FFFFFF',
  textNavy: '#1A2536',
  textAccent: '#00BCD4',
  
  // UI ELEMENTS
  border: '#364C73',
  borderLight: 'rgba(54, 76, 115, 0.5)',
  borderAccent: '#00BCD4',
  shadow: 'rgba(14, 21, 30, 0.6)',
  
  // GRADIENTS - EXACT from design
  gradientBackground: ['#1A2536', '#0E151E'],
  gradientBackgroundWarm: ['#F26522', '#1A2536'],
  gradientOrange: ['#F26522', '#F9A825'],
  gradientOrangeYellow: ['#E74C2B', '#FFC107'],
  gradientButton: ['#F26522', '#F9A825'],
  gradientButtonAlt: ['#E74C2B', '#F9A825'],
  gradientTeal: ['#00BCD4', '#26C6DA'],
  gradientNavy: ['#1A2536', '#0E151E'],
  gradientCard: ['#22314B', '#1A2536'],
  
  // Welcome screen radial gradient effect (orange to dark)
  gradientWelcome: ['#F26522', '#EA3807', '#1A2536', '#0E151E'],
  
  // LEGACY (for backwards compatibility)
  gradientMain: ['#F26522', '#F9A825'],
  gradientTealStart: ['#00BCD4', '#26C6DA'],
  gradientOrangeStart: ['#F26522', '#F9A825'],
};

// Typography configuration
export const Typography = {
  // Font weights
  headerWeight: '900',
  subheaderWeight: '700',
  bodyWeight: '500',
  labelWeight: '600',
  
  // Font sizes
  headerSize: 28,
  titleSize: 24,
  subtitleSize: 18,
  bodySize: 16,
  labelSize: 12,
  smallSize: 11,
};

// Shadow configurations - EXACT from design
export const Shadows = {
  card: {
    shadowColor: '#0E151E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  button: {
    shadowColor: '#F26522',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
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
    shadowColor: '#0E151E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
};

// Border radius values - EXACT from design
export const BorderRadius = {
  button: 25, // Pill-like buttons
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

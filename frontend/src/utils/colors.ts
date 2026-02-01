// RapidReps Official Brand Colors - Bold, Sporty, High-Energy

export const Colors = {
  // PRIMARY - Rapid Orange
  primary: '#FF7A00',
  primaryLight: '#FF9A3E',
  primaryDark: '#E66D00',
  
  // SECONDARY - Teal Accent
  secondary: '#0AAABF',
  secondaryLight: '#0CC4D3',
  secondaryDark: '#0199A7',
  
  // BASE - Deep Navy
  navy: '#002A4A',
  navyLight: '#003D6B',
  navyDark: '#00172C',
  
  // NEUTRAL
  white: '#FFFFFF',
  background: '#001E36',
  lightGray: '#E0E0E0',
  darkGray: '#1A3A52',
  
  // STATUS COLORS
  success: '#0AAABF',
  error: '#FF4444',
  danger: '#FF4444',
  warning: '#FF9A3E',
  
  // TEXT
  text: '#FFFFFF',
  textLight: '#A8C4D9',
  textWhite: '#FFFFFF',
  textNavy: '#002A4A',
  
  // UI ELEMENTS
  border: '#0AAABF',
  borderLight: 'rgba(10, 170, 191, 0.3)',
  shadow: 'rgba(0, 23, 44, 0.4)',
  cardBg: 'rgba(0, 42, 74, 0.8)',
  inputBg: 'rgba(0, 42, 74, 0.9)',
  
  // GRADIENTS
  gradientBackground: ['#002A4A', '#0199A7'],
  gradientBackgroundDark: ['#00172C', '#002A4A'],
  gradientOrange: ['#FF7A00', '#FF9A3E'],
  gradientTeal: ['#0199A7', '#0CC4D3'],
  gradientButton: ['#FF7A00', '#0BBAC2'],
  gradientCard: ['#FF7A00', '#FF9A3E'],
  gradientNavy: ['#002A4A', '#003D6B'],
  
  // LEGACY (for backwards compatibility)
  gradientMain: ['#FF7A00', '#FF9A3E'],
  gradientTealStart: ['#0199A7', '#0CC4D3'],
  gradientOrangeStart: ['#FF7A00', '#FF9A3E'],
};

// Typography configuration
export const Typography = {
  headerFont: 'System', // Would use Montserrat ExtraBold in production
  subheaderFont: 'System', // Would use Montserrat SemiBold in production
  bodyFont: 'System', // Would use Inter Regular in production
  numberFont: 'System', // Would use Inter SemiBold in production
};

// Shadow configuration
export const Shadows = {
  card: {
    shadowColor: '#00172C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    shadowColor: '#00172C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  input: {
    shadowColor: '#00172C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
};

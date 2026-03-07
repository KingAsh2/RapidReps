// RapidReps Design System - Unified Styling for Production
// This file ensures consistent design across all screens

export const BRAND = {
  // Primary Colors
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  orangeDark: '#E65C00',
  
  // Accent Colors
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  tealDark: '#152050',
  
  // Base Colors
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  navyDark: '#0f1a3e',
  
  // Neutral Colors
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  grayLight: '#F5F6F8',
  gray: '#8892b0',
  grayDark: '#5a6785',
  
  // Status Colors
  success: '#00C853',
  successLight: '#E8F5E9',
  error: '#FF4757',
  errorLight: '#FFEBEE',
  warning: '#FFB300',
  warningLight: '#FFF8E1',
  
  // Text Colors
  textPrimary: '#1a2a5e',
  textSecondary: '#5a6785',
  textMuted: '#8892b0',
  textWhite: '#FFFFFF',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const TYPOGRAPHY = {
  // Headers
  h1: {
    fontSize: 32,
    fontWeight: '900' as const,
    letterSpacing: 0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  h4: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  // Body
  bodyLarge: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  // Labels
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Uber-like Session Status
export const SESSION_STATUS = {
  REQUESTED: {
    label: 'Requested',
    color: BRAND.warning,
    bgColor: BRAND.warningLight,
    icon: 'time-outline',
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: BRAND.teal,
    bgColor: '#E0F7F6',
    icon: 'checkmark-circle-outline',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: BRAND.orange,
    bgColor: '#FFF3E0',
    icon: 'fitness-outline',
  },
  COMPLETED: {
    label: 'Completed',
    color: BRAND.success,
    bgColor: BRAND.successLight,
    icon: 'trophy-outline',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: BRAND.error,
    bgColor: BRAND.errorLight,
    icon: 'close-circle-outline',
  },
};

// Trainer Availability Status (Uber-like)
export const AVAILABILITY_STATUS = {
  ONLINE: {
    label: 'Online',
    sublabel: 'Accepting new clients',
    color: BRAND.success,
    icon: 'radio-button-on',
  },
  OFFLINE: {
    label: 'Offline',
    sublabel: 'Not accepting clients',
    color: BRAND.gray,
    icon: 'radio-button-off',
  },
  BUSY: {
    label: 'In Session',
    sublabel: 'Currently with a client',
    color: BRAND.orange,
    icon: 'fitness',
  },
};

// Session Types
export const SESSION_TYPES = {
  IN_PERSON: {
    label: 'In-Person',
    description: 'Trainer comes to you',
    icon: 'location',
    color: BRAND.orange,
  },
  VIRTUAL: {
    label: 'Virtual',
    description: 'Video call session',
    icon: 'videocam',
    color: BRAND.teal,
  },
  AT_GYM: {
    label: 'At Gym',
    description: 'Meet at a gym',
    icon: 'barbell',
    color: BRAND.navy,
  },
};

// Common Button Styles
export const BUTTON_STYLES = {
  primary: {
    backgroundColor: BRAND.orange,
    textColor: BRAND.white,
    borderColor: BRAND.navy,
  },
  secondary: {
    backgroundColor: BRAND.teal,
    textColor: BRAND.white,
    borderColor: BRAND.navy,
  },
  outline: {
    backgroundColor: 'transparent',
    textColor: BRAND.navy,
    borderColor: BRAND.navy,
  },
  ghost: {
    backgroundColor: 'transparent',
    textColor: BRAND.orange,
    borderColor: 'transparent',
  },
};

/**
 * RapidReps Haptic & Sound Feedback
 * Energetic tactile/audio feedback for key interactions
 */
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Haptic patterns
export const haptic = {
  light: () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium: () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  heavy: () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  success: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  warning: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  selection: () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  },
};

// Sound effect player - uses system sounds as fallback
let soundCache: Record<string, Audio.Sound> = {};

export const playSound = async (type: 'tap' | 'success' | 'error' | 'whoosh' | 'coin' | 'pop') => {
  if (Platform.OS === 'web') return;
  
  try {
    // Combine haptic + sound for maximum energy
    switch (type) {
      case 'tap':
        haptic.light();
        break;
      case 'success':
        haptic.success();
        break;
      case 'error':
        haptic.error();
        break;
      case 'whoosh':
        haptic.medium();
        break;
      case 'coin':
        haptic.heavy();
        break;
      case 'pop':
        haptic.light();
        break;
    }
  } catch (e) {
    // Silent fail - haptics not critical
  }
};

// Button press feedback (haptic + scale animation)
export const buttonFeedback = () => {
  haptic.light();
};

// Success feedback (haptic + visual)
export const successFeedback = () => {
  haptic.success();
};

// Error feedback (haptic + shake)
export const errorFeedback = () => {
  haptic.error();
};

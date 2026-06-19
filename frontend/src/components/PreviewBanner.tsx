/**
 * PreviewBanner — iter106am.
 *
 * Translucent top-of-screen pill that appears when the user navigated to a
 * public profile screen with `?preview=1` (i.e. they tapped "Preview as
 * Visitor" on their own profile). Makes it obvious they're in preview mode
 * and provides a one-tap exit so they don't get stuck wondering "why am I
 * looking at my own profile twice?".
 *
 * Position: absolute, top, edge-to-edge with safe-area inset. Renders
 * nothing when `visible` is false.
 */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface Props {
  visible?: boolean;
  /** Tint that matches the screen's accent. Defaults to RapidReps orange. */
  accent?: string | null;
}

export const PreviewBanner: React.FC<Props> = ({ visible, accent }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  if (!visible) return null;
  const tint = accent || '#FF6A00';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.back()}
      style={[
        styles.banner,
        {
          top: insets.top + 6,
          borderColor: `${tint}66`,
          backgroundColor: `${tint}1F`,
        },
      ]}
      data-testid="preview-banner"
    >
      <Ionicons name="eye" size={14} color="#FFFFFF" />
      <Text style={styles.text}>
        You&apos;re previewing your profile as a visitor sees it · <Text style={styles.exit}>Tap to exit</Text>
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    // Subtle blur effect simulated via translucent backgroundColor (set
    // dynamically from accent). No need for a real blur lib here — keeps
    // bundle small and avoids native-module variance.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  exit: {
    textDecorationLine: 'underline',
    fontWeight: '900',
  },
});

export default PreviewBanner;

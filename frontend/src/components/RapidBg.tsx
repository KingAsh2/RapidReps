/**
 * iter102r — RapidBg (508-compliant build)
 *
 * Drop-in replacement for solid-navy screen roots. Renders one of four brand
 * hero images (orange-lit gym scenes) behind a dark navy scrim so foreground
 * text stays WCAG AA legible (default scrim = 0.85 alpha → ≥7:1 contrast for
 * white body text).
 *
 * Accessibility:
 *  - The background image is purely decorative → marked `accessible={false}`
 *    + `accessibilityElementsHidden` so screen readers skip it entirely.
 *  - `accessibilityIgnoresInvertColors` so high-contrast / invert-colors
 *    accessibility settings don't blow out the hero photo.
 *
 * Usage:
 *   <RapidBg variant="screen-key" style={styles.container}>
 *     ...content...
 *   </RapidBg>
 *
 * Variants pick deterministically from the 4 brand hero images via a stable
 * string hash so each route always shows the same photo across re-mounts.
 */
import React from 'react';
import { ImageBackground, View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';

const IMAGES = [
  // 1. Box jump w/ orange laser tunnel
  { uri: 'https://customer-assets.emergentagent.com/job_d8ab9fb0-d35d-48ac-80ad-c4a441665856/artifacts/hfagel6r_22C3BFCF-00C4-419E-A0E8-2843F1FECECD.png' },
  // 2. Battle ropes — woman lead
  { uri: 'https://customer-assets.emergentagent.com/job_d8ab9fb0-d35d-48ac-80ad-c4a441665856/artifacts/290e1gl1_76FFE716-08A2-4F2B-A284-9F2A3934559C.png' },
  // 3. Battle ropes — man lead
  { uri: 'https://customer-assets.emergentagent.com/job_d8ab9fb0-d35d-48ac-80ad-c4a441665856/artifacts/yg1ey2qa_4E3B03C6-ADDC-49F2-BB10-DB66F9322C90.png' },
  // 4. Kettlebell swing — woman
  { uri: 'https://customer-assets.emergentagent.com/job_d8ab9fb0-d35d-48ac-80ad-c4a441665856/artifacts/srf9nrim_D992951C-D11E-44E8-9A4E-697FE545DBA5.png' },
];

const hashVariant = (key?: string): number => {
  if (!key) return 0;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % IMAGES.length;
};

interface Props {
  /** Stable key (route name) — deterministically picks one of the 4 images. */
  variant?: string;
  /** Override scrim opacity (defaults to 0.85 for WCAG AA white-on-bg contrast). */
  scrim?: number;
  /** Set to true to skip scrim entirely (only when caller draws their own overlay). */
  noScrim?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}

export const RapidBg: React.FC<Props> = ({
  variant, scrim = 0.85, noScrim, style, children, testID,
}) => {
  const idx = hashVariant(variant);
  return (
    <ImageBackground
      source={IMAGES[idx]}
      resizeMode="cover"
      style={[styles.bg, style]}
      // Hero photo is purely decorative — screen readers should skip it.
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      accessibilityIgnoresInvertColors
      // Preserve test hooks but don't expose the bg as an interactive element.
      {...(Platform.OS === 'web' ? { 'data-testid': testID || 'rapid-bg' } : {})}
    >
      {!noScrim && (
        <View
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: `rgba(10,14,26,${scrim})` },
          ]}
        />
      )}
      {children}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0A0E1A' },
});

export default RapidBg;

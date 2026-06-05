/**
 * iter102r — RapidBg
 *
 * Drop-in replacement for the `<LinearGradient colors={['#0A0E1A','#141929']}>`
 * roots that were making 29 screens read as flat navy. Renders one of four
 * brand hero images (orange-lit gym scenes) with a dark navy scrim on top
 * so any foreground text/CTAs stay legible.
 *
 * Usage (same surface as LinearGradient):
 *   <RapidBg style={styles.container}>
 *     ...content...
 *   </RapidBg>
 *
 * Image selection is deterministic per `variant` prop — pass a stable string
 * (typically the route name) so the same screen always picks the same image
 * rather than flickering on re-mount. Omit it for the default image.
 */
import React from 'react';
import { ImageBackground, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

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

/** Stable string → IMAGES index (0..3). */
const hashVariant = (key?: string): number => {
  if (!key) return 0;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h % IMAGES.length;
};

interface Props {
  /** Stable key (route name) — deterministically picks one of the 4 images. */
  variant?: string;
  /** Override scrim opacity (defaults to 0.78 — dark enough for white text). */
  scrim?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}

export const RapidBg: React.FC<Props> = ({ variant, scrim = 0.78, style, children, testID }) => {
  const idx = hashVariant(variant);
  return (
    <ImageBackground
      source={IMAGES[idx]}
      resizeMode="cover"
      style={[styles.bg, style]}
      data-testid={testID || 'rapid-bg'}
    >
      {/* Dark navy scrim keeps foreground text/CTAs readable on top of the photo. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: `rgba(10,14,26,${scrim})` },
        ]}
      />
      {children}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0A0E1A' },
});

export default RapidBg;

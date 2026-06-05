/**
 * iter102k — AccentGlowOverlay
 *
 * Renders a soft "neon edge" glow around the entire app screen using the
 * signed-in user's chosen brand accent color (`user.accentColor`). Default
 * is RapidReps orange when no preference is set.
 *
 * Implementation:
 *  - Pure RN <View> + expo-linear-gradient with `pointerEvents="none"` so it
 *    never blocks taps.
 *  - 4 edge gradients (top / bottom / left / right) fade the accent into
 *    transparent over ~70px. The bottom edge fades more deeply so the tab
 *    bar / menu appears wrapped in the color.
 *  - Subtle breathing pulse via Animated to feel alive, not static.
 *  - Mounted once globally in app/_layout.tsx — every route inherits it.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { hexToRgba } from '../utils/accentColor';

const EDGE = 70;        // px of glow falloff from each edge
const BOTTOM_EDGE = 110; // wider glow at the bottom so the tab bar feels wrapped

export const AccentGlowOverlay: React.FC = () => {
  const { user } = useAuth();
  const accent = (user as any)?.accentColor || '#FF6A00';

  // Soft pulse — opacity oscillates between 0.55 and 1.0 every ~3.5s
  const pulse = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // No user signed in? Don't draw the glow — keep auth/onboarding screens clean.
  if (!user) return null;

  const c80 = hexToRgba(accent, 0.55);
  const c40 = hexToRgba(accent, 0.18);
  const c00 = hexToRgba(accent, 0);

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { opacity: pulse }]}>
      {/* Top edge */}
      <LinearGradient
        colors={[c80, c40, c00]}
        style={[styles.edge, { top: 0, left: 0, right: 0, height: EDGE }]}
      />
      {/* Bottom edge — wraps the tab bar */}
      <LinearGradient
        colors={[c00, c40, c80]}
        style={[styles.edge, { bottom: 0, left: 0, right: 0, height: BOTTOM_EDGE }]}
      />
      {/* Left edge */}
      <LinearGradient
        colors={[c80, c40, c00]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.edge, { left: 0, top: 0, bottom: 0, width: EDGE }]}
      />
      {/* Right edge */}
      <LinearGradient
        colors={[c00, c40, c80]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.edge, { right: 0, top: 0, bottom: 0, width: EDGE }]}
      />
      {/* Subtle 1px inner border on all four sides for a defined neon line */}
      <View style={[styles.borderLine, { borderColor: hexToRgba(accent, 0.35) }]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9998 },
  edge: { position: 'absolute' },
  borderLine: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.2,
    borderRadius: 20,
    margin: 2,
  },
});

export default AccentGlowOverlay;

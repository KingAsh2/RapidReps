/**
 * Cinematic, blended RapidReps logo.
 *
 * - Uses the transparent PNG (no boxed background).
 * - Continuous "breathing" pulse: scale + ember halo opacity oscillation.
 * - Subtle slow rotation (±2°) gives the dumbbell weight a living feel.
 * - All animation is GPU-accelerated (useNativeDriver) for performance.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Props = {
  size?: number;        // Logo width (height auto-scales to ~0.9)
  haloIntensity?: number; // 0–1; how strong the ember halo behind logo is
  testID?: string;
};

export const PremiumLogo: React.FC<Props> = ({
  size = 220,
  haloIntensity = 1,
  testID = 'premium-logo',
}) => {
  // Animation refs
  const breath = useRef(new Animated.Value(0)).current;     // 0–1 loop for scale
  const haloPulse = useRef(new Animated.Value(0)).current;  // 0–1 loop for halo opacity
  const tilt = useRef(new Animated.Value(0)).current;       // -1..1 loop for subtle rotation
  const sparkle = useRef(new Animated.Value(0)).current;    // 0–1 loop for ember sparks

  useEffect(() => {
    const loops = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(breath, {
            toValue: 1, duration: 2400,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
          Animated.timing(breath, {
            toValue: 0, duration: 2400,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(haloPulse, {
            toValue: 1, duration: 2800,
            easing: Easing.inOut(Easing.quad), useNativeDriver: true,
          }),
          Animated.timing(haloPulse, {
            toValue: 0, duration: 2800,
            easing: Easing.inOut(Easing.quad), useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(tilt, {
            toValue: 1, duration: 4200,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
          Animated.timing(tilt, {
            toValue: -1, duration: 4200,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkle, {
            toValue: 1, duration: 1800,
            easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
          Animated.timing(sparkle, {
            toValue: 0, duration: 600, useNativeDriver: true,
          }),
        ]),
      ),
    ]);
    loops.start();
    return () => loops.stop();
  }, []);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
  const rotate = tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-1.6deg', '1.6deg'] });
  const haloOpacity = haloPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35 * haloIntensity, 0.75 * haloIntensity],
  });
  const haloScale = haloPulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] });

  // Sparkle dots positions (deterministic, stable across renders)
  const sparkPositions = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        x: (i - 2.5) * (size * 0.11),
        delay: i * 200,
        size: 3 + (i % 3),
      })),
    [size],
  );

  return (
    <View style={[styles.wrap, { width: size, height: size * 0.92 }]} testID={testID}>
      {/* Ember halo — soft radial via shadow only, no solid box */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size * 1.15,
            height: size * 0.7,
            borderRadius: size,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
            shadowRadius: size * 0.35,
          },
        ]}
      />
      {/* The logo itself — breathing + subtle tilt */}
      <Animated.Image
        source={require('../../../assets/rapidreps-logo-premium.png')}
        style={[
          styles.logo,
          {
            width: size,
            height: size * 0.92,
            transform: [{ scale }, { rotate }],
          },
        ]}
        resizeMode="contain"
      />
      {/* Ember sparkles drifting from the bottom (where dumbbell sparks live) */}
      <View pointerEvents="none" style={styles.sparkLayer}>
        {sparkPositions.map((s, i) => {
          const dy = sparkle.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(size * 0.45)],
          });
          const opacity = sparkle.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0, 1, 0],
          });
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                bottom: size * 0.08,
                left: '50%',
                marginLeft: s.x,
                width: s.size,
                height: s.size,
                borderRadius: s.size / 2,
                backgroundColor: '#FFB347',
                shadowColor: '#FF7A00',
                shadowOpacity: 0.95,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
                opacity,
                transform: [{ translateY: dy }],
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  logo: {
    // Drop shadow to lift logo off the cinematic bg — no boxed surface
    shadowColor: '#FF7A00',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  halo: {
    position: 'absolute',
    top: '32%',
    shadowColor: '#FF7A00',
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    // The halo itself is invisible (no bg color) but its shadow paints the glow
    backgroundColor: 'transparent',
    // RN Android needs elevation + a faint backgroundColor for shadow to render;
    // we use a 1% orange tint that effectively reads as glow only.
    elevation: 18,
  },
  sparkLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});

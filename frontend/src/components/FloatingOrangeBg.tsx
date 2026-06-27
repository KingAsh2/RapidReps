/**
 * Floating Orange Particles — subtle background ambience.
 *
 * iter97 (#14): Lifted from the Login/Signup premium hero so any screen can
 * drop them in. Pure RN Animated — no native deps. Auto-fades into the
 * current backdrop (transparent root, pointerEvents="none").
 *
 * Performance: 8 embers by default, native driver enabled, no JS-thread
 * animations. Safe to mount on every screen.
 *
 *   <FloatingOrangeBg />
 *   <FloatingOrangeBg density={12} intensity={0.6} />
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle, AppState } from 'react-native';

type Props = {
  density?: number;     // # of particles. Default 8.
  intensity?: number;   // 0..1 multiplier on opacity. Default 0.45.
  style?: ViewStyle;
};

const Ember: React.FC<{
  delay: number;
  left: string;
  size: number;
  duration: number;
  intensity: number;
  paused: boolean;
}> = ({ delay, left, size, duration, intensity, paused }) => {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (paused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: intensity, duration: duration * 0.25, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: duration * 0.75, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const ty = y.interpolate({ inputRange: [0, 1], outputRange: [0, -180] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: left as any,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FF8A2A',
        opacity,
        transform: [{ translateY: ty }],
        shadowColor: '#FF7A00',
        shadowOpacity: 0.9,
        shadowRadius: size * 1.4,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
};

export const FloatingOrangeBg: React.FC<Props> = ({ density = 8, intensity = 0.45, style }) => {
  // iter106am: pause embers when the app is backgrounded. Each ember runs its
  // own Animated.loop; leaving 8 of them spinning while the OS suspends the
  // app can stall the run-loop on resume (a known contributor to iOS
  // WatchdogTermination on long backgrounds).
  const [paused, setPaused] = useState(AppState.currentState !== 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setPaused(next !== 'active');
    });
    return () => sub.remove();
  }, []);

  const embers = useMemo(
    () =>
      Array.from({ length: density }).map((_, i) => ({
        delay: i * 450 + (i % 3) * 280,
        left: `${(i * 13 + 5) % 92}%`,
        size: 2 + (i % 4) * 1.5,
        duration: 4200 + (i % 5) * 900,
      })),
    [density],
  );

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {embers.map((e, i) => (
        <Ember key={i} {...e} intensity={intensity} paused={paused} />
      ))}
    </View>
  );
};

export default FloatingOrangeBg;

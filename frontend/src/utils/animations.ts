/**
 * RapidReps Animation Utilities
 * Energetic, engaging micro-interactions
 */
import { Animated, Easing } from 'react-native';

// Pulse animation for buttons/CTAs
export const createPulse = (anim: Animated.Value, toValue = 1.05, duration = 800) => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(anim, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ])
  );
};

// Bounce in animation for cards/elements appearing
export const bounceIn = (anim: Animated.Value, delay = 0, duration = 500) => {
  anim.setValue(0);
  return Animated.timing(anim, {
    toValue: 1,
    duration,
    delay,
    easing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
    useNativeDriver: true,
  });
};

// Stagger children animation
export const staggerFadeIn = (anims: Animated.Value[], staggerMs = 80) => {
  return Animated.stagger(
    staggerMs,
    anims.map((a) => {
      a.setValue(0);
      return Animated.timing(a, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    })
  );
};

// Slide up fade in
export const slideUpFadeIn = (
  opacityAnim: Animated.Value,
  translateAnim: Animated.Value,
  delay = 0,
  duration = 450
) => {
  opacityAnim.setValue(0);
  translateAnim.setValue(30);
  return Animated.parallel([
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(translateAnim, {
      toValue: 0,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]);
};

// Scale tap feedback
export const pressIn = (anim: Animated.Value) =>
  Animated.spring(anim, {
    toValue: 0.95,
    useNativeDriver: true,
    speed: 50,
    bounciness: 4,
  });

export const pressOut = (anim: Animated.Value) =>
  Animated.spring(anim, {
    toValue: 1,
    useNativeDriver: true,
    speed: 50,
    bounciness: 4,
  });

// Shake animation for errors
export const shake = (anim: Animated.Value) => {
  anim.setValue(0);
  return Animated.sequence([
    Animated.timing(anim, { toValue: 10, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: -10, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: 8, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: -8, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: 4, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
  ]);
};

// Number counter animation
export const countTo = (
  callback: (value: number) => void,
  from: number,
  to: number,
  duration = 1000
) => {
  const start = Date.now();
  const step = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = Math.round(from + (to - from) * eased);
    callback(current);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

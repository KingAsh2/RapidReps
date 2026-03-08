/**
 * AnimatedScreen - Subtle entrance transition wrapper
 * Applies a gentle fade + slide-up on mount
 */
import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  slideDistance?: number;
}

export const AnimatedScreen: React.FC<Props> = ({
  children,
  style,
  delay = 0,
  duration = 350,
  slideDistance = 18,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        { flex: 1, opacity, transform: [{ translateY }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

/**
 * FadeIn - Simple opacity fade for overlays/modals
 */
export const FadeIn: React.FC<{
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ children, duration = 250, delay = 0, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[{ opacity }, style]}>
      {children}
    </Animated.View>
  );
};

/**
 * Premium cinematic background — uses the Nano Banana-generated PNG for the
 * hero scene (athletic silhouettes + ember storm) and stacks gradient overlays
 * + an animated ember particle layer on top for additional depth.
 *
 * Falls back to pure CSS gradients only if image fails to load (defensive).
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumColors } from '../../theme/premium';

type Props = {
  variant?: 'welcome' | 'login' | 'signup';
  children?: React.ReactNode;
};

const SOURCES = {
  welcome: require('../../assets/images/premium-welcome-bg.png'),
  login: require('../../assets/images/premium-login-bg.png'),
  // Signup reuses welcome bg for cohesion (different hero copy will distinguish)
  signup: require('../../assets/images/premium-welcome-bg.png'),
};

/** Animated ember particle — drifts upward + fades */
const Ember: React.FC<{ delay: number; left: string; size: number; duration: number }> = ({
  delay,
  left,
  size,
  duration,
}) => {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.9, duration: duration * 0.2, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: duration * 0.8, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [0, -260] });
  const translateX = y.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 8, -6] });

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
        backgroundColor: PremiumColors.orangeEmber,
        opacity,
        transform: [{ translateY }, { translateX }],
        shadowColor: PremiumColors.orange,
        shadowOpacity: 0.9,
        shadowRadius: size,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
};

export const PremiumHeroBg: React.FC<Props> = ({ variant = 'welcome', children }) => {
  // Stable ember configuration across renders
  const embers = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        delay: i * 350 + (i % 3) * 200,
        left: `${(i * 7) % 95}%`,
        size: 2.5 + (i % 4) * 1.5,
        duration: 3500 + (i % 5) * 800,
      })),
    [],
  );

  return (
    <View style={styles.root}>
      <ImageBackground source={SOURCES[variant]} style={StyleSheet.absoluteFill} resizeMode="cover">
        {/* Top vignette — keeps hero copy crisp */}
        <LinearGradient
          colors={['rgba(10,10,10,0.45)', 'rgba(10,10,10,0)']}
          style={[StyleSheet.absoluteFill, { height: '40%' }]}
        />
        {/* Bottom vignette — keeps CTAs/forms legible */}
        <LinearGradient
          colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.78)', 'rgba(10,10,10,0.95)']}
          style={[StyleSheet.absoluteFill, { top: '45%' }]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        {/* Animated ember particles drifting upward */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {embers.map((e, i) => (
            <Ember key={i} {...e} />
          ))}
        </View>
        {children}
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PremiumColors.black },
});

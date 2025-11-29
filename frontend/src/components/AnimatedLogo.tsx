import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet, Image } from 'react-native';

type AnimationType = 'burst' | 'spin-bounce' | 'elastic-scale' | 'power-slam' | 'explosive-entry';

interface AnimatedLogoProps {
  size?: number;
  animationType?: AnimationType;
  autoPlay?: boolean;
  loop?: boolean;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  size = 80,
  animationType = 'burst',
  autoPlay = true,
  loop = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (autoPlay) {
      playAnimation();
    }
  }, []);

  const playAnimation = () => {
    switch (animationType) {
      case 'burst':
        // Explosive burst from center with rotation
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.3,
              duration: 150,
              easing: Easing.out(Easing.exp),
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 3,
              tension: 100,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.back(2)),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'spin-bounce':
        // Fast spin with bounce landing
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 0.5,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              velocity: 10,
              tension: 80,
              friction: 4,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(rotateAnim, {
            toValue: 2,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'elastic-scale':
        // Elastic bounce with overshoot
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            velocity: 8,
            tension: 50,
            friction: 3,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'power-slam':
        // Slams in from top with impact
        Animated.parallel([
          Animated.sequence([
            Animated.timing(translateYAnim, {
              toValue: 10,
              duration: 300,
              easing: Easing.out(Easing.exp),
              useNativeDriver: true,
            }),
            Animated.spring(translateYAnim, {
              toValue: 0,
              velocity: 5,
              tension: 100,
              friction: 6,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 0.5,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.2,
              duration: 300,
              easing: Easing.out(Easing.exp),
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'explosive-entry':
        // Multiple effects: scale, rotate, opacity - all explosive
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 0.3,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
              toValue: -0.5,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.spring(scaleAnim, {
              toValue: 1.15,
              velocity: 12,
              tension: 100,
              friction: 5,
              useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 500,
              easing: Easing.out(Easing.back(1.5)),
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (loop) {
            // Reset and replay
            scaleAnim.setValue(0);
            rotateAnim.setValue(0);
            opacityAnim.setValue(0);
            translateYAnim.setValue(-100);
            setTimeout(() => playAnimation(), 1000);
          }
        });
        break;
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0deg', '360deg', '720deg'],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [
              { scale: scaleAnim },
              { rotate: rotateInterpolate },
              { translateY: translateYAnim },
            ],
            opacity: opacityAnim,
          },
        ]}
      >
        <Image
          source={require('../../assets/rapidreps-logo.png')}
          style={[styles.logo, { width: size, height: size }]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});

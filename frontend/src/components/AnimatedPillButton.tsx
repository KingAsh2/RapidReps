import React, { useRef, useEffect } from 'react';
import {
  Animated,
  TouchableWithoutFeedback,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';

type ButtonVariant = 'primary' | 'outline' | 'teal' | 'danger' | 'navy';

interface AnimatedPillButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  showArrow?: boolean;
  gradientColors?: readonly [string, string, ...string[]];
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export const AnimatedPillButton: React.FC<AnimatedPillButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  showArrow = true,
  gradientColors,
  disabled = false,
  loading = false,
  style,
  textStyle,
  testID,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Bouncy entrance
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Continuous shimmer loop
    const delay = variant === 'navy' ? 900 : 0;
    const timer = setTimeout(() => {
      if (!mounted.current) return;
      const runShimmer = () => {
        if (!mounted.current) return;
        shimmerAnim.setValue(0);
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && mounted.current) {
            setTimeout(runShimmer, 2500);
          }
        });
      };
      runShimmer();
    }, delay);

    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      friction: 6,
      tension: 500,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.1,
        friction: 3,
        tension: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // White flash
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const colors: readonly [string, string, ...string[]] = gradientColors
    || (variant === 'teal' ? ['#0ED2CE', '#1FB8B4', '#17A09D'] as const
      : variant === 'danger' ? [Colors.error, '#C0392B'] as const
      : variant === 'navy' ? ['#2A3F7E', '#1A2A5E', '#0F1B3D'] as const
      : ['#00CFC1', '#FF6B35'] as const);

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 400],
  });

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          styles.buttonOuter,
          {
            transform: [{ scale: scaleAnim }],
            opacity: disabled ? 0.5 : scaleAnim,
          },
          style,
        ]}
        {...(testID ? { 'data-testid': testID } : {})}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonInner}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              {icon && <Ionicons name={icon} size={22} color={Colors.white} style={styles.leftIcon} />}
              <Text style={[styles.buttonText, textStyle]}>{title}</Text>
              {showArrow && <Ionicons name="arrow-forward" size={20} color={Colors.white} style={styles.rightIcon} />}
            </>
          )}

          {/* Shimmer sweep */}
          <Animated.View
            style={[
              styles.shimmer,
              { transform: [{ translateX: shimmerTranslateX }, { rotate: '20deg' }] },
            ]}
            pointerEvents="none"
          />

          {/* Flash overlay on press */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.flash,
              { opacity: flashAnim },
            ]}
            pointerEvents="none"
          />
        </LinearGradient>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  buttonOuter: {
    borderRadius: 30,
    overflow: 'hidden',
    marginVertical: 5,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  leftIcon: {
    marginRight: 10,
  },
  rightIcon: {
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  shimmer: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 25,
  },
  flash: {
    backgroundColor: '#fff',
    borderRadius: 30,
    opacity: 0,
  },
});

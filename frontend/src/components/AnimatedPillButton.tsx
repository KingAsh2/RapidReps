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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const shimmerPos = useRef(new Animated.Value(-1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const bounceY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Bouncy entrance
    Animated.parallel([
      Animated.spring(entranceAnim, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(bounceY, {
        toValue: 0,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous shimmer sweep
    const runShimmer = () => {
      shimmerPos.setValue(-1);
      Animated.timing(shimmerPos, {
        toValue: 2,
        duration: 1800,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(runShimmer, 2200);
      });
    };
    const shimmerDelay = variant === 'navy' ? 900 : 0;
    setTimeout(runShimmer, shimmerDelay);

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      friction: 6,
      tension: 500,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.12,
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
      ]),
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const isGradient = variant !== 'outline';
  const colors: readonly [string, string, ...string[]] = gradientColors
    || (variant === 'teal' ? ['#0ED2CE', '#1FB8B4', '#17A09D'] as const
      : variant === 'danger' ? [Colors.error, '#C0392B'] as const
      : variant === 'navy' ? ['#2A3F7E', '#1A2A5E', '#0F1B3D'] as const
      : ['#00CFC1', '#FF6B35'] as const);

  const iconColor = Colors.white;

  const shimmerTranslate = shimmerPos.interpolate({
    inputRange: [-1, 2],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH * 2],
  });

  const glowShadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, variant === 'teal' ? 22 : 18],
  });

  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const glowColor = variant === 'teal' ? '#1FB8B4' : variant === 'navy' ? '#4A6CF7' : '#FF6B35';

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
            transform: [
              { scale: Animated.multiply(scaleAnim, entranceAnim) },
              { translateY: bounceY },
            ],
            opacity: disabled ? 0.5 : entranceAnim,
            shadowColor: glowColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: glowShadowOpacity,
            shadowRadius: glowShadowRadius,
            elevation: 12,
          },
          style,
        ]}
        {...(testID ? { 'data-testid': testID } : {})}
      >
        {isGradient ? (
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
                {icon && <Ionicons name={icon} size={22} color={iconColor} style={styles.leftIcon} />}
                <Text style={[styles.buttonText, textStyle]}>{title}</Text>
                {showArrow && <Ionicons name="arrow-forward" size={20} color={iconColor} style={styles.rightIcon} />}
              </>
            )}
            {/* Shimmer sweep */}
            <Animated.View
              style={[
                styles.shimmer,
                { transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }] },
              ]}
              pointerEvents="none"
            />
            {/* Flash overlay on press */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: '#fff',
                  opacity: Animated.multiply(flashAnim, 0.45),
                  borderRadius: 30,
                },
              ]}
              pointerEvents="none"
            />
          </LinearGradient>
        ) : (
          <View style={styles.buttonInner}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                {icon && <Ionicons name={icon} size={22} color={iconColor} style={styles.leftIcon} />}
                <Text style={[styles.outlineText, textStyle]}>{title}</Text>
                {showArrow && <Ionicons name="arrow-forward" size={20} color={iconColor} style={styles.rightIcon} />}
              </>
            )}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: '#fff',
                  opacity: Animated.multiply(flashAnim, 0.3),
                  borderRadius: 30,
                },
              ]}
              pointerEvents="none"
            />
          </View>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  buttonOuter: {
    borderRadius: 30,
    overflow: 'hidden',
    marginVertical: 5,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  outlineBorder: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
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
  outlineText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  shimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 20,
  },
});

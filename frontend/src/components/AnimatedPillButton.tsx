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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(-1)).current;
  const shimmerPos = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    let alive = true;
    const delay = variant === 'navy' ? 900 : 0;
    const tid = setTimeout(() => {
      const loop = () => {
        if (!alive) return;
        shimmerPos.setValue(-200);
        Animated.timing(shimmerPos, {
          toValue: 400,
          duration: 1600,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && alive) setTimeout(loop, 2500);
        });
      };
      loop();
    }, delay);
    return () => { alive = false; clearTimeout(tid); };
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      friction: 6,
      tension: 400,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    // Energizing bounce-back + flash
    Animated.parallel([
      // Overshoot bounce
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.08,
          friction: 4,
          tension: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 300,
          useNativeDriver: true,
        }),
      ]),
      // Quick flash
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
      // Shine sweep
      Animated.timing(shineAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      shineAnim.setValue(-1);
    });
  };

  const isGradient = variant !== 'outline';
  const colors: readonly [string, string, ...string[]] = gradientColors
    || (variant === 'teal' ? ['#1FB8B4', '#17A09D'] as const
      : variant === 'danger' ? [Colors.error, '#C0392B'] as const
      : variant === 'navy' ? ['#1A2A5E', '#0F1B3D'] as const
      : ['#00CFC1', '#FF6B35'] as const);

  const iconColor = Colors.white;

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
          isGradient && styles.gradientShadow,
          variant === 'outline' && styles.outlineBorder,
          variant === 'navy' && styles.navyShadow,
          {
            transform: [{ scale: scaleAnim }],
            opacity: disabled ? 0.5 : 1,
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
            {/* Flash overlay */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: '#fff',
                  opacity: Animated.multiply(flashAnim, 0.35),
                  borderRadius: 30,
                },
              ]}
              pointerEvents="none"
            />
            {/* Shimmer sweep */}
            <Animated.View
              style={{
                position: 'absolute',
                top: -30,
                bottom: -30,
                width: 50,
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                borderRadius: 25,
                transform: [{ translateX: shimmerPos }, { rotate: '20deg' }],
              }}
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
            {/* Flash overlay */}
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
  },
  gradientShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  navyShadow: {
    shadowColor: '#1A2A5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  outlineBorder: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
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
  outlineText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
});

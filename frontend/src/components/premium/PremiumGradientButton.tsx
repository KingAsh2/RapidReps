/**
 * Premium primary CTA — navy↘orange gradient pill with optional left icon
 * + right arrow. Matches the "FIND A TRAINER" button in the mockup exactly.
 */
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PremiumColors, PremiumRadii, PremiumShadow } from '../../theme/premium';

type Props = {
  label: string;
  onPress: () => void;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'login' | 'secondary';
  loading?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

export const PremiumGradientButton: React.FC<Props> = ({
  label,
  onPress,
  leftIcon,
  rightIcon = 'arrow-forward',
  variant = 'primary',
  loading,
  testID,
  accessibilityLabel,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onIn = () =>
    Animated.spring(scale, { toValue: 0.96, friction: 8, tension: 200, useNativeDriver: true }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 160, useNativeDriver: true }).start();

  const gradient: readonly [string, string, ...string[]] =
    variant === 'login'
      ? ['#FF6A00', '#FF9B2F', '#FFB347', '#FF9B2F', '#FF6A00']
      : variant === 'secondary'
      ? ['rgba(2,4,12,0.97)', 'rgba(6,14,30,0.93)', 'rgba(3,6,16,0.96)']
      : ['#0E1F3D', '#1B2E5C', '#FF7A00', '#FFB347'];

  const isSecondary = variant === 'secondary';
  const isLogin = variant === 'login';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        disabled={loading}
        testID={testID}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="button"
        style={[
          styles.wrap,
          isSecondary && styles.wrapSecondary,
          isLogin && styles.wrapLogin,
          PremiumShadow.glow,
        ]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        >
          {/* Subtle inner glass highlight */}
          <View pointerEvents="none" style={styles.innerHighlight} />
          {/* Secondary: top-edge specular hairline for premium glass feel */}
          {isSecondary && <View pointerEvents="none" style={styles.secondaryEdgeHighlight} />}

          {leftIcon && (
            <View style={styles.leftIconWrap}>
              <Ionicons
                name={leftIcon}
                size={22}
                color={isSecondary ? PremiumColors.orange : PremiumColors.white}
              />
              <View style={styles.divider} />
            </View>
          )}

          <Text
            style={[
              styles.label,
              isSecondary && { color: PremiumColors.white },
              isLogin && { letterSpacing: 4 },
            ]}
          >
            {loading ? '…' : label}
          </Text>

          {rightIcon && !isLogin && (
            <View style={styles.rightIconWrap}>
              <Ionicons name={rightIcon} size={22} color={PremiumColors.white} />
            </View>
          )}
          {isLogin && leftIcon && null}
        </LinearGradient>

        {/* Outer orange glow ring for the secondary "outlined" look */}
        {isSecondary && <View pointerEvents="none" style={styles.outerGlow} />}
      </Pressable>
    </Animated.View>
  );
};

const HEIGHT = 64;

const styles = StyleSheet.create({
  wrap: {
    borderRadius: PremiumRadii.pill,
    overflow: 'visible',
  },
  wrapSecondary: {
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
  },
  wrapLogin: {
    shadowColor: PremiumColors.orangeGlow,
    shadowOpacity: 0.7,
    shadowRadius: 22,
  },
  gradient: {
    height: HEIGHT,
    borderRadius: PremiumRadii.pill,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  innerHighlight: {
    position: 'absolute',
    top: 4,
    left: 16,
    right: 16,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    opacity: 0.5,
  },
  secondaryEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    opacity: 0.9,
  },
  leftIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: 60,
  },
  divider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  rightIconWrap: {
    width: 44,
    alignItems: 'flex-end',
  },
  label: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2.5,
    color: PremiumColors.white,
    textAlign: 'center',
  },
  outerGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: PremiumRadii.pill,
    borderWidth: 2.2,
    borderColor: PremiumColors.orangeGlow,
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.85,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
});

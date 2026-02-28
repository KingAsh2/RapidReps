import React, { useRef } from 'react';
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

type ButtonVariant = 'primary' | 'outline' | 'teal' | 'danger';

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

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      friction: 8,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const isGradient = variant === 'primary' || variant === 'teal' || variant === 'danger';
  const colors: readonly [string, string, ...string[]] = gradientColors
    || (variant === 'teal' ? [Colors.teal, Colors.tealDark] as const
      : variant === 'danger' ? [Colors.error, '#C0392B'] as const
      : ['#00CFC1', '#FF6B35'] as const);

  const iconColor = variant === 'outline' ? Colors.white : Colors.white;

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
          { transform: [{ scale: scaleAnim }], opacity: disabled ? 0.5 : 1 },
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

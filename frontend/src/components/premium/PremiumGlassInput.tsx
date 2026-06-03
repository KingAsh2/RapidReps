/**
 * Glass-morphism input used across Login + Signup premium screens.
 * - Translucent dark surface
 * - Orange focus glow
 * - Optional left icon
 * - Optional right-side toggle (e.g., eye for password)
 */
import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PremiumColors, PremiumRadii } from '../../theme/premium';

type Props = TextInputProps & {
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  testID?: string;
};

export const PremiumGlassInput: React.FC<Props> = ({
  leftIcon,
  rightIcon,
  onRightIconPress,
  testID,
  ...inputProps
}) => {
  const [focused, setFocused] = useState(false);
  const glow = useRef(new Animated.Value(0)).current;

  const onFocus = (e: any) => {
    setFocused(true);
    Animated.timing(glow, { toValue: 1, duration: 220, useNativeDriver: false }).start();
    inputProps.onFocus?.(e);
  };
  const onBlur = (e: any) => {
    setFocused(false);
    Animated.timing(glow, { toValue: 0, duration: 220, useNativeDriver: false }).start();
    inputProps.onBlur?.(e);
  };

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [PremiumColors.glassBorder, PremiumColors.glassBorderFocus],
  });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          borderColor,
          shadowColor: PremiumColors.orange,
          shadowOpacity,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      {leftIcon && (
        <View style={styles.iconWrap}>
          <Ionicons name={leftIcon} size={20} color={PremiumColors.orange} />
        </View>
      )}
      <TextInput
        {...inputProps}
        style={[styles.input, inputProps.style]}
        placeholderTextColor={PremiumColors.textDim}
        onFocus={onFocus}
        onBlur={onBlur}
        testID={testID}
      />
      {rightIcon && (
        <Pressable
          onPress={onRightIconPress}
          hitSlop={12}
          style={styles.iconWrap}
          accessibilityRole="button"
          accessibilityLabel="Toggle visibility"
        >
          <Ionicons name={rightIcon} size={20} color={PremiumColors.orange} />
        </Pressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: PremiumRadii.input,
    borderWidth: 1.4,
    backgroundColor: 'rgba(8,16,38,0.62)',
    paddingHorizontal: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: PremiumColors.white,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 0,
  },
});

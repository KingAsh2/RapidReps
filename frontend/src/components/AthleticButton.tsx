import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';
import { Typography } from '../utils/typography';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
type ButtonSize = 'large' | 'medium' | 'small';

interface AthleticButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: any;
}

export const AthleticButton: React.FC<AthleticButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
}) => {
  const getButtonStyles = () => {
    const baseStyles = [styles.button];
    
    // Size
    if (size === 'large') baseStyles.push(styles.buttonLarge);
    if (size === 'medium') baseStyles.push(styles.buttonMedium);
    if (size === 'small') baseStyles.push(styles.buttonSmall);
    
    // Variant
    if (variant === 'primary') baseStyles.push(styles.buttonPrimary);
    if (variant === 'secondary') baseStyles.push(styles.buttonSecondary);
    if (variant === 'outline') baseStyles.push(styles.buttonOutline);
    if (variant === 'danger') baseStyles.push(styles.buttonDanger);
    
    // State
    if (disabled || loading) baseStyles.push(styles.buttonDisabled);
    if (fullWidth) baseStyles.push(styles.buttonFullWidth);
    
    return baseStyles;
  };

  const getTextStyles = () => {
    const baseStyles = [styles.buttonText];
    
    if (variant === 'primary') baseStyles.push(styles.textPrimary);
    if (variant === 'secondary') baseStyles.push(styles.textSecondary);
    if (variant === 'outline') baseStyles.push(styles.textOutline);
    if (variant === 'danger') baseStyles.push(styles.textDanger);
    if (disabled || loading) baseStyles.push(styles.textDisabled);
    
    return baseStyles;
  };

  const getIconColor = () => {
    if (disabled || loading) return Colors.textLight;
    if (variant === 'outline') return Colors.primary;
    return Colors.white;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[...getButtonStyles(), style]}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator size="small" color={getIconColor()} />
        ) : (
          icon && <Ionicons name={icon} size={24} color={getIconColor()} />
        )}
        <Text style={getTextStyles()}>
          {loading ? 'LOADING...' : title.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 0,
  },
  buttonLarge: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  buttonMedium: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonSmall: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  buttonFullWidth: {
    width: '100%',
  },
  
  // Variants
  buttonPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.navy,
  },
  buttonSecondary: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.navy,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderColor: Colors.navy,
  },
  buttonDanger: {
    backgroundColor: Colors.error,
    borderColor: Colors.navy,
  },
  buttonDisabled: {
    backgroundColor: Colors.lightGray,
    borderColor: Colors.textLight,
    opacity: 0.6,
  },
  
  // Content
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  
  // Text Styles
  buttonText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textPrimary: {
    color: Colors.white,
  },
  textSecondary: {
    color: Colors.navy,
  },
  textOutline: {
    color: Colors.navy,
  },
  textDanger: {
    color: Colors.white,
  },
  textDisabled: {
    color: Colors.textLight,
  },
});

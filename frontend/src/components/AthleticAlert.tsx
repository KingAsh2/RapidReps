import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AthleticAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
  onClose: () => void;
  showInput?: boolean;
  inputPlaceholder?: string;
  onInputSubmit?: (value: string) => void;
}

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  yellow: '#FDBB2D',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  error: '#FF4757',
  errorDark: '#E84118',
  warning: '#FFA502',
  warningDark: '#FF8C00',
};

export default function AthleticAlert({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK', style: 'default' }],
  onClose,
  showInput = false,
  inputPlaceholder = '',
  onInputSubmit,
}: AthleticAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;
  const [inputValue, setInputValue] = React.useState('');

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Icon pulse for error/warning
      if (type === 'error' || type === 'warning') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(iconPulseAnim, {
              toValue: 1.1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(iconPulseAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    } else {
      // Exit animation
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getConfig = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'alert-circle' as const,
          gradientColors: [COLORS.error, COLORS.errorDark] as [string, string],
          iconBgColors: ['rgba(255,71,87,0.2)', 'rgba(232,65,24,0.2)'] as [string, string],
          accentColor: COLORS.error,
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          gradientColors: [COLORS.orangeHot, COLORS.orange] as [string, string],
          iconBgColors: ['rgba(255,106,0,0.2)', 'rgba(247,147,30,0.2)'] as [string, string],
          accentColor: COLORS.orangeHot,
        };
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          gradientColors: [COLORS.teal, COLORS.tealLight] as [string, string],
          iconBgColors: ['rgba(31,184,180,0.2)', 'rgba(34,193,195,0.2)'] as [string, string],
          accentColor: COLORS.teal,
        };
      default: // info
        return {
          icon: 'information-circle' as const,
          gradientColors: [COLORS.navy, '#2a3a6e'] as [string, string],
          iconBgColors: ['rgba(26,42,94,0.15)', 'rgba(42,58,110,0.15)'] as [string, string],
          accentColor: COLORS.navy,
        };
    }
  };

  const config = getConfig();

  const handleButtonPress = (button: AlertButton) => {
    if (showInput && onInputSubmit && button.style !== 'cancel') {
      onInputSubmit(inputValue);
    }
    if (button.onPress) {
      button.onPress();
    }
    onClose();
    setInputValue('');
  };

  const getButtonGradient = (button: AlertButton): [string, string] => {
    if (button.style === 'destructive') {
      return [COLORS.error, COLORS.errorDark];
    }
    if (button.style === 'cancel') {
      return ['#F0F4F8', '#E8ECF0'];
    }
    // Default - use accent gradient
    return [COLORS.teal, COLORS.tealLight];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          {/* Backdrop blur effect */}
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'rgba(26,42,94,0.85)']}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <Animated.View
            style={[
              styles.alertWrapper,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            {/* Main Alert Card */}
            <View style={styles.alertCard}>
              {/* Top Gradient Accent Bar */}
              <LinearGradient
                colors={config.gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.accentBar}
              />

              {/* Icon Container */}
              <View style={styles.iconWrapper}>
                <LinearGradient
                  colors={config.iconBgColors}
                  style={styles.iconBackground}
                >
                  <Animated.View style={{ transform: [{ scale: iconPulseAnim }] }}>
                    <Ionicons 
                      name={config.icon} 
                      size={48} 
                      color={config.accentColor} 
                    />
                  </Animated.View>
                </LinearGradient>
              </View>

              {/* Content */}
              <View style={styles.contentContainer}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>

                {/* Optional Input Field */}
                {showInput && (
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      placeholder={inputPlaceholder}
                      placeholderTextColor="#8892b0"
                      value={inputValue}
                      onChangeText={setInputValue}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                )}
              </View>

              {/* Buttons */}
              <View style={[
                styles.buttonsContainer,
                buttons.length === 2 && styles.buttonsRow,
              ]}>
                {buttons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleButtonPress(button)}
                      style={[
                        styles.button,
                        buttons.length === 2 && styles.buttonHalf,
                      ]}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={getButtonGradient(button)}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {isDestructive && (
                          <Ionicons 
                            name="trash-outline" 
                            size={18} 
                            color={COLORS.white} 
                            style={styles.buttonIcon}
                          />
                        )}
                        <Text
                          style={[
                            styles.buttonText,
                            isCancel && styles.buttonTextCancel,
                          ]}
                        >
                          {button.text}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertWrapper: {
    width: '100%',
    maxWidth: 340,
  },
  alertCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  accentBar: {
    height: 6,
    width: '100%',
  },
  iconWrapper: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 8,
  },
  iconBackground: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingHorizontal: 28,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: '#5a6a8a',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    marginTop: 20,
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E8ECF0',
  },
  textInput: {
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.navy,
    minHeight: 80,
  },
  buttonsContainer: {
    padding: 20,
    gap: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  buttonTextCancel: {
    color: COLORS.navy,
  },
});

// Static method to show alerts programmatically
let alertController: {
  show: (config: {
    title: string;
    message: string;
    type?: AlertType;
    buttons?: AlertButton[];
  }) => void;
} | null = null;

export function setAlertController(controller: typeof alertController) {
  alertController = controller;
}

export function showAlert(config: {
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
}) {
  if (alertController) {
    alertController.show(config);
  }
}

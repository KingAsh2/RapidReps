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

// Brand colors - consistent with app
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  error: '#FF4757',
  errorDark: '#D63031',
  warning: '#F7931E',
  warningDark: '#FF6A00',
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

      // Pulse animation for error/warning
      if (type === 'error' || type === 'warning') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(iconPulseAnim, {
              toValue: 1.15,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(iconPulseAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    } else {
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
          iconColor: COLORS.white,
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          gradientColors: [COLORS.orangeHot, COLORS.orange] as [string, string],
          iconColor: COLORS.white,
        };
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          gradientColors: [COLORS.teal, COLORS.tealLight] as [string, string],
          iconColor: COLORS.white,
        };
      default: // info
        return {
          icon: 'information-circle' as const,
          gradientColors: [COLORS.navy, COLORS.navyLight] as [string, string],
          iconColor: COLORS.white,
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

  const getButtonStyle = (button: AlertButton) => {
    if (button.style === 'destructive') {
      return {
        colors: [COLORS.error, COLORS.errorDark] as [string, string],
        textColor: COLORS.white,
      };
    }
    if (button.style === 'cancel') {
      return {
        colors: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.1)'] as [string, string],
        textColor: COLORS.white,
      };
    }
    // Default - white button
    return {
      colors: [COLORS.white, '#F5F5F5'] as [string, string],
      textColor: COLORS.navy,
    };
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
          {/* Dark overlay */}
          <View style={styles.backdrop} />

          <Animated.View
            style={[
              styles.alertWrapper,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            {/* Main Alert Card with Gradient */}
            <LinearGradient
              colors={config.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.alertCard}
            >
              {/* Decorative glow */}
              <View style={styles.glowCircle} />
              
              {/* Icon */}
              <Animated.View 
                style={[
                  styles.iconContainer,
                  { transform: [{ scale: iconPulseAnim }] }
                ]}
              >
                <View style={styles.iconBg}>
                  <Ionicons name={config.icon} size={36} color={config.gradientColors[0]} />
                </View>
              </Animated.View>

              {/* Content */}
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              {/* Optional Input */}
              {showInput && (
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={inputPlaceholder}
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={inputValue}
                    onChangeText={setInputValue}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Buttons */}
              <View style={[
                styles.buttonsContainer,
                buttons.length === 2 && styles.buttonsRow,
              ]}>
                {buttons.map((button, index) => {
                  const btnStyle = getButtonStyle(button);
                  
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
                        colors={btnStyle.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        <Text style={[styles.buttonText, { color: btnStyle.textColor }]}>
                          {button.text}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </LinearGradient>
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
    padding: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  alertWrapper: {
    width: '100%',
    maxWidth: 340,
  },
  alertCard: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 24,
  },
  glowCircle: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.white,
    minHeight: 80,
  },
  buttonsContainer: {
    width: '100%',
    gap: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonHalf: {
    flex: 1,
  },
  buttonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

// Static controller
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

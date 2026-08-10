import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type AlertType = 'success' | 'error' | 'warning' | 'info';
type IconName = keyof typeof Ionicons.glyphMap;

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  icon?: IconName;
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
  /** Optional Ionicons name for the top disc. If omitted, we pick a sensible
   *  default from `type` (or the title, e.g. "logout" → log-out). */
  icon?: IconName;
}

// iter118bc premium palette — matches the pixel-locked mockup
const PALETTE = {
  orange: '#FF6A00',
  orangeBright: '#FF7A1A',
  orangeSoft: '#FFA85E',
  cardBg: '#0E1116',
  cardBgInner: '#0A0D14',
  discBg: '#0A0D14',
  white: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.09)',
  closeBg: 'rgba(255,255,255,0.08)',
  closeFg: 'rgba(255,255,255,0.65)',
};

// Guess an icon from the title when the caller doesn't provide one.
function guessIconFromTitle(title: string, type: AlertType): IconName {
  const t = (title || '').toLowerCase();
  if (t.includes('logout') || t.includes('log out') || t.includes('sign out')) return 'log-out';
  if (t.includes('delete') || t.includes('remove')) return 'trash';
  if (t.includes('end session') || t.includes('cancel session') || t.includes('end ')) return 'stop-circle';
  if (t.includes('cancel')) return 'close-circle';
  if (t.includes('block')) return 'ban';
  if (t.includes('report')) return 'flag';
  if (t.includes('refund')) return 'cash';
  if (t.includes('accept')) return 'checkmark-circle';
  if (t.includes('decline')) return 'close-circle';
  if (t.includes('location')) return 'location';
  if (t.includes('connection') || t.includes('network') || t.includes('offline')) return 'wifi';
  if (t.includes('email')) return 'mail';
  if (t.includes('phone') || t.includes('facetime')) return 'call';
  if (t.includes('link') || t.includes('invalid link')) return 'link';
  if (t.includes('login') || t.includes('sign in')) return 'log-in';
  if (t.includes('authentication') || t.includes('auth')) return 'shield-checkmark';
  if (t.includes('booking') || t.includes('booked')) return 'calendar';
  if (t.includes('loading')) return 'refresh';
  if (t.includes('payment') || t.includes('paid') || t.includes('pay')) return 'card';
  if (t.includes('save')) return 'save';
  if (t.includes('discard')) return 'trash-bin';
  if (t.includes('rate') || t.includes('review') || t.includes('rating')) return 'star';
  if (t.includes('choose your path') || t.includes('choose')) return 'compass';
  if (t.includes('congrat') || t.includes('success') || t.includes('confirmed') || t.includes('✓')) return 'checkmark-circle';
  if (t.includes('error') || t.includes('failed') || t.includes('unable') || t.includes('required')) return 'alert-circle';
  if (t.includes('warning') || t.includes('are you sure') || t.includes('?')) return 'warning';
  // Fall back to type
  if (type === 'success') return 'checkmark-circle';
  if (type === 'error') return 'alert-circle';
  if (type === 'warning') return 'warning';
  return 'information-circle';
}

// Guess an icon for the primary (non-cancel) button, matching the disc icon.
function guessButtonIcon(buttonText: string, alertIcon: IconName, style?: string): IconName {
  const t = (buttonText || '').toLowerCase();
  if (t.includes('logout') || t.includes('log out') || t.includes('sign out')) return 'log-out';
  if (t.includes('delete') || t.includes('remove')) return 'trash';
  if (t.includes('block')) return 'ban';
  if (t.includes('report')) return 'flag';
  if (t.includes('refund')) return 'cash';
  if (t.includes('confirm') || t.includes('yes') || t.includes('ok')) return 'checkmark';
  if (t.includes('save')) return 'save';
  if (t.includes('discard')) return 'trash-bin';
  if (style === 'destructive') return alertIcon;
  return 'arrow-forward';
}

/** Six tiny ember dots that dance around the disc — cheap decoration, no deps. */
function EmberDots() {
  return (
    <>
      <View style={[dotStyles.dot, { top: 4, left: 22, opacity: 0.85 }]} />
      <View style={[dotStyles.dot, { top: 18, right: 8, opacity: 0.55 }]} />
      <View style={[dotStyles.dot, { top: 46, left: -4, opacity: 0.7 }]} />
      <View style={[dotStyles.dot, { bottom: 32, right: -4, opacity: 0.5 }]} />
      <View style={[dotStyles.dot, { bottom: 8, left: 30, opacity: 0.7 }]} />
      <View style={[dotStyles.dot, { bottom: 22, right: 26, opacity: 0.35 }]} />
    </>
  );
}
const dotStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.orange,
  },
});

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
  icon,
}: AthleticAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ringPulseAnim = useRef(new Animated.Value(1)).current;
  const [inputValue, setInputValue] = React.useState('');

  const resolvedIcon: IconName = useMemo(
    () => icon || guessIconFromTitle(title, type),
    [icon, title, type],
  );

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 110,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      // Subtle breathing pulse on the ring, always on — feels alive.
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulseAnim, {
            toValue: 1.06,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(ringPulseAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

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

  // Order the buttons so Cancel is always on the LEFT and the primary CTA on
  // the RIGHT (matches the mockup). We do NOT mutate the caller's array.
  const orderedButtons = useMemo(() => {
    if (!buttons || buttons.length !== 2) return buttons;
    const [a, b] = buttons;
    if (a.style === 'cancel' && b.style !== 'cancel') return [a, b];
    if (b.style === 'cancel' && a.style !== 'cancel') return [b, a];
    return buttons;
  }, [buttons]);

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
          <TouchableOpacity
            activeOpacity={1}
            onPress={onClose}
            style={styles.backdrop}
            data-testid="alert-backdrop"
          />

          <Animated.View
            style={[
              styles.alertWrapper,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
            data-testid="premium-alert-card"
          >
            {/* Outer orange glow — layered behind the card via shadow */}
            <View style={styles.cardGlow} pointerEvents="none" />

            <View style={styles.card}>
              {/* Top-right close (X) button */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                data-testid="alert-close-btn"
                accessibilityLabel="Close alert"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={18} color={PALETTE.closeFg} />
              </TouchableOpacity>

              {/* Icon disc with pulsing orange ring + ember dots */}
              <View style={styles.discWrap}>
                <EmberDots />
                <Animated.View
                  style={[
                    styles.discRing,
                    { transform: [{ scale: ringPulseAnim }] },
                  ]}
                />
                <View style={styles.disc}>
                  <Ionicons name={resolvedIcon} size={44} color={PALETTE.orange} />
                </View>
              </View>

              {/* Title + message */}
              <Text style={styles.title} data-testid="alert-title">
                {title}
              </Text>
              {message ? (
                <Text style={styles.message} data-testid="alert-message">
                  {message}
                </Text>
              ) : null}

              {/* Optional input */}
              {showInput && (
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={inputPlaceholder}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={inputValue}
                    onChangeText={setInputValue}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Buttons */}
              <View
                style={[
                  styles.buttonsContainer,
                  orderedButtons && orderedButtons.length === 2 && styles.buttonsRow,
                ]}
              >
                {(orderedButtons || []).map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';
                  const btnIcon: IconName =
                    button.icon || (isCancel ? 'close-circle' : guessButtonIcon(button.text, resolvedIcon, button.style));

                  return (
                    <TouchableOpacity
                      key={`${button.text}-${index}`}
                      onPress={() => handleButtonPress(button)}
                      style={[
                        styles.button,
                        orderedButtons && orderedButtons.length === 2 && styles.buttonHalf,
                        isCancel ? styles.cancelBtn : styles.primaryBtnShadow,
                      ]}
                      activeOpacity={0.88}
                      data-testid={`alert-btn-${isCancel ? 'cancel' : isDestructive ? 'destructive' : 'primary'}`}
                    >
                      {isCancel ? (
                        <View style={styles.cancelInner}>
                          <Ionicons name={btnIcon} size={20} color={PALETTE.white} />
                          <Text style={styles.cancelText}>{button.text}</Text>
                        </View>
                      ) : (
                        <LinearGradient
                          colors={[PALETTE.orangeBright, PALETTE.orange]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.primaryInner}
                        >
                          <Ionicons name={btnIcon} size={20} color={PALETTE.white} />
                          <Text style={styles.primaryText}>{button.text}</Text>
                        </LinearGradient>
                      )}
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  alertWrapper: {
    width: '100%',
    maxWidth: 380,
  },
  cardGlow: {
    // Warm orange bloom behind the card — done with a translated shadow
    // sitting under the card border so it reads as light spillage.
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    shadowColor: PALETTE.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 20,
  },
  card: {
    borderRadius: 28,
    paddingTop: 30,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: PALETTE.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.42)',
    // Extra inner shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PALETTE.closeBg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  // Icon disc + ring + dots
  discWrap: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 22,
  },
  discRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    borderColor: 'rgba(255,106,0,0.55)',
    shadowColor: PALETTE.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  disc: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: PALETTE.discBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Typography
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: PALETTE.white,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: PALETTE.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: PALETTE.white,
    minHeight: 80,
  },
  // Buttons
  buttonsContainer: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonHalf: {
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: PALETTE.glass,
    borderWidth: 1,
    borderColor: PALETTE.glassBorder,
  },
  cancelInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.white,
    letterSpacing: 0.2,
  },
  primaryBtnShadow: {
    shadowColor: PALETTE.orange,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  },
  primaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: PALETTE.white,
    letterSpacing: 0.2,
  },
});

// Static controller (backwards compat with existing showAlert callers)
let alertController: {
  show: (config: {
    title: string;
    message: string;
    type?: AlertType;
    buttons?: AlertButton[];
    icon?: IconName;
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
  icon?: IconName;
}) {
  if (alertController) {
    alertController.show(config);
  }
}

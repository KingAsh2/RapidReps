import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Vibrant brand colors
const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  orangeGlow: '#FFB347',
  teal: '#00CFC1',
  tealLight: '#22E8DF',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  error: '#FF4757',
  success: '#00D26A',
};

interface SafetyPinEntryProps {
  onPinVerified: (pin: string) => Promise<boolean>;
  onCancel?: () => void;
  sessionType?: 'in_home' | 'outdoor';
}

export const SafetyPinEntry: React.FC<SafetyPinEntryProps> = ({
  onPinVerified,
  onCancel,
  sessionType = 'in_home',
}) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const handlePinChange = (value: string, index: number) => {
    if (value.length > 1) {
      value = value[value.length - 1];
    }
    
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (index === 3 && value && newPin.every(d => d)) {
      verifyPin(newPin.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyPin = async (pinString: string) => {
    setVerifying(true);
    setError('');

    try {
      const success = await onPinVerified(pinString);
      
      if (success) {
        setVerified(true);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Success animation
        Animated.spring(successAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }).start();
      } else {
        handleError();
      }
    } catch (err) {
      handleError();
    } finally {
      setVerifying(false);
    }
  };

  const handleError = () => {
    setError('Invalid PIN. Please try again.');
    setPin(['', '', '', '']);
    inputRefs.current[0]?.focus();
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Shake animation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  if (verified) {
    return (
      <Animated.View 
        style={[
          styles.container, 
          styles.successContainer,
          { transform: [{ scale: successAnim }] }
        ]}
      >
        <LinearGradient
          colors={[COLORS.success, '#00A854']}
          style={styles.successGradient}
        >
          <Ionicons name="checkmark-circle" size={64} color={COLORS.white} />
          <Text style={styles.successTitle}>PIN Verified! ✓</Text>
          <Text style={styles.successSubtitle}>Session is starting...</Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name={sessionType === 'in_home' ? 'home' : 'location'} 
            size={32} 
            color={COLORS.orange} 
          />
        </View>
        <Text style={styles.title}>Enter Safety PIN</Text>
        <Text style={styles.subtitle}>
          Ask the client for their 4-digit safety PIN to start the session
        </Text>
      </View>

      {/* PIN Input */}
      <Animated.View 
        style={[
          styles.pinContainer,
          { transform: [{ translateX: shakeAnim }] }
        ]}
      >
        {pin.map((digit, index) => (
          <View 
            key={index} 
            style={[
              styles.pinBox,
              digit ? styles.pinBoxFilled : null,
              error ? styles.pinBoxError : null,
            ]}
          >
            <TextInput
              ref={ref => inputRefs.current[index] = ref}
              style={styles.pinInput}
              value={digit}
              onChangeText={(value) => handlePinChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!verifying}
            />
          </View>
        ))}
      </Animated.View>

      {/* Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={16} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Verifying State */}
      {verifying && (
        <View style={styles.verifyingContainer}>
          <Text style={styles.verifyingText}>Verifying PIN...</Text>
        </View>
      )}

      {/* Safety Info */}
      <View style={styles.safetyInfo}>
        <Ionicons name="shield-checkmark" size={20} color={COLORS.teal} />
        <Text style={styles.safetyText}>
          The PIN ensures both trainer and client safety
        </Text>
      </View>

      {/* Cancel Button */}
      {onCancel && (
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel Session</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

interface ClientSafetyPinProps {
  pin: string;
  sessionType?: 'in_home' | 'outdoor';
}

export const ClientSafetyPin: React.FC<ClientSafetyPinProps> = ({ 
  pin, 
  sessionType = 'in_home' 
}) => {
  return (
    <View style={styles.clientPinContainer}>
      <LinearGradient
        colors={[COLORS.orange, COLORS.orangeLight]}
        style={styles.clientPinGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.clientPinHeader}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.white} />
          <Text style={styles.clientPinTitle}>Your Safety PIN</Text>
        </View>
        
        <View style={styles.clientPinDisplay}>
          {pin.split('').map((digit, index) => (
            <View key={index} style={styles.clientPinDigit}>
              <Text style={styles.clientPinDigitText}>{digit}</Text>
            </View>
          ))}
        </View>
        
        <Text style={styles.clientPinInstructions}>
          🔒 Share this PIN with your trainer when they arrive to start the session
        </Text>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  successContainer: {
    padding: 0,
    overflow: 'hidden',
  },
  successGradient: {
    padding: 40,
    alignItems: 'center',
    width: '100%',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 16,
  },
  successSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  pinContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pinBox: {
    width: 56,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBoxFilled: {
    borderColor: COLORS.orange,
    backgroundColor: '#FFF5EB',
  },
  pinBoxError: {
    borderColor: COLORS.error,
    backgroundColor: '#FFF5F5',
  },
  pinInput: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  verifyingContainer: {
    marginBottom: 16,
  },
  verifyingText: {
    color: COLORS.orange,
    fontSize: 14,
    fontWeight: '600',
  },
  safetyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8FFF5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  safetyText: {
    fontSize: 13,
    color: COLORS.navy,
    flex: 1,
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 12,
  },
  cancelText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  // Client PIN Display
  clientPinContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  clientPinGradient: {
    padding: 24,
    alignItems: 'center',
  },
  clientPinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  clientPinTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  clientPinDisplay: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  clientPinDigit: {
    width: 52,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientPinDigitText: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.white,
  },
  clientPinInstructions: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SafetyPinEntry;

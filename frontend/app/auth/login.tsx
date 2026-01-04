import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/utils/colors';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login, user, activeRole } = useAuth();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Animation values
  const gradientAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const emailFocusAnim = useRef(new Animated.Value(0)).current;
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;
  const buttonPressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lockShakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animated gradient background
    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(gradientAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Card entrance animation
    Animated.spring(cardAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Pulse animation for button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (user && activeRole && loginSuccess) {
      const timer = setTimeout(() => {
        if (activeRole === 'trainer') {
          router.replace('/trainer/home');
        } else if (activeRole === 'trainee') {
          router.replace('/trainee/(tabs)/home');
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [user, activeRole, loginSuccess]);

  const handleEmailFocus = () => {
    Animated.spring(emailFocusAnim, {
      toValue: 1,
      tension: 50,
      friction: 3,
      useNativeDriver: false,
    }).start();
  };

  const handleEmailBlur = () => {
    Animated.spring(emailFocusAnim, {
      toValue: 0,
      tension: 50,
      friction: 3,
      useNativeDriver: false,
    }).start();
  };

  const handlePasswordFocus = () => {
    Animated.spring(passwordFocusAnim, {
      toValue: 1,
      tension: 50,
      friction: 3,
      useNativeDriver: false,
    }).start();
    // Lock shake animation
    Animated.sequence([
      Animated.timing(lockShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(lockShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(lockShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(lockShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handlePasswordBlur = () => {
    Animated.spring(passwordFocusAnim, {
      toValue: 0,
      tension: 50,
      friction: 3,
      useNativeDriver: false,
    }).start();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert({
        title: 'Missing Info',
        message: 'Please enter both email and password',
        type: 'warning',
      });
      return;
    }

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonPressAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonPressAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      setLoginSuccess(true);
      // Navigate immediately without popup
    } catch (error: any) {
      showAlert({
        title: 'Login Failed',
        message: error.response?.data?.detail || 'Invalid email or password',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const emailBorderColor = emailFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.3)', Colors.warning],
  });

  const passwordBorderColor = passwordFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.3)', Colors.warning],
  });

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const gradientTranslateX = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  return (
    <View style={styles.container}>
      {/* Animated Gradient Background */}
      <Animated.View
        style={[
          styles.gradientBackground,
          {
            transform: [
              { translateX: gradientTranslateX },
              { scale: 1.2 },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#FF6B35', '#F7931E', '#00CFC1', '#1a2a5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Back Button */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={Colors.white} />
          </TouchableOpacity>

          {/* Login Card */}
          <Animated.View
            style={[
              styles.cardContainer,
              {
                opacity: cardAnim,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            {/* Glassmorphism Card */}
            <View style={styles.glassCard}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Let's Finish What{"\n"}You Started</Text>
                <Text style={styles.subtitle}>Time to lock in 💪⚡</Text>
              </View>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <Animated.View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: emailBorderColor,
                      borderWidth: emailFocusAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [2, 3],
                      }),
                    },
                  ]}
                >
                  <Ionicons name="mail" size={20} color={Colors.white} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="john@example.com"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={handleEmailFocus}
                    onBlur={handleEmailBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Animated.View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <Animated.View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: passwordBorderColor,
                      borderWidth: passwordFocusAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [2, 3],
                      }),
                      transform: [{ translateX: lockShakeAnim }],
                    },
                  ]}
                >
                  <Ionicons
                    name={showPassword ? 'lock-open' : 'lock-closed'}
                    size={20}
                    color={Colors.white}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="rgba(255, 255, 255, 0.7)"
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={() => router.push('/auth/forgot-password')}
                style={styles.forgotButton}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <Animated.View
                style={[
                  styles.loginButtonContainer,
                  {
                    transform: [
                      { scale: loading ? 1 : buttonPressAnim },
                      { scale: loading ? 1 : pulseAnim },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading}
                  style={styles.loginButton}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#00CFC1', '#FF6B35']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <View style={styles.loginButtonContent}>
                        <Text style={styles.loginButtonText}>Log In</Text>
                        <Ionicons name="flash" size={20} color={Colors.white} />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Sign Up Link */}
              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                  <Text style={styles.signupLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
    width: width * 2,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  glassCard: {
    backgroundColor: 'rgba(26, 42, 94, 0.85)',
    borderRadius: 24,
    padding: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 10,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.warning,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning,
    textDecorationLine: 'underline',
  },
  loginButtonContainer: {
    marginBottom: 24,
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  loginButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.warning,
    textDecorationLine: 'underline',
  },
});

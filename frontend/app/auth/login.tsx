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
  Image,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/utils/colors';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { AnimatedPillButton } from '../../src/components/AnimatedPillButton';
import { haptic } from '../../src/utils/haptics';
import { SocialAuthButtons } from '../../src/components/SocialAuthButtons';

const { width } = Dimensions.get('window');

const BRAND = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  navy: '#1a2a5e',
  white: '#FFFFFF',
};

const backgroundImage = require('../../assets/images/bg-battle-ropes.png');

export default function LoginScreen() {
  const router = useRouter();
  const { login, user, activeRole } = useAuth();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.6)).current;
  const headerShimmer = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-60)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const combinedLogoScale = useRef(Animated.multiply(logoScale, pulseScale)).current;
  const emailBorderAnim = useRef(new Animated.Value(0)).current;
  const passwordBorderAnim = useRef(new Animated.Value(0)).current;
  const lockShakeAnim = useRef(new Animated.Value(0)).current;
  const buttonPressAnim = useRef(new Animated.Value(1)).current;
  const animationsAlive = useRef(true);

  useEffect(() => {
    // Staggered cinematic entrance: header slides down first, then logo scales up
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(headerSlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      ]),
    ]).start(() => {
      if (animationsAlive.current) startPulse();
    });
    return () => { animationsAlive.current = false; };
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.06, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 0.98, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.03, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(1800),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.9, duration: 200, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerShimmer, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(headerShimmer, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  };

  useEffect(() => {
    if (user && activeRole && loginSuccess) {
      const timer = setTimeout(() => {
        if (activeRole === 'admin') router.replace('/admin/dashboard');
        else if (activeRole === 'trainer') router.replace('/trainer/(tabs)/home');
        else router.replace('/trainee/(tabs)/home');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, activeRole, loginSuccess]);

  const animateFocus = (anim: Animated.Value, toValue: number) => {
    try {
      anim.stopAnimation();
      Animated.spring(anim, { toValue, tension: 50, friction: 3, useNativeDriver: false }).start();
    } catch (e) {
      anim.setValue(toValue);
    }
  };

  const handlePasswordFocus = () => {
    animateFocus(passwordBorderAnim, 1);
    Animated.sequence([
      Animated.timing(lockShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(lockShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(lockShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(lockShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!email || !password) {
      haptic.warning();
      showAlert({ title: 'Missing Info', message: 'Please enter both email and password', type: 'warning' });
      return;
    }
    haptic.medium();
    Animated.sequence([
      Animated.timing(buttonPressAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonPressAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    setLoading(true);
    try {
      const loggedInUser = await login(email.trim().toLowerCase(), password);
      haptic.success();
      setLoginSuccess(true);
      if (loggedInUser.isAdmin || loggedInUser.roles?.includes('admin')) router.replace('/admin/dashboard');
      else if (loggedInUser.roles?.includes('trainer')) router.replace('/trainer/(tabs)/home');
      else router.replace('/trainee/(tabs)/home');
    } catch (error: any) {
      haptic.error();
      const apiDetail = error?.response?.data?.detail;
      const statusCode = error?.response?.status;
      const errorMsg = error?.message || 'Unknown error';
      let message = '';
      if (statusCode === 401) message = apiDetail || 'Invalid email or password';
      else if (statusCode === 429) message = 'Too many attempts. Please wait.';
      else if (errorMsg.includes('Network Error')) message = 'Unable to reach server. Check your connection.';
      else message = apiDetail || errorMsg;
      showAlert({ title: 'Login Failed', message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const emailBorderColor = emailBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.25)', '#FFD700'],
  });
  const passwordBorderColor = passwordBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.25)', '#FFD700'],
  });
  const headerGlowOpacity = headerShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(255, 127, 0, 0.92)', 'rgba(255, 127, 0, 0.88)', 'rgba(255, 165, 38, 0.85)']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            style={styles.backButton}
            accessibilityLabel="Go back"
            data-testid="login-back-btn"
          >
            <Ionicons name="arrow-back" size={26} color={BRAND.white} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Logo — Rapid Reps text slides down from top */}
            <Animated.View
              style={[
                styles.headerLogoSection,
                {
                  opacity: Animated.multiply(headerFade, headerGlowOpacity),
                  transform: [{ translateY: headerSlide }],
                },
              ]}
            >
              <View style={styles.headerLogoGlow}>
                <Image
                  source={require('../../assets/rapidreps-header.png')}
                  style={styles.headerLogoImage}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* Pulsating RR Icon Logo — fills entire circular frame */}
            <Animated.View
              style={[
                styles.logoSection,
                { opacity: fadeAnim, transform: [{ scale: combinedLogoScale }] },
              ]}
            >
              <Animated.View style={[styles.logoBacking, { opacity: glowOpacity }]}>
                <Image
                  source={require('../../assets/rapidreps-icon-logo.png')}
                  style={styles.logo}
                  resizeMode="cover"
                />
              </Animated.View>
            </Animated.View>

            {/* Welcome Text */}
            <Animated.View
              style={[styles.headerSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              <Text style={styles.welcomeTitle}>WELCOME BACK</Text>
              <View style={styles.taglineRow}>
                <Text style={styles.taglineBold}>LET'S GET TO WORK</Text>
              </View>
            </Animated.View>

            {/* Social Login Buttons */}
            <Animated.View
              style={[styles.formSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              <SocialAuthButtons
                onError={(msg) => showAlert({ title: 'Sign In Failed', message: msg, type: 'error' })}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign in with email</Text>
                <View style={styles.dividerLine} />
              </View>
            </Animated.View>

            {/* Login Form */}
            <Animated.View
              style={[styles.formSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            >
              <View style={styles.inputGroup}>
                <Animated.View style={[styles.inputContainer, { borderColor: emailBorderColor, borderWidth: 2 }]}>
                  <View style={styles.inputIconCircle}>
                    <Ionicons name="mail" size={18} color={BRAND.navy} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => animateFocus(emailBorderAnim, 1)}
                    onBlur={() => animateFocus(emailBorderAnim, 0)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Email address input"
                    data-testid="login-email-input"
                  />
                </Animated.View>
              </View>

              <View style={styles.inputGroup}>
                <Animated.View
                  style={[
                    styles.inputContainer,
                    { borderColor: passwordBorderColor, borderWidth: 2, transform: [{ translateX: lockShakeAnim }] },
                  ]}
                >
                  <View style={styles.inputIconCircle}>
                    <Ionicons name={showPassword ? 'lock-open' : 'lock-closed'} size={18} color={BRAND.navy} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={() => animateFocus(passwordBorderAnim, 0)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    accessibilityLabel="Password input"
                    data-testid="login-password-input"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/auth/forgot-password')}
                style={styles.forgotButton}
                accessibilityLabel="Forgot password"
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <AnimatedPillButton
                title="Log In"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                icon="flash"
                showArrow={false}
                testID="login-submit-btn"
              />

              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/signup')} accessibilityLabel="Sign up">
                  <Text style={styles.signupLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const CIRCLE_SIZE = width * 0.65;
const LOGO_SCALE = 1.30;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.orange },
  safeArea: { flex: 1 },
  backButton: {
    position: 'absolute', top: 12, left: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 30,
  },

  /* Header Logo — oversized to cover background logo */
  headerLogoSection: { alignItems: 'center', marginBottom: 0 },
  headerLogoGlow: {
    width: width * 1.15,
  },
  headerLogoImage: {
    width: width * 1.15,
    height: undefined,
    aspectRatio: 1179 / 442,
  },

  /* Circle Logo — no backing, no shadow, just clipped circle */
  logoSection: { alignItems: 'center', marginBottom: 8 },
  logoBacking: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: CIRCLE_SIZE * LOGO_SCALE,
    height: CIRCLE_SIZE * LOGO_SCALE,
  },

  headerSection: { alignItems: 'center', marginBottom: 20 },
  welcomeTitle: { fontSize: 18, fontWeight: '700', color: BRAND.white, letterSpacing: 2 },
  taglineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  taglineBold: { fontSize: 24, fontWeight: '900', color: BRAND.navy, letterSpacing: 1 },
  formSection: { gap: 4 },
  inputGroup: { marginBottom: 14 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16, paddingHorizontal: 14, height: 56, gap: 12,
  },
  inputIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: BRAND.white,
    justifyContent: 'center', alignItems: 'center',
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: BRAND.white },
  forgotButton: { alignSelf: 'flex-end', marginBottom: 20, paddingVertical: 4 },
  forgotText: { fontSize: 14, fontWeight: '700', color: BRAND.white, textDecorationLine: 'underline' },
  signupContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  signupText: { fontSize: 14, fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)' },
  signupLink: { fontSize: 14, fontWeight: '900', color: BRAND.white, textDecorationLine: 'underline' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  dividerText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', paddingHorizontal: 14 },
});

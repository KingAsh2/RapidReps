/**
 * RapidReps PREMIUM Forgot-Password screen.
 * Premium glassmorphism + cinematic background, consistent with welcome/login/signup.
 * Preserves all business logic (email validation + POST /api/auth/forgot-password).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAlert } from '../../src/contexts/AlertContext';
import { PremiumColors } from '../../src/theme/premium';
import { PremiumHeroBg } from '../../src/components/premium/PremiumHeroBg';
import { PremiumGlassInput } from '../../src/components/premium/PremiumGlassInput';
import { PremiumGradientButton } from '../../src/components/premium/PremiumGradientButton';
import { PremiumLogo } from '../../src/components/premium/PremiumLogo';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PremiumForgotPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [emailSent]);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleReset = async () => {
    if (!email.trim()) {
      showAlert({ title: 'Email Required', message: 'Please enter your email.', type: 'warning' });
      return;
    }
    if (!validateEmail(email.trim())) {
      showAlert({ title: 'Invalid Email', message: 'Enter a valid email.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email: email.trim().toLowerCase() });
      setEmailSent(true);
    } catch (err: any) {
      showAlert({
        title: 'Error',
        message: err?.response?.data?.detail || 'Something went wrong. Try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }} testID="premium-forgot-screen">
      <StatusBar barStyle="light-content" />
      <PremiumHeroBg variant="login">
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                testID="premium-forgot-back"
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="arrow-back" size={24} color={PremiumColors.white} />
              </TouchableOpacity>

              <Animated.View
                style={[styles.heroWrap, { opacity: fade, transform: [{ translateY: slideUp }] }]}
              >
                <PremiumLogo size={160} haloIntensity={0.8} testID="premium-forgot-logo" />
                <Text style={styles.eyebrow} numberOfLines={1}>
                  {emailSent ? 'CHECK YOUR INBOX' : 'PASSWORD RESET'}
                </Text>
                <Text
                  style={styles.heroLineWhite}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  allowFontScaling={false}
                >
                  {emailSent ? "YOU'RE" : 'RESET YOUR'}
                </Text>
                <Text
                  style={styles.heroLineOrange}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  allowFontScaling={false}
                >
                  {emailSent ? 'ALL SET' : 'PASSWORD'}
                </Text>
                <View style={styles.boltUnderline} />
              </Animated.View>

              {emailSent ? (
                <Animated.View style={[styles.successWrap, { opacity: fade }]}>
                  <View style={styles.successIconWrap}>
                    <Ionicons name="checkmark-circle" size={64} color={PremiumColors.orangeGlow} />
                  </View>
                  <Text style={styles.successText}>
                    If an account exists with{' '}
                    <Text style={styles.emailHighlight}>{email}</Text>, we sent reset instructions.
                    Check your inbox and spam folder.
                  </Text>

                  <View style={{ height: 28 }} />

                  <PremiumGradientButton
                    label="BACK TO LOGIN"
                    leftIcon="arrow-back"
                    variant="primary"
                    onPress={() => router.replace('/auth/login')}
                    testID="premium-forgot-back-to-login"
                  />
                </Animated.View>
              ) : (
                <>
                  <Animated.View style={[styles.subWrap, { opacity: fade }]}>
                    <Text style={styles.subtitle}>
                      Enter the email tied to your account and we'll send instructions to reset your
                      password.
                    </Text>
                  </Animated.View>

                  <Animated.View style={[styles.formWrap, { opacity: fade }]}>
                    <PremiumGlassInput
                      leftIcon="mail"
                      placeholder="Email Address"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      testID="premium-forgot-email"
                    />
                  </Animated.View>

                  <Animated.View style={[styles.ctaWrap, { opacity: fade }]}>
                    <PremiumGradientButton
                      label="SEND RESET LINK"
                      leftIcon="flash"
                      variant="login"
                      loading={loading}
                      onPress={handleReset}
                      testID="premium-forgot-submit"
                    />
                  </Animated.View>

                  <View style={styles.loginWrap}>
                    <TouchableOpacity
                      onPress={() => router.back()}
                      accessibilityRole="button"
                      testID="premium-forgot-back-link"
                      style={{ paddingVertical: 6 }}
                    >
                      <Text style={styles.loginPrompt}>
                        Remembered it? <Text style={styles.loginLink}>Back to Login</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </PremiumHeroBg>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 22 },
  scroll: { paddingBottom: 36 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,10,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroWrap: { alignItems: 'center', marginTop: 4, marginBottom: 18 },
  eyebrow: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 5,
    color: PremiumColors.orange,
    marginTop: 4,
    fontFamily: 'Oswald_700Bold',
    textShadowColor: 'rgba(255,122,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  heroLineWhite: {
    fontSize: 50,
    fontWeight: '900',
    color: PremiumColors.white,
    letterSpacing: -1,
    lineHeight: 52,
    textAlign: 'center',
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-8deg' }],
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
    alignSelf: 'stretch',
  },
  heroLineOrange: {
    fontSize: 60,
    fontWeight: '900',
    color: PremiumColors.orange,
    letterSpacing: -1.3,
    lineHeight: 62,
    textAlign: 'center',
    marginTop: -3,
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-8deg' }],
    textShadowColor: 'rgba(255,122,0,0.78)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    alignSelf: 'stretch',
  },
  boltUnderline: {
    width: 190,
    height: 3,
    marginTop: 8,
    backgroundColor: PremiumColors.orangeGlow,
    borderRadius: 2,
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.85,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  subWrap: { marginBottom: 16, paddingHorizontal: 4 },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: PremiumColors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  formWrap: { marginBottom: 4 },
  ctaWrap: { marginTop: 14, marginBottom: 22 },
  loginWrap: { alignItems: 'center', marginTop: 6 },
  loginPrompt: { fontSize: 14, color: PremiumColors.textMuted, fontWeight: '600' },
  loginLink: { color: PremiumColors.orange, fontWeight: '900', textDecorationLine: 'underline' },
  successWrap: { alignItems: 'center', marginTop: 12, paddingHorizontal: 6 },
  successIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(10,10,10,0.55)',
    borderWidth: 1.4,
    borderColor: 'rgba(255,155,47,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  successText: {
    fontSize: 15,
    fontWeight: '600',
    color: PremiumColors.white,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: {
    color: PremiumColors.orangeGlow,
    fontWeight: '900',
  },
});

/**
 * RapidReps PREMIUM Login screen (Iteration 89).
 * Pixel-targeted match for the user's "LET'S GET TO WORK" mockup.
 * Preserves all auth logic of the classic version.
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { haptic } from '../../src/utils/haptics';
// iter106ao: SocialAuthButtons import removed per App Store Guideline 2.1(a).
import { PremiumColors } from '../../src/theme/premium';
import { PremiumHeroBg } from '../../src/components/premium/PremiumHeroBg';
import { PremiumGlassInput } from '../../src/components/premium/PremiumGlassInput';
import { PremiumGradientButton } from '../../src/components/premium/PremiumGradientButton';
import { PremiumLogo } from '../../src/components/premium/PremiumLogo';
import { formatApiError } from '../../src/utils/formatApiError';

export default function PremiumLoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { showAlert } = useAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;
  const heroScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAlert({ title: 'Missing info', message: 'Please enter email and password.', type: 'warning' });
      return;
    }
    haptic.light();
    setLoading(true);
    try {
      const loggedInUser = await login(email.trim().toLowerCase(), password);
      haptic.success();
      if (loggedInUser.isAdmin || loggedInUser.roles?.includes('admin')) {
        router.replace('/admin/dashboard');
      } else if (loggedInUser.roles?.includes('trainer')) {
        router.replace('/trainer/(tabs)/home');
      } else {
        router.replace('/trainee/(tabs)/home');
      }
    } catch (err: any) {
      haptic.error();
      showAlert({
        title: 'Login failed',
        message: formatApiError(err, 'Check your credentials and try again.'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }} testID="premium-login-screen">
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
              {/* ── Hero ─────────────────────────────────────── */}
              <Animated.View
                style={[
                  styles.heroWrap,
                  { opacity: fade, transform: [{ translateY: slideUp }, { scale: heroScale }] },
                ]}
              >
                <PremiumLogo size={212} testID="premium-login-logo" />
                <Text style={styles.brandWordmark} numberOfLines={1}>RAPIDREPS</Text>
                <Text style={styles.eyebrow} numberOfLines={1}>WELCOME BACK</Text>
                <Text
                  style={styles.heroLineWhite}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  allowFontScaling={false}
                >
                  LET'S GET
                </Text>
                <Text
                  style={styles.heroLineOrange}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  allowFontScaling={false}
                >
                  TO WORK
                </Text>
                <View style={styles.boltUnderline} />
              </Animated.View>

              {/* ── Social auth removed per iter106ao (App Store Guideline 2.1a).
                     Apple review reported Sign in with Apple failing on iPad Air M3;
                     both providers pulled until re-verified.  ─────────── */}

              {/* ── Inputs ──────────────────────────────────── */}
              <Animated.View style={[styles.formWrap, { opacity: fade }]}>
                <PremiumGlassInput
                  leftIcon="mail"
                  placeholder="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  testID="premium-login-email"
                />
                <PremiumGlassInput
                  leftIcon="lock-closed"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  rightIcon={showPassword ? 'eye-off' : 'eye'}
                  onRightIconPress={() => setShowPassword(p => !p)}
                  testID="premium-login-password"
                />

                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => router.push('/auth/forgot-password')}
                  testID="premium-forgot-password"
                  accessibilityRole="button"
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* ── CTA ─────────────────────────────────────── */}
              <Animated.View style={[styles.ctaWrap, { opacity: fade }]}>
                <PremiumGradientButton
                  label="LOG IN"
                  leftIcon="flash"
                  variant="login"
                  loading={loading}
                  onPress={handleLogin}
                  testID="premium-login-btn"
                  accessibilityLabel="Log in to RapidReps"
                />
              </Animated.View>

              {/* ── Signup link ─────────────────────────────── */}
              <Animated.View style={[styles.signupWrap, { opacity: fade }]}>
                <Text style={styles.signupPrompt}>
                  Don't have an account?{' '}
                  <Text
                    style={styles.signupLink}
                    onPress={() => router.push('/auth/signup')}
                  >
                    Sign Up
                  </Text>
                </Text>
              </Animated.View>
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
  heroWrap: { alignItems: 'center', marginTop: 4, marginBottom: 22 },
  logo: { width: 200, height: 170, marginBottom: 4 },
  brandWordmark: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 5,
    color: PremiumColors.white,
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-6deg' }],
    // iter97 (#15): stronger orange halo around the wordmark
    textShadowColor: 'rgba(255,122,0,0.92)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
    marginTop: -8,
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 5,
    color: PremiumColors.white,
    marginTop: 2,
    marginBottom: 4,
    fontFamily: 'Oswald_700Bold',
  },
  heroLineWhite: {
    fontSize: 58,
    fontWeight: '900',
    color: PremiumColors.white,
    letterSpacing: -1,
    lineHeight: 60,
    textAlign: 'center',
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-8deg' }],
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 12,
    alignSelf: 'stretch',
  },
  heroLineOrange: {
    fontSize: 68,
    fontWeight: '900',
    color: PremiumColors.orange,
    letterSpacing: -1.3,
    lineHeight: 70,
    textAlign: 'center',
    marginTop: -4,
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-8deg' }],
    textShadowColor: 'rgba(255,122,0,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
    alignSelf: 'stretch',
  },
  boltUnderline: {
    width: 210,
    height: 3,
    marginTop: 10,
    backgroundColor: PremiumColors.orangeGlow,
    borderRadius: 2,
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.85,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  socialWrap: { marginTop: 10, gap: 10 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  orText: {
    marginHorizontal: 14,
    fontSize: 12,
    fontWeight: '800',
    color: PremiumColors.white,
    letterSpacing: 6,
  },
  formWrap: { marginBottom: 4 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 12, paddingVertical: 6 },
  forgotText: {
    fontSize: 13,
    fontWeight: '800',
    color: PremiumColors.orangeGlow,
    textDecorationLine: 'underline',
  },
  ctaWrap: { marginTop: 10, marginBottom: 24 },
  signupWrap: { alignItems: 'center', marginTop: 8, paddingBottom: 4 },
  signupPrompt: { fontSize: 14, color: PremiumColors.white, fontWeight: '600' },
  signupLink: {
    color: PremiumColors.orange,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
});

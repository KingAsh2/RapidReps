/**
 * RapidReps PREMIUM Signup screen (Iteration 89).
 * Same premium design system as Welcome + Login. Used for both
 * "Find a Trainer" (?role=trainee) and "Become a Trainer" (?role=trainer).
 * Hero copy + accent flip based on role param.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { UserRole } from '../../src/types';
import { haptic } from '../../src/utils/haptics';
import { SocialAuthButtons } from '../../src/components/SocialAuthButtons';
import { PremiumColors } from '../../src/theme/premium';
import { PremiumHeroBg } from '../../src/components/premium/PremiumHeroBg';
import { PremiumGlassInput } from '../../src/components/premium/PremiumGlassInput';
import { PremiumGradientButton } from '../../src/components/premium/PremiumGradientButton';
import { PremiumLogo } from '../../src/components/premium/PremiumLogo';
import { formatApiError } from '../../src/utils/formatApiError';

export default function PremiumSignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signup } = useAuth();
  const { showAlert } = useAlert();

  const isSocialAuth = params.socialAuth === 'true';
  const initialRole = (params.role as string) === 'trainer' ? UserRole.TRAINER : UserRole.TRAINEE;

  const [formData, setFormData] = useState({
    email: (params.socialEmail as string) || '',
    password: '',
    confirmPassword: '',
    fullName: (params.socialName as string) || '',
    phone: '',
    roles: [initialRole] as string[],
    referralCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const isTrainer = formData.roles.includes(UserRole.TRAINER);

  const toggleRole = (role: string) => {
    haptic.selection();
    setFormData(p => ({ ...p, roles: [role] }));
  };

  const handleSignup = async () => {
    if (!formData.fullName.trim()) return showAlert({ title: 'Missing name', message: 'Please enter your full name.', type: 'warning' });
    if (!formData.email.trim()) return showAlert({ title: 'Missing email', message: 'Please enter your email.', type: 'warning' });
    if (!formData.phone.trim()) return showAlert({ title: 'Phone required', message: 'We need your phone to connect you.', type: 'warning' });
    if (!isSocialAuth) {
      if (!formData.password) return showAlert({ title: 'Missing password', message: 'Create a password.', type: 'warning' });
      if (formData.password.length < 8) return showAlert({ title: 'Weak password', message: 'At least 8 characters.', type: 'warning' });
      if (formData.password !== formData.confirmPassword) return showAlert({ title: 'Password mismatch', message: "Passwords don't match.", type: 'error' });
    }
    if (formData.roles.length === 0) return showAlert({ title: 'Choose your path', message: 'Pick Find or Become.', type: 'warning' });

    haptic.medium();
    setLoading(true);
    try {
      await signup({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: isSocialAuth ? undefined : formData.password,
        roles: formData.roles,
        referralCode: formData.referralCode || undefined,
        isSocialAuth: isSocialAuth || undefined,
      });
      if (formData.roles.includes(UserRole.TRAINER)) router.replace('/auth/onboarding-trainer');
      else router.replace('/auth/onboarding-trainee');
    } catch (err: any) {
      showAlert({ title: 'Signup failed', message: formatApiError(err, 'Try again.'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }} testID="premium-signup-screen">
      <StatusBar barStyle="light-content" />
      <PremiumHeroBg variant="signup">
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
              {/* Back */}
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.replace('/')}
                testID="premium-signup-back"
                accessibilityRole="button"
                accessibilityLabel="Back to welcome"
              >
                <Ionicons name="arrow-back" size={24} color={PremiumColors.white} />
              </TouchableOpacity>

              {/* Hero */}
              <Animated.View
                style={[styles.heroWrap, { opacity: fade, transform: [{ translateY: slideUp }] }]}
              >
                <PremiumLogo size={180} haloIntensity={0.85} testID="premium-signup-logo" />
                <Text style={styles.eyebrow} numberOfLines={1}>
                  {isTrainer ? 'JOIN THE ELITE' : 'LET\u2019S GET YOU MOVING'}
                </Text>
                <Text
                  style={styles.heroLineWhite}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  allowFontScaling={false}
                >
                  {isTrainer ? 'BECOME A' : 'FIND YOUR'}
                </Text>
                <Text
                  style={styles.heroLineOrange}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  allowFontScaling={false}
                >
                  {isTrainer ? 'TRAINER' : 'TRAINER'}
                </Text>
                <View style={styles.boltUnderline} />
              </Animated.View>

              {/* Role Toggle */}
              <Animated.View style={[styles.roleRow, { opacity: fade }]}>
                <RolePill
                  active={!isTrainer}
                  icon="search"
                  label="FIND A TRAINER"
                  onPress={() => toggleRole(UserRole.TRAINEE)}
                  testID="premium-signup-role-trainee"
                />
                <RolePill
                  active={isTrainer}
                  icon="barbell"
                  label="BECOME ONE"
                  onPress={() => toggleRole(UserRole.TRAINER)}
                  testID="premium-signup-role-trainer"
                />
              </Animated.View>

              {/* Social */}
              {!isSocialAuth && (
                <Animated.View style={[styles.socialWrap, { opacity: fade }]}>
                  <SocialAuthButtons
                    onError={(msg) => showAlert({ title: 'Sign Up Failed', message: msg, type: 'error' })}
                  />
                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>OR EMAIL</Text>
                    <View style={styles.orLine} />
                  </View>
                </Animated.View>
              )}

              {/* Form */}
              <Animated.View style={[styles.formWrap, { opacity: fade }]}>
                <PremiumGlassInput
                  leftIcon="person"
                  placeholder="Full Name"
                  value={formData.fullName}
                  onChangeText={t => setFormData(p => ({ ...p, fullName: t }))}
                  testID="premium-signup-name"
                />
                <PremiumGlassInput
                  leftIcon="mail"
                  placeholder="Email Address"
                  value={formData.email}
                  onChangeText={t => setFormData(p => ({ ...p, email: t }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="premium-signup-email"
                />
                <PremiumGlassInput
                  leftIcon="call"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChangeText={t => setFormData(p => ({ ...p, phone: t }))}
                  keyboardType="phone-pad"
                  testID="premium-signup-phone"
                />

                {!isSocialAuth && (
                  <>
                    <PremiumGlassInput
                      leftIcon="lock-closed"
                      placeholder="Password (8+ chars)"
                      value={formData.password}
                      onChangeText={t => setFormData(p => ({ ...p, password: t }))}
                      secureTextEntry={!showPassword}
                      rightIcon={showPassword ? 'eye-off' : 'eye'}
                      onRightIconPress={() => setShowPassword(v => !v)}
                      testID="premium-signup-password"
                    />
                    <PremiumGlassInput
                      leftIcon="shield-checkmark"
                      placeholder="Confirm Password"
                      value={formData.confirmPassword}
                      onChangeText={t => setFormData(p => ({ ...p, confirmPassword: t }))}
                      secureTextEntry={!showConfirm}
                      rightIcon={showConfirm ? 'eye-off' : 'eye'}
                      onRightIconPress={() => setShowConfirm(v => !v)}
                      testID="premium-signup-confirm"
                    />
                  </>
                )}

                <PremiumGlassInput
                  leftIcon="gift"
                  placeholder="Referral code (optional)"
                  value={formData.referralCode}
                  onChangeText={t => setFormData(p => ({ ...p, referralCode: t }))}
                  autoCapitalize="characters"
                  testID="premium-signup-referral"
                />
              </Animated.View>

              {/* CTA */}
              <Animated.View style={[styles.ctaWrap, { opacity: fade }]}>
                <PremiumGradientButton
                  label={isTrainer ? 'BECOME A TRAINER' : 'FIND A TRAINER'}
                  leftIcon={isTrainer ? 'barbell' : 'search'}
                  variant="primary"
                  loading={loading}
                  onPress={handleSignup}
                  testID="premium-signup-submit"
                />
              </Animated.View>

              {/* Login link */}
              <View style={styles.loginWrap}>
                <Text style={styles.loginPrompt}>
                  Already have an account?{' '}
                  <Text
                    style={styles.loginLink}
                    onPress={() => router.replace('/auth/login')}
                  >
                    Log In
                  </Text>
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </PremiumHeroBg>
    </View>
  );
}

const RolePill: React.FC<{
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}> = ({ active, icon, label, onPress, testID }) => (
  <Pressable
    onPress={onPress}
    style={[rolePillStyles.pill, active && rolePillStyles.pillActive]}
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel={label}
  >
    <Ionicons name={icon} size={18} color={active ? PremiumColors.white : PremiumColors.orangeGlow} />
    <Text style={[rolePillStyles.label, active && { color: PremiumColors.white }]}>{label}</Text>
  </Pressable>
);

const rolePillStyles = StyleSheet.create({
  pill: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: 'rgba(255,155,47,0.55)',
    backgroundColor: 'rgba(10,10,10,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pillActive: {
    backgroundColor: PremiumColors.orange,
    borderColor: PremiumColors.orangeGlow,
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: PremiumColors.orangeGlow,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 20 },
  scroll: { paddingBottom: 36 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,10,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroWrap: { alignItems: 'center', marginTop: 2, marginBottom: 20 },
  logo: { width: 160, height: 130 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
    color: PremiumColors.white,
    marginTop: 4,
    fontFamily: 'Oswald_700Bold',
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
    fontSize: 58,
    fontWeight: '900',
    color: PremiumColors.orange,
    letterSpacing: -1.2,
    lineHeight: 58,
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
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  socialWrap: { marginBottom: 8, gap: 10 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  orText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '800',
    color: PremiumColors.textMuted,
    letterSpacing: 4,
  },
  formWrap: { marginBottom: 4 },
  ctaWrap: { marginTop: 14, marginBottom: 22 },
  loginWrap: { alignItems: 'center', marginTop: 6, paddingBottom: 4 },
  loginPrompt: { fontSize: 14, color: PremiumColors.textMuted, fontWeight: '600' },
  loginLink: { color: PremiumColors.orange, fontWeight: '900', textDecorationLine: 'underline' },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { UserRole } from '../../src/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPillButton } from '../../src/components/AnimatedPillButton';
import { haptic } from '../../src/utils/haptics';
import { SocialAuthButtons } from '../../src/components/SocialAuthButtons';

const { width } = Dimensions.get('window');

// Background image - Box jumps (high energy, getting started)
const backgroundImage = require('../../assets/images/bg-box-jumps.png');

// Brand colors
const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  orangeGlow: '#FFB347',
  yellow: '#FDBB2D',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
  border: '#E0E4E8',
};

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signup, socialLogin } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const isSocialAuth = params.socialAuth === 'true';
  const [formData, setFormData] = useState({
    email: (params.socialEmail as string) || '',
    password: '',
    confirmPassword: '',
    fullName: (params.socialName as string) || '',
    phone: '',
    roles: [] as string[],
    referralCode: '',
  });

  // Pre-select role from URL params (coming from welcome screen)
  useEffect(() => {
    const roleParam = params.role as string;
    if (roleParam === 'trainee' && !formData.roles.includes(UserRole.TRAINEE)) {
      setFormData(prev => ({ ...prev, roles: [UserRole.TRAINEE] }));
    } else if (roleParam === 'trainer' && !formData.roles.includes(UserRole.TRAINER)) {
      setFormData(prev => ({ ...prev, roles: [UserRole.TRAINER] }));
    }
  }, [params.role]);

  // Animation refs
  const heroAnim = useRef(new Animated.Value(0)).current;
  const formCardAnim = useRef(new Animated.Value(0)).current;
  const roleCardsAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const ctaPulseAnim = useRef(new Animated.Value(1)).current;
  const traineeCardScale = useRef(new Animated.Value(1)).current;
  const trainerCardScale = useRef(new Animated.Value(1)).current;
  const traineeCardOpacity = useRef(new Animated.Value(1)).current;
  const trainerCardOpacity = useRef(new Animated.Value(1)).current;

  // ── Explosive entrance animations ──
  const headerSlam = useRef(new Animated.Value(-250)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerRotate = useRef(new Animated.Value(-12)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoSpin = useRef(new Animated.Value(0)).current;
  const logoFade = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const headerShimmer = useRef(new Animated.Value(0)).current;
  const energyRing = useRef(new Animated.Value(0.5)).current;
  const combinedLogoScale = useRef(Animated.multiply(logoScale, pulseScale)).current;

  useEffect(() => {
    // Phase 1: Header SLAMS
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(headerSlam, { toValue: 0, friction: 6, tension: 120, useNativeDriver: true }),
        Animated.spring(headerRotate, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
      ]),
      // Phase 2: Flash + Logo explodes
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 0.4, duration: 80, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
        Animated.timing(logoFade, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(logoSpin, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
        Animated.timing(heroAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      // Phase 3: Form cascade
      Animated.parallel([
        Animated.spring(formCardAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(roleCardsAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(ctaAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Start continuous pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 0.96, duration: 100, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1.04, duration: 100, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.delay(2000),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(headerShimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(headerShimmer, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(energyRing, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(energyRing, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    });

    const pulseInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(ctaPulseAnim, { toValue: 1.03, duration: 300, useNativeDriver: true }),
        Animated.timing(ctaPulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 7000);
    return () => clearInterval(pulseInterval);
  }, []);

  const handleSignup = async () => {
    if (!formData.fullName) {
      showAlert({ title: 'Missing Information', message: 'Please enter your name', type: 'warning' });
      return;
    }

    if (!formData.email) {
      showAlert({ title: 'Missing Information', message: 'Please enter your email', type: 'warning' });
      return;
    }

    // Password fields only required for non-social signup
    if (!isSocialAuth) {
      if (!formData.password) {
        showAlert({ title: 'Missing Information', message: 'Please create a password', type: 'warning' });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        showAlert({ title: 'Password Mismatch', message: "Your passwords don't match.", type: 'error' });
        return;
      }
      if (formData.password.length < 8) {
        showAlert({ title: 'Weak Password', message: 'Password must be at least 8 characters.', type: 'warning' });
        return;
      }
    }

    if (formData.roles.length === 0) {
      showAlert({ title: 'Choose Your Path', message: 'Please select whether you want to find a trainer or become one.', type: 'warning' });
      return;
    }

    if (!formData.phone) {
      showAlert({ title: 'Phone Required', message: 'We need your phone number to connect you with trainers.', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await signup({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: isSocialAuth ? undefined : formData.password,
        roles: formData.roles,
        referralCode: formData.referralCode || undefined,
        isSocialAuth: isSocialAuth || undefined,
      });

      if (formData.roles.includes(UserRole.TRAINER)) {
        router.replace('/auth/onboarding-trainer');
      } else {
        router.replace('/auth/onboarding-trainee');
      }
    } catch (error: any) {
      showAlert({
        title: 'Signup Failed',
        message: error.response?.data?.detail || 'Something went wrong. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role: UserRole) => {
    // Animate selection
    if (role === UserRole.TRAINEE) {
      Animated.parallel([
        Animated.spring(traineeCardScale, { toValue: 1.02, friction: 6, useNativeDriver: true }),
        Animated.timing(trainerCardOpacity, { toValue: 0.5, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        Animated.spring(traineeCardScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      });
      Animated.timing(trainerCardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.parallel([
        Animated.spring(trainerCardScale, { toValue: 1.02, friction: 6, useNativeDriver: true }),
        Animated.timing(traineeCardOpacity, { toValue: 0.5, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        Animated.spring(trainerCardScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      });
      Animated.timing(traineeCardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }

    // Toggle role
    if (formData.roles.includes(role)) {
      setFormData({ ...formData, roles: formData.roles.filter(r => r !== role) });
    } else {
      setFormData({ ...formData, roles: [role] }); // Single selection
    }
  };

  const heroTranslateY = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  const headerRotateStr = headerRotate.interpolate({
    inputRange: [-12, 0],
    outputRange: ['-12deg', '0deg'],
  });
  const logoSpinStr = logoSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const headerGlowOpacity = headerShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  const formTranslateY = formCardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const roleTranslateY = roleCardsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  const ctaTranslateY = ctaAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      {/* Orange overlay */}
      <LinearGradient
        colors={['rgba(10, 14, 26, 0.97)', 'rgba(17, 24, 39, 0.96)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={COLORS.white} />
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Flash overlay */}
            <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFD700', opacity: flashOpacity, zIndex: 100 }} pointerEvents="none" />

            {/* Hero Section — explosive entrance */}
            <View style={styles.heroSection}>
              {/* Header SLAMS down */}
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    opacity: Animated.multiply(headerFade, headerGlowOpacity),
                    transform: [{ translateY: headerSlam }, { rotate: headerRotateStr }],
                  },
                ]}
              >
                <Image 
                  source={require('../../assets/rapidreps-header.png')} 
                  style={styles.headerLogoImage}
                  resizeMode="contain"
                />
              </Animated.View>

              {/* Logo EXPLODES with spin */}
              <Animated.View
                style={[
                  styles.circleLogoContainer,
                  {
                    opacity: logoFade,
                    transform: [{ scale: combinedLogoScale }, { rotate: logoSpinStr }],
                  },
                ]}
              >
                <View style={styles.circleBacking}>
                  <Image 
                    source={require('../../assets/rapidreps-icon-logo.png')} 
                    style={styles.circleLogoImage}
                    resizeMode="cover"
                  />
                </View>
              </Animated.View>

              <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroTranslateY }] }}>
                <Text style={styles.heroTitle}>Let's Build Your{'\n'}Fitness Momentum</Text>
                <Text style={styles.heroSubtitle}>Train smarter. Move faster. Get real results.</Text>
              </Animated.View>
            </View>

            {/* Social Sign-Up (only for non-social-redirected users) */}
            {!isSocialAuth && (
              <Animated.View
                style={[
                  styles.formCard,
                  { opacity: formCardAnim, transform: [{ translateY: formTranslateY }], marginBottom: 0 },
                ]}
              >
                <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
                  <SocialAuthButtons
                    onError={(msg) => showAlert({ title: 'Sign Up Failed', message: msg, type: 'error' })}
                  />
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or create account with email</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Social user banner */}
            {isSocialAuth && (
              <View style={{ backgroundColor: 'rgba(0,200,83,0.1)', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(0,200,83,0.25)' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#00C853', textAlign: 'center' }}>
                  Almost there! Just pick your role and add your phone number.
                </Text>
              </View>
            )}

            {/* Form Card */}
            <Animated.View
              style={[
                styles.formCard,
                {
                  opacity: formCardAnim,
                  transform: [{ translateY: formTranslateY }],
                },
              ]}
            >
              <LinearGradient
                colors={['#0A0E1A', '#141929']}
                style={styles.formCardGradient}
              >
                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>What should we call you?</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.fullName}
                      onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                      placeholder="Your full name"
                      placeholderTextColor={COLORS.gray}
                    />
                  </View>
                </View>

                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Where should we send your wins?</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.email}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      placeholder="your@email.com"
                      placeholderTextColor={COLORS.gray}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Phone Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Best number to reach you</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.phone}
                      onChangeText={(text) => setFormData({ ...formData, phone: text })}
                      placeholder="(555) 123-4567"
                      placeholderTextColor={COLORS.gray}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Password Input - only for email signup */}
                {!isSocialAuth && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Create a strong password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.password}
                      onChangeText={(text) => setFormData({ ...formData, password: text })}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.gray}
                      secureTextEntry
                    />
                  </View>
                  <Text style={styles.helperText}>At least 8 characters. Strength matters.</Text>
                </View>
                )}

                {/* Confirm Password Input - only for email signup */}
                {!isSocialAuth && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Lock it in</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.confirmPassword}
                      onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.gray}
                      secureTextEntry
                    />
                  </View>
                </View>
                )}
              </LinearGradient>
            </Animated.View>

            {/* Role Selection */}
            <Animated.View
              style={[
                styles.roleSection,
                {
                  opacity: roleCardsAnim,
                  transform: [{ translateY: roleTranslateY }],
                },
              ]}
            >
              <Text style={styles.roleSectionTitle}>I'm here to...</Text>

              {/* Trainee Card */}
              <Animated.View style={{ transform: [{ scale: traineeCardScale }], opacity: traineeCardOpacity }}>
                <TouchableOpacity
                  onPress={() => selectRole(UserRole.TRAINEE)}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={
                      formData.roles.includes(UserRole.TRAINEE)
                        ? ['#0A0E1A', '#141929']
                        : ['#141929', '#1A2035']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.roleCard,
                      formData.roles.includes(UserRole.TRAINEE) && styles.roleCardSelected,
                    ]}
                  >
                    <View style={styles.roleCardContent}>
                      <View style={[
                        styles.roleIconBg,
                        formData.roles.includes(UserRole.TRAINEE) && styles.roleIconBgSelected,
                      ]}>
                        <Ionicons 
                          name="search" 
                          size={28} 
                          color={formData.roles.includes(UserRole.TRAINEE) ? '#FF6A00' : COLORS.white} 
                        />
                      </View>
                      <View style={styles.roleTextContainer}>
                        <Text style={[
                          styles.roleCardTitle,
                          formData.roles.includes(UserRole.TRAINEE) && styles.roleCardTitleSelected,
                        ]}>
                          Find a Trainer 💪
                        </Text>
                        <Text style={[
                          styles.roleCardSubtitle,
                          formData.roles.includes(UserRole.TRAINEE) && styles.roleCardSubtitleSelected,
                        ]}>
                          Book fast, train anywhere, level up on your schedule.
                        </Text>
                      </View>
                    </View>
                    {formData.roles.includes(UserRole.TRAINEE) && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Trainer Card */}
              <Animated.View style={{ transform: [{ scale: trainerCardScale }], opacity: trainerCardOpacity }}>
                <TouchableOpacity
                  onPress={() => selectRole(UserRole.TRAINER)}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={
                      formData.roles.includes(UserRole.TRAINER)
                        ? [COLORS.orangeHot, COLORS.orange]
                        : ['#141929', '#1A2035']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.roleCard,
                      formData.roles.includes(UserRole.TRAINER) && styles.roleCardSelected,
                    ]}
                  >
                    <View style={styles.roleCardContent}>
                      <View style={[
                        styles.roleIconBg,
                        formData.roles.includes(UserRole.TRAINER) && styles.roleIconBgSelectedOrange,
                      ]}>
                        <Ionicons 
                          name="flash" 
                          size={28} 
                          color={formData.roles.includes(UserRole.TRAINER) ? COLORS.orangeHot : COLORS.white} 
                        />
                      </View>
                      <View style={styles.roleTextContainer}>
                        <Text style={[
                          styles.roleCardTitle,
                          formData.roles.includes(UserRole.TRAINER) && styles.roleCardTitleSelected,
                        ]}>
                          Become a Trainer 🔥
                        </Text>
                        <Text style={[
                          styles.roleCardSubtitle,
                          formData.roles.includes(UserRole.TRAINER) && styles.roleCardSubtitleSelected,
                        ]}>
                          Earn more, build your brand, train clients on demand.
                        </Text>
                      </View>
                    </View>
                    {formData.roles.includes(UserRole.TRAINER) && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Selection Confirmation */}
              {formData.roles.length > 0 && (
                <Animated.Text style={styles.selectionConfirm}>
                  Perfect — we'll tailor RapidReps for you
                </Animated.Text>
              )}
            </Animated.View>

            {/* Referral Code Input */}
            <View style={styles.referralSection}>
              <View style={styles.referralInputRow}>
                <Ionicons name="gift-outline" size={20} color="#FFFFFF" />
                <TextInput
                  style={styles.referralInput}
                  placeholder="Have a referral code? (optional)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={formData.referralCode}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, referralCode: text.toUpperCase() }))}
                  autoCapitalize="characters"
                  data-testid="signup-referral-code-input"
                />
              </View>
              {formData.referralCode.length > 0 && (
                <Text style={styles.referralHint}>You and the referrer each earn $5 after your first booking!</Text>
              )}
            </View>

            {/* CTA Button */}
            <Animated.View
              style={[
                styles.ctaContainer,
                {
                  opacity: ctaAnim,
                  transform: [
                    { translateY: ctaTranslateY },
                    { scale: ctaPulseAnim },
                  ],
                },
              ]}
            >
              <AnimatedPillButton
                title={loading ? 'Creating Your Account...' : 'Start My Journey'}
                onPress={handleSignup}
                loading={loading}
                disabled={loading}
                icon="rocket"
                showArrow={false}
                gradientColors={loading ? ['#7a8aac', '#999999'] as const : [COLORS.orangeHot, COLORS.orangeGlow] as const}
                testID="signup-submit-btn"
              />
            </Animated.View>

            {/* Reassurance Text */}
            <Text style={styles.reassuranceText}>
              No commitments. Train when you want. 🏋️
            </Text>

            {/* Terms & Login */}
            <View style={styles.footerSection}>
              <Text style={styles.termsText}>
                By continuing, you agree to the{' '}
                <Text style={styles.termsLink} onPress={() => router.push('/legal/terms')}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={styles.termsLink} onPress={() => router.push('/legal/privacy')}>
                  Privacy Policy
                </Text>
              </Text>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already crushing it?</Text>
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.loginLink}>Log In →</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 0,
    alignItems: 'center',
    width: width * 1.30,
    alignSelf: 'center',
  },
  headerLogoImage: {
    width: width * 1.69,
    height: undefined,
    aspectRatio: 1179 / 442,
  },
  circleLogoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'center',
  },
  energyRingStyle: {
    position: 'absolute',
    width: width * 0.65 + 20,
    height: width * 0.65 + 20,
    borderRadius: (width * 0.65 + 20) / 2,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  circleBacking: {
    width: width * 0.65,
    height: width * 0.65,
    borderRadius: (width * 0.65) / 2,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circleLogoImage: {
    width: width * 0.65 * 1.30,
    height: width * 0.65 * 1.30,
  },
  logoImage: {
    width: 140,
    height: 70,
  },
  logoBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 36,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    marginTop: 8,
  },
  // Form Card
  formCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 20,
  },
  formCardGradient: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141929',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    marginLeft: 4,
  },
  // Role Section
  roleSection: {
    marginBottom: 20,
  },
  roleSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  roleCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
  },
  roleCardSelected: {
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  roleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleIconBgSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  roleIconBgSelectedOrange: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  roleTextContainer: {
    flex: 1,
  },
  roleCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  roleCardTitleSelected: {
    color: COLORS.white,
  },
  roleCardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  roleCardSubtitleSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  selectedBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  selectionConfirm: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // CTA
  ctaContainer: {
    marginBottom: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: COLORS.orangeHot,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  reassuranceText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Footer
  footerSection: {
    alignItems: 'center',
  },
  termsText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  termsLink: {
    fontWeight: '700',
    color: COLORS.white,
    textDecorationLine: 'underline',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  referralSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  referralInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  referralInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 1,
  },
  referralHint: {
    fontSize: 13,
    color: '#FF8533',
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 14,
  },
});

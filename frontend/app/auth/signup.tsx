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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { UserRole } from '../../src/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  orangeGlow: '#FFB347',
  yellow: '#FDBB2D',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#8892b0',
  grayLight: '#E8ECF0',
  border: '#E0E4E8',
};

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    roles: [] as UserRole[],
  });

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

  // Entrance animations
  useEffect(() => {
    // Hero fade + slide down
    Animated.timing(heroAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Form card cascade
    setTimeout(() => {
      Animated.spring(formCardAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, 200);

    // Role cards stagger
    setTimeout(() => {
      Animated.spring(roleCardsAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, 350);

    // CTA button
    setTimeout(() => {
      Animated.spring(ctaAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, 500);

    // CTA pulse every 7 seconds
    const pulseInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(ctaPulseAnim, {
          toValue: 1.03,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, 7000);

    return () => clearInterval(pulseInterval);
  }, []);

  const handleSignup = async () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      showAlert({
        title: 'Missing Information',
        message: 'Please fill in all required fields',
        type: 'warning',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showAlert({
        title: 'Password Mismatch',
        message: 'Your passwords don\'t match. Please try again.',
        type: 'error',
      });
      return;
    }

    if (formData.password.length < 8) {
      showAlert({
        title: 'Weak Password',
        message: 'Password must be at least 8 characters.',
        type: 'warning',
      });
      return;
    }

    if (formData.roles.length === 0) {
      showAlert({
        title: 'Choose Your Path',
        message: 'Please select whether you want to find a trainer or become one.',
        type: 'warning',
      });
      return;
    }

    if (!formData.phone) {
      showAlert({
        title: 'Phone Required',
        message: 'We need your phone number to connect you with trainers.',
        type: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      await signup({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        roles: formData.roles,
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
    <View style={styles.container}>
      {/* Full gradient background */}
      <LinearGradient
        colors={[COLORS.orange, COLORS.orangeLight, COLORS.orangeGlow]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
            {/* Hero Section */}
            <Animated.View
              style={[
                styles.heroSection,
                {
                  opacity: heroAnim,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
            >
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={[COLORS.white, 'rgba(255,255,255,0.95)']}
                  style={styles.logoBg}
                >
                  <Ionicons name="fitness" size={40} color={COLORS.orange} />
                </LinearGradient>
              </View>
              <Text style={styles.heroTitle}>Let's Build Your{'\n'}Fitness Momentum 🔥</Text>
              <Text style={styles.heroSubtitle}>Train smarter. Move faster. Get real results.</Text>
            </Animated.View>

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
                colors={[COLORS.offWhite, COLORS.white]}
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

                {/* Password Input */}
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
                  <Text style={styles.helperText}>At least 8 characters. Strength matters. 💪</Text>
                </View>

                {/* Confirm Password Input */}
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
                        ? [COLORS.teal, COLORS.tealLight]
                        : [COLORS.white, COLORS.offWhite]
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
                          color={formData.roles.includes(UserRole.TRAINEE) ? COLORS.teal : COLORS.navy} 
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
                        : [COLORS.white, COLORS.offWhite]
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
                          color={formData.roles.includes(UserRole.TRAINER) ? COLORS.orangeHot : COLORS.navy} 
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
                  Perfect — we'll tailor RapidReps for you ✨
                </Animated.Text>
              )}
            </Animated.View>

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
              <TouchableOpacity
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={loading ? ['#CCCCCC', '#999999'] : [COLORS.orangeHot, COLORS.orangeGlow]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaButton}
                >
                  {loading ? (
                    <Text style={styles.ctaText}>Creating Your Account...</Text>
                  ) : (
                    <>
                      <Ionicons name="rocket" size={22} color={COLORS.white} />
                      <Text style={styles.ctaText}>Start My Journey</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
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
    </View>
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
  logoContainer: {
    marginBottom: 16,
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
    color: COLORS.navy,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
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
    color: COLORS.navy,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray,
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
    backgroundColor: COLORS.grayLight,
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
    color: COLORS.navy,
    marginBottom: 4,
  },
  roleCardTitleSelected: {
    color: COLORS.white,
  },
  roleCardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
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
    fontSize: 12,
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
});

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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { UserRole } from '../../src/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Shadows, BorderRadius, Spacing } from '../../src/utils/colors';

const { width } = Dimensions.get('window');

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
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
    if (formData.roles.includes(role)) {
      setFormData({ ...formData, roles: formData.roles.filter(r => r !== role) });
    } else {
      setFormData({ ...formData, roles: [role] });
    }
  };

  return (
    <View style={styles.container}>
      {/* Dark Navy Background */}
      <LinearGradient
        colors={Colors.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
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
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {/* Logo */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/rapidreps-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Header Card */}
              <View style={styles.headerCard}>
                <Text style={styles.title}>Let's Build Your{'\n'}Fitness Momentum 🔥</Text>
                <Text style={styles.subtitle}>Train smarter. Move faster. Get real results.</Text>
              </View>

              {/* Form Card */}
              <View style={styles.card}>
                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color={Colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.fullName}
                      onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                      placeholder="Your full name"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>

                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color={Colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.email}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      placeholder="your@email.com"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Phone Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color={Colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.phone}
                      onChangeText={(text) => setFormData({ ...formData, phone: text })}
                      placeholder="(555) 123-4567"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color={Colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.password}
                      onChangeText={(text) => setFormData({ ...formData, password: text })}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={Colors.secondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.confirmPassword}
                      onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>
                </View>
              </View>

              {/* Role Selection */}
              <View style={styles.roleSection}>
                <Text style={styles.roleSectionTitle}>I Want To...</Text>

                {/* Trainee Card */}
                <TouchableOpacity
                  onPress={() => selectRole(UserRole.TRAINEE)}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.roleCard,
                    formData.roles.includes(UserRole.TRAINEE) && styles.roleCardSelected,
                  ]}>
                    <View style={[
                      styles.roleIconContainer,
                      formData.roles.includes(UserRole.TRAINEE) && styles.roleIconSelected,
                    ]}>
                      <Ionicons 
                        name="search" 
                        size={24} 
                        color={formData.roles.includes(UserRole.TRAINEE) ? Colors.white : Colors.secondary} 
                      />
                    </View>
                    <View style={styles.roleTextContainer}>
                      <Text style={styles.roleCardTitle}>Find a Trainer</Text>
                      <Text style={styles.roleCardSubtitle}>Book sessions & achieve your goals</Text>
                    </View>
                    {formData.roles.includes(UserRole.TRAINEE) && (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.secondary} />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Trainer Card */}
                <TouchableOpacity
                  onPress={() => selectRole(UserRole.TRAINER)}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.roleCard,
                    formData.roles.includes(UserRole.TRAINER) && styles.roleCardSelectedOrange,
                  ]}>
                    <View style={[
                      styles.roleIconContainer,
                      formData.roles.includes(UserRole.TRAINER) && styles.roleIconSelectedOrange,
                    ]}>
                      <Ionicons 
                        name="flash" 
                        size={24} 
                        color={formData.roles.includes(UserRole.TRAINER) ? Colors.white : Colors.primary} 
                      />
                    </View>
                    <View style={styles.roleTextContainer}>
                      <Text style={styles.roleCardTitle}>Become a Trainer</Text>
                      <Text style={styles.roleCardSubtitle}>Build your business & earn more</Text>
                    </View>
                    {formData.roles.includes(UserRole.TRAINER) && (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* CTA Button - Orange to Yellow Gradient */}
              <TouchableOpacity
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={loading ? [Colors.textMuted, Colors.textMuted] : Colors.gradientOrangeYellow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaButton}
                >
                  {loading ? (
                    <Text style={styles.ctaText}>Creating Account...</Text>
                  ) : (
                    <>
                      <Ionicons name="rocket" size={22} color={Colors.white} />
                      <Text style={styles.ctaText}>Start My Journey</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Footer */}
              <View style={styles.footer}>
                <View style={styles.loginRow}>
                  <Text style={styles.loginText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/auth/login')}>
                    <Text style={styles.loginLink}>Log In</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 40 }} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navyDark,
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
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 180,
    height: 70,
  },
  headerCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.card,
    padding: Spacing.cardPadding,
    marginBottom: 20,
    ...Shadows.subtle,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 30,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textLight,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.card,
    padding: Spacing.cardPadding,
    marginBottom: 20,
    ...Shadows.card,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.inputPadding,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.white,
  },
  roleSection: {
    marginBottom: 24,
  },
  roleSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.card,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.subtle,
  },
  roleCardSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(0, 188, 212, 0.1)',
  },
  roleCardSelectedOrange: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(242, 101, 34, 0.1)',
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleIconSelected: {
    backgroundColor: Colors.secondary,
  },
  roleIconSelectedOrange: {
    backgroundColor: Colors.primary,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  roleCardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: BorderRadius.button,
    gap: 10,
    ...Shadows.button,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary,
  },
});

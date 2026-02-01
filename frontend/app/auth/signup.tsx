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
import { Colors, Shadows } from '../../src/utils/colors';

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
    <LinearGradient
      colors={Colors.gradientBackground}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
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

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>JOIN THE TEAM</Text>
                <Text style={styles.subtitle}>Your fitness journey starts here 🔥</Text>
              </View>

              {/* Form Card */}
              <View style={styles.card}>
                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>FULL NAME</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="person" size={20} color={Colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.fullName}
                      onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                      placeholder="John Smith"
                      placeholderTextColor={Colors.textLight}
                    />
                  </View>
                </View>

                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>EMAIL</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail" size={20} color={Colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.email}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      placeholder="your@email.com"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Phone Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PHONE</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call" size={20} color={Colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.phone}
                      onChangeText={(text) => setFormData({ ...formData, phone: text })}
                      placeholder="(555) 123-4567"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PASSWORD</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed" size={20} color={Colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.password}
                      onChangeText={(text) => setFormData({ ...formData, password: text })}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textLight}
                      secureTextEntry
                    />
                  </View>
                  <Text style={styles.helperText}>At least 8 characters</Text>
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CONFIRM PASSWORD</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="shield-checkmark" size={20} color={Colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.confirmPassword}
                      onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textLight}
                      secureTextEntry
                    />
                  </View>
                </View>
              </View>

              {/* Role Selection */}
              <View style={styles.roleSection}>
                <Text style={styles.roleSectionTitle}>I WANT TO...</Text>

                {/* Trainee Card */}
                <TouchableOpacity
                  onPress={() => selectRole(UserRole.TRAINEE)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={formData.roles.includes(UserRole.TRAINEE) ? Colors.gradientTeal : ['transparent', 'transparent']}
                    style={[
                      styles.roleCard,
                      formData.roles.includes(UserRole.TRAINEE) && styles.roleCardSelected,
                    ]}
                  >
                    <View style={styles.roleIconContainer}>
                      <Ionicons 
                        name="search" 
                        size={28} 
                        color={formData.roles.includes(UserRole.TRAINEE) ? Colors.white : Colors.secondary} 
                      />
                    </View>
                    <View style={styles.roleTextContainer}>
                      <Text style={[
                        styles.roleCardTitle,
                        formData.roles.includes(UserRole.TRAINEE) && styles.roleCardTitleSelected,
                      ]}>
                        FIND A TRAINER
                      </Text>
                      <Text style={[
                        styles.roleCardSubtitle,
                        formData.roles.includes(UserRole.TRAINEE) && styles.roleCardSubtitleSelected,
                      ]}>
                        Book sessions & achieve your goals
                      </Text>
                    </View>
                    {formData.roles.includes(UserRole.TRAINEE) && (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Trainer Card */}
                <TouchableOpacity
                  onPress={() => selectRole(UserRole.TRAINER)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={formData.roles.includes(UserRole.TRAINER) ? Colors.gradientOrange : ['transparent', 'transparent']}
                    style={[
                      styles.roleCard,
                      formData.roles.includes(UserRole.TRAINER) && styles.roleCardSelected,
                    ]}
                  >
                    <View style={styles.roleIconContainer}>
                      <Ionicons 
                        name="flash" 
                        size={28} 
                        color={formData.roles.includes(UserRole.TRAINER) ? Colors.white : Colors.primary} 
                      />
                    </View>
                    <View style={styles.roleTextContainer}>
                      <Text style={[
                        styles.roleCardTitle,
                        formData.roles.includes(UserRole.TRAINER) && styles.roleCardTitleSelected,
                      ]}>
                        BECOME A TRAINER
                      </Text>
                      <Text style={[
                        styles.roleCardSubtitle,
                        formData.roles.includes(UserRole.TRAINER) && styles.roleCardSubtitleSelected,
                      ]}>
                        Build your business & earn more
                      </Text>
                    </View>
                    {formData.roles.includes(UserRole.TRAINER) && (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* CTA Button */}
              <TouchableOpacity
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={loading ? ['#666', '#888'] : Colors.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaButton}
                >
                  {loading ? (
                    <Text style={styles.ctaText}>Creating Account...</Text>
                  ) : (
                    <>
                      <Ionicons name="rocket" size={22} color={Colors.white} />
                      <Text style={styles.ctaText}>START MY JOURNEY</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.termsText}>
                  By signing up, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>

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
    </LinearGradient>
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
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 180,
    height: 70,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.secondary,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 24,
    ...Shadows.card,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
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
  helperText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textLight,
    marginTop: 6,
    marginLeft: 4,
  },
  roleSection: {
    marginBottom: 24,
  },
  roleSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.card,
  },
  roleCardSelected: {
    borderColor: 'transparent',
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  roleCardTitleSelected: {
    color: Colors.white,
  },
  roleCardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textLight,
  },
  roleCardSubtitleSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    ...Shadows.button,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1.5,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  termsText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 16,
  },
  termsLink: {
    fontWeight: '700',
    color: Colors.secondary,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textLight,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
});

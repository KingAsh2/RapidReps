import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { Colors } from '../../src/utils/colors';
import { UserRole } from '../../src/types';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedLogo } from '../../src/components/AnimatedLogo';

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

  const handleSignup = async () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      showAlert({
        title: 'Missing Information',
        message: 'Please fill in all fields',
        type: 'error',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showAlert({
        title: 'Password Mismatch',
        message: 'Passwords do not match',
        type: 'error',
      });
      return;
    }

    if (formData.roles.length === 0) {
      showAlert({
        title: 'Select Role',
        message: 'Please select at least one role',
        type: 'error',
      });
      return;
    }

    if (!formData.phone) {
      showAlert({
        title: 'Phone Required',
        message: 'Please enter your phone number',
        type: 'error',
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

      showAlert({
        title: 'Success! 🎉',
        message: 'Account created successfully!',
        type: 'success',
        buttons: [
          { 
            text: 'Continue', 
            onPress: () => {
              // If user selected trainer, go to trainer onboarding
              if (formData.roles.includes(UserRole.TRAINER)) {
                router.replace('/auth/onboarding-trainer');
              } else {
                router.replace('/auth/onboarding-trainee');
              }
            }
          },
        ],
      });
    } catch (error: any) {
      showAlert({
        title: 'Signup Failed',
        message: error.response?.data?.detail || 'Signup failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: UserRole) => {
    if (formData.roles.includes(role)) {
      setFormData({
        ...formData,
        roles: formData.roles.filter(r => r !== role),
      });
    } else {
      setFormData({
        ...formData,
        roles: [...formData.roles, role],
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <AnimatedLogo size={70} animationType="burst" />
        <Text style={styles.headerTitle}>Join RapidReps 🔥</Text>
        <Text style={styles.headerSubtitle}>Your fitness journey starts now</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              placeholder="John Doe"
              placeholderTextColor={Colors.textLight}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholder="john@example.com"
              placeholderTextColor={Colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="555-1234"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              placeholder="••••••••"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              placeholder="••••••••"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
            />
          </View>

          <View style={styles.roleSection}>
            <Text style={styles.roleTitle}>I want to...</Text>
            <View style={styles.roleChips}>
              <TouchableOpacity
                onPress={() => toggleRole(UserRole.TRAINEE)}
                style={styles.roleChipWrapper}
              >
                <LinearGradient
                  colors={
                    formData.roles.includes(UserRole.TRAINEE)
                      ? Colors.gradientTealStart
                      : ['#FFFFFF', '#FFFFFF']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.roleChip,
                    formData.roles.includes(UserRole.TRAINEE) && styles.roleChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      formData.roles.includes(UserRole.TRAINEE) && styles.roleChipTextSelected,
                    ]}
                  >
                    Find a Trainer 💪
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => toggleRole(UserRole.TRAINER)}
                style={styles.roleChipWrapper}
              >
                <LinearGradient
                  colors={
                    formData.roles.includes(UserRole.TRAINER)
                      ? Colors.gradientOrangeStart
                      : ['#FFFFFF', '#FFFFFF']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.roleChip,
                    formData.roles.includes(UserRole.TRAINER) && styles.roleChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      formData.roles.includes(UserRole.TRAINER) && styles.roleChipTextSelected,
                    ]}
                  >
                    Become a Trainer 🔥
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSignup}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? ['#CCCCCC', '#999999'] : Colors.gradientMain}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.signUpButton}
            >
              <Text style={styles.signUpButtonText}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.termsSection}>
            <Text style={styles.termsText}>
              By continuing, you agree to the{' '}
              <Text style={styles.termsLink} onPress={() => Alert.alert('Terms of Service', 'Terms of Service will be available soon.')}>
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={() => Alert.alert('Privacy Policy', 'Privacy Policy will be available soon.')}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>

          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginLinkButton}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: 16,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.white,
    marginTop: 8,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.navy,
  },
  roleSection: {
    marginTop: 8,
    gap: 16,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.navy,
  },
  roleChips: {
    gap: 12,
  },
  roleChipWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  roleChip: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  roleChipSelected: {
    borderColor: 'transparent',
  },
  roleChipText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.navy,
    textAlign: 'center',
  },
  roleChipTextSelected: {
    color: Colors.white,
  },
  signUpButton: {
    marginTop: 12,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  signUpButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  termsSection: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.neonBlue,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  loginText: {
    fontSize: 14,
    color: Colors.text,
  },
  loginLinkButton: {
    fontSize: 14,
    color: Colors.neonBlue,
    fontWeight: '700',
  },
});

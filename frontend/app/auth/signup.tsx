import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { UserRole } from '../../src/types';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedLogo } from '../../src/components/AnimatedLogo';

export default function SignupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    roles: [] as UserRole[],
  });

  const handleSignup = async () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.roles.length === 0) {
      Alert.alert('Error', 'Please select at least one role');
      return;
    }

    setLoading(true);
    try {
      await authAPI.signup(
        formData.email,
        formData.password,
        formData.fullName,
        formData.roles
      );

      Alert.alert('Success', 'Account created successfully!', [
        { 
          text: 'OK', 
          onPress: () => {
            // If user selected trainer, go to trainer onboarding
            if (formData.roles.includes(UserRole.TRAINER)) {
              router.replace('/auth/onboarding-trainer');
            } else {
              router.replace('/auth/onboarding-trainee');
            }
          }
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Signup failed');
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
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
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

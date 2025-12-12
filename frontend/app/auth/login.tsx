import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedLogo } from '../../src/components/AnimatedLogo';

export default function LoginScreen() {
  const router = useRouter();
  const { login, user, activeRole } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successAnim] = useState(new Animated.Value(0));
  const [checkmarkAnim] = useState(new Animated.Value(0));

  // Navigate when user is logged in and has an active role
  useEffect(() => {
    if (user && activeRole && loginSuccess) {
      // Increased delay to ensure Root Layout is fully mounted
      const timer = setTimeout(() => {
        if (activeRole === 'trainer') {
          router.replace('/trainer/home');
        } else if (activeRole === 'trainee') {
          router.replace('/trainee/home');
        }
      }, 2500); // Increased from 1500ms to 2500ms
      return () => clearTimeout(timer);
    }
  }, [user, activeRole, loginSuccess, router]);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert({
        title: 'Missing Fields',
        message: 'Please fill in all fields',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      
      // Show success animation
      setLoginSuccess(true);
      
      // Animate success overlay
      Animated.parallel([
        Animated.spring(successAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
        }),
        Animated.sequence([
          Animated.delay(200),
          Animated.spring(checkmarkAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 5,
          }),
        ]),
      ]).start();
      
    } catch (error: any) {
      setLoading(false);
      console.error('Login error:', error);
      showAlert({
        title: 'Login Failed',
        message: error.response?.data?.detail || 'Invalid email or password. Please try again.',
        type: 'error',
      });
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientTealStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <AnimatedLogo size={70} animationType="power-slam" />
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Ready to crush your goals? 💪</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail" size={20} color={Colors.neonBlue} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="john@example.com"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed" size={20} color={Colors.neonBlue} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textLight}
                  secureTextEntry
                />
              </View>
              <TouchableOpacity 
                onPress={() => router.push('/auth/forgot-password')}
                style={styles.forgotPasswordLink}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleLogin}
              disabled={loading || loginSuccess}
            >
              <LinearGradient
                colors={loading || loginSuccess ? ['#CCCCCC', '#999999'] : Colors.gradientTealStart}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loginButton}
              >
                {loading && !loginSuccess ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={Colors.white} />
                    <Text style={styles.loginButtonText}>Logging In...</Text>
                  </View>
                ) : (
                  <Text style={styles.loginButtonText}>
                    {loginSuccess ? 'Success! 🎉' : 'Log In ⚡'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signupLink}>
              <Text style={styles.signupLinkText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                <Text style={styles.signupLinkButton}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Overlay */}
      {loginSuccess && (
        <Animated.View
          style={[
            styles.successOverlay,
            {
              opacity: successAnim,
              transform: [
                {
                  scale: successAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={Colors.gradientMain}
            style={styles.successGradient}
          >
            <Animated.View
              style={[
                styles.checkmarkContainer,
                {
                  transform: [
                    {
                      scale: checkmarkAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                    {
                      rotate: checkmarkAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={80} color={Colors.white} />
            </Animated.View>
            <Text style={styles.successText}>Login Successful! 🎉</Text>
            <Text style={styles.successSubtext}>Redirecting you now...</Text>
            <ActivityIndicator size="small" color={Colors.white} style={{ marginTop: 20 }} />
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backButton: {
    marginBottom: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
  },
  formContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 8,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neonBlue,
    textDecorationLine: 'underline',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.navy,
  },
  loginButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.neonBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupLinkText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  signupLinkButton: {
    fontSize: 14,
    color: Colors.neonBlue,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successGradient: {
    width: '80%',
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  checkmarkContainer: {
    marginBottom: 20,
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
    textAlign: 'center',
  },
});

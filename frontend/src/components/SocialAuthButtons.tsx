import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableWithoutFeedback, StyleSheet, Platform,
  ActivityIndicator, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { haptic } from '../utils/haptics';

interface SocialAuthButtonsProps {
  preSelectedRole?: string;
  onError?: (message: string) => void;
  onSuccess?: (user: any, isNewUser: boolean) => void;
}

// ── Animated Social Button ──────────────────────────────────────────────
interface SocialBtnProps {
  provider: string;
  label: string;
  icon: string;
  iconColor: string;
  gradientColors: string[];
  textColor: string;
  borderColors?: string[];
  delay: number;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  testId: string;
}

const SocialBtn = ({
  provider, label, icon, iconColor, gradientColors, textColor,
  borderColors, delay, loading, disabled, onPress, testId,
}: SocialBtnProps) => {
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance — slide up + fade in
    Animated.spring(entranceAnim, {
      toValue: 1,
      delay,
      friction: 7,
      tension: 50,
      useNativeDriver: true,
    }).start();

    // Subtle glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
          delay: delay + 600,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Icon micro-bounce on mount
    Animated.sequence([
      Animated.delay(delay + 400),
      Animated.spring(iconBounce, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.spring(iconBounce, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.94, friction: 8, tension: 200, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    haptic.light();
    // Success bounce
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.92, friction: 8, tension: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [35, 0] });
  const opacity = entranceAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const iconTranslateY = iconBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.45],
  });

  const borderOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.5],
  });

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [{ translateY }, { scale: scaleAnim }],
        },
      ]}
    >
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        data-testid={testId}
      >
        <Animated.View
          style={[
            styles.btnOuter,
            {
              shadowOpacity,
              shadowColor: gradientColors[0],
            },
          ]}
        >
          {/* Animated border glow */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.borderGlow,
              {
                borderColor: borderColors ? borderColors[0] : gradientColors[0],
                opacity: borderOpacity,
              },
            ]}
          />

          <LinearGradient
            colors={gradientColors as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.btnGradient}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={textColor} />
                <Text style={[styles.btnText, { color: textColor, opacity: 0.7 }]}>Connecting...</Text>
              </View>
            ) : (
              <View style={styles.btnContent}>
                <Animated.View style={{ transform: [{ translateY: iconTranslateY }] }}>
                  <Ionicons name={icon as any} size={22} color={iconColor} />
                </Animated.View>
                <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>
                <Ionicons name="chevron-forward" size={16} color={textColor} style={{ opacity: 0.4 }} />
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
};

// ── Main Component ──────────────────────────────────────────────────────
export const SocialAuthButtons = ({ preSelectedRole, onError, onSuccess }: SocialAuthButtonsProps) => {
  const { socialLogin } = useAuth();
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSocialResult = async (user: any, isNewUser: boolean) => {
    if (onSuccess) {
      onSuccess(user, isNewUser);
      return;
    }
    if (isNewUser || !user.roles?.length) {
      router.replace({
        pathname: '/auth/signup',
        params: {
          socialName: user.fullName || '',
          socialEmail: user.email || '',
          socialAuth: 'true',
          role: preSelectedRole || '',
        },
      });
    } else {
      haptic.success();
      const role = user.roles[0];
      if (user.isAdmin || role === 'admin') router.replace('/admin/dashboard');
      else if (role === 'trainer') router.replace('/trainer/(tabs)/home');
      else router.replace('/trainee/(tabs)/home');
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingProvider('google');
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1] || '';
        const params = new URLSearchParams(fragment);
        const sessionId = params.get('session_id');
        if (!sessionId) { onError?.('Google sign-in was cancelled or failed.'); return; }
        const { user, isNewUser } = await socialLogin('google', { sessionId });
        await handleSocialResult(user, isNewUser);
      }
    } catch (err: any) {
      onError?.(err?.response?.data?.detail || err?.message || 'Google sign-in failed.');
    } finally { setLoadingProvider(null); }
  };

  const handleAppleLogin = async () => {
    if (Platform.OS !== 'ios') { onError?.('Apple Sign-In is only available on iOS.'); return; }
    setLoadingProvider('apple');
    try {
      const AppleAuth = await import('expo-apple-authentication');
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) { onError?.('Apple Sign-In failed.'); return; }
      let fullName: string | undefined;
      if (credential.fullName) {
        const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
        if (parts.length > 0) fullName = parts.join(' ');
      }
      const { user, isNewUser } = await socialLogin('apple', {
        identityToken: credential.identityToken, userId: credential.user,
        email: credential.email || undefined, fullName: fullName || undefined,
      });
      await handleSocialResult(user, isNewUser);
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        onError?.(err?.response?.data?.detail || err?.message || 'Apple sign-in failed.');
      }
    } finally { setLoadingProvider(null); }
  };

  const handleFacebookLogin = async () => {
    setLoadingProvider('facebook');
    haptic.light();
    setTimeout(() => {
      onError?.('Facebook login is coming soon. Use Google or Apple to sign in.');
      setLoadingProvider(null);
    }, 800);
  };

  const isLoading = !!loadingProvider;

  return (
    <View style={styles.container}>
      {/* Apple — sleek black */}
      {Platform.OS === 'ios' && (
        <SocialBtn
          provider="apple"
          label="Continue with Apple"
          icon="logo-apple"
          iconColor="#FFFFFF"
          gradientColors={['#1A1A1A', '#000000']}
          textColor="#FFFFFF"
          borderColors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.05)']}
          delay={0}
          loading={loadingProvider === 'apple'}
          disabled={isLoading}
          onPress={handleAppleLogin}
          testId="social-apple-btn"
        />
      )}

      {/* Google — clean white with color accent */}
      <SocialBtn
        provider="google"
        label="Continue with Google"
        icon="logo-google"
        iconColor="#4285F4"
        gradientColors={['#FFFFFF', '#F5F7FA']}
        textColor="#2D3748"
        borderColors={['rgba(66,133,244,0.3)', 'rgba(66,133,244,0.05)']}
        delay={Platform.OS === 'ios' ? 100 : 0}
        loading={loadingProvider === 'google'}
        disabled={isLoading}
        onPress={handleGoogleLogin}
        testId="social-google-btn"
      />

      {/* Facebook — bold blue */}
      <SocialBtn
        provider="facebook"
        label="Continue with Facebook"
        icon="logo-facebook"
        iconColor="#FFFFFF"
        gradientColors={['#1877F2', '#0C5DC7']}
        textColor="#FFFFFF"
        borderColors={['rgba(24,119,242,0.4)', 'rgba(24,119,242,0.1)']}
        delay={Platform.OS === 'ios' ? 200 : 100}
        loading={loadingProvider === 'facebook'}
        disabled={isLoading}
        onPress={handleFacebookLogin}
        testId="social-facebook-btn"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 14,
    width: '100%',
  },
  btnOuter: {
    borderRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  borderGlow: {
    borderRadius: 18,
    borderWidth: 1.5,
    zIndex: 2,
    pointerEvents: 'none',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 20,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    flex: 1,
  },
});

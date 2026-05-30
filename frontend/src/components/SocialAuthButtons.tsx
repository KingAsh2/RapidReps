import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

/* ── Full-width pill button (Apple HIG + Google brand compliant) ── */
interface PillBtnProps {
  label: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  delay: number;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  testId: string;
}

const PillBtn = ({
  label, icon, iconColor, bgColor, textColor, borderColor,
  delay, loading, disabled, onPress, testId,
}: PillBtnProps) => {
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1,
      delay,
      friction: 7,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, friction: 8, tension: 200, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 200, useNativeDriver: true }).start();
  };

  const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View
      style={{ opacity: entranceAnim, transform: [{ translateY }, { scale: scaleAnim }] }}
    >
      <TouchableOpacity
        style={[
          styles.pillBtn,
          { backgroundColor: bgColor, borderColor },
          disabled && !loading && { opacity: 0.6 },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        data-testid={testId}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            <Ionicons name={icon as any} size={20} color={iconColor} />
            <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  preSelectedRole, onError, onSuccess,
}) => {
  const { socialLogin } = useAuth();
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoadingProvider('google');
    haptic.light();
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/auth/google-callback`
        : Linking.createURL('auth/google-callback');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const sessionId = new URL(result.url.replace('rapidreps://', 'https://placeholder/'))
          .searchParams.get('session_id')
          || result.url.split('session_id=')[1]?.split('&')[0];
        if (!sessionId) { onError?.('Google sign-in was cancelled or failed.'); return; }
        const { user, isNewUser } = await socialLogin('google', { sessionId });
        if (onSuccess) onSuccess(user, isNewUser);
        else if (isNewUser) router.replace(`/auth/signup?isSocialAuth=true&socialId=${user.id}`);
        else router.replace(user.roles?.includes('trainer') ? '/trainer/(tabs)/home' : '/trainee/(tabs)/home');
      }
    } catch (err: any) {
      onError?.(err?.response?.data?.detail || err?.message || 'Google sign-in failed.');
    } finally { setLoadingProvider(null); }
  };

  const handleAppleLogin = async () => {
    setLoadingProvider('apple');
    haptic.light();
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/auth/apple-callback`
        : Linking.createURL('auth/apple-callback');
      const appleAuthUrl = `https://appleid.apple.com/auth/authorize?` +
        `client_id=app.emergent.trainer-finder-9f806c77e&` +
        `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
        `response_type=code id_token&` +
        `scope=name email&` +
        `response_mode=fragment`;
      const result = await WebBrowser.openAuthSessionAsync(appleAuthUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1] || '';
        const params = new URLSearchParams(fragment);
        const idToken = params.get('id_token');
        if (!idToken) { onError?.('Apple sign-in was cancelled or failed.'); return; }
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        const email = payload.email || '';
        const appleUserId = payload.sub || '';
        const { user, isNewUser } = await socialLogin('apple', {
          identityToken: idToken,
          userId: appleUserId,
          email,
        });
        if (onSuccess) onSuccess(user, isNewUser);
        else if (isNewUser) router.replace(`/auth/signup?isSocialAuth=true&socialId=${user.id}`);
        else router.replace(user.roles?.includes('trainer') ? '/trainer/(tabs)/home' : '/trainee/(tabs)/home');
      }
    } catch (err: any) {
      onError?.(err?.response?.data?.detail || err?.message || 'Apple sign-in failed.');
    } finally { setLoadingProvider(null); }
  };

  const isLoading = !!loadingProvider;

  return (
    <View style={styles.container}>
      {Platform.OS !== 'android' && (
        <PillBtn
          label="Continue with Apple"
          icon="logo-apple"
          iconColor="#FFFFFF"
          bgColor="#000000"
          textColor="#FFFFFF"
          borderColor="rgba(255,255,255,0.18)"
          delay={0}
          loading={loadingProvider === 'apple'}
          disabled={isLoading}
          onPress={handleAppleLogin}
          testId="social-apple-btn"
        />
      )}
      <PillBtn
        label="Continue with Google"
        icon="logo-google"
        iconColor="#4285F4"
        bgColor="#FFFFFF"
        textColor="#1F1F1F"
        borderColor="rgba(0,0,0,0.08)"
        delay={Platform.OS !== 'android' ? 80 : 0}
        loading={loadingProvider === 'google'}
        disabled={isLoading}
        onPress={handleGoogleLogin}
        testId="social-google-btn"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 12,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

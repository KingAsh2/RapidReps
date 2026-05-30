import React, { useState, useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Easing, Platform,
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

/* ── Compact circular icon button ── */
interface IconBtnProps {
  icon: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  delay: number;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
  testId: string;
}

const IconBtn = ({
  icon, iconColor, bgColor, borderColor,
  delay, loading, disabled, onPress, testId,
}: IconBtnProps) => {
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
    Animated.spring(scaleAnim, { toValue: 0.88, friction: 8, tension: 200, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }).start();
  };
  const handlePress = () => {
    haptic.light();
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.88, friction: 8, tension: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const opacity = entranceAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale: scaleAnim }] }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
        data-testid={testId}
        style={[
          styles.iconBtn,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons name={icon as any} size={22} color={iconColor} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ── Main Component ── */
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
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/auth/callback`
        : Linking.createURL('auth/callback');
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
    setLoadingProvider('apple');
    try {
      const redirectUrl = Platform.OS === 'web'
        ? `${window.location.origin}/auth/apple-callback`
        : Linking.createURL('auth/apple-callback');
      const appleAuthUrl = `https://appleid.apple.com/auth/authorize?` +
        `client_id=${encodeURIComponent('app.emergent.trainer-finder-9f806c77e')}` +
        `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
        `&response_type=code+id_token` +
        `&scope=name+email` +
        `&response_mode=fragment`;
      const result = await WebBrowser.openAuthSessionAsync(appleAuthUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1] || '';
        const params = new URLSearchParams(fragment);
        const idToken = params.get('id_token');
        if (!idToken) { onError?.('Apple sign-in was cancelled or failed.'); return; }
        const payloadB64 = idToken.split('.')[1] || '';
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
        const appleUserId = payload.sub || '';
        const email = payload.email || undefined;
        const { user, isNewUser } = await socialLogin('apple', {
          identityToken: idToken,
          userId: appleUserId,
          email,
          authorizationCode: params.get('code') || undefined,
        });
        await handleSocialResult(user, isNewUser);
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        onError?.(err?.response?.data?.detail || err?.message || 'Apple sign-in failed.');
      }
    } finally { setLoadingProvider(null); }
  };

  const isLoading = !!loadingProvider;

  /* Rendered right-to-left: Google, Apple (Facebook intentionally removed) */
  return (
    <View style={styles.container}>
      <IconBtn
        icon="logo-google"
        iconColor="#4285F4"
        bgColor="#FFFFFF"
        borderColor="rgba(66,133,244,0.3)"
        delay={100}
        loading={loadingProvider === 'google'}
        disabled={isLoading}
        onPress={handleGoogleLogin}
        testId="social-google-btn"
      />
      {Platform.OS !== 'android' && (
        <IconBtn
          icon="logo-apple"
          iconColor="#FFFFFF"
          bgColor="#000000"
          borderColor="rgba(255,255,255,0.25)"
          delay={0}
          loading={loadingProvider === 'apple'}
          disabled={isLoading}
          onPress={handleAppleLogin}
          testId="social-apple-btn"
        />
      )}
    </View>
  );
};

const ICON_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});

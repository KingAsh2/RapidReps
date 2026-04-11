import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { haptic } from '../utils/haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface SocialAuthButtonsProps {
  /** Pre-selected role to pass through to onboarding (optional) */
  preSelectedRole?: string;
  /** Called on error */
  onError?: (message: string) => void;
  /** Called on success with user + isNewUser flag */
  onSuccess?: (user: any, isNewUser: boolean) => void;
}

export const SocialAuthButtons = ({ preSelectedRole, onError, onSuccess }: SocialAuthButtonsProps) => {
  const { socialLogin } = useAuth();
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSocialResult = async (user: any, isNewUser: boolean) => {
    if (onSuccess) {
      onSuccess(user, isNewUser);
      return;
    }

    // Default navigation logic
    if (isNewUser || !user.roles?.length) {
      // New user → go to signup to pick role, with name/email pre-filled
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
      // Existing user → go to their home
      haptic.success();
      const role = user.roles[0];
      if (user.isAdmin || role === 'admin') router.replace('/admin/dashboard');
      else if (role === 'trainer') router.replace('/trainer/(tabs)/home');
      else router.replace('/trainee/(tabs)/home');
    }
  };

  // ---- GOOGLE (Emergent Auth) ----
  const handleGoogleLogin = async () => {
    setLoadingProvider('google');
    try {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = Linking.createURL('auth/callback');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        // Extract session_id from URL fragment: ...#session_id=xxx
        const url = result.url;
        const fragment = url.split('#')[1] || '';
        const params = new URLSearchParams(fragment);
        const sessionId = params.get('session_id');

        if (!sessionId) {
          onError?.('Google sign-in was cancelled or failed.');
          return;
        }

        const { user, isNewUser } = await socialLogin('google', { sessionId });
        await handleSocialResult(user, isNewUser);
      } else {
        // User cancelled
      }
    } catch (err: any) {
      console.error('Google auth error:', err);
      onError?.(err?.response?.data?.detail || err?.message || 'Google sign-in failed.');
    } finally {
      setLoadingProvider(null);
    }
  };

  // ---- APPLE ----
  const handleAppleLogin = async () => {
    if (Platform.OS !== 'ios') {
      onError?.('Apple Sign-In is only available on iOS devices.');
      return;
    }

    setLoadingProvider('apple');
    try {
      const AppleAuth = await import('expo-apple-authentication');

      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        onError?.('Apple Sign-In failed: no identity token.');
        return;
      }

      // Build full name from Apple's name components
      let fullName: string | undefined;
      if (credential.fullName) {
        const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
        if (parts.length > 0) fullName = parts.join(' ');
      }

      const { user, isNewUser } = await socialLogin('apple', {
        identityToken: credential.identityToken,
        userId: credential.user,
        email: credential.email || undefined,
        fullName: fullName || undefined,
      });

      await handleSocialResult(user, isNewUser);
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled — do nothing
      } else {
        console.error('Apple auth error:', err);
        onError?.(err?.response?.data?.detail || err?.message || 'Apple sign-in failed.');
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  // ---- FACEBOOK (Scaffolded) ----
  const handleFacebookLogin = async () => {
    setLoadingProvider('facebook');
    try {
      onError?.('Facebook login is coming soon. Please use Google or Apple to sign in.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const isLoading = !!loadingProvider;

  return (
    <View style={styles.container}>
      {/* Apple Sign-In (iOS only — required by Apple if using other social logins) */}
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.socialButton, styles.appleButton]}
          onPress={handleAppleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
          data-testid="social-apple-btn"
        >
          {loadingProvider === 'apple' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
              <Text style={[styles.socialText, styles.appleText]}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Google Sign-In */}
      <TouchableOpacity
        style={[styles.socialButton, styles.googleButton]}
        onPress={handleGoogleLogin}
        disabled={isLoading}
        activeOpacity={0.8}
        data-testid="social-google-btn"
      >
        {loadingProvider === 'google' ? (
          <ActivityIndicator size="small" color="#333" />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color="#4285F4" />
            <Text style={[styles.socialText, styles.googleText]}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Facebook Sign-In */}
      <TouchableOpacity
        style={[styles.socialButton, styles.facebookButton]}
        onPress={handleFacebookLogin}
        disabled={isLoading}
        activeOpacity={0.8}
        data-testid="social-facebook-btn"
      >
        {loadingProvider === 'facebook' ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="logo-facebook" size={22} color="#FFFFFF" />
            <Text style={[styles.socialText, styles.facebookText]}>Continue with Facebook</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    width: '100%',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
  },
  socialText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  appleText: {
    color: '#FFFFFF',
  },
  googleText: {
    color: '#333333',
  },
  facebookText: {
    color: '#FFFFFF',
  },
});

/**
 * RapidReps PREMIUM Welcome screen (Iteration 89).
 * Pixel-targeted match for the user's "DELIVERED RAPIDLY" mockup.
 *
 * Preserves all routing & business logic of the classic version:
 *  - Find a Trainer  → /auth/signup?role=trainee
 *  - Become a Trainer → /auth/signup?role=trainer
 *  - Already auth'd → routed to dashboard
 *  - Terms / Privacy links unchanged
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PremiumColors } from '../src/theme/premium';
import { PremiumHeroBg } from '../src/components/premium/PremiumHeroBg';
import { PremiumGradientButton } from '../src/components/premium/PremiumGradientButton';
import { PremiumFeatureBadge } from '../src/components/premium/PremiumFeatureBadge';

export default function PremiumWelcomeScreen() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(28)).current;
  const heroScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Auto-redirect if logged in (preserve classic behavior)
    (async () => {
      const token = await AsyncStorage.getItem('@rapidreps_token');
      if (token) router.replace('/auth/login');
    })();

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1 }} testID="premium-welcome-screen">
      <StatusBar barStyle="light-content" />
      <PremiumHeroBg variant="welcome">
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* ── Hero logo + tagline ─────────────────────────── */}
          <Animated.View
            style={[
              styles.heroWrap,
              { opacity: fade, transform: [{ translateY: slideUp }, { scale: heroScale }] },
            ]}
          >
            <Image
              source={require('../assets/rapidreps-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.eyebrow}>YOUR WORKOUT</Text>
            <Text style={styles.heroLineWhite}>DELIVERED</Text>
            <Text style={styles.heroLineOrange}>RAPIDLY</Text>

            {/* Small lightning underline accent */}
            <View style={styles.boltUnderline} />
          </Animated.View>

          {/* ── Feature badges ──────────────────────────────── */}
          <Animated.View style={[styles.featuresRow, { opacity: fade }]}>
            <PremiumFeatureBadge
              icon="location"
              topLine="Trainers"
              bottomLine="Near You"
              testID="premium-feature-near"
            />
            <View style={styles.featureDivider} />
            <PremiumFeatureBadge
              icon="flash"
              topLine="Book"
              bottomLine="Instantly"
              testID="premium-feature-instant"
            />
            <View style={styles.featureDivider} />
            <PremiumFeatureBadge
              icon="shield-checkmark"
              topLine="Verified"
              bottomLine="Pros"
              testID="premium-feature-verified"
            />
          </Animated.View>

          {/* ── CTAs ───────────────────────────────────────── */}
          <Animated.View style={[styles.ctaStack, { opacity: fade }]}>
            <PremiumGradientButton
              label="FIND A TRAINER"
              leftIcon="search"
              variant="primary"
              onPress={() => router.push({ pathname: '/auth/signup', params: { role: 'trainee' } })}
              testID="premium-find-trainer-btn"
              accessibilityLabel="Find a trainer"
            />
            <View style={{ height: 14 }} />
            <PremiumGradientButton
              label="BECOME A TRAINER"
              leftIcon="barbell"
              variant="secondary"
              onPress={() => router.push({ pathname: '/auth/signup', params: { role: 'trainer' } })}
              testID="premium-become-trainer-btn"
              accessibilityLabel="Become a trainer"
            />
          </Animated.View>

          {/* ── Terms ──────────────────────────────────────── */}
          <Animated.View style={[styles.termsWrap, { opacity: fade }]}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/legal/terms')}>
                Terms
              </Text>{' '}
              &{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/legal/privacy')}>
                Privacy Policy
              </Text>
            </Text>

            {/* Decorative bolt divider */}
            <View style={styles.boltDivider}>
              <View style={styles.boltLine} />
              <Text style={styles.boltIcon}>⚡</Text>
              <View style={styles.boltLine} />
            </View>

            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              testID="premium-login-link"
              accessibilityRole="button"
              accessibilityLabel="Log in to existing account"
            >
              <Text style={styles.loginPrompt}>
                Already have an account? <Text style={styles.loginLink}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </PremiumHeroBg>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 22, paddingBottom: 14 },
  heroWrap: { alignItems: 'center', marginTop: 10, marginBottom: 18 },
  logo: { width: 200, height: 180, marginBottom: 6 },
  eyebrow: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 4,
    color: PremiumColors.orange,
    marginTop: 2,
  },
  heroLineWhite: {
    fontSize: 52,
    fontWeight: '900',
    fontStyle: 'italic',
    color: PremiumColors.white,
    letterSpacing: -1,
    lineHeight: 52,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  heroLineOrange: {
    fontSize: 60,
    fontWeight: '900',
    fontStyle: 'italic',
    color: PremiumColors.orange,
    letterSpacing: -1.2,
    lineHeight: 60,
    textAlign: 'center',
    marginTop: -4,
    textShadowColor: 'rgba(255,122,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  boltUnderline: {
    width: 220,
    height: 3,
    marginTop: 8,
    backgroundColor: PremiumColors.orangeGlow,
    borderRadius: 2,
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 22,
  },
  featureDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 4,
  },
  ctaStack: { marginTop: 6 },
  termsWrap: { marginTop: 18, alignItems: 'center' },
  termsText: {
    fontSize: 13,
    color: PremiumColors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  termsLink: {
    color: PremiumColors.orangeGlow,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  boltDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 12,
    width: '70%',
  },
  boltLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,122,0,0.4)' },
  boltIcon: {
    marginHorizontal: 10,
    fontSize: 16,
    color: PremiumColors.orangeGlow,
  },
  loginPrompt: {
    fontSize: 14,
    fontWeight: '600',
    color: PremiumColors.textMuted,
  },
  loginLink: {
    color: PremiumColors.orange,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
});

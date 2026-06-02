/**
 * RapidReps PREMIUM Welcome screen (Iteration 90 — refinement pass).
 *
 * Refinements from user feedback:
 *  - Removed boxed/halo logo container; logo now cinematically blends via PremiumLogo
 *  - Larger, tighter "DELIVERED / RAPIDLY" hero typography for athletic impact
 *  - Premium glassmorphism feature badges with deeper shadows + edge lighting
 *  - Stronger orange edge + deeper glass on "BECOME A TRAINER"
 *  - More breathing room in footer/CTA stack
 *  - Logo breathes (scale + halo pulse + subtle tilt + ember sparkle)
 *
 * Business logic preserved 100%:
 *  - Find a Trainer  → /auth/signup?role=trainee
 *  - Become a Trainer → /auth/signup?role=trainer
 *  - Auth'd users     → routed to /auth/login
 *  - Terms / Privacy / Log In links unchanged
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
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
import { PremiumLogo } from '../src/components/premium/PremiumLogo';

export default function PremiumWelcomeScreen() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('@rapidreps_token');
      if (token) router.replace('/auth/login');
    })();

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1 }} testID="premium-welcome-screen">
      <StatusBar barStyle="light-content" />
      <PremiumHeroBg variant="welcome">
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* ── Hero logo (cinematic blend — NO boxed container) ─── */}
          <Animated.View
            style={[
              styles.heroLogoWrap,
              { opacity: fade, transform: [{ translateY: slideUp }] },
            ]}
          >
            <PremiumLogo size={200} testID="premium-welcome-logo" />
          </Animated.View>

          {/* ── Hero typography — larger, tighter, athletic ─── */}
          <Animated.View
            style={[styles.heroTextWrap, { opacity: fade, transform: [{ translateY: slideUp }] }]}
          >
            <Text style={styles.eyebrow} numberOfLines={1}>YOUR WORKOUT</Text>
            <Text
              style={styles.heroLineWhite}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              allowFontScaling={false}
            >
              DELIVERED
            </Text>
            <Text
              style={styles.heroLineOrange}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              allowFontScaling={false}
            >
              RAPIDLY
            </Text>
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
            <View style={{ height: 16 }} />
            <PremiumGradientButton
              label="BECOME A TRAINER"
              leftIcon="barbell"
              variant="secondary"
              onPress={() => router.push({ pathname: '/auth/signup', params: { role: 'trainer' } })}
              testID="premium-become-trainer-btn"
              accessibilityLabel="Become a trainer"
            />
          </Animated.View>

          {/* ── Footer (more breathing room) ──────────────── */}
          <Animated.View style={[styles.footerWrap, { opacity: fade }]}>
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
              style={styles.loginTap}
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
  safe: { flex: 1, paddingHorizontal: 24, paddingBottom: 12 },
  heroLogoWrap: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: -6, // slight negative — lets logo halo touch the headline
  },
  heroTextWrap: { alignItems: 'center', marginBottom: 18, alignSelf: 'stretch' },
  eyebrow: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 5,
    color: PremiumColors.orange,
    marginBottom: 2,
    fontFamily: 'Oswald_700Bold',
    textShadowColor: 'rgba(255,122,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  heroLineWhite: {
    fontSize: 64,
    fontWeight: '900',
    color: PremiumColors.white,
    letterSpacing: -1,
    lineHeight: 66,
    textAlign: 'center',
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-8deg' }],
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 14,
    alignSelf: 'stretch',
  },
  heroLineOrange: {
    fontSize: 76,
    fontWeight: '900',
    color: PremiumColors.orange,
    letterSpacing: -1.4,
    lineHeight: 76,
    textAlign: 'center',
    marginTop: -4,
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-8deg' }],
    textShadowColor: 'rgba(255,122,0,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
    alignSelf: 'stretch',
  },
  boltUnderline: {
    width: 200,
    height: 3,
    marginTop: 8,
    backgroundColor: PremiumColors.orangeGlow,
    borderRadius: 2,
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureDivider: {
    width: 1,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 2,
  },
  ctaStack: { marginTop: 2 },
  footerWrap: { marginTop: 16, alignItems: 'center', paddingBottom: 0 },
  termsText: {
    fontSize: 12,
    color: PremiumColors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: PremiumColors.orangeGlow,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  boltDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    width: '72%',
  },
  boltLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,122,0,0.4)' },
  boltIcon: {
    marginHorizontal: 12,
    fontSize: 16,
    color: PremiumColors.orangeGlow,
  },
  loginTap: { paddingVertical: 4 },
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

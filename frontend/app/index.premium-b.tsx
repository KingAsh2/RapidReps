/**
 * Welcome Variant B — Community-first hero (iter95c A/B harness).
 *
 * Surfaced when EXPO_PUBLIC_WELCOME_VARIANT === 'B'.
 *
 * Design intent (vs. Variant A's "DELIVERED RAPIDLY" speed angle):
 *  - Leads with proximity/community: "TRAINERS / NEAR YOU"
 *  - Adds a "social proof" avatar strip + live stat ("237 trainers in your area")
 *  - CTAs reordered to emphasize Trainee path with a softer secondary trainer CTA
 *  - Same Oswald typography and premium token vocabulary as Variant A for brand consistency
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { PremiumColors } from '../src/theme/premium';
import { PremiumHeroBg } from '../src/components/premium/PremiumHeroBg';
import { PremiumGradientButton } from '../src/components/premium/PremiumGradientButton';
import { PremiumLogo } from '../src/components/premium/PremiumLogo';

// Stock avatar strip — small, anonymous, just for "people are here" signal.
// Using ui-avatars endpoint via initials so no external CDN dependency at runtime.
const SOCIAL_AVATARS = [
  { initials: 'TM', bg: '#FF7A00' },
  { initials: 'SR', bg: '#3B82F6' },
  { initials: 'JK', bg: '#22C55E' },
  { initials: 'AL', bg: '#A855F7' },
  { initials: 'DB', bg: '#EAB308' },
];

export default function PremiumWelcomeVariantB() {
  const router = useRouter();
  const { user } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(28)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user) {
      if (user.isAdmin || user.roles?.includes('admin')) {
        router.replace('/admin/dashboard');
      } else if (user.roles?.includes('trainer')) {
        router.replace('/trainer/(tabs)/home');
      } else if (user.roles?.includes('trainee')) {
        router.replace('/trainee/(tabs)/home');
      }
    }
  }, [user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // Subtle live-dot pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View style={{ flex: 1 }} testID="premium-welcome-screen-b">
      <StatusBar barStyle="light-content" />
      <PremiumHeroBg variant="welcome">
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Logo */}
          <Animated.View
            style={[styles.heroLogoWrap, { opacity: fade, transform: [{ translateY: slideUp }] }]}
          >
            <PremiumLogo size={196} testID="premium-welcome-logo-b" />
          </Animated.View>

          {/* Eyebrow + hero */}
          <Animated.View
            style={[styles.heroTextWrap, { opacity: fade, transform: [{ translateY: slideUp }] }]}
          >
            <Text style={styles.eyebrow} numberOfLines={1}>BUILD WITH PROS</Text>
            <Text
              style={styles.heroLineWhite}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              allowFontScaling={false}
            >
              TRAINERS
            </Text>
            <Text
              style={styles.heroLineOrange}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              allowFontScaling={false}
            >
              NEAR YOU
            </Text>
          </Animated.View>

          {/* Social proof — live-dot + avatar strip + count */}
          <Animated.View style={[styles.proofRow, { opacity: fade }]}>
            <View style={styles.liveDotWrap}>
              <Animated.View
                style={[
                  styles.liveDotPulse,
                  { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
                ]}
              />
              <View style={styles.liveDot} />
            </View>
            <View style={styles.avatarStrip}>
              {SOCIAL_AVATARS.map((a, i) => (
                <View
                  key={i}
                  style={[
                    styles.avatar,
                    { backgroundColor: a.bg, marginLeft: i === 0 ? 0 : -10, zIndex: 5 - i },
                  ]}
                >
                  <Text style={styles.avatarText}>{a.initials}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.proofText}>
              <Text style={styles.proofCount}>237</Text> trainers in your area
            </Text>
          </Animated.View>

          {/* Stat tiles */}
          <Animated.View style={[styles.statsRow, { opacity: fade }]}>
            <View style={styles.stat}>
              <Ionicons name="star" size={14} color={PremiumColors.orange} />
              <Text style={styles.statValue}>4.9</Text>
              <Text style={styles.statLabel}>Avg Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Ionicons name="people" size={14} color={PremiumColors.orange} />
              <Text style={styles.statValue}>12k+</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Ionicons name="flash" size={14} color={PremiumColors.orange} />
              <Text style={styles.statValue}>{'<10m'}</Text>
              <Text style={styles.statLabel}>Avg Match</Text>
            </View>
          </Animated.View>

          {/* CTAs — same as Variant A so conversion deltas are clean */}
          <Animated.View style={[styles.ctaStack, { opacity: fade }]}>
            <PremiumGradientButton
              label="MATCH WITH A TRAINER"
              leftIcon="search"
              variant="primary"
              onPress={() => router.push({ pathname: '/auth/signup', params: { role: 'trainee' } })}
              testID="premium-find-trainer-btn"
              accessibilityLabel="Match with a trainer"
            />
            <View style={{ height: 14 }} />
            <PremiumGradientButton
              label="I'M A TRAINER"
              leftIcon="barbell"
              variant="secondary"
              onPress={() => router.push({ pathname: '/auth/signup', params: { role: 'trainer' } })}
              testID="premium-become-trainer-btn"
              accessibilityLabel="Become a trainer"
            />
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footerWrap, { opacity: fade }]}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/legal/terms')}>Terms</Text>
              {' & '}
              <Text style={styles.termsLink} onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text>
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              testID="premium-login-link"
              accessibilityRole="button"
              style={styles.loginTap}
            >
              <Text style={styles.loginPrompt}>
                Already have an account? <Text style={styles.loginLink}>Log In</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/corporate')}
              testID="premium-corporate-link"
              accessibilityRole="button"
              style={styles.loginTap}
            >
              <Text style={styles.loginPrompt}>
                <Text style={styles.loginLink}>For Teams →</Text> Corporate Wellness
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
  heroLogoWrap: { alignItems: 'center', marginTop: 0, marginBottom: -4 },
  heroTextWrap: { alignItems: 'center', marginBottom: 18, alignSelf: 'stretch' },
  eyebrow: {
    fontSize: 13, fontWeight: '900', letterSpacing: 5,
    color: PremiumColors.orange, marginBottom: 4,
    fontFamily: 'Oswald_700Bold',
    textShadowColor: 'rgba(255,122,0,0.5)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  heroLineWhite: {
    fontSize: 58, fontWeight: '900', color: PremiumColors.white,
    letterSpacing: -1, lineHeight: 60, textAlign: 'center',
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-8deg' }],
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 5 }, textShadowRadius: 14,
    alignSelf: 'stretch',
  },
  heroLineOrange: {
    fontSize: 64, fontWeight: '900', color: PremiumColors.orange,
    letterSpacing: -1.2, lineHeight: 66, textAlign: 'center',
    fontFamily: 'Oswald_700Bold',
    transform: [{ skewX: '-8deg' }],
    textShadowColor: 'rgba(255,122,0,0.5)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 22,
    alignSelf: 'stretch',
  },
  proofRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 18, paddingHorizontal: 8,
  },
  liveDotWrap: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveDotPulse: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E' },
  avatarStrip: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0A0E1A',
  },
  avatarText: { color: '#FFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  proofText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  proofCount: { color: PremiumColors.orange, fontWeight: '900' },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18,
    marginBottom: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.10)' },
  statValue: { color: PremiumColors.white, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  ctaStack: { alignSelf: 'stretch', marginBottom: 22 },
  footerWrap: { alignItems: 'center', marginTop: 'auto', paddingTop: 8 },
  termsText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 18, marginBottom: 14, paddingHorizontal: 12 },
  termsLink: { color: PremiumColors.orange, fontWeight: '700' },
  loginTap: { paddingVertical: 8, paddingHorizontal: 18 },
  loginPrompt: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  loginLink: { color: PremiumColors.orange, fontWeight: '900' },
});

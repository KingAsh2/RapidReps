import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { corporateAPI } from '../../../src/services/api';
import { DS } from '../../../src/theme/designSystem';

/**
 * Public branded landing page — no auth required.
 * Each employer gets their own URL at /corporate/c/<slug>.
 */
export default function CorporatePublicLanding() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = String(params.slug || '');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); setError('Missing company'); return; }
    corporateAPI.publicLanding(slug)
      .then(setData)
      .catch((e) => setError(e?.response?.status === 404 ? 'Company not found' : 'Could not load page'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
        <View style={styles.center}><ActivityIndicator color={DS.colors.orange} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color={DS.colors.textMuted} />
          <Text style={[DS.text.h3, { marginTop: 16 }]}>{error || 'Not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const brand = data.brandColor || DS.colors.orange;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.hero}>
          <View style={[styles.logoBubble, { backgroundColor: brand }]}>
            <Ionicons name="briefcase" size={42} color="#fff" />
          </View>
          <Text style={styles.eyebrow}>CORPORATE WELLNESS</Text>
          <Text style={styles.companyName}>{data.name}</Text>
          {data.brandTagline ? <Text style={styles.tagline}>"{data.brandTagline}"</Text> : null}
        </View>

        <View style={styles.pitchCard}>
          <Text style={DS.text.h2}>Powered by RapidReps</Text>
          <Text style={[DS.text.body, { marginTop: 8 }]}>
            {data.name} has partnered with RapidReps to subsidize world-class personal training for the team.
            Your employer covers part of every session — you book sessions, build streaks, and crush goals.
          </Text>
        </View>

        <View style={styles.featureGrid}>
          {[
            { icon: 'flash', label: 'Instant Match', sub: 'Find a trainer in minutes' },
            { icon: 'shield-checkmark', label: 'Vetted Pros', sub: 'Certified & background-checked' },
            { icon: 'card', label: 'Subsidized', sub: `${data.name} covers your sessions` },
          ].map((f) => (
            <View key={f.label} style={styles.featureCard}>
              <Ionicons name={f.icon as any} size={26} color={brand} />
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={DS.text.helper}>{f.sub}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaBlock}>
          <TouchableOpacity
            style={[styles.primaryCta, { backgroundColor: brand }]}
            onPress={() => router.push('/corporate/redeem')}
            data-testid="corp-landing-redeem-btn"
          >
            <Text style={styles.primaryCtaText}>I Have a Code → Redeem</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryCta}
            onPress={() => router.push('/auth/signup')}
            data-testid="corp-landing-signup-btn"
          >
            <Text style={styles.secondaryCtaText}>Create a RapidReps Account</Text>
          </TouchableOpacity>
        </View>

        {data.employeeCount > 0 ? (
          <Text style={styles.socialProof}>
            {data.employeeCount} team member{data.employeeCount === 1 ? '' : 's'} already training
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: DS.spacing['3xl'], paddingHorizontal: DS.spacing['2xl'] },
  logoBubble: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.spacing.lg, ...DS.shadows.card,
  },
  eyebrow: { ...DS.text.label, marginBottom: 6 },
  companyName: { ...DS.text.display, fontSize: 36, textAlign: 'center', marginBottom: 8 },
  tagline: { ...DS.text.body, fontStyle: 'italic', textAlign: 'center' },

  pitchCard: {
    margin: DS.spacing['2xl'], marginTop: DS.spacing['3xl'],
    backgroundColor: DS.colors.bgRaised, borderRadius: DS.radii.card,
    padding: DS.spacing.xl, borderWidth: 1, borderColor: DS.colors.border,
  },

  featureGrid: {
    flexDirection: 'row', gap: 10, paddingHorizontal: DS.spacing['2xl'], marginBottom: DS.spacing.xl,
  },
  featureCard: {
    flex: 1, backgroundColor: DS.colors.bgRaised, borderRadius: DS.radii.card,
    padding: DS.spacing.md, borderWidth: 1, borderColor: DS.colors.border,
  },
  featureLabel: { ...DS.text.bodyStrong, marginTop: 8, marginBottom: 2, fontSize: 14 },

  ctaBlock: { paddingHorizontal: DS.spacing['2xl'], gap: 12 },
  primaryCta: {
    paddingVertical: DS.spacing.lg, borderRadius: DS.radii.card,
    alignItems: 'center', ...DS.shadows.orangeGlow,
  },
  primaryCtaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryCta: {
    paddingVertical: DS.spacing.lg, borderRadius: DS.radii.card,
    alignItems: 'center', backgroundColor: DS.colors.surface,
    borderWidth: 1, borderColor: DS.colors.borderStrong,
  },
  secondaryCtaText: { color: DS.colors.textPrimary, fontSize: 16, fontWeight: '700' },

  socialProof: {
    ...DS.text.caption, textAlign: 'center',
    marginTop: DS.spacing.xl, marginBottom: DS.spacing['3xl'],
  },
});

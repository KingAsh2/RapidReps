import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { corporateAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { DS } from '../../src/theme/designSystem';

export default function CorporateRedeemScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState<any>(null);

  const handleRedeem = async () => {
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 4) {
      toast.error('Code too short', 'Please enter your full invite code');
      return;
    }
    setLoading(true);
    try {
      const data = await corporateAPI.redeem(cleaned);
      haptic.success();
      setRedeemed(data);
      toast.success('Enrolled', `Welcome to ${data.company?.name || 'your company'}!`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Could not redeem code';
      toast.error('Redemption failed', msg);
    } finally {
      setLoading(false);
    }
  };

  if (redeemed) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: redeemed.company?.brandColor || DS.colors.orange }]}>
            <Ionicons name="briefcase" size={56} color="#fff" />
          </View>
          <Text style={styles.successTitle}>You're enrolled!</Text>
          <Text style={styles.successCompany}>{redeemed.company?.name}</Text>
          {redeemed.company?.brandTagline ? (
            <Text style={styles.successTagline}>"{redeemed.company.brandTagline}"</Text>
          ) : null}
          <View style={styles.creditCard}>
            <Text style={styles.creditLabel}>YOUR EMPLOYER CREDIT</Text>
            <Text style={styles.creditAmount}>
              ${((redeemed.membership?.creditAllowanceCents || 0) / 100).toFixed(2)}
            </Text>
            <Text style={styles.creditHint}>Use it on personal training sessions</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryCta}
            onPress={() => router.replace('/trainee/(tabs)/home')}
            data-testid="corp-redeem-continue-btn"
          >
            <Text style={styles.primaryCtaText}>Find a Trainer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} data-testid="corp-redeem-back">
              <Ionicons name="chevron-back" size={28} color={DS.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.iconBubble}>
              <Ionicons name="business" size={42} color={DS.colors.orange} />
            </View>
            <Text style={styles.title}>Redeem Employer Code</Text>
            <Text style={styles.subtitle}>
              Got an invite code from your HR or wellness team? Enter it here to unlock subsidized training.
            </Text>

            <TextInput
              data-testid="corp-redeem-code-input"
              style={styles.input}
              placeholder="ABCD1234"
              placeholderTextColor={DS.colors.textMuted}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
            />

            <TouchableOpacity
              style={[styles.primaryCta, loading && { opacity: 0.5 }]}
              onPress={handleRedeem}
              disabled={loading}
              data-testid="corp-redeem-submit-btn"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryCtaText}>Redeem Code</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helperText}>
              Don't have a code? Ask your HR or wellness contact for one.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.bg },
  header: { paddingHorizontal: DS.spacing.lg, paddingTop: DS.spacing.md },
  body: { paddingHorizontal: DS.spacing['2xl'], paddingTop: DS.spacing['3xl'], alignItems: 'center' },
  iconBubble: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: DS.colors.orangeSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.spacing.xl,
  },
  title: { ...DS.text.h1, textAlign: 'center', marginBottom: DS.spacing.md },
  subtitle: { ...DS.text.body, textAlign: 'center', marginBottom: DS.spacing['3xl'] },
  input: {
    width: '100%',
    backgroundColor: DS.colors.bgRaised,
    borderWidth: 1, borderColor: DS.colors.borderStrong,
    borderRadius: DS.radii.input,
    paddingHorizontal: DS.spacing.lg, paddingVertical: DS.spacing.lg,
    fontSize: 24, color: DS.colors.textPrimary,
    letterSpacing: 4, textAlign: 'center', fontWeight: '800',
    marginBottom: DS.spacing.lg,
  },
  primaryCta: {
    width: '100%', backgroundColor: DS.colors.orange,
    paddingVertical: DS.spacing.lg, borderRadius: DS.radii.card,
    alignItems: 'center', ...DS.shadows.orangeGlow,
  },
  primaryCtaText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },
  helperText: { ...DS.text.helper, textAlign: 'center', marginTop: DS.spacing.lg },

  // Success state
  successWrap: { flex: 1, paddingHorizontal: DS.spacing['2xl'], alignItems: 'center', justifyContent: 'center' },
  successIcon: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center', marginBottom: DS.spacing.xl,
    ...DS.shadows.orangeGlow,
  },
  successTitle: { ...DS.text.display, fontSize: 32, marginBottom: DS.spacing.sm, textAlign: 'center' },
  successCompany: { ...DS.text.h2, color: DS.colors.orange, marginBottom: DS.spacing.xs, textAlign: 'center' },
  successTagline: { ...DS.text.caption, fontStyle: 'italic', marginBottom: DS.spacing.xl, textAlign: 'center' },
  creditCard: {
    width: '100%', backgroundColor: DS.colors.bgRaised,
    borderRadius: DS.radii.card, padding: DS.spacing.xl,
    borderWidth: 1, borderColor: DS.colors.borderAccent,
    alignItems: 'center', marginBottom: DS.spacing['2xl'],
    ...DS.shadows.card,
  },
  creditLabel: { ...DS.text.label, marginBottom: DS.spacing.sm },
  creditAmount: { fontSize: 42, fontWeight: '900', color: DS.colors.orange, marginBottom: DS.spacing.xs },
  creditHint: { ...DS.text.caption, textAlign: 'center' },
});

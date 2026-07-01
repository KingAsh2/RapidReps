/**
 * corporate/signup.tsx
 *
 * iter106ao (2026-07): This screen previously accepted business/organization
 * account registration in-app. Apple flagged it under App Store Review
 * Guideline 3.1.1 ("access to external mechanisms for purchases or
 * subscriptions to be used in the app"). Per Apple's remediation
 * instruction, the in-app registration form has been removed.
 *
 * Kept as a route so any existing deep link doesn't 404; now it just
 * routes team admins to the website to enroll their organization.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { DS } from '../../src/theme/designSystem';
import { FloatingOrangeBg } from '../../src/components/FloatingOrangeBg';

const SALES_URL = 'https://rapidreps.com/for-teams';
const SALES_EMAIL = 'sales@rapidreps.com';

export default function CorporateSignupRedirectScreen() {
  const router = useRouter();

  const openWeb = () => Linking.openURL(SALES_URL).catch(() => {});
  const emailSales = () => Linking.openURL(`mailto:${SALES_EMAIL}?subject=RapidReps%20for%20Teams%20Enrollment`).catch(() => {});

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
      <FloatingOrangeBg density={5} intensity={0.28} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="corp-signup-back">
          <Ionicons name="chevron-back" size={28} color={DS.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.iconBubble}>
          <Ionicons name="business" size={42} color={DS.colors.orange} />
        </View>

        <Text style={styles.title}>Enroll your team</Text>
        <Text style={styles.subtitle}>
          Corporate wellness signups happen through our team-onboarding portal so we can walk you through credit pool sizing, invoicing, and admin seat setup.
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={openWeb} data-testid="corp-signup-web">
          <Ionicons name="open-outline" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Open team onboarding portal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={emailSales} data-testid="corp-signup-email">
          <Ionicons name="mail-outline" size={20} color={DS.colors.textPrimary} />
          <Text style={styles.secondaryBtnText}>Email {SALES_EMAIL}</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Employees with an invite code can still redeem their allowance from the previous screen.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.bg },
  header: { paddingHorizontal: DS.spacing.lg, paddingTop: DS.spacing.md },
  body: { paddingHorizontal: DS.spacing['2xl'], paddingTop: DS.spacing.xl, flex: 1 },
  iconBubble: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: DS.colors.orangeSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.spacing.xl, alignSelf: 'center',
  },
  title: { ...DS.text.h1, textAlign: 'center', marginBottom: DS.spacing.md },
  subtitle: { ...DS.text.body, textAlign: 'center', marginBottom: DS.spacing['3xl'], color: DS.colors.textSec },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: DS.colors.orange, borderRadius: DS.radii.card,
    paddingVertical: DS.spacing.lg, gap: 10,
    marginBottom: DS.spacing.md,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent', borderRadius: DS.radii.card,
    paddingVertical: DS.spacing.lg, gap: 10,
    borderWidth: 1, borderColor: DS.colors.border,
    marginBottom: DS.spacing['2xl'],
  },
  secondaryBtnText: { color: DS.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  footnote: { ...DS.text.caption, textAlign: 'center', color: DS.colors.textMuted },
});

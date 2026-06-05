/**
 * iter102t — Safety Center (508-compliant rebuild).
 *
 * Earlier version wrapped the Safety Tips + Share section in an
 * `<Animated.View style={{ opacity: fadeAnim }}>` where `fadeAnim` started at 0.
 * On web/Expo the `useNativeDriver: true` opacity animation could fail silently
 * and the whole section stayed at opacity 0 → user reported "text not visible".
 *
 * Rebuilt without the fade so every block is rendered at opacity 1 from frame
 * one. Background swapped to the shared `RapidBg` so this screen now uses one
 * of the 4 brand hero photos with a WCAG AA scrim.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RapidBg from '../../src/components/RapidBg';

const COLORS = {
  navy: '#1a2a5e',
  orange: '#F7931E',
  white: '#FFFFFF',
  success: '#00C853',
  error: '#FF4757',
};

const SAFETY_TIPS = [
  { icon: 'location', title: 'Share Your Location', desc: 'Always let someone know where your training session is taking place.' },
  { icon: 'people', title: 'Train in Public', desc: 'For first sessions, choose well-lit public areas like parks or gyms.' },
  { icon: 'call', title: 'Emergency Contacts', desc: 'Keep your emergency contacts updated and easily accessible.' },
  { icon: 'shield-checkmark', title: 'Verified Trainers', desc: 'Only book sessions with verified trainers who have passed our background checks.' },
  { icon: 'videocam', title: 'Virtual Option', desc: 'If unsure, try a virtual session first before meeting in person.' },
  { icon: 'flag', title: 'Report Concerns', desc: 'Report any suspicious behavior or safety concerns immediately.' },
];

export default function SafetyCenterScreen() {
  const router = useRouter();

  return (
    <RapidBg variant="trainee-safety-center" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            data-testid="safety-back-btn"
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} accessibilityRole="header">Safety Center</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Hero Banner */}
          <View style={styles.heroBanner}>
            <Ionicons name="shield-checkmark" size={48} color={COLORS.orange} />
            <Text style={styles.heroTitle} accessibilityRole="header">Your Safety Matters</Text>
            <Text style={styles.heroSub}>
              RapidReps is committed to providing a safe training environment for everyone.
            </Text>
          </View>

          {/* Emergency Actions */}
          <Text style={styles.sectionTitle} accessibilityRole="header">Emergency Actions</Text>
          <View style={styles.emergencyRow}>
            <TouchableOpacity
              style={[styles.emergencyBtn, { backgroundColor: COLORS.error }]}
              onPress={() => Linking.openURL('tel:911')}
              data-testid="call-911-btn"
              accessibilityLabel="Call 911 emergency services"
              accessibilityRole="button"
            >
              <Ionicons name="call" size={22} color={COLORS.white} />
              <Text style={styles.emergencyBtnText}>Call 911</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emergencyBtn, { backgroundColor: COLORS.orange }]}
              onPress={() => router.push('/trainee/report-issue')}
              data-testid="report-issue-btn"
              accessibilityLabel="Report a safety issue"
              accessibilityRole="button"
            >
              {/* iter102t: dark icon + dark text on orange to stay ≥4.5:1 contrast (508/AA). */}
              <Ionicons name="flag" size={22} color="#0A0E1A" />
              <Text style={[styles.emergencyBtnText, { color: '#0A0E1A' }]}>Report Issue</Text>
            </TouchableOpacity>
          </View>

          {/* Safety Tips */}
          <Text style={styles.sectionTitle} accessibilityRole="header">Safety Tips</Text>
          {SAFETY_TIPS.map((tip, idx) => (
            <View key={idx} style={styles.tipCard} data-testid={`safety-tip-${idx}`}>
              <View style={styles.tipIcon}>
                <Ionicons name={tip.icon as any} size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDesc}>{tip.desc}</Text>
              </View>
            </View>
          ))}

          {/* Share Session Feature */}
          <View style={styles.shareCard} accessibilityRole="summary">
            <Ionicons name="share-social" size={28} color={COLORS.orange} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.shareTitle}>Share Your Session</Text>
              <Text style={styles.shareSub}>
                Share your session details with a friend or family member so they know where you are.
              </Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </RapidBg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)', // bumped from 0.10 → 0.16 for 3:1 control-vs-bg
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroBanner: {
    borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 24, gap: 10,
    backgroundColor: 'rgba(10,14,26,0.55)', // solid-ish card so hero photo doesn't fight the headline
    borderWidth: 1, borderColor: 'rgba(255,106,0,0.35)',
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  heroSub: {
    // 508/WCAG AA: white-95 over rgba(10,14,26,0.55) on top of dark hero ≥ 12:1.
    fontSize: 14, color: 'rgba(255,255,255,0.95)', textAlign: 'center', lineHeight: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 14, marginTop: 8 },
  emergencyRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  emergencyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderRadius: 14,
  },
  emergencyBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(10,14,26,0.78)', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  tipIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,106,0,0.22)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,106,0,0.45)',
  },
  tipTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  // Bumped from rgba 0.88 → 0.95 to guarantee ≥4.5:1 over the rgba(10,14,26,0.78) card.
  tipDesc: { fontSize: 13, color: 'rgba(255,255,255,0.95)', lineHeight: 18 },
  shareCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(247,147,30,0.22)', borderRadius: 14, padding: 18,
    marginTop: 16, borderWidth: 1, borderColor: 'rgba(247,147,30,0.6)',
  },
  shareTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  shareSub: { fontSize: 13, color: 'rgba(255,255,255,0.95)', lineHeight: 18 },
});

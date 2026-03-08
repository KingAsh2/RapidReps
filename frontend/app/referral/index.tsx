import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { referralAPI } from '../../src/services/api';

const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  success: '#00C853',
  dark: '#0a0f1e',
};

export default function ReferralScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await referralAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load referral stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!stats?.referralCode) return;
    try {
      await Share.share({ message: stats.referralCode });
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!stats?.referralCode) return;
    try {
      await Share.share({
        message: `Join me on RapidReps! Use my referral code ${stats.referralCode} when you sign up and we both get $5 off our next session. Download the app today!`,
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#1a2a5e']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="referral-back-button">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>REFER & EARN</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[COLORS.orangeHot, COLORS.orange]}
              style={styles.heroBadge}
            >
              <Ionicons name="gift" size={32} color={COLORS.white} />
            </LinearGradient>
            <Text style={styles.heroTitle}>Share & Save</Text>
            <Text style={styles.heroSubtitle}>
              Invite friends to RapidReps. You both earn $5.00 credit after their first booking!
            </Text>
          </View>

          {/* Referral Code Card */}
          <View style={styles.codeCard} data-testid="referral-code-card">
            <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText} data-testid="referral-code-text">{stats?.referralCode || '---'}</Text>
              <TouchableOpacity onPress={handleCopyCode} style={styles.copyButton} data-testid="referral-copy-button">
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color={copied ? COLORS.success : COLORS.white} />
                <Text style={[styles.copyText, copied && { color: COLORS.success }]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleShare} style={styles.shareButton} data-testid="referral-share-button">
              <LinearGradient colors={[COLORS.teal, COLORS.tealLight]} style={styles.shareButtonGradient}>
                <Ionicons name="share-social" size={20} color={COLORS.white} />
                <Text style={styles.shareButtonText}>Share with Friends</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.activatedReferrals || 0}</Text>
              <Text style={styles.statLabel}>Activated</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.pendingReferrals || 0}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.success }]}>
                ${((stats?.availableCredits || 0) / 100).toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Credits</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.referralsRemaining ?? 5}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
          </View>

          {/* How It Works */}
          <View style={styles.howSection}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Share Your Code</Text>
                <Text style={styles.stepDesc}>Send your unique code to friends who want to get fit.</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>They Sign Up & Book</Text>
                <Text style={styles.stepDesc}>Your friend enters your code at signup and books their first session.</Text>
              </View>
            </View>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: COLORS.success }]}><Text style={styles.stepNumberText}>3</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>You Both Earn $5</Text>
                <Text style={styles.stepDesc}>Credits are auto-applied as a discount on your next booking.</Text>
              </View>
            </View>
          </View>

          {/* Referral History */}
          {stats?.referralHistory && stats.referralHistory.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Referral History</Text>
              {stats.referralHistory.map((ref: any, i: number) => (
                <View key={i} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <Ionicons
                      name={ref.status === 'activated' ? 'checkmark-circle' : 'time'}
                      size={20}
                      color={ref.status === 'activated' ? COLORS.success : COLORS.orange}
                    />
                    <Text style={styles.historyName}>{ref.referredName}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={[
                      styles.historyStatus,
                      { color: ref.status === 'activated' ? COLORS.success : COLORS.orange }
                    ]}>
                      {ref.status === 'activated' ? '+$5.00' : 'Pending'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Limit Notice */}
          <Text style={styles.limitNotice}>
            Maximum {stats?.maxReferrals || 5} referrals per account. Credits never expire and auto-apply at checkout.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f1e' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  heroSection: { alignItems: 'center', marginTop: 10, marginBottom: 24 },
  heroBadge: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: COLORS.white, marginBottom: 8 },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },

  codeCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  codeLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray, letterSpacing: 2, marginBottom: 12 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  codeText: { fontSize: 28, fontWeight: '900', color: COLORS.orange, letterSpacing: 3 },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 },
  copyText: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  shareButton: { borderRadius: 14, overflow: 'hidden' },
  shareButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  shareButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  statLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray },

  howSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, marginBottom: 16 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.teal, justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: COLORS.white, marginBottom: 2 },
  stepDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },

  historySection: { marginBottom: 24 },
  historyItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyName: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  historyRight: {},
  historyStatus: { fontSize: 14, fontWeight: '700' },

  limitNotice: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 18, marginTop: 8, marginBottom: 20 },
});

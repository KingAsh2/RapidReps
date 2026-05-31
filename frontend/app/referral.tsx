import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  RefreshControl,
  Clipboard,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { referralAPI } from '../src/services/api';
import { haptic } from '../src/utils/haptics';
import { toast } from '../src/utils/toast';

const COLORS = {
  navy: '#0A0E1A',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.10)',
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  gold: '#FFD700',
  green: '#00C853',
  white: '#FFFFFF',
  subtle: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.40)',
};

type ReferralStats = {
  referralCode: string;
  totalReferrals: number;
  activatedReferrals: number;
  pendingReferrals: number;
  totalCreditsEarned: number;
  availableCredits: number;
  maxReferrals: number;
  referralsRemaining: number;
  referralHistory: Array<{
    referredName: string;
    status: 'pending' | 'activated' | string;
    creditCents: number;
    createdAt: string | null;
    activatedAt: string | null;
  }>;
};

export default function ReferralScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await referralAPI.getStats();
      setStats(data);
    } catch (err) {
      toast.error('Could not load referrals. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleCopy = async () => {
    if (!stats?.referralCode) return;
    Clipboard.setString(stats.referralCode);
    haptic.success();
    toast.success('Referral code copied to clipboard');
  };

  const handleShare = async () => {
    if (!stats?.referralCode) return;
    try {
      haptic.medium();
      await Share.share({
        title: 'Join me on Rapid Reps',
        message: `Train smarter with Rapid Reps. Use my referral code ${stats.referralCode} when you sign up and we both get session credit. https://rapidreps.com/r/${stats.referralCode}`,
      });
    } catch { /* user cancelled */ }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }
  if (!stats) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={{ color: COLORS.white, fontSize: 16, textAlign: 'center' }}>
          Could not load your referrals. Pull to retry.
        </Text>
      </View>
    );
  }

  const dollarsEarned = (stats.totalCreditsEarned / 100).toFixed(2);
  const dollarsAvail = (stats.availableCredits / 100).toFixed(2);
  const successRate = stats.totalReferrals > 0
    ? Math.round((stats.activatedReferrals / stats.totalReferrals) * 100)
    : 0;

  // Bar chart values (max bar height 140)
  const barMax = Math.max(stats.totalReferrals, 1);
  const activatedHeight = (stats.activatedReferrals / barMax) * 140;
  const pendingHeight = (stats.pendingReferrals / barMax) * 140;
  const remainingHeight = (stats.referralsRemaining / Math.max(stats.maxReferrals, 1)) * 140;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="referral-back-btn">
            <Ionicons name="chevron-back" size={26} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Referrals</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.orange} />}
        >
          {/* HERO — Code + Share */}
          <LinearGradient
            colors={[COLORS.orange, COLORS.orangeLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="gift" size={20} color={COLORS.white} />
              <Text style={styles.heroLabel}>YOUR REFERRAL CODE</Text>
            </View>
            <Text style={styles.heroCode} data-testid="referral-code">{stats.referralCode}</Text>
            <View style={styles.heroActions}>
              <TouchableOpacity onPress={handleCopy} style={styles.heroBtnSecondary} data-testid="copy-code-btn">
                <Ionicons name="copy-outline" size={18} color={COLORS.white} />
                <Text style={styles.heroBtnSecondaryText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={styles.heroBtnPrimary} data-testid="share-code-btn">
                <Ionicons name="share-social" size={18} color={COLORS.orange} />
                <Text style={styles.heroBtnPrimaryText}>Share</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Stat Cards */}
          <View style={styles.statsRow}>
            <StatCard
              icon="people"
              label="Total invited"
              value={String(stats.totalReferrals)}
              accent={COLORS.white}
              testID="stat-total"
            />
            <StatCard
              icon="checkmark-circle"
              label="Activated"
              value={String(stats.activatedReferrals)}
              accent={COLORS.green}
              testID="stat-activated"
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon="time"
              label="Pending"
              value={String(stats.pendingReferrals)}
              accent={COLORS.gold}
              testID="stat-pending"
            />
            <StatCard
              icon="trending-up"
              label="Success rate"
              value={`${successRate}%`}
              accent={COLORS.orange}
              testID="stat-success-rate"
            />
          </View>

          {/* Earnings */}
          <View style={styles.earningsCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.earningsLabel}>Total earned</Text>
              <Text style={styles.earningsValue} data-testid="earnings-total">${dollarsEarned}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.earningsLabel}>Available to spend</Text>
              <Text style={[styles.earningsValue, { color: COLORS.green }]} data-testid="earnings-available">
                ${dollarsAvail}
              </Text>
            </View>
          </View>

          {/* Chart Card */}
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Referral breakdown</Text>
            <View style={styles.chartArea}>
              <ChartBar
                label="Activated"
                value={stats.activatedReferrals}
                height={activatedHeight}
                color={COLORS.green}
                testID="chart-bar-activated"
              />
              <ChartBar
                label="Pending"
                value={stats.pendingReferrals}
                height={pendingHeight}
                color={COLORS.gold}
                testID="chart-bar-pending"
              />
              <ChartBar
                label="Slots left"
                value={stats.referralsRemaining}
                height={remainingHeight}
                color={COLORS.orange}
                testID="chart-bar-remaining"
              />
            </View>
            <View style={styles.legendRow}>
              <Text style={styles.legendText}>
                {stats.referralsRemaining} of {stats.maxReferrals} invites remaining
              </Text>
            </View>
          </View>

          {/* History */}
          <Text style={[styles.sectionTitle, { marginLeft: 16, marginTop: 24, marginBottom: 8 }]}>
            History
          </Text>
          {stats.referralHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="paper-plane-outline" size={42} color={COLORS.faint} />
              <Text style={styles.emptyTitle}>No referrals yet</Text>
              <Text style={styles.emptySub}>
                Share your code to start earning session credit.
              </Text>
              <TouchableOpacity onPress={handleShare} style={styles.emptyCTA} data-testid="empty-share-btn">
                <Text style={styles.emptyCTAText}>Share my code</Text>
              </TouchableOpacity>
            </View>
          ) : (
            stats.referralHistory.map((ref, idx) => (
              <View key={`${ref.referredName}-${idx}`} style={styles.historyRow} data-testid={`history-row-${idx}`}>
                <View style={[styles.historyDot, { backgroundColor: ref.status === 'activated' ? COLORS.green : COLORS.gold }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{ref.referredName}</Text>
                  <Text style={styles.historyMeta}>
                    {ref.status === 'activated' ? 'Activated' : 'Pending'} ·{' '}
                    {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </Text>
                </View>
                <Text style={[styles.historyCredit, { color: ref.status === 'activated' ? COLORS.green : COLORS.faint }]}>
                  {ref.status === 'activated' ? `+$${(ref.creditCents / 100).toFixed(0)}` : '—'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const StatCard = ({
  icon,
  label,
  value,
  accent,
  testID,
}: {
  icon: any;
  label: string;
  value: string;
  accent: string;
  testID: string;
}) => (
  <View style={styles.statCard} data-testid={testID}>
    <Ionicons name={icon} size={20} color={accent} />
    <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ChartBar = ({
  label,
  value,
  height,
  color,
  testID,
}: {
  label: string;
  value: number;
  height: number;
  color: string;
  testID: string;
}) => (
  <View style={styles.barColumn} data-testid={testID}>
    <Text style={styles.barValue}>{value}</Text>
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { height: Math.max(6, height), backgroundColor: color }]} />
    </View>
    <Text style={styles.barLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
  heroCard: {
    margin: 16,
    padding: 20,
    borderRadius: 20,
    gap: 12,
    shadowColor: COLORS.orange,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  heroLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.92)', letterSpacing: 1.4 },
  heroCode: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  heroBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  heroBtnSecondaryText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  heroBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  heroBtnPrimaryText: { color: COLORS.orange, fontWeight: '800', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  statValue: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  statLabel: { fontSize: 12, color: COLORS.subtle, fontWeight: '600' },
  earningsCard: {
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  earningsLabel: { fontSize: 12, color: COLORS.subtle, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  earningsValue: { fontSize: 22, fontWeight: '900', color: COLORS.white, marginTop: 4 },
  earningsDivider: { width: 1, height: '100%', backgroundColor: COLORS.border, marginHorizontal: 16 },
  chartCard: {
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.white, marginBottom: 14 },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 180,
    paddingHorizontal: 8,
  },
  barColumn: { alignItems: 'center', gap: 6, flex: 1 },
  barValue: { fontSize: 13, fontWeight: '800', color: COLORS.white },
  barTrack: { width: 36, height: 140, justifyContent: 'flex-end', borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  barFill: { width: '100%', borderRadius: 8 },
  barLabel: { fontSize: 11, color: COLORS.subtle, fontWeight: '600' },
  legendRow: { marginTop: 12, alignItems: 'center' },
  legendText: { fontSize: 12, color: COLORS.subtle, fontWeight: '600' },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 32,
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginTop: 4 },
  emptySub: { fontSize: 13, color: COLORS.subtle, textAlign: 'center', paddingHorizontal: 32 },
  emptyCTA: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.orange },
  emptyCTAText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginBottom: 8,
  },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyName: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  historyMeta: { fontSize: 12, color: COLORS.subtle, marginTop: 2 },
  historyCredit: { fontSize: 15, fontWeight: '800' },
});

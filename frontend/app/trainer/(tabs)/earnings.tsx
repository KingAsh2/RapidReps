import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { toast } from '../../../src/utils/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_MAX_HEIGHT = 100;

const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA040',
  teal: '#1FB8B4',
  tealDark: '#18908D',
  navy: '#1a2a5e',
  navyLight: '#243b7f',
  white: '#FFFFFF',
  gray: '#8892b0',
  grayLight: '#F5F6F8',
  success: '#00C853',
  successLight: '#69F0AE',
  error: '#FF4757',
  warning: '#FFB300',
};

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const backgroundImage = require('../../../assets/images/bg-gym-weights.png');

type Period = 'week' | 'month';
type PayoutMethod = 'cashapp' | 'zelle' | 'stripe';

export default function TrainerEarningsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState<Period>('week');
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('cashapp');
  const [payoutHandle, setPayoutHandle] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const barAnims = useRef([...Array(7)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    loadEarnings();
  }, []);

  useEffect(() => {
    if (data) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      animateBars();
    }
  }, [data, period]);

  const animateBars = () => {
    barAnims.forEach(a => a.setValue(0));
    const items = period === 'week' ? (data?.dailyBreakdown || []) : (data?.weeklyBreakdown || []);
    const maxVal = Math.max(1, ...items.map((i: any) => i.earningsCents));
    items.forEach((_: any, idx: number) => {
      if (barAnims[idx]) {
        Animated.timing(barAnims[idx], {
          toValue: 1,
          duration: 600,
          delay: idx * 80,
          useNativeDriver: false,
        }).start();
      }
    });
  };

  const loadEarnings = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await axios.get(`${API_URL}/api/trainer/earnings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err: any) {
      console.error('Earnings load error:', err?.response?.data || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEarnings();
  };

  const handleRequestPayout = async () => {
    if (!payoutHandle.trim()) {
      toast.warning('Please enter your payment handle (CashApp tag, Zelle email, etc.)');
      return;
    }
    setSubmittingPayout(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await axios.post(
        `${API_URL}/api/trainer/request-payout`,
        {
          paymentMethod: payoutMethod,
          paymentHandle: payoutHandle.trim(),
          notes: payoutNotes.trim() || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      setPayoutModalVisible(false);
      setPayoutHandle('');
      setPayoutNotes('');
      loadEarnings();
    } catch (err: any) {
      toast.error( err?.response?.data?.detail || 'Failed to request payout');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const cents = (c: number) => `$${(c / 100).toFixed(2)}`;
  const periodEarnings = period === 'week' ? (data?.weekEarningsCents || 0) : (data?.monthEarningsCents || 0);
  const periodSessions = period === 'week' ? (data?.weekSessions || 0) : (data?.monthSessions || 0);
  const lastPeriodEarnings = period === 'week' ? (data?.lastWeekEarningsCents || 0) : (data?.lastMonthEarningsCents || 0);
  const changePercent = lastPeriodEarnings > 0 ? Math.round(((periodEarnings - lastPeriodEarnings) / lastPeriodEarnings) * 100) : 0;
  const chartItems = period === 'week' ? (data?.dailyBreakdown || []) : (data?.weeklyBreakdown || []);
  const maxChartVal = Math.max(1, ...chartItems.map((i: any) => i.earningsCents));
  const hasPendingRequest = data?.payoutRequests?.some((r: any) => r.status === 'pending');

  if (loading) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(26, 42, 94, 0.96)', 'rgba(26, 42, 94, 0.92)']} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(26, 42, 94, 0.96)', 'rgba(26, 42, 94, 0.92)']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Earnings</Text>
              <Text style={styles.headerSubtitle}>Your financial overview</Text>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
          >
            {/* Hero Card - Pending Balance */}
            <LinearGradient
              colors={[COLORS.teal, COLORS.tealDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>Available Balance</Text>
                <View style={styles.heroIconBg}>
                  <Ionicons name="wallet" size={20} color={COLORS.teal} />
                </View>
              </View>
              <Text style={styles.heroAmount}>{cents(data?.pendingBalanceCents || 0)}</Text>
              <View style={styles.heroDivider} />
              <View style={styles.heroBottom}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Total Earned</Text>
                  <Text style={styles.heroStatValue}>{cents(data?.totalEarningsCents || 0)}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Paid Out</Text>
                  <Text style={styles.heroStatValue}>{cents(data?.totalPaidOutCents || 0)}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Request Payout Button */}
            <TouchableOpacity
              style={[styles.payoutButton, (data?.pendingBalanceCents <= 0 || hasPendingRequest) && styles.payoutButtonDisabled]}
              onPress={() => setPayoutModalVisible(true)}
              disabled={data?.pendingBalanceCents <= 0 || hasPendingRequest}
              data-testid="request-payout-btn"
            >
              <LinearGradient
                colors={data?.pendingBalanceCents > 0 && !hasPendingRequest ? [COLORS.success, '#00A844'] : ['#555', '#444']}
                style={styles.payoutButtonGradient}
              >
                <Ionicons name={hasPendingRequest ? 'time' : 'cash'} size={20} color={COLORS.white} />
                <Text style={styles.payoutButtonText}>
                  {hasPendingRequest ? 'Payout Pending' : data?.pendingBalanceCents > 0 ? `Request Payout (${cents(data.pendingBalanceCents)})` : 'No Balance to Withdraw'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Period Toggle */}
            <View style={styles.periodToggle}>
              {(['week', 'month'] as Period[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                  onPress={() => setPeriod(p)}
                  data-testid={`period-${p}`}
                >
                  <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                    {p === 'week' ? 'This Week' : 'This Month'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Period Summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Earnings</Text>
                <Text style={styles.summaryValue}>{cents(periodEarnings)}</Text>
                {changePercent !== 0 && (
                  <View style={[styles.changeBadge, { backgroundColor: changePercent > 0 ? `${COLORS.success}20` : `${COLORS.error}20` }]}>
                    <Ionicons name={changePercent > 0 ? 'trending-up' : 'trending-down'} size={12} color={changePercent > 0 ? COLORS.success : COLORS.error} />
                    <Text style={[styles.changeText, { color: changePercent > 0 ? COLORS.success : COLORS.error }]}>
                      {changePercent > 0 ? '+' : ''}{changePercent}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Sessions</Text>
                <Text style={styles.summaryValue}>{periodSessions}</Text>
                <Text style={styles.summarySubtext}>{data?.totalSessions || 0} all time</Text>
              </View>
            </View>

            {/* Earnings Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>{period === 'week' ? 'Daily' : 'Weekly'} Breakdown</Text>
              <View style={styles.chartContainer}>
                {chartItems.map((item: any, idx: number) => {
                  const barHeight = barAnims[idx]
                    ? barAnims[idx].interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, Math.max(4, (item.earningsCents / maxChartVal) * BAR_MAX_HEIGHT)],
                      })
                    : 4;
                  return (
                    <View key={idx} style={styles.chartBarWrapper}>
                      <Text style={styles.chartBarValue}>
                        {item.earningsCents > 0 ? `$${(item.earningsCents / 100).toFixed(0)}` : ''}
                      </Text>
                      <Animated.View
                        style={[
                          styles.chartBar,
                          {
                            height: barHeight,
                            backgroundColor: item.earningsCents > 0 ? COLORS.teal : 'rgba(255,255,255,0.15)',
                          },
                        ]}
                      />
                      <Text style={styles.chartBarLabel}>
                        {period === 'week' ? item.day : item.week?.replace('Week ', 'W')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Recent Sessions */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Sessions</Text>
              <Text style={styles.sectionCount}>{data?.recentSessions?.length || 0}</Text>
            </View>

            {data?.recentSessions?.length > 0 ? (
              data.recentSessions.map((session: any, idx: number) => (
                <View key={session.id || idx} style={styles.sessionCard} data-testid={`session-${idx}`}>
                  <View style={styles.sessionIconBg}>
                    <Ionicons
                      name={session.sessionType === 'virtual' ? 'videocam' : session.sessionType === 'outdoor' ? 'sunny' : 'home'}
                      size={18}
                      color={COLORS.teal}
                    />
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionName}>{session.traineeName}</Text>
                    <Text style={styles.sessionMeta}>
                      {session.sessionType} | {session.durationMinutes}min | {new Date(session.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.sessionEarning}>+{cents(session.earningsCents)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="barbell-outline" size={36} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyText}>No completed sessions yet</Text>
                <Text style={[styles.emptyText, { fontSize: 11, marginTop: 4 }]}>Complete sessions to start earning and request payouts.</Text>
              </View>
            )}

            {/* Payout History */}
            {(data?.payoutRequests?.length > 0 || data?.payouts?.length > 0) && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Payout History</Text>
                </View>
                {data?.payoutRequests?.map((pr: any, idx: number) => (
                  <View key={pr.id || idx} style={styles.payoutHistoryCard}>
                    <View style={[styles.payoutStatusDot, { backgroundColor: pr.status === 'pending' ? COLORS.warning : pr.status === 'completed' ? COLORS.success : COLORS.error }]} />
                    <View style={styles.payoutHistoryInfo}>
                      <Text style={styles.payoutHistoryAmount}>{cents(pr.amountCents)}</Text>
                      <Text style={styles.payoutHistoryMeta}>
                        {pr.paymentMethod} | {pr.status} | {new Date(pr.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Revenue Split Info */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={22} color={COLORS.teal} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>How Earnings Work</Text>
                <Text style={styles.infoText}>
                  You keep 75% of every session. RapidReps takes 25% as a platform fee. Payouts are processed within 1-3 business days.
                </Text>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>

      {/* Payout Modal */}
      <Modal visible={payoutModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Payout</Text>
              <TouchableOpacity onPress={() => setPayoutModalVisible(false)} data-testid="close-payout-modal">
                <Ionicons name="close" size={24} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalAmount}>{cents(data?.pendingBalanceCents || 0)}</Text>
              <Text style={styles.modalAmountLabel}>Available Balance</Text>

              <Text style={styles.modalFieldLabel}>Payment Method</Text>
              <View style={styles.methodGrid}>
                {([
                  { id: 'cashapp' as PayoutMethod, icon: 'cash', label: 'Cash App' },
                  { id: 'zelle' as PayoutMethod, icon: 'phone-portrait', label: 'Zelle' },
                  { id: 'stripe' as PayoutMethod, icon: 'card', label: 'Stripe' },
                ]).map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.methodCard, payoutMethod === m.id && styles.methodCardActive]}
                    onPress={() => setPayoutMethod(m.id)}
                    data-testid={`method-${m.id}`}
                  >
                    <Ionicons name={m.icon as any} size={22} color={payoutMethod === m.id ? COLORS.teal : COLORS.gray} />
                    <Text style={[styles.methodLabel, payoutMethod === m.id && styles.methodLabelActive]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalFieldLabel}>
                {payoutMethod === 'cashapp' ? 'CashApp Tag ($cashtag)' : payoutMethod === 'zelle' ? 'Zelle Email or Phone' : 'Stripe Account ID'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder={payoutMethod === 'cashapp' ? '$yourcashtag' : payoutMethod === 'zelle' ? 'email@example.com' : 'acct_...'}
                value={payoutHandle}
                onChangeText={setPayoutHandle}
                autoCapitalize="none"
                data-testid="payout-handle-input"
              />

              <Text style={styles.modalFieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Any special instructions..."
                value={payoutNotes}
                onChangeText={setPayoutNotes}
                multiline
                data-testid="payout-notes-input"
              />

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleRequestPayout}
                disabled={submittingPayout}
                data-testid="submit-payout-btn"
              >
                <LinearGradient colors={[COLORS.success, '#00A844']} style={styles.modalSubmitGradient}>
                  {submittingPayout ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={18} color={COLORS.white} />
                      <Text style={styles.modalSubmitText}>Submit Payout Request</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.gray, fontSize: 14 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 16 },

  // Hero Card
  heroCard: { borderRadius: 20, padding: 22, marginBottom: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  heroLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  heroIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  heroAmount: { fontSize: 42, fontWeight: '900', color: COLORS.white, marginVertical: 4 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 14 },
  heroBottom: { flexDirection: 'row' },
  heroStat: { flex: 1 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },
  heroStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: COLORS.white, marginTop: 2 },

  // Payout Button
  payoutButton: { borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  payoutButtonDisabled: { opacity: 0.6 },
  payoutButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  payoutButtonText: { fontSize: 16, fontWeight: '800', color: COLORS.white },

  // Period Toggle
  periodToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 4, marginBottom: 16 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  periodBtnActive: { backgroundColor: COLORS.white },
  periodBtnText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  periodBtnTextActive: { color: COLORS.navy },

  // Summary Row
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 },
  summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  summaryValue: { fontSize: 24, fontWeight: '900', color: COLORS.white, marginTop: 4 },
  summarySubtext: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  changeText: { fontSize: 11, fontWeight: '700' },

  // Chart
  chartCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, marginBottom: 20 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: BAR_MAX_HEIGHT + 40, paddingTop: 20 },
  chartBarWrapper: { alignItems: 'center', flex: 1 },
  chartBarValue: { fontSize: 10, color: COLORS.teal, fontWeight: '700', marginBottom: 4, height: 14 },
  chartBar: { width: 28, borderRadius: 6, minHeight: 4 },
  chartBarLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 6, fontWeight: '600' },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  sectionCount: { fontSize: 13, fontWeight: '700', color: COLORS.teal, backgroundColor: `${COLORS.teal}20`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },

  // Session Card
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  sessionIconBg: { width: 40, height: 40, borderRadius: 10, backgroundColor: `${COLORS.teal}20`, justifyContent: 'center', alignItems: 'center' },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  sessionMeta: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  sessionEarning: { fontSize: 16, fontWeight: '800', color: COLORS.success },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  // Payout History
  payoutHistoryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  payoutStatusDot: { width: 10, height: 10, borderRadius: 5 },
  payoutHistoryInfo: { flex: 1 },
  payoutHistoryAmount: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  payoutHistoryMeta: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  // Info Card
  infoCard: { flexDirection: 'row', backgroundColor: `${COLORS.teal}15`, borderRadius: 14, padding: 16, gap: 12, marginTop: 8 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  infoText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18, marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.navy },
  modalBody: { paddingHorizontal: 22, paddingBottom: 40, paddingTop: 20 },
  modalAmount: { fontSize: 36, fontWeight: '900', color: COLORS.success, textAlign: 'center' },
  modalAmountLabel: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 24 },
  modalFieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.navy, marginBottom: 8, marginTop: 16 },
  methodGrid: { flexDirection: 'row', gap: 10 },
  methodCard: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#eee', gap: 6 },
  methodCardActive: { borderColor: COLORS.teal, backgroundColor: `${COLORS.teal}08` },
  methodLabel: { fontSize: 12, fontWeight: '700', color: COLORS.gray },
  methodLabelActive: { color: COLORS.teal },
  modalInput: { backgroundColor: COLORS.grayLight, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.navy, borderWidth: 1, borderColor: '#e2e8f0' },
  modalSubmitBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 24 },
  modalSubmitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  modalSubmitText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
});

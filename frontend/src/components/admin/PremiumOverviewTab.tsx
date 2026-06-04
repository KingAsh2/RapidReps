/**
 * Premium Admin Overview Tab — iter98a
 * - Glass-morphism KPI tiles over a dark gradient background
 * - User-configurable: hide/show any tile from the "Customize" modal
 * - Tiles persist via AsyncStorage so each admin keeps their layout
 * - CSV Export modal with date-range picker + direct download
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, formatCents, api, getAuthHeader } from './AdminShared';
import { toast } from '../../utils/toast';

const STORAGE_KEY = 'admin_overview_tiles_v1';

type TileKey =
  | 'totalRevenue'
  | 'serviceFee'
  | 'commission'
  | 'trainerPayouts'
  | 'totalSessions'
  | 'activeUsers'
  | 'corporatePool'
  | 'avgSessionValue'
  | 'topTrainers'
  | 'recentSessions'
  | 'pendingItems';

const TILE_DEFS: { key: TileKey; label: string; icon: string; group: string }[] = [
  { key: 'totalRevenue', label: 'Total Revenue', icon: 'cash', group: 'Revenue' },
  { key: 'serviceFee', label: 'Service Fee Revenue', icon: 'pricetag', group: 'Revenue' },
  { key: 'commission', label: 'Commission Revenue', icon: 'analytics', group: 'Revenue' },
  { key: 'trainerPayouts', label: 'Trainer Payouts', icon: 'wallet', group: 'Revenue' },
  { key: 'avgSessionValue', label: 'Avg Session Value', icon: 'speedometer', group: 'Revenue' },
  { key: 'totalSessions', label: 'Sessions (Month / All)', icon: 'calendar', group: 'Activity' },
  { key: 'activeUsers', label: 'Active Trainers / Trainees', icon: 'people', group: 'Activity' },
  { key: 'corporatePool', label: 'Corporate Credit Pool', icon: 'business', group: 'Activity' },
  { key: 'pendingItems', label: 'Pending Verifications', icon: 'shield-checkmark', group: 'Activity' },
  { key: 'topTrainers', label: 'Top 5 Trainers (Leaderboard)', icon: 'trophy', group: 'Lists' },
  { key: 'recentSessions', label: 'Recent Sessions Feed', icon: 'time', group: 'Lists' },
];

const DEFAULT_VISIBLE: TileKey[] = TILE_DEFS.map((t) => t.key);

interface Props {
  dashboard: any;
  leaderboard: any[];
  setActiveTab: (tab: string) => void;
}

export const PremiumOverviewTab = ({ dashboard, leaderboard, setActiveTab }: Props) => {
  const [visible, setVisible] = useState<TileKey[]>(DEFAULT_VISIBLE);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [exportPeriod, setExportPeriod] = useState<'this_month' | 'last_month' | 'all_time'>('this_month');
  const [exporting, setExporting] = useState(false);

  // Load saved tile prefs
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setVisible(JSON.parse(raw));
      } catch { /* no-op */ }
    })();
  }, []);

  // Fetch recent sessions feed
  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeader();
        const res = await api.get('/admin/recent-sessions?limit=10', { headers });
        setRecentSessions(res.data.sessions || []);
      } catch { /* no-op */ }
    })();
  }, []);

  const toggleTile = (key: TileKey) => {
    const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key];
    setVisible(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const isOn = (k: TileKey) => visible.includes(k);

  const handleExport = async () => {
    setExporting(true);
    try {
      const headers = await getAuthHeader();
      const res = await api.get(`/admin/payments/csv-export?period=${exportPeriod}`, {
        headers,
        responseType: 'text' as any,
        transformResponse: [(d: any) => d], // prevent axios JSON parse
      });
      const csvText: string = typeof res.data === 'string' ? res.data : String(res.data);
      const filename = `rapidreps_payments_${exportPeriod}.csv`;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filename}`);
      } else {
        // Native: write to cache and share
        try {
          const FileSystem = require('expo-file-system');
          const Sharing = require('expo-sharing');
          const path = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(path, csvText, { encoding: FileSystem.EncodingType.UTF8 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: filename });
          }
          toast.success(`Exported ${filename}`);
        } catch {
          toast.success(`CSV ready (${filename})`);
        }
      }
      setExportOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!dashboard) return null;

  // KPI tile component — premium glass-morphism on dark gradient
  const KpiTile = ({
    icon, label, value, sub, accent, onPress, testId,
  }: {
    icon: string; label: string; value: string; sub?: string;
    accent: string; onPress?: () => void; testId: string;
  }) => {
    const inner = (
      <View style={styles.tileBody}>
        <View style={[styles.tileIcon, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
          <Ionicons name={icon as any} size={18} color={accent} />
        </View>
        <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text style={styles.tileLabel}>{label}</Text>
        {sub ? <Text style={[styles.tileSub, { color: accent }]}>{sub}</Text> : null}
      </View>
    );
    const wrapper = (
      <View style={styles.tileWrapper} data-testid={testId}>
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.tileGradient}
        >
          {inner}
          <View style={[styles.tileGlow, { backgroundColor: accent }]} />
        </LinearGradient>
      </View>
    );
    return onPress ? (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{wrapper}</TouchableOpacity>
    ) : wrapper;
  };

  const totalRevCents = dashboard.totalRevenueCents || 0;
  const monthRev = dashboard.monthRevenueCents || 0;
  const serviceFee = dashboard.serviceFeeRevenueCents || 0;
  const commission = dashboard.commissionRevenueCents || (dashboard.platformRevenueCents - serviceFee);
  const trainerPayouts = dashboard.trainerPayoutsCents || 0;
  const avgValue = dashboard.avgSessionValueCents || 0;
  const sessionsMonth = dashboard.sessionsThisMonth || 0;
  const totalSessions = dashboard.totalSessions || 0;
  const corpRemaining = dashboard.corporatePoolRemainingCents || 0;
  const corpCompanies = dashboard.corporateCompaniesCount || 0;
  const pendingV = dashboard.pendingVerifications || 0;

  return (
    <View style={styles.root}>
      {/* Hero header */}
      <LinearGradient
        colors={['rgba(255,106,0,0.18)', 'rgba(255,106,0,0.02)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>This Month</Text>
            <Text style={styles.heroValue} data-testid="hero-month-revenue">{formatCents(monthRev)}</Text>
            <Text style={styles.heroSub}>{sessionsMonth} session{sessionsMonth !== 1 ? 's' : ''} • Platform earned {formatCents(dashboard.monthPlatformRevenueCents || 0)}</Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroBtn}
              onPress={() => setExportOpen(true)}
              data-testid="open-csv-export"
            >
              <Ionicons name="download-outline" size={16} color={C.orange} />
              <Text style={styles.heroBtnText}>Export CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroBtn}
              onPress={() => setCustomizeOpen(true)}
              data-testid="open-customize"
            >
              <Ionicons name="options-outline" size={16} color={C.orange} />
              <Text style={styles.heroBtnText}>Customize</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* KPI Tiles grid */}
      <View style={styles.tilesGrid}>
        {isOn('totalRevenue') && (
          <KpiTile
            icon="cash" label="Total Revenue" value={formatCents(totalRevCents)}
            sub="All-time" accent="#00D68F" testId="tile-total-revenue"
            onPress={() => setActiveTab('payments')}
          />
        )}
        {isOn('serviceFee') && (
          <KpiTile
            icon="pricetag" label="Service Fees" value={formatCents(serviceFee)}
            sub="100% platform" accent="#FFB300" testId="tile-service-fee"
          />
        )}
        {isOn('commission') && (
          <KpiTile
            icon="analytics" label="Commission Earned" value={formatCents(commission)}
            sub="Tier splits" accent="#FF6A00" testId="tile-commission"
          />
        )}
        {isOn('trainerPayouts') && (
          <KpiTile
            icon="wallet" label="Trainer Payouts" value={formatCents(trainerPayouts)}
            sub="Paid + pending" accent="#5EC8FF" testId="tile-trainer-payouts"
            onPress={() => setActiveTab('payouts')}
          />
        )}
        {isOn('avgSessionValue') && (
          <KpiTile
            icon="speedometer" label="Avg Session Value" value={formatCents(avgValue)}
            sub="Completed sessions" accent="#B388FF" testId="tile-avg-value"
          />
        )}
        {isOn('totalSessions') && (
          <KpiTile
            icon="calendar" label="Sessions"
            value={`${sessionsMonth} / ${totalSessions}`}
            sub="This month / all-time" accent="#FF6A00" testId="tile-total-sessions"
            onPress={() => setActiveTab('sessions')}
          />
        )}
        {isOn('activeUsers') && (
          <KpiTile
            icon="people" label="Trainers / Trainees"
            value={`${dashboard.totalTrainers} / ${dashboard.totalTrainees}`}
            sub={`${dashboard.totalUsers} total users`} accent="#00D68F" testId="tile-active-users"
            onPress={() => setActiveTab('users')}
          />
        )}
        {isOn('corporatePool') && (
          <KpiTile
            icon="business" label="Corporate Pool"
            value={formatCents(corpRemaining)}
            sub={`${corpCompanies} compan${corpCompanies === 1 ? 'y' : 'ies'}`} accent="#FFB300" testId="tile-corporate"
          />
        )}
        {isOn('pendingItems') && (
          <KpiTile
            icon="shield-checkmark" label="Pending Reviews" value={String(pendingV)}
            sub={pendingV > 0 ? 'Needs attention' : 'All clear'}
            accent={pendingV > 0 ? '#FF4757' : '#00D68F'}
            testId="tile-pending"
            onPress={() => setActiveTab('verifications')}
          />
        )}
      </View>

      {/* Top Trainers (mini-leaderboard) */}
      {isOn('topTrainers') && (
        <View style={styles.section} data-testid="section-top-trainers">
          <View style={styles.sectionHead}>
            <Ionicons name="trophy" size={16} color="#FFB300" />
            <Text style={styles.sectionTitle}>Top 5 Trainers</Text>
            <Text style={styles.sectionMeta}>last 7 days</Text>
          </View>
          {leaderboard.length === 0 ? (
            <View style={styles.emptyMini}>
              <Text style={styles.emptyMiniText}>No completed sessions this week yet</Text>
            </View>
          ) : (
            leaderboard.slice(0, 5).map((t, i) => {
              const ranks = ['#FFB300', '#C0C0C0', '#CD7F32', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.25)'];
              return (
                <View key={t.trainerId} style={styles.leaderRow}>
                  <View style={[styles.leaderRank, { backgroundColor: `${ranks[i]}22`, borderColor: ranks[i] }]}>
                    <Text style={[styles.leaderRankText, { color: ranks[i] }]}>#{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderName} numberOfLines={1}>{t.fullName}</Text>
                    <Text style={styles.leaderSub}>
                      {t.sessionCount} session{t.sessionCount !== 1 ? 's' : ''}
                      {t.averageRating > 0 ? ` • ${t.averageRating.toFixed(1)}★` : ''}
                    </Text>
                  </View>
                  <Text style={styles.leaderRev}>{formatCents(t.totalRevenueCents || 0)}</Text>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Recent Sessions */}
      {isOn('recentSessions') && (
        <View style={styles.section} data-testid="section-recent-sessions">
          <View style={styles.sectionHead}>
            <Ionicons name="time" size={16} color="#5EC8FF" />
            <Text style={styles.sectionTitle}>Recent Sessions</Text>
            <Text style={styles.sectionMeta}>last 10 completed</Text>
          </View>
          {recentSessions.length === 0 ? (
            <View style={styles.emptyMini}>
              <Text style={styles.emptyMiniText}>No completed sessions yet</Text>
            </View>
          ) : (
            recentSessions.map((rs) => (
              <View key={rs.id} style={styles.recentRow}>
                <View style={styles.recentDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName} numberOfLines={1}>{rs.trainerName} → {rs.traineeName}</Text>
                  <Text style={styles.recentSub}>
                    {rs.sessionType} • {rs.createdAt ? new Date(rs.createdAt).toLocaleDateString() : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.recentAmount}>{formatCents(rs.finalSessionPriceCents)}</Text>
                  <Text style={styles.recentPlatform}>+{formatCents(rs.platformFeeCents)} platform</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Customize Modal */}
      <Modal visible={customizeOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Customize Dashboard</Text>
              <TouchableOpacity onPress={() => setCustomizeOpen(false)} data-testid="close-customize">
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>Toggle which tiles appear on your overview. Saved per-admin.</Text>
            <ScrollView style={{ maxHeight: 460 }}>
              {['Revenue', 'Activity', 'Lists'].map((group) => (
                <View key={group}>
                  <Text style={styles.modalGroup}>{group}</Text>
                  {TILE_DEFS.filter((t) => t.group === group).map((t) => {
                    const on = isOn(t.key);
                    return (
                      <TouchableOpacity
                        key={t.key}
                        style={styles.toggleRow}
                        onPress={() => toggleTile(t.key)}
                        data-testid={`toggle-${t.key}`}
                      >
                        <Ionicons name={t.icon as any} size={18} color={on ? C.orange : 'rgba(255,255,255,0.4)'} />
                        <Text style={[styles.toggleLabel, { color: on ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
                          {t.label}
                        </Text>
                        <View style={[styles.switchTrack, { backgroundColor: on ? C.orange : 'rgba(255,255,255,0.12)' }]}>
                          <View style={[styles.switchThumb, { transform: [{ translateX: on ? 18 : 0 }] }]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => {
                  setVisible(DEFAULT_VISIBLE);
                  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_VISIBLE)).catch(() => {});
                }}
                data-testid="reset-tiles"
              >
                <Text style={styles.resetBtnText}>Reset to default</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setCustomizeOpen(false)}
                data-testid="done-customize"
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CSV Export Modal */}
      <Modal visible={exportOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Export Payments CSV</Text>
              <TouchableOpacity onPress={() => setExportOpen(false)} data-testid="close-export">
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Per-session payment breakdown, sorted by trainer. Includes gross, commission %, service fee,
              trainer payout, corporate subsidy, and Stripe Intent ID.
            </Text>
            <Text style={styles.modalGroup}>Date Range</Text>
            {(['this_month', 'last_month', 'all_time'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.rangeRow, exportPeriod === p && styles.rangeRowActive]}
                onPress={() => setExportPeriod(p)}
                data-testid={`range-${p}`}
              >
                <Ionicons
                  name={exportPeriod === p ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={exportPeriod === p ? C.orange : 'rgba(255,255,255,0.4)'}
                />
                <Text style={styles.rangeLabel}>
                  {p === 'this_month' ? 'This Month' : p === 'last_month' ? 'Last Month' : 'All Time'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.doneBtn, { marginTop: 16, opacity: exporting ? 0.6 : 1 }]}
              onPress={handleExport}
              disabled={exporting}
              data-testid="download-csv"
            >
              {exporting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={[styles.doneBtnText, { marginLeft: 6 }]}>Download CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { paddingBottom: 24 },
  // Hero
  hero: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.25)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroEyebrow: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1.2 },
  heroValue: { fontSize: 34, fontWeight: '900', color: '#fff', marginTop: 6, letterSpacing: -0.5 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '500' },
  heroActions: { gap: 8 },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
  },
  heroBtnText: { fontSize: 11, fontWeight: '700', color: '#FF6A00' },

  // Tile grid
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  tileWrapper: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tileGradient: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    minHeight: 110,
  },
  tileBody: { gap: 6 },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  tileValue: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  tileLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.6 },
  tileSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  tileGlow: {
    position: 'absolute',
    right: -30, top: -30,
    width: 80, height: 80,
    borderRadius: 40,
    opacity: 0.08,
  },

  // Sections (lists)
  section: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#fff', flex: 1 },
  sectionMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },

  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  leaderRank: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  leaderRankText: { fontSize: 11, fontWeight: '900' },
  leaderName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  leaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  leaderRev: { fontSize: 13, fontWeight: '800', color: '#00D68F' },

  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  recentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D68F' },
  recentName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  recentSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1, textTransform: 'capitalize' },
  recentAmount: { fontSize: 13, fontWeight: '800', color: '#fff' },
  recentPlatform: { fontSize: 10, color: '#00D68F', fontWeight: '600', marginTop: 1 },

  emptyMini: { alignItems: 'center', paddingVertical: 16 },
  emptyMiniText: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#141929',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 30,
    maxHeight: '85%',
  },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  modalHint: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 14, lineHeight: 18 },
  modalGroup: { fontSize: 11, fontWeight: '800', color: '#FF6A00', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  toggleLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  switchTrack: { width: 38, height: 20, borderRadius: 10, padding: 2, justifyContent: 'center' },
  switchThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },

  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.03)' },
  rangeRowActive: { backgroundColor: 'rgba(255,106,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,106,0,0.35)' },
  rangeLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },

  resetBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  doneBtn: { flex: 2, flexDirection: 'row', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FF6A00' },
  doneBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});

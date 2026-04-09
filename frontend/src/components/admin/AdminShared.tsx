import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Svg, { Circle, G, Rect, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export const C = {
  orange: '#FF7F00',
  teal: '#1a2a5e',
  navy: '#0f1b3d',
  navyLight: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  grayDark: '#2d3748',
  success: '#00C853',
  error: '#FF4757',
  warning: '#FFB300',
  bg: '#f0f2f5',
  card: '#FFFFFF',
};

export const PAGE_SIZE = 20;

export const api = axios.create({ baseURL: `${API_URL}/api` });

export const getAuthHeader = async () => {
  const token = await AsyncStorage.getItem('auth_token');
  return { Authorization: `Bearer ${token}` };
};

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const getStatusColor = (status: string) => {
  if (status === 'completed') return C.success;
  if (status === 'confirmed') return '#FF6A00';
  if (status === 'cancelled' || status === 'declined') return C.error;
  if (status === 'no_show') return C.warning;
  return C.gray;
};

// --- StatCard ---
export const StatCard = ({ icon, label, value, color, subtitle, growth }: { icon: string; label: string; value: string | number; color: string; subtitle?: string; growth?: string }) => (
  <View style={s.statCard} data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={[s.statIconBg, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      {growth ? (
        <View style={[s.growthTag, { backgroundColor: growth.startsWith('+') ? '#E8F5E9' : '#FFEBEE' }]}>
          <Ionicons name={growth.startsWith('+') ? 'trending-up' : 'trending-down'} size={10} color={growth.startsWith('+') ? C.success : C.error} />
          <Text style={[s.growthText, { color: growth.startsWith('+') ? C.success : C.error }]}>{growth}</Text>
        </View>
      ) : null}
    </View>
    <Text style={s.statValue}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
    {subtitle ? <Text style={s.statSub}>{subtitle}</Text> : null}
  </View>
);

// --- DonutChart ---
export const DonutChart = ({ segments, size, strokeWidth, centerLabel, centerValue }: {
  segments: { value: number; color: string; label: string }[];
  size: number;
  strokeWidth: number;
  centerLabel: string;
  centerValue: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  let cumulativeOffset = 0;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#f0f2f5" strokeWidth={strokeWidth} fill="none" />
        {segments.map((seg, i) => {
          const pct = total > 0 ? seg.value / total : 0;
          const dashLength = circumference * pct;
          const dashOffset = circumference * (1 - cumulativeOffset / total) + circumference * 0.25;
          cumulativeOffset += seg.value;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          );
        })}
        <SvgText x={size / 2} y={size / 2 - 6} textAnchor="middle" fontSize={10} fill={C.gray} fontWeight="600">{centerLabel}</SvgText>
        <SvgText x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize={18} fill={'#0A0E1A'} fontWeight="900">{centerValue}</SvgText>
      </Svg>
    </View>
  );
};

// --- MiniBarChart ---
export const MiniBarChart = ({ data, barColors, height, labels }: {
  data: number[];
  barColors: string[];
  height: number;
  labels: string[];
}) => {
  const maxVal = Math.max(...data, 1);
  const barWidth = 24;
  const gap = 8;
  const chartWidth = data.length * (barWidth + gap);
  return (
    <Svg width={chartWidth} height={height + 20}>
      <Defs>
        <SvgLinearGradient id="barGrad1" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={'#FF6A00'} />
          <Stop offset="100%" stopColor="#0D8B88" />
        </SvgLinearGradient>
        <SvgLinearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={C.orange} />
          <Stop offset="100%" stopColor="#E65C00" />
        </SvgLinearGradient>
      </Defs>
      {data.map((val, i) => {
        const barH = (val / maxVal) * height;
        const x = i * (barWidth + gap);
        const y = height - barH;
        const colorIdx = i % barColors.length;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barWidth} height={barH} rx={4} fill={barColors[colorIdx]} opacity={0.9} />
            <SvgText x={x + barWidth / 2} y={height + 14} textAnchor="middle" fontSize={9} fill={C.gray} fontWeight="600">{labels[i] || ''}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
};

// --- PaginationBar ---
export const PaginationBar = ({ current, total, pageSize, onPageChange }: { current: number; total: number; pageSize: number; onPageChange: (page: number) => void }) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <View style={s.paginationBar} data-testid="pagination-bar">
      <TouchableOpacity
        style={[s.pageBtn, current === 0 && s.pageBtnDisabled]}
        onPress={() => current > 0 && onPageChange(current - 1)}
        disabled={current === 0}
        data-testid="pagination-prev"
      >
        <Ionicons name="chevron-back" size={18} color={current === 0 ? C.gray : '#FF6A00'} />
      </TouchableOpacity>
      <Text style={s.pageInfo}>Page {current + 1} of {totalPages}</Text>
      <TouchableOpacity
        style={[s.pageBtn, current >= totalPages - 1 && s.pageBtnDisabled]}
        onPress={() => current < totalPages - 1 && onPageChange(current + 1)}
        disabled={current >= totalPages - 1}
        data-testid="pagination-next"
      >
        <Ionicons name="chevron-forward" size={18} color={current >= totalPages - 1 ? C.gray : '#FF6A00'} />
      </TouchableOpacity>
    </View>
  );
};

// --- FilterPills ---
export const FilterPills = ({ options, selected, onSelect, testIdPrefix }: { options: { key: string; label: string }[]; selected: string; onSelect: (key: string) => void; testIdPrefix: string }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
    {options.map((opt) => (
      <TouchableOpacity
        key={opt.key}
        style={[s.filterPill, selected === opt.key && s.filterPillActive]}
        onPress={() => onSelect(selected === opt.key ? '' : opt.key)}
        data-testid={`${testIdPrefix}-${opt.key || 'all'}`}
      >
        <Text style={[s.filterPillText, selected === opt.key && s.filterPillTextActive]}>{opt.label}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

// --- SearchBar ---
export const SearchBar = ({ value, onChangeText, onSubmit, placeholder }: { value: string; onChangeText: (t: string) => void; onSubmit: () => void; placeholder: string }) => (
  <View style={s.searchBar} data-testid="admin-search-bar">
    <Ionicons name="search" size={18} color={C.gray} />
    <TextInput
      style={s.searchInput}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      placeholderTextColor={C.gray}
      returnKeyType="search"
      data-testid="admin-search-input"
    />
    {value ? (
      <TouchableOpacity onPress={() => { onChangeText(''); onSubmit(); }} data-testid="admin-search-clear">
        <Ionicons name="close-circle" size={18} color={C.gray} />
      </TouchableOpacity>
    ) : null}
  </View>
);

// --- Styles ---
export const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  tabBar: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBarScroll: { paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FF6A00' },
  tabText: { fontSize: 13, fontWeight: '600', color: C.gray },
  tabTextActive: { color: '#FF6A00' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  loadingText: { color: C.gray, fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 12, marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: C.card, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statIconBg: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 13, color: C.gray, marginTop: 4 },
  statSub: { fontSize: 13, color: C.gray, marginTop: 2, fontStyle: 'italic' },
  growthTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  growthText: { fontSize: 13, fontWeight: '700' },
  timeframePills: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  timeframePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: '#e2e8f0' },
  timeframePillActive: { backgroundColor: '#FF6A00', borderColor: '#FF6A00' },
  timeframePillText: { fontSize: 13, fontWeight: '600', color: C.gray },
  timeframePillTextActive: { color: C.white },
  revenueBarContainer: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 16 },
  revenueBarSegment: { height: 8 },
  revenueBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  revenueBarLabel: { fontSize: 13, fontWeight: '700' },
  chartCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#0A0E1A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  chartCardTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  chartLegend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, color: C.gray, fontWeight: '500' },
  legendValue: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  legendDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 2 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  listCardIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  userAvatar: { width: 38, height: 38, borderRadius: 19 },
  listCardTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  listCardSub: { fontSize: 13, color: C.gray, marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#FF6A00', justifyContent: 'center', alignItems: 'center' },
  verifyCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: C.warning, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  verifyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  verifyName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  verifySub: { fontSize: 13, color: C.gray, marginTop: 2 },
  pendingBadge: { backgroundColor: '#FFB30020', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pendingBadgeText: { fontSize: 13, fontWeight: '700', color: C.warning },
  verifyChecks: { gap: 6, marginBottom: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 13, color: C.grayDark },
  verifyActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  actionBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  sessionCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },
  sessionType: { fontSize: 13, color: C.gray, fontWeight: '500', backgroundColor: '#f0f2f5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sessionNames: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
  sessionPrice: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  sessionDetails: { gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: C.grayDark },
  transCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  transAmount: { fontSize: 16, fontWeight: '800' },
  transBreakdown: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 8 },
  transBreakdownText: { fontSize: 13, color: C.gray, fontWeight: '500' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  smallBtnText: { color: C.white, fontSize: 13, fontWeight: '700' },
  refundedTag: { marginTop: 8, backgroundColor: '#FFE0E0', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  refundedTagText: { fontSize: 13, fontWeight: '700', color: C.error },
  profileCard: { backgroundColor: C.card, borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E0F7F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  profileSub: { fontSize: 13, color: C.gray, marginTop: 4 },
  profileInfo: { width: '100%', gap: 8, marginTop: 12 },
  profileInfoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  profileInfoLabel: { fontSize: 13, color: C.gray },
  profileInfoValue: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF6A00', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 20 },
  editProfileBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptySub: { fontSize: 13, color: C.gray, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  modalBody: { paddingHorizontal: 20, paddingBottom: 30 },
  modalSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalSectionTitle: { fontSize: 14, fontWeight: '700', color: '#FF6A00', marginBottom: 8 },
  modalField: { fontSize: 13, color: C.grayDark, lineHeight: 22 },
  messageInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, minHeight: 100, fontSize: 14, color: '#FFFFFF', textAlignVertical: 'top' },
  textInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#FFFFFF', marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: C.grayDark, marginBottom: 6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF', paddingVertical: 2 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: '#e2e8f0' },
  filterPillActive: { backgroundColor: '#FF6A00', borderColor: '#FF6A00' },
  filterPillText: { fontSize: 13, fontWeight: '600', color: C.gray },
  filterPillTextActive: { color: C.white },
  paginationBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 16 },
  pageBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtnDisabled: { opacity: 0.4 },
  pageInfo: { fontSize: 13, fontWeight: '600', color: C.grayDark },
  attentionCard: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  attentionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  attentionIconBg: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  attentionText: { flex: 1, fontSize: 13, color: C.grayDark },
  attentionCount: { fontWeight: '800', color: '#FFFFFF' },
  attentionDivider: { height: 1, backgroundColor: '#f0f2f5', marginLeft: 60 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  leaderRowFirst: { borderLeftWidth: 4, borderLeftColor: '#FFB300' },
  leaderRank: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  leaderRankText: { fontSize: 13, fontWeight: '900' },
  leaderName: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  leaderTierBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  leaderTierText: { fontSize: 13, fontWeight: '700' },
  leaderRating: { fontSize: 13, fontWeight: '700', color: C.grayDark },
  leaderStats: { alignItems: 'center' },
  leaderStatNum: { fontSize: 20, fontWeight: '900', color: '#FF6A00' },
  leaderStatLabel: { fontSize: 13, color: C.gray, fontWeight: '600', textTransform: 'uppercase' },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
});

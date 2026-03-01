import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Svg, { Circle, G, Rect, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  orange: '#FF7F00',
  teal: '#1FB8B4',
  navy: '#0f1b3d',
  navyLight: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  grayLight: '#F5F6F8',
  grayDark: '#2d3748',
  success: '#00C853',
  error: '#FF4757',
  warning: '#FFB300',
  bg: '#f0f2f5',
  card: '#FFFFFF',
};

type Tab = 'overview' | 'users' | 'verifications' | 'sessions' | 'payments' | 'profile';

const api = axios.create({ baseURL: `${API_URL}/api` });

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'month'>('month');

  // Data
  const [dashboard, setDashboard] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transTotal, setTransTotal] = useState(0);
  const [transPage, setTransPage] = useState(0);

  const PAGE_SIZE = 20;

  // Modals
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetailVisible, setUserDetailVisible] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [adminUser, setAdminUser] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  };

  // --- Fetch Functions ---
  const fetchDashboard = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/dashboard', { headers });
      setDashboard(res.data);
    } catch (err: any) {
      console.error('Dashboard error:', err?.response?.data || err.message);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/top-trainers?days=7&limit=5', { headers });
      setLeaderboard(res.data.leaderboard || []);
    } catch (err: any) {
      console.error('Leaderboard error:', err?.response?.data || err.message);
    }
  };

  const fetchUsers = async (page = 0) => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get(`/admin/users?limit=${PAGE_SIZE}&skip=${page * PAGE_SIZE}`, { headers });
      setUsers(res.data.users || []);
      setUsersTotal(res.data.total || 0);
      setUsersPage(page);
    } catch (err: any) {
      console.error('Users error:', err?.response?.data || err.message);
    }
  };

  const fetchVerifications = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/verifications/pending', { headers });
      setVerifications(res.data.pendingVerifications || []);
    } catch (err: any) {
      console.error('Verify error:', err?.response?.data || err.message);
    }
  };

  const fetchSessions = async (page = 0) => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get(`/admin/sessions?limit=${PAGE_SIZE}&skip=${page * PAGE_SIZE}`, { headers });
      setSessions(res.data.sessions || []);
      setSessionsTotal(res.data.total || 0);
      setSessionsPage(page);
    } catch (err: any) {
      console.error('Sessions error:', err?.response?.data || err.message);
    }
  };

  const fetchTransactions = async (page = 0) => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get(`/admin/transactions-enriched?limit=${PAGE_SIZE}&skip=${page * PAGE_SIZE}`, { headers });
      setTransactions(res.data.transactions || []);
      setTransTotal(res.data.total || 0);
      setTransPage(page);
    } catch (err: any) {
      console.error('Transactions error:', err?.response?.data || err.message);
    }
  };

  const fetchAdminProfile = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/auth/me', { headers });
      setAdminUser(res.data);
      setProfileName(res.data.fullName || '');
      setProfilePhone(res.data.phone || '');
      setProfileEmail(res.data.email || '');
    } catch (err: any) {
      console.error('Profile error:', err?.response?.data || err.message);
    }
  };

  const loadTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      if (tab === 'overview') { await fetchDashboard(); await fetchLeaderboard(); }
      else if (tab === 'users') await fetchUsers();
      else if (tab === 'verifications') await fetchVerifications();
      else if (tab === 'sessions') await fetchSessions();
      else if (tab === 'payments') await fetchTransactions();
      else if (tab === 'profile') await fetchAdminProfile();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTab(activeTab); }, [activeTab]);

  const onRefresh = () => { setRefreshing(true); loadTab(activeTab); };

  // --- Action Handlers ---
  const handleApproveVerification = (trainerId: string) => {
    Alert.alert('Approve Trainer', 'Approve this trainer for the platform?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve', onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.post(`/admin/verifications/${trainerId}/approve`, {}, { headers });
            Alert.alert('Success', 'Trainer approved');
            fetchVerifications();
          } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  const handleRejectVerification = (trainerId: string) => {
    Alert.alert('Reject Trainer', 'Reject this trainer\'s verification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive', onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.post(`/admin/verifications/${trainerId}/reject`, {}, { headers });
            Alert.alert('Done', 'Verification rejected');
            fetchVerifications();
          } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  const handleViewUser = async (userId: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get(`/admin/users/${userId}`, { headers });
      setSelectedUser(res.data);
      setUserDetailVisible(true);
    } catch { Alert.alert('Error', 'Failed to load user details'); }
  };

  const handleRemoveUser = (userId: string, userName: string) => {
    Alert.alert('Remove User', `Permanently remove ${userName} and all their data?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.delete(`/admin/users/${userId}`, { headers });
            Alert.alert('Removed', `${userName} has been removed`);
            setUserDetailVisible(false);
            fetchUsers();
          } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail || 'Failed to remove user'); }
        },
      },
    ]);
  };

  const handleOpenMessage = (userId: string, userName: string) => {
    setMessageRecipient({ id: userId, name: userName });
    setMessageText('');
    setMessageModalVisible(true);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !messageRecipient) return;
    try {
      const headers = await getAuthHeader();
      await api.post('/admin/message', { receiverId: messageRecipient.id, content: messageText.trim() }, { headers });
      Alert.alert('Sent', `Message sent to ${messageRecipient.name}`);
      setMessageModalVisible(false);
      setMessageText('');
    } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail || 'Failed to send'); }
  };

  const handleRefund = (sessionId: string, amount: number) => {
    Alert.alert('Refund Payment', `Refund $${(amount / 100).toFixed(2)} for this session?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Refund', style: 'destructive', onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.post('/admin/refund', { sessionId, reason: 'Admin refund' }, { headers });
            Alert.alert('Refunded', 'Payment has been refunded');
            fetchTransactions();
          } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail || 'Refund failed'); }
        },
      },
    ]);
  };

  const handleConfirmPayment = (sessionId: string) => {
    Alert.alert('Confirm Payment', 'Mark this payment as confirmed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.post('/admin/confirm-payment', { sessionId }, { headers });
            Alert.alert('Confirmed', 'Payment confirmed');
            fetchTransactions();
          } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  const handleUpdateProfile = async () => {
    try {
      const headers = await getAuthHeader();
      const body: any = {};
      if (profileName.trim()) body.fullName = profileName.trim();
      if (profilePhone.trim()) body.phone = profilePhone.trim();
      if (profileEmail.trim()) body.email = profileEmail.trim();
      await api.put('/admin/profile', body, { headers });
      Alert.alert('Updated', 'Profile updated successfully');
      setProfileModalVisible(false);
      fetchAdminProfile();
    } catch (err: any) { Alert.alert('Error', err?.response?.data?.detail || 'Update failed'); }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('active_role');
    router.replace('/');
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'overview', icon: 'grid', label: 'Overview' },
    { id: 'users', icon: 'people', label: 'Users' },
    { id: 'verifications', icon: 'shield-checkmark', label: 'Verify' },
    { id: 'sessions', icon: 'calendar', label: 'Sessions' },
    { id: 'payments', icon: 'card', label: 'Payments' },
    { id: 'profile', icon: 'person-circle', label: 'Profile' },
  ];

  // --- Stat Card (Enhanced) ---
  const StatCard = ({ icon, label, value, color, subtitle, growth }: { icon: string; label: string; value: string | number; color: string; subtitle?: string; growth?: string }) => (
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

  // --- Donut Chart ---
  const DonutChart = ({ segments, size, strokeWidth, centerLabel, centerValue }: {
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
          <SvgText x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize={18} fill={C.navy} fontWeight="900">{centerValue}</SvgText>
        </Svg>
      </View>
    );
  };

  // --- Mini Bar Chart ---
  const MiniBarChart = ({ data, barColors, height, labels }: {
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
            <Stop offset="0%" stopColor={C.teal} />
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

  // --- Timeframe Pills ---
  const TimeframePills = () => {
    const options: { key: 'today' | 'week' | 'month'; label: string }[] = [
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
    ];
    return (
      <View style={s.timeframePills} data-testid="timeframe-pills">
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[s.timeframePill, selectedTimeframe === opt.key && s.timeframePillActive]}
            onPress={() => setSelectedTimeframe(opt.key)}
            data-testid={`timeframe-${opt.key}`}
          >
            <Text style={[s.timeframePillText, selectedTimeframe === opt.key && s.timeframePillTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // --- RENDER: Overview ---
  const renderOverview = () => {
    if (!dashboard) return null;
    const platformPct = dashboard.totalRevenueCents > 0 ? (dashboard.platformRevenueCents / dashboard.totalRevenueCents) * 100 : 25;
    const trainerPct = 100 - platformPct;
    const pendingCount = dashboard.pendingVerifications || 0;

    // Placeholder weekly session data
    const weeklyData = [3, 5, 2, 7, 4, 6, 3];
    const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return (
      <View>
        {/* Timeframe Filter */}
        <TimeframePills />

        {/* Platform Stats */}
        <Text style={s.sectionTitle}>Platform Stats</Text>
        <View style={s.statsGrid}>
          <StatCard icon="people" label="Total Users" value={dashboard.totalUsers} color={C.teal} subtitle="All-time" growth="+12%" />
          <StatCard icon="fitness" label="Trainers" value={dashboard.totalTrainers} color={C.orange} subtitle="Approved trainers" growth="+3%" />
          <StatCard icon="person" label="Trainees" value={dashboard.totalTrainees} color={C.navyLight} subtitle="Active clients" growth="+8%" />
          <StatCard icon="calendar" label="Sessions" value={dashboard.totalSessions} color={C.success} subtitle="Booked in period" growth="+5%" />
        </View>

        {/* User Composition Donut */}
        <Text style={s.sectionTitle}>User Breakdown</Text>
        <View style={s.chartCard}>
          <View style={s.chartRow}>
            <DonutChart
              segments={[
                { value: dashboard.totalTrainers, color: C.orange, label: 'Trainers' },
                { value: dashboard.totalTrainees, color: C.teal, label: 'Trainees' },
              ]}
              size={130}
              strokeWidth={18}
              centerLabel="Users"
              centerValue={String(dashboard.totalUsers)}
            />
            <View style={s.chartLegend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.orange }]} />
                <Text style={s.legendLabel}>Trainers</Text>
                <Text style={s.legendValue}>{dashboard.totalTrainers}</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.teal }]} />
                <Text style={s.legendLabel}>Trainees</Text>
                <Text style={s.legendValue}>{dashboard.totalTrainees}</Text>
              </View>
              <View style={[s.legendDivider]} />
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.navy }]} />
                <Text style={s.legendLabel}>Total</Text>
                <Text style={[s.legendValue, { fontWeight: '900' }]}>{dashboard.totalUsers}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Revenue Donut + Breakdown */}
        <Text style={s.sectionTitle}>Revenue</Text>
        <View style={s.chartCard}>
          <View style={s.chartRow}>
            <DonutChart
              segments={[
                { value: dashboard.platformRevenueCents, color: C.success, label: 'Platform' },
                { value: dashboard.trainerPayoutsCents, color: C.orange, label: 'Trainers' },
              ]}
              size={130}
              strokeWidth={18}
              centerLabel="Total"
              centerValue={formatCents(dashboard.totalRevenueCents)}
            />
            <View style={s.chartLegend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.success }]} />
                <Text style={s.legendLabel}>Platform (25%)</Text>
                <Text style={[s.legendValue, { color: C.success }]}>{formatCents(dashboard.platformRevenueCents)}</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.orange }]} />
                <Text style={s.legendLabel}>Trainers (75%)</Text>
                <Text style={s.legendValue}>{formatCents(dashboard.trainerPayoutsCents)}</Text>
              </View>
            </View>
          </View>
          {/* Revenue Split Progress Bar */}
          <View style={s.revenueBarContainer}>
            <View style={[s.revenueBarSegment, { flex: platformPct, backgroundColor: C.success, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
            <View style={[s.revenueBarSegment, { flex: trainerPct, backgroundColor: C.orange, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
          </View>
          <View style={s.revenueBarLabels}>
            <Text style={[s.revenueBarLabel, { color: C.success }]}>Platform {platformPct.toFixed(0)}%</Text>
            <Text style={[s.revenueBarLabel, { color: C.orange }]}>Trainers {trainerPct.toFixed(0)}%</Text>
          </View>
        </View>

        {/* Weekly Activity Bar Chart */}
        <Text style={s.sectionTitle}>Weekly Activity</Text>
        <View style={s.chartCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={s.chartCardTitle}>Sessions This Week</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="trending-up" size={14} color={C.success} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.success }}>+15%</Text>
            </View>
          </View>
          <View style={{ alignItems: 'center' }}>
            <MiniBarChart
              data={weeklyData}
              barColors={[C.teal, C.orange]}
              height={80}
              labels={weekLabels}
            />
          </View>
        </View>

        {/* Quick Info */}
        <Text style={s.sectionTitle}>Quick Info</Text>
        <View style={s.statsGrid}>
          <StatCard icon="checkmark-circle" label="Completed" value={dashboard.completedSessions} color={C.success} subtitle="Sessions done" />
          <StatCard icon="star" label="Memberships" value={dashboard.activeMemberships} color={C.warning} subtitle="Active plans" />
          <StatCard icon="flash" label="Boosts" value={dashboard.activeBoosts} color={C.orange} subtitle="Active boosts" />
          <StatCard icon="hourglass" label="Pending" value={pendingCount} color={C.error} subtitle="Awaiting review" />
        </View>

        {/* Session Status Pie */}
        <Text style={s.sectionTitle}>Session Status</Text>
        <View style={s.chartCard}>
          <View style={s.chartRow}>
            <DonutChart
              segments={[
                { value: dashboard.completedSessions, color: C.success, label: 'Completed' },
                { value: Math.max(dashboard.totalSessions - dashboard.completedSessions, 0), color: C.warning, label: 'Active' },
                { value: pendingCount, color: C.error, label: 'Pending' },
              ]}
              size={120}
              strokeWidth={16}
              centerLabel="Sessions"
              centerValue={String(dashboard.totalSessions)}
            />
            <View style={s.chartLegend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.success }]} />
                <Text style={s.legendLabel}>Completed</Text>
                <Text style={s.legendValue}>{dashboard.completedSessions}</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.warning }]} />
                <Text style={s.legendLabel}>Active / Upcoming</Text>
                <Text style={s.legendValue}>{Math.max(dashboard.totalSessions - dashboard.completedSessions, 0)}</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.error }]} />
                <Text style={s.legendLabel}>Pending Review</Text>
                <Text style={s.legendValue}>{pendingCount}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Attention Needed */}
        <Text style={s.sectionTitle}>Attention Needed</Text>
        <View style={s.attentionCard}>
          <TouchableOpacity
            style={s.attentionRow}
            onPress={() => setActiveTab('verifications')}
            data-testid="attention-verifications"
          >
            <View style={[s.attentionIconBg, { backgroundColor: '#FFB30020' }]}>
              <Ionicons name="shield-checkmark" size={16} color={C.warning} />
            </View>
            <Text style={s.attentionText}><Text style={s.attentionCount}>{pendingCount}</Text> trainers pending verification</Text>
            <Ionicons name="chevron-forward" size={16} color={C.gray} />
          </TouchableOpacity>
          <View style={s.attentionDivider} />
          <TouchableOpacity
            style={s.attentionRow}
            onPress={() => setActiveTab('payments')}
            data-testid="attention-payments"
          >
            <View style={[s.attentionIconBg, { backgroundColor: '#FF475720' }]}>
              <Ionicons name="card" size={16} color={C.error} />
            </View>
            <Text style={s.attentionText}><Text style={s.attentionCount}>0</Text> payment issues</Text>
            <Ionicons name="chevron-forward" size={16} color={C.gray} />
          </TouchableOpacity>
          <View style={s.attentionDivider} />
          <TouchableOpacity
            style={s.attentionRow}
            onPress={() => setActiveTab('users')}
            data-testid="attention-low-rated"
          >
            <View style={[s.attentionIconBg, { backgroundColor: '#FF7F0020' }]}>
              <Ionicons name="star-half" size={16} color={C.orange} />
            </View>
            <Text style={s.attentionText}><Text style={s.attentionCount}>0</Text> low-rated trainers ({'<'}3.0)</Text>
            <Ionicons name="chevron-forward" size={16} color={C.gray} />
          </TouchableOpacity>
        </View>

        {/* Top Trainers Leaderboard */}
        <Text style={s.sectionTitle}>Top Trainers This Week</Text>
        {leaderboard.length > 0 ? (
          leaderboard.map((trainer: any, index: number) => {
            const rankColors = ['#FFB300', '#A0A0A0', '#CD7F32', C.teal, C.navyLight];
            const rankColor = rankColors[index] || C.gray;
            const tierLabel = trainer.tier === 'elite' ? 'Elite' : trainer.tier === 'pro' ? 'Pro' : 'Rising';
            const tierColor = trainer.tier === 'elite' ? C.orange : trainer.tier === 'pro' ? C.teal : C.gray;
            return (
              <View key={trainer.trainerId} style={[s.leaderRow, index === 0 && s.leaderRowFirst]}>
                <View style={[s.leaderRank, { backgroundColor: `${rankColor}20`, borderColor: rankColor }]}>
                  <Text style={[s.leaderRankText, { color: rankColor }]}>#{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.leaderName}>{trainer.fullName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <View style={[s.leaderTierBadge, { backgroundColor: `${tierColor}15` }]}>
                      <Ionicons name="ribbon" size={10} color={tierColor} />
                      <Text style={[s.leaderTierText, { color: tierColor }]}>{tierLabel}</Text>
                    </View>
                    {trainer.averageRating > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Ionicons name="star" size={11} color={C.warning} />
                        <Text style={s.leaderRating}>{trainer.averageRating}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={s.leaderStats}>
                  <Text style={s.leaderStatNum}>{trainer.sessionCount}</Text>
                  <Text style={s.leaderStatLabel}>sessions</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={s.chartCard}>
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="trophy-outline" size={32} color={C.gray} />
              <Text style={{ color: C.gray, fontSize: 13, marginTop: 8 }}>No sessions completed this week yet</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // --- Pagination Bar ---
  const PaginationBar = ({ current, total, pageSize, onPageChange }: { current: number; total: number; pageSize: number; onPageChange: (page: number) => void }) => {
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
          <Ionicons name="chevron-back" size={18} color={current === 0 ? C.gray : C.teal} />
        </TouchableOpacity>
        <Text style={s.pageInfo}>Page {current + 1} of {totalPages}</Text>
        <TouchableOpacity
          style={[s.pageBtn, current >= totalPages - 1 && s.pageBtnDisabled]}
          onPress={() => current < totalPages - 1 && onPageChange(current + 1)}
          disabled={current >= totalPages - 1}
          data-testid="pagination-next"
        >
          <Ionicons name="chevron-forward" size={18} color={current >= totalPages - 1 ? C.gray : C.teal} />
        </TouchableOpacity>
      </View>
    );
  };

  // --- RENDER: Users ---
  const renderUsers = () => (
    <View>
      <Text style={s.sectionTitle}>All Users ({usersTotal})</Text>
      {users.map((user) => (
        <View key={user.id} style={s.listCard}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
            onPress={() => handleViewUser(user.id)}
            data-testid={`admin-user-${user.id}`}
          >
            <View style={[s.listCardIcon, { backgroundColor: user.isAdmin ? C.error : user.roles?.includes('trainer') ? C.orange : C.teal }]}>
              <Ionicons
                name={user.isAdmin ? 'shield' : user.roles?.includes('trainer') ? 'fitness' : 'person'}
                size={18} color={C.white}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.listCardTitle}>{user.fullName}</Text>
              <Text style={s.listCardSub}>{user.email}</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => handleOpenMessage(user.id, user.fullName)}
              data-testid={`msg-user-${user.id}`}
            >
              <Ionicons name="chatbubble" size={16} color={C.teal} />
            </TouchableOpacity>
            {!user.isAdmin && (
              <TouchableOpacity
                style={[s.iconBtn, { borderColor: C.error }]}
                onPress={() => handleRemoveUser(user.id, user.fullName)}
                data-testid={`remove-user-${user.id}`}
              >
                <Ionicons name="trash" size={16} color={C.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
      <PaginationBar current={usersPage} total={usersTotal} pageSize={PAGE_SIZE} onPageChange={(p) => fetchUsers(p)} />
    </View>
  );

  // --- RENDER: Verifications ---
  const renderVerifications = () => (
    <View>
      <Text style={s.sectionTitle}>Pending Verifications ({verifications.length})</Text>
      {verifications.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="checkmark-done-circle" size={48} color={C.success} />
          <Text style={s.emptyTitle}>All Clear!</Text>
          <Text style={s.emptySub}>No pending verifications.</Text>
        </View>
      ) : (
        verifications.map((item, idx) => (
          <View key={idx} style={s.verifyCard} data-testid={`verification-${idx}`}>
            <View style={s.verifyHeader}>
              <View>
                <Text style={s.verifyName}>{item.user?.fullName || 'Unknown'}</Text>
                <Text style={s.verifySub}>{item.user?.email || ''}</Text>
              </View>
              <View style={s.pendingBadge}><Text style={s.pendingBadgeText}>PENDING</Text></View>
            </View>
            <View style={s.verifyChecks}>
              {['governmentIdUploaded', 'backgroundCheckPassed', 'fitnessCertUploaded', 'cprAedCertUploaded', 'introVideoUploaded'].map((field) => (
                <View key={field} style={s.checkRow}>
                  <Ionicons
                    name={item.profile?.[field] ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16} color={item.profile?.[field] ? C.success : C.gray}
                  />
                  <Text style={s.checkLabel}>{field.replace(/([A-Z])/g, ' $1').replace(/^./, (ch: string) => ch.toUpperCase())}</Text>
                </View>
              ))}
            </View>
            <View style={s.verifyActions}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.success }]} onPress={() => handleApproveVerification(item.profile?.userId)} data-testid={`approve-btn-${idx}`}>
                <Ionicons name="checkmark" size={18} color={C.white} />
                <Text style={s.actionBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.error }]} onPress={() => handleRejectVerification(item.profile?.userId)} data-testid={`reject-btn-${idx}`}>
                <Ionicons name="close" size={18} color={C.white} />
                <Text style={s.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  // --- RENDER: Sessions ---
  const getStatusColor = (status: string) => {
    if (status === 'completed') return C.success;
    if (status === 'confirmed') return C.teal;
    if (status === 'cancelled' || status === 'declined') return C.error;
    if (status === 'no_show') return C.warning;
    return C.gray;
  };

  const renderSessions = () => (
    <View>
      <Text style={s.sectionTitle}>Sessions ({sessionsTotal})</Text>
      {sessions.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={C.gray} />
          <Text style={s.emptyTitle}>No Sessions</Text>
          <Text style={s.emptySub}>Sessions will appear here.</Text>
        </View>
      ) : (
        sessions.map((sess, idx) => (
          <View key={sess.id || idx} style={s.sessionCard} data-testid={`session-${idx}`}>
            <View style={s.sessionHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={[s.statusDot, { backgroundColor: getStatusColor(sess.status) }]} />
                  <Text style={[s.statusText, { color: getStatusColor(sess.status) }]}>{(sess.status || '').toUpperCase()}</Text>
                  <Text style={s.sessionType}>{sess.sessionType || 'outdoor'}</Text>
                </View>
                <Text style={s.sessionNames}>
                  <Text style={{ fontWeight: '700' }}>{sess.trainerName}</Text>
                  <Text style={{ color: C.gray }}> with </Text>
                  <Text style={{ fontWeight: '700' }}>{sess.traineeName}</Text>
                </Text>
              </View>
              <Text style={s.sessionPrice}>{sess.finalSessionPriceCents ? formatCents(sess.finalSessionPriceCents) : '-'}</Text>
            </View>

            <View style={s.sessionDetails}>
              {sess.locationNameOrAddress ? (
                <View style={s.detailRow}>
                  <Ionicons name="location" size={14} color={C.gray} />
                  <Text style={s.detailText}>{sess.locationNameOrAddress}</Text>
                </View>
              ) : null}
              {sess.traineeHomeAddress && sess.sessionType === 'in_home' ? (
                <View style={s.detailRow}>
                  <Ionicons name="home" size={14} color={C.orange} />
                  <Text style={s.detailText}>Home: {sess.traineeHomeAddress}</Text>
                </View>
              ) : null}
              <View style={s.detailRow}>
                <Ionicons name="time" size={14} color={C.gray} />
                <Text style={s.detailText}>
                  Scheduled: {sess.durationMinutes || '?'}min
                  {sess.actualDurationMinutes != null ? ` | Actual: ${sess.actualDurationMinutes}min` : ''}
                </Text>
              </View>
              {sess.sessionStartedAt ? (
                <View style={s.detailRow}>
                  <Ionicons name="play-circle" size={14} color={C.success} />
                  <Text style={s.detailText}>
                    Started: {new Date(sess.sessionStartedAt).toLocaleString()}
                  </Text>
                </View>
              ) : null}
              {sess.sessionEndedAt ? (
                <View style={s.detailRow}>
                  <Ionicons name="stop-circle" size={14} color={C.error} />
                  <Text style={s.detailText}>
                    Ended: {new Date(sess.sessionEndedAt).toLocaleString()}
                  </Text>
                </View>
              ) : null}
              {sess.refunded ? (
                <View style={[s.detailRow, { backgroundColor: '#FFE0E0', borderRadius: 6, padding: 4 }]}>
                  <Ionicons name="alert-circle" size={14} color={C.error} />
                  <Text style={[s.detailText, { color: C.error, fontWeight: '600' }]}>REFUNDED</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}
      <PaginationBar current={sessionsPage} total={sessionsTotal} pageSize={PAGE_SIZE} onPageChange={(p) => fetchSessions(p)} />
    </View>
  );

  // --- RENDER: Payments/Transactions ---
  const renderPayments = () => (
    <View>
      <Text style={s.sectionTitle}>Transactions ({transTotal})</Text>
      {transactions.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="card-outline" size={48} color={C.gray} />
          <Text style={s.emptyTitle}>No Transactions</Text>
          <Text style={s.emptySub}>Payments will appear here.</Text>
        </View>
      ) : (
        transactions.map((t, idx) => (
          <View key={t.id || idx} style={s.transCard} data-testid={`transaction-${idx}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[s.listCardIcon, { backgroundColor: t.refunded ? C.error : C.success, width: 34, height: 34, borderRadius: 9 }]}>
                <Ionicons name={t.refunded ? 'arrow-undo' : 'cash'} size={16} color={C.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.listCardTitle}>{t.trainerName} / {t.traineeName}</Text>
                <Text style={s.listCardSub}>{t.sessionType || 'Session'} | {t.status}</Text>
              </View>
              <Text style={[s.transAmount, { color: t.refunded ? C.error : C.navy }]}>
                {t.refunded ? '-' : ''}{t.finalSessionPriceCents ? formatCents(t.finalSessionPriceCents) : '-'}
              </Text>
            </View>
            <View style={s.transBreakdown}>
              <Text style={s.transBreakdownText}>Platform: {formatCents(t.platformFeeCents || 0)}</Text>
              <Text style={s.transBreakdownText}>Trainer: {formatCents(t.trainerEarningsCents || 0)}</Text>
            </View>
            {!t.refunded && t.finalSessionPriceCents > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[s.smallBtn, { backgroundColor: C.error }]}
                  onPress={() => handleRefund(t.id, t.finalSessionPriceCents)}
                  data-testid={`refund-btn-${idx}`}
                >
                  <Ionicons name="arrow-undo" size={14} color={C.white} />
                  <Text style={s.smallBtnText}>Refund</Text>
                </TouchableOpacity>
                {!t.paymentConfirmed && (
                  <TouchableOpacity
                    style={[s.smallBtn, { backgroundColor: C.success }]}
                    onPress={() => handleConfirmPayment(t.id)}
                    data-testid={`confirm-btn-${idx}`}
                  >
                    <Ionicons name="checkmark-circle" size={14} color={C.white} />
                    <Text style={s.smallBtnText}>Confirm</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {t.refunded && (
              <View style={[s.refundedTag]}>
                <Text style={s.refundedTagText}>REFUNDED</Text>
              </View>
            )}
          </View>
        ))
      )}
      <PaginationBar current={transPage} total={transTotal} pageSize={PAGE_SIZE} onPageChange={(p) => fetchTransactions(p)} />
    </View>
  );

  // --- RENDER: Admin Profile ---
  const renderProfile = () => (
    <View>
      <Text style={s.sectionTitle}>Admin Profile</Text>
      {adminUser ? (
        <View style={s.profileCard}>
          <View style={s.profileAvatar}>
            <Ionicons name="shield-checkmark" size={36} color={C.teal} />
          </View>
          <Text style={s.profileName}>{adminUser.fullName}</Text>
          <Text style={s.profileSub}>{adminUser.email}</Text>
          <Text style={s.profileSub}>{adminUser.phone}</Text>
          <View style={s.divider} />
          <View style={s.profileInfo}>
            <View style={s.profileInfoRow}>
              <Text style={s.profileInfoLabel}>Role</Text>
              <Text style={s.profileInfoValue}>Administrator</Text>
            </View>
            <View style={s.profileInfoRow}>
              <Text style={s.profileInfoLabel}>Account ID</Text>
              <Text style={s.profileInfoValue}>{adminUser.id?.slice(-8)}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.editProfileBtn}
            onPress={() => setProfileModalVisible(true)}
            data-testid="edit-profile-btn"
          >
            <Ionicons name="create" size={18} color={C.white} />
            <Text style={s.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ActivityIndicator color={C.teal} />
      )}
    </View>
  );

  // --- MODAL: User Detail ---
  const renderUserDetailModal = () => (
    <Modal visible={userDetailVisible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>User Details</Text>
            <TouchableOpacity onPress={() => setUserDetailVisible(false)} data-testid="close-user-modal">
              <Ionicons name="close" size={24} color={C.navy} />
            </TouchableOpacity>
          </View>
          {selectedUser && (
            <ScrollView style={s.modalBody}>
              <View style={s.modalSection}>
                <Text style={s.modalSectionTitle}>Basic Info</Text>
                <Text style={s.modalField}>Name: {selectedUser.user?.fullName}</Text>
                <Text style={s.modalField}>Email: {selectedUser.user?.email}</Text>
                <Text style={s.modalField}>Phone: {selectedUser.user?.phone}</Text>
                <Text style={s.modalField}>Roles: {selectedUser.user?.roles?.join(', ')}</Text>
              </View>
              {selectedUser.trainerProfile && (
                <View style={s.modalSection}>
                  <Text style={s.modalSectionTitle}>Trainer Profile</Text>
                  <Text style={s.modalField}>Bio: {selectedUser.trainerProfile.bio || 'N/A'}</Text>
                  <Text style={s.modalField}>Experience: {selectedUser.trainerProfile.experienceYears || 0} years</Text>
                  <Text style={s.modalField}>Verified: {selectedUser.trainerProfile.isVerified ? 'Yes' : 'No'}</Text>
                  <Text style={s.modalField}>Rating: {selectedUser.trainerProfile.averageRating || 'N/A'}</Text>
                  <Text style={s.modalField}>Sessions: {selectedUser.trainerProfile.totalSessionsCompleted || 0}</Text>
                </View>
              )}
              {selectedUser.traineeProfile && (
                <View style={s.modalSection}>
                  <Text style={s.modalSectionTitle}>Trainee Profile</Text>
                  <Text style={s.modalField}>Goals: {selectedUser.traineeProfile.fitnessGoals || 'N/A'}</Text>
                  <Text style={s.modalField}>Level: {selectedUser.traineeProfile.currentFitnessLevel || 'N/A'}</Text>
                  <Text style={s.modalField}>Home Address: {selectedUser.traineeProfile.homeAddress || 'Not set'}</Text>
                </View>
              )}
              {selectedUser.recentSessions?.length > 0 && (
                <View style={s.modalSection}>
                  <Text style={s.modalSectionTitle}>Recent Sessions ({selectedUser.recentSessions.length})</Text>
                  {selectedUser.recentSessions.slice(0, 5).map((sess: any, i: number) => (
                    <Text key={i} style={s.modalField}>
                      {sess.sessionType || 'Session'} - {sess.status} ({sess.finalSessionPriceCents ? formatCents(sess.finalSessionPriceCents) : 'N/A'})
                    </Text>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 30 }}>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: C.teal, flex: 1 }]}
                  onPress={() => { setUserDetailVisible(false); handleOpenMessage(selectedUser.user?.id, selectedUser.user?.fullName); }}
                  data-testid="modal-message-btn"
                >
                  <Ionicons name="chatbubble" size={18} color={C.white} />
                  <Text style={s.actionBtnText}>Message</Text>
                </TouchableOpacity>
                {!selectedUser.user?.isAdmin && (
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: C.error, flex: 1 }]}
                    onPress={() => handleRemoveUser(selectedUser.user?.id, selectedUser.user?.fullName)}
                    data-testid="modal-remove-btn"
                  >
                    <Ionicons name="trash" size={18} color={C.white} />
                    <Text style={s.actionBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // --- MODAL: Send Message ---
  const renderMessageModal = () => (
    <Modal visible={messageModalVisible} animationType="slide" transparent>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.modalContent, { maxHeight: '50%' }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Message {messageRecipient?.name}</Text>
            <TouchableOpacity onPress={() => setMessageModalVisible(false)} data-testid="close-message-modal">
              <Ionicons name="close" size={24} color={C.navy} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <TextInput
              style={s.messageInput}
              placeholder="Type your message..."
              placeholderTextColor={C.gray}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              data-testid="message-input"
            />
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: C.teal, justifyContent: 'center', marginTop: 12 }]}
              onPress={handleSendMessage}
              data-testid="send-message-btn"
            >
              <Ionicons name="send" size={18} color={C.white} />
              <Text style={s.actionBtnText}>Send Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // --- MODAL: Edit Profile ---
  const renderProfileModal = () => (
    <Modal visible={profileModalVisible} animationType="slide" transparent>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.modalContent, { maxHeight: '60%' }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)} data-testid="close-profile-modal">
              <Ionicons name="close" size={24} color={C.navy} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={s.inputLabel}>Full Name</Text>
            <TextInput style={s.textInput} value={profileName} onChangeText={setProfileName} data-testid="profile-name-input" />
            <Text style={s.inputLabel}>Email</Text>
            <TextInput style={s.textInput} value={profileEmail} onChangeText={setProfileEmail} keyboardType="email-address" data-testid="profile-email-input" />
            <Text style={s.inputLabel}>Phone</Text>
            <TextInput style={s.textInput} value={profilePhone} onChangeText={setProfilePhone} keyboardType="phone-pad" data-testid="profile-phone-input" />
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: C.teal, justifyContent: 'center', marginTop: 16 }]}
              onPress={handleUpdateProfile}
              data-testid="save-profile-btn"
            >
              <Ionicons name="checkmark" size={18} color={C.white} />
              <Text style={s.actionBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={[C.navy, '#1e3470']} style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Admin Panel</Text>
            <Text style={s.headerSub}>RapidReps Management</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} data-testid="admin-logout-btn">
            <Ionicons name="log-out-outline" size={22} color={C.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarScroll}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[s.tab, activeTab === tab.id && s.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              data-testid={`admin-tab-${tab.id}`}
            >
              <Ionicons name={tab.icon as any} size={17} color={activeTab === tab.id ? C.teal : C.gray} />
              <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingBox}><ActivityIndicator size="large" color={C.teal} /><Text style={s.loadingText}>Loading...</Text></View>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'verifications' && renderVerifications()}
            {activeTab === 'sessions' && renderSessions()}
            {activeTab === 'payments' && renderPayments()}
            {activeTab === 'profile' && renderProfile()}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {renderUserDetailModal()}
      {renderMessageModal()}
      {renderProfileModal()}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  tabBar: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBarScroll: { paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: C.teal },
  tabText: { fontSize: 12, fontWeight: '600', color: C.gray },
  tabTextActive: { color: C.teal },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  loadingText: { color: C.gray, fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.navy, marginBottom: 12, marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: C.card, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statIconBg: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: C.navy },
  statLabel: { fontSize: 12, color: C.gray, marginTop: 4 },
  statSub: { fontSize: 10, color: C.gray, marginTop: 2, fontStyle: 'italic' },
  growthTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  growthText: { fontSize: 10, fontWeight: '700' },
  timeframePills: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  timeframePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: '#e2e8f0' },
  timeframePillActive: { backgroundColor: C.teal, borderColor: C.teal },
  timeframePillText: { fontSize: 12, fontWeight: '600', color: C.gray },
  timeframePillTextActive: { color: C.white },
  revenueCard: { backgroundColor: C.card, borderRadius: 14, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  revenueRowHero: { alignItems: 'center', paddingVertical: 10, marginBottom: 4 },
  revenueLabelHero: { fontSize: 13, color: C.gray, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  revenueValueHero: { fontSize: 30, fontWeight: '900', color: C.navy },
  revenueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  revenueLabel: { fontSize: 14, color: C.gray },
  revenueValue: { fontSize: 18, fontWeight: '700', color: C.navy },
  revenueValueBold: { fontSize: 18, fontWeight: '800' },
  revenueDot: { width: 8, height: 8, borderRadius: 4 },
  revenueBarContainer: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 16 },
  revenueBarSegment: { height: 8 },
  revenueBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  revenueBarLabel: { fontSize: 10, fontWeight: '700' },
  // Chart styles
  chartCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: C.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  chartCardTitle: { fontSize: 14, fontWeight: '700', color: C.navy },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  chartLegend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 12, color: C.gray, fontWeight: '500' },
  legendValue: { fontSize: 13, fontWeight: '700', color: C.navy },
  legendDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 2 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  listCardIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  listCardTitle: { fontSize: 14, fontWeight: '700', color: C.navy },
  listCardSub: { fontSize: 12, color: C.gray, marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: C.teal, justifyContent: 'center', alignItems: 'center' },
  verifyCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: C.warning, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  verifyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  verifyName: { fontSize: 16, fontWeight: '700', color: C.navy },
  verifySub: { fontSize: 12, color: C.gray, marginTop: 2 },
  pendingBadge: { backgroundColor: '#FFB30020', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pendingBadgeText: { fontSize: 10, fontWeight: '700', color: C.warning },
  verifyChecks: { gap: 6, marginBottom: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 12, color: C.grayDark },
  verifyActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  actionBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  sessionCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  sessionType: { fontSize: 11, color: C.gray, fontWeight: '500', backgroundColor: '#f0f2f5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sessionNames: { fontSize: 14, color: C.navy, lineHeight: 20 },
  sessionPrice: { fontSize: 16, fontWeight: '800', color: C.navy },
  sessionDetails: { gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: C.grayDark },
  transCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  transAmount: { fontSize: 16, fontWeight: '800' },
  transBreakdown: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 8 },
  transBreakdownText: { fontSize: 11, color: C.gray, fontWeight: '500' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  smallBtnText: { color: C.white, fontSize: 12, fontWeight: '700' },
  refundedTag: { marginTop: 8, backgroundColor: '#FFE0E0', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  refundedTagText: { fontSize: 11, fontWeight: '700', color: C.error },
  profileCard: { backgroundColor: C.card, borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E0F7F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileName: { fontSize: 20, fontWeight: '800', color: C.navy },
  profileSub: { fontSize: 13, color: C.gray, marginTop: 4 },
  profileInfo: { width: '100%', gap: 8, marginTop: 12 },
  profileInfoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  profileInfoLabel: { fontSize: 13, color: C.gray },
  profileInfoValue: { fontSize: 13, fontWeight: '600', color: C.navy },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.teal, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 20 },
  editProfileBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.navy },
  emptySub: { fontSize: 13, color: C.gray, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.navy },
  modalBody: { paddingHorizontal: 20, paddingBottom: 30 },
  modalSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalSectionTitle: { fontSize: 14, fontWeight: '700', color: C.teal, marginBottom: 8 },
  modalField: { fontSize: 13, color: C.grayDark, lineHeight: 22 },
  messageInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, minHeight: 100, fontSize: 14, color: C.navy, textAlignVertical: 'top' },
  textInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: C.navy, marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: C.grayDark, marginBottom: 6 },
  paginationBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 16 },
  pageBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtnDisabled: { opacity: 0.4 },
  pageInfo: { fontSize: 13, fontWeight: '600', color: C.grayDark },
  // Attention Needed
  attentionCard: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  attentionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  attentionIconBg: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  attentionText: { flex: 1, fontSize: 13, color: C.grayDark },
  attentionCount: { fontWeight: '800', color: C.navy },
  attentionDivider: { height: 1, backgroundColor: '#f0f2f5', marginLeft: 60 },
  // Leaderboard
  leaderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  leaderRowFirst: { borderLeftWidth: 4, borderLeftColor: '#FFB300' },
  leaderRank: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  leaderRankText: { fontSize: 13, fontWeight: '900' },
  leaderName: { fontSize: 15, fontWeight: '800', color: C.navy },
  leaderTierBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  leaderTierText: { fontSize: 10, fontWeight: '700' },
  leaderRating: { fontSize: 11, fontWeight: '700', color: C.grayDark },
  leaderStats: { alignItems: 'center' },
  leaderStatNum: { fontSize: 20, fontWeight: '900', color: C.teal },
  leaderStatLabel: { fontSize: 9, color: C.gray, fontWeight: '600', textTransform: 'uppercase' },
});

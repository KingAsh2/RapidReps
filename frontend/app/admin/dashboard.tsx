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
  FlatList,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  orange: '#FF7F00',
  teal: '#1FB8B4',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  grayLight: '#F5F6F8',
  grayDark: '#2d3748',
  success: '#00C853',
  error: '#FF4757',
  warning: '#FFB300',
  bg: '#f0f2f5',
};

type Tab = 'overview' | 'users' | 'verifications' | 'sessions' | 'transactions';

const api = axios.create({ baseURL: `${API_URL}/api` });

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetailModalVisible, setUserDetailModalVisible] = useState(false);

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchDashboard = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/dashboard', { headers });
      setDashboard(res.data);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err?.response?.data || err.message);
    }
  };

  const fetchUsers = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/users?limit=50', { headers });
      setUsers(res.data.users || []);
      setUsersTotal(res.data.total || 0);
    } catch (err: any) {
      console.error('Users fetch error:', err?.response?.data || err.message);
    }
  };

  const fetchVerifications = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/verifications/pending', { headers });
      setVerifications(res.data.pendingVerifications || []);
    } catch (err: any) {
      console.error('Verifications fetch error:', err?.response?.data || err.message);
    }
  };

  const fetchSessions = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/sessions?limit=50', { headers });
      setSessions(res.data.sessions || []);
    } catch (err: any) {
      console.error('Sessions fetch error:', err?.response?.data || err.message);
    }
  };

  const fetchTransactions = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/transactions?limit=50', { headers });
      setTransactions(res.data.transactions || []);
    } catch (err: any) {
      console.error('Transactions fetch error:', err?.response?.data || err.message);
    }
  };

  const loadTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      if (tab === 'overview') await fetchDashboard();
      else if (tab === 'users') await fetchUsers();
      else if (tab === 'verifications') await fetchVerifications();
      else if (tab === 'sessions') await fetchSessions();
      else if (tab === 'transactions') await fetchTransactions();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTab(activeTab);
  };

  const handleApproveVerification = async (trainerId: string) => {
    Alert.alert('Approve Trainer', 'Approve this trainer for the platform?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.post(`/admin/verifications/${trainerId}/approve`, {}, { headers });
            Alert.alert('Success', 'Trainer approved successfully');
            fetchVerifications();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to approve');
          }
        },
      },
    ]);
  };

  const handleRejectVerification = async (trainerId: string) => {
    Alert.alert('Reject Trainer', 'Reject this trainer\'s verification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.post(`/admin/verifications/${trainerId}/reject`, {}, { headers });
            Alert.alert('Done', 'Trainer verification rejected');
            fetchVerifications();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to reject');
          }
        },
      },
    ]);
  };

  const handleViewUser = async (userId: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get(`/admin/users/${userId}`, { headers });
      setSelectedUser(res.data);
      setUserDetailModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load user details');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('active_role');
    router.replace('/');
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDollars = (dollars: number) => `$${dollars.toFixed(2)}`;

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'overview', icon: 'grid', label: 'Overview' },
    { id: 'users', icon: 'people', label: 'Users' },
    { id: 'verifications', icon: 'shield-checkmark', label: 'Verify' },
    { id: 'sessions', icon: 'calendar', label: 'Sessions' },
    { id: 'transactions', icon: 'card', label: 'Payments' },
  ];

  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconBg, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderOverview = () => {
    if (!dashboard) return null;
    return (
      <View>
        <Text style={styles.sectionTitle}>Platform Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="people" label="Total Users" value={dashboard.totalUsers} color={COLORS.teal} />
          <StatCard icon="fitness" label="Trainers" value={dashboard.totalTrainers} color={COLORS.orange} />
          <StatCard icon="person" label="Trainees" value={dashboard.totalTrainees} color={COLORS.navy} />
          <StatCard icon="calendar" label="Sessions" value={dashboard.totalSessions} color={COLORS.success} />
        </View>

        <Text style={styles.sectionTitle}>Revenue</Text>
        <View style={styles.revenueCard}>
          <View style={styles.revenueRow}>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={styles.revenueValue}>{formatDollars(dashboard.totalRevenueDollars)}</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueRow}>
            <Text style={styles.revenueLabel}>Platform Revenue (25%)</Text>
            <Text style={[styles.revenueValue, { color: COLORS.success }]}>
              {formatDollars(dashboard.platformRevenueDollars)}
            </Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueRow}>
            <Text style={styles.revenueLabel}>Trainer Payouts (75%)</Text>
            <Text style={styles.revenueValue}>{formatDollars(dashboard.trainerPayoutsDollars)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Info</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="checkmark-circle" label="Completed" value={dashboard.completedSessions} color={COLORS.success} />
          <StatCard icon="star" label="Memberships" value={dashboard.activeMemberships} color={COLORS.warning} />
          <StatCard icon="flash" label="Active Boosts" value={dashboard.activeBoosts} color={COLORS.orange} />
          <StatCard icon="time" label="Pending Verify" value={dashboard.pendingVerifications} color={COLORS.error} />
        </View>
      </View>
    );
  };

  const renderUsers = () => (
    <View>
      <Text style={styles.sectionTitle}>All Users ({usersTotal})</Text>
      {users.map((user) => (
        <TouchableOpacity
          key={user.id}
          style={styles.listCard}
          onPress={() => handleViewUser(user.id)}
          data-testid={`admin-user-${user.id}`}
        >
          <View style={styles.listCardIcon}>
            <Ionicons
              name={user.roles?.includes('trainer') ? 'fitness' : user.isAdmin ? 'shield' : 'person'}
              size={20}
              color={COLORS.white}
            />
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>{user.fullName}</Text>
            <Text style={styles.listCardSubtitle}>{user.email}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {user.isAdmin ? 'Admin' : user.roles?.join(', ') || 'User'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderVerifications = () => (
    <View>
      <Text style={styles.sectionTitle}>Pending Verifications ({verifications.length})</Text>
      {verifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle" size={48} color={COLORS.success} />
          <Text style={styles.emptyTitle}>All Clear!</Text>
          <Text style={styles.emptySubtitle}>No pending verifications at this time.</Text>
        </View>
      ) : (
        verifications.map((item, idx) => (
          <View key={idx} style={styles.verifyCard} data-testid={`verification-${idx}`}>
            <View style={styles.verifyHeader}>
              <View>
                <Text style={styles.verifyName}>{item.user?.fullName || 'Unknown'}</Text>
                <Text style={styles.verifyEmail}>{item.user?.email || ''}</Text>
              </View>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>PENDING</Text>
              </View>
            </View>

            <View style={styles.verifyChecks}>
              {['governmentIdUploaded', 'backgroundCheckPassed', 'fitnessCertUploaded', 'cprAedCertUploaded', 'insuranceUploaded', 'profilePhotoUploaded', 'introVideoUploaded'].map((field) => (
                <View key={field} style={styles.checkRow}>
                  <Ionicons
                    name={item.profile?.[field] ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={item.profile?.[field] ? COLORS.success : COLORS.gray}
                  />
                  <Text style={styles.checkLabel}>
                    {field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.verifyActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleApproveVerification(item.profile?.userId)}
                data-testid={`approve-btn-${idx}`}
              >
                <Ionicons name="checkmark" size={18} color={COLORS.white} />
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleRejectVerification(item.profile?.userId)}
                data-testid={`reject-btn-${idx}`}
              >
                <Ionicons name="close" size={18} color={COLORS.white} />
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderSessions = () => (
    <View>
      <Text style={styles.sectionTitle}>Recent Sessions</Text>
      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No Sessions Yet</Text>
          <Text style={styles.emptySubtitle}>Sessions will appear here when users book trainers.</Text>
        </View>
      ) : (
        sessions.map((s, idx) => (
          <View key={s.id || idx} style={styles.listCard}>
            <View style={[styles.listCardIcon, { backgroundColor: COLORS.teal }]}>
              <Ionicons name="barbell" size={18} color={COLORS.white} />
            </View>
            <View style={styles.listCardContent}>
              <Text style={styles.listCardTitle}>{s.sessionType || 'Training'}</Text>
              <Text style={styles.listCardSubtitle}>
                Status: {s.status} | {s.finalSessionPriceCents ? formatCents(s.finalSessionPriceCents) : 'N/A'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: s.status === 'completed' ? `${COLORS.success}20` : `${COLORS.warning}20` }]}>
              <Text style={[styles.statusBadgeText, { color: s.status === 'completed' ? COLORS.success : COLORS.warning }]}>
                {s.status?.toUpperCase()}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderTransactions = () => (
    <View>
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="card-outline" size={48} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No Transactions</Text>
          <Text style={styles.emptySubtitle}>Payment transactions will appear here.</Text>
        </View>
      ) : (
        transactions.map((t, idx) => (
          <View key={t.id || idx} style={styles.listCard}>
            <View style={[styles.listCardIcon, { backgroundColor: COLORS.success }]}>
              <Ionicons name="cash" size={18} color={COLORS.white} />
            </View>
            <View style={styles.listCardContent}>
              <Text style={styles.listCardTitle}>{t.transactionType || t.paymentType || 'Payment'}</Text>
              <Text style={styles.listCardSubtitle}>
                {t.amountCents ? formatCents(t.amountCents) : formatDollars(t.amount || 0)} | {t.status}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderUserDetailModal = () => (
    <Modal visible={userDetailModalVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>User Details</Text>
            <TouchableOpacity onPress={() => setUserDetailModalVisible(false)} data-testid="close-user-modal">
              <Ionicons name="close" size={24} color={COLORS.navy} />
            </TouchableOpacity>
          </View>

          {selectedUser && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Basic Info</Text>
                <Text style={styles.modalField}>Name: {selectedUser.user?.fullName}</Text>
                <Text style={styles.modalField}>Email: {selectedUser.user?.email}</Text>
                <Text style={styles.modalField}>Phone: {selectedUser.user?.phone}</Text>
                <Text style={styles.modalField}>Roles: {selectedUser.user?.roles?.join(', ')}</Text>
              </View>

              {selectedUser.trainerProfile && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Trainer Profile</Text>
                  <Text style={styles.modalField}>Bio: {selectedUser.trainerProfile.bio || 'N/A'}</Text>
                  <Text style={styles.modalField}>Experience: {selectedUser.trainerProfile.experienceYears || 0} years</Text>
                  <Text style={styles.modalField}>Verified: {selectedUser.trainerProfile.isVerified ? 'Yes' : 'No'}</Text>
                  <Text style={styles.modalField}>Rating: {selectedUser.trainerProfile.averageRating || 'N/A'}</Text>
                </View>
              )}

              {selectedUser.traineeProfile && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Trainee Profile</Text>
                  <Text style={styles.modalField}>Goals: {selectedUser.traineeProfile.fitnessGoals || 'N/A'}</Text>
                  <Text style={styles.modalField}>Level: {selectedUser.traineeProfile.currentFitnessLevel || 'N/A'}</Text>
                </View>
              )}

              {selectedUser.recentSessions?.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Recent Sessions ({selectedUser.recentSessions.length})</Text>
                  {selectedUser.recentSessions.slice(0, 5).map((s: any, i: number) => (
                    <Text key={i} style={styles.modalField}>
                      {s.sessionType || 'Session'} - {s.status} ({s.finalSessionPriceCents ? formatCents(s.finalSessionPriceCents) : 'N/A'})
                    </Text>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[COLORS.navy, '#243b7f']} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSubtitle}>RapidReps Management</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} data-testid="admin-logout-btn">
            <Ionicons name="log-out-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              data-testid={`admin-tab-${tab.id}`}
            >
              <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.id ? COLORS.teal : COLORS.gray} />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.teal} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'verifications' && renderVerifications()}
            {activeTab === 'sessions' && renderSessions()}
            {activeTab === 'transactions' && renderTransactions()}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {renderUserDetailModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  tabBar: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBarScroll: { paddingHorizontal: 12 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.teal },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.teal },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  loadingText: { color: COLORS.gray, fontSize: 14 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy, marginBottom: 12, marginTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconBg: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 4 },

  revenueCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  revenueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  revenueLabel: { fontSize: 14, color: COLORS.gray },
  revenueValue: { fontSize: 18, fontWeight: '700', color: COLORS.navy },
  revenueDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },

  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  listCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listCardContent: { flex: 1 },
  listCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  listCardSubtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  roleBadge: {
    backgroundColor: `${COLORS.teal}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.teal, textTransform: 'uppercase' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  verifyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  verifyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  verifyName: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  verifyEmail: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  pendingBadge: { backgroundColor: `${COLORS.warning}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pendingBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.warning },
  verifyChecks: { gap: 6, marginBottom: 14 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 12, color: COLORS.grayDark },
  verifyActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  approveBtn: { backgroundColor: COLORS.success },
  rejectBtn: { backgroundColor: COLORS.error },
  actionBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.navy },
  emptySubtitle: { fontSize: 13, color: COLORS.gray, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.navy },
  modalBody: { paddingHorizontal: 20, paddingBottom: 40 },
  modalSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalSectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.teal, marginBottom: 8 },
  modalField: { fontSize: 13, color: COLORS.grayDark, lineHeight: 22 },
});

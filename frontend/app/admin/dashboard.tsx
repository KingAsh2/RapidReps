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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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

  const fetchSessions = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/sessions?limit=50', { headers });
      setSessions(res.data.sessions || []);
      setSessionsTotal(res.data.total || 0);
    } catch (err: any) {
      console.error('Sessions error:', err?.response?.data || err.message);
    }
  };

  const fetchTransactions = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/transactions-enriched?limit=50', { headers });
      setTransactions(res.data.transactions || []);
      setTransTotal(res.data.total || 0);
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
      if (tab === 'overview') await fetchDashboard();
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

  // --- Stat Card ---
  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) => (
    <View style={s.statCard} data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <View style={[s.statIconBg, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );

  // --- RENDER: Overview ---
  const renderOverview = () => {
    if (!dashboard) return null;
    return (
      <View>
        <Text style={s.sectionTitle}>Platform Stats</Text>
        <View style={s.statsGrid}>
          <StatCard icon="people" label="Total Users" value={dashboard.totalUsers} color={C.teal} />
          <StatCard icon="fitness" label="Trainers" value={dashboard.totalTrainers} color={C.orange} />
          <StatCard icon="person" label="Trainees" value={dashboard.totalTrainees} color={C.navyLight} />
          <StatCard icon="calendar" label="Sessions" value={dashboard.totalSessions} color={C.success} />
        </View>
        <Text style={s.sectionTitle}>Revenue</Text>
        <View style={s.revenueCard}>
          <View style={s.revenueRow}>
            <Text style={s.revenueLabel}>Total Revenue</Text>
            <Text style={s.revenueValue}>{formatCents(dashboard.totalRevenueCents)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.revenueRow}>
            <Text style={s.revenueLabel}>Platform (25%)</Text>
            <Text style={[s.revenueValue, { color: C.success }]}>{formatCents(dashboard.platformRevenueCents)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.revenueRow}>
            <Text style={s.revenueLabel}>Trainer Payouts (75%)</Text>
            <Text style={s.revenueValue}>{formatCents(dashboard.trainerPayoutsCents)}</Text>
          </View>
        </View>
        <Text style={s.sectionTitle}>Quick Info</Text>
        <View style={s.statsGrid}>
          <StatCard icon="checkmark-circle" label="Completed" value={dashboard.completedSessions} color={C.success} />
          <StatCard icon="star" label="Memberships" value={dashboard.activeMemberships} color={C.warning} />
          <StatCard icon="flash" label="Boosts" value={dashboard.activeBoosts} color={C.orange} />
          <StatCard icon="time" label="Pending Verify" value={dashboard.pendingVerifications} color={C.error} />
        </View>
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
  revenueCard: { backgroundColor: C.card, borderRadius: 14, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  revenueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  revenueLabel: { fontSize: 14, color: C.gray },
  revenueValue: { fontSize: 18, fontWeight: '700', color: C.navy },
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
});

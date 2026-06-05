import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
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
import { toast } from '../../src/utils/toast';
import { useAuth } from '../../src/contexts/AuthContext';

// Shared utilities & styles
import { C, s, api, getAuthHeader, formatCents, PAGE_SIZE } from '../../src/components/admin/AdminShared';

// Tab components
import { PremiumOverviewTab } from '../../src/components/admin/PremiumOverviewTab';
import { UsersTab } from '../../src/components/admin/UsersTab';
import { VerificationsTab } from '../../src/components/admin/VerificationsTab';
import { SessionsTab } from '../../src/components/admin/SessionsTab';
import { PaymentsTab } from '../../src/components/admin/PaymentsTab';
import { PayoutsTab } from '../../src/components/admin/PayoutsTab';
import { ProfileTab } from '../../src/components/admin/ProfileTab';
import { SafetyTab } from '../../src/components/admin/SafetyTab';
import { SubscriptionsTab } from '../../src/components/admin/SubscriptionsTab';
import RapidBg from '../../src/components/RapidBg';

type Tab = 'overview' | 'users' | 'verifications' | 'sessions' | 'subscriptions' | 'payments' | 'payouts' | 'safety' | 'profile';

export default function AdminDashboard() {
  const router = useRouter();
  const { logout: authLogout } = useAuth();
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
  const [payoutsData, setPayoutsData] = useState<any>(null);
  const [payoutsHistory, setPayoutsHistory] = useState<any[]>([]);
  const [payingTrainerId, setPayingTrainerId] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [earningsSummary, setEarningsSummary] = useState<any>(null);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('');
  const [transStatusFilter, setTransStatusFilter] = useState<string>('');
  const [transTypeFilter, setTransTypeFilter] = useState<string>('');

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
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // --- Fetch Functions ---
  const fetchDashboard = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/dashboard', { headers });
      setDashboard(res.data);
    } catch (err: any) { console.error('Dashboard error:', err?.response?.data || err.message); }
  };

  const fetchLeaderboard = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/top-trainers?days=7&limit=5', { headers });
      setLeaderboard(res.data.leaderboard || []);
    } catch (err: any) { console.error('Leaderboard error:', err?.response?.data || err.message); }
  };

  const fetchEarningsSummary = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/earnings-summary', { headers });
      setEarningsSummary(res.data);
    } catch (err: any) { console.error('Earnings summary error:', err?.response?.data || err.message); }
  };

  const fetchUsers = async (page = 0, search = userSearch, role = userRoleFilter) => {
    try {
      const headers = await getAuthHeader();
      let url = `/admin/users?limit=${PAGE_SIZE}&skip=${page * PAGE_SIZE}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (role) url += `&role=${role}`;
      const res = await api.get(url, { headers });
      setUsers(res.data.users || []);
      setUsersTotal(res.data.total || 0);
      setUsersPage(page);
    } catch (err: any) { console.error('Users error:', err?.response?.data || err.message); }
  };

  const fetchVerifications = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/verifications/pending', { headers });
      setVerifications(res.data.pendingVerifications || []);
    } catch (err: any) { console.error('Verify error:', err?.response?.data || err.message); }
  };

  const fetchSessions = async (page = 0, status = sessionStatusFilter, type = sessionTypeFilter) => {
    try {
      const headers = await getAuthHeader();
      let url = `/admin/sessions?limit=${PAGE_SIZE}&skip=${page * PAGE_SIZE}`;
      if (status) url += `&status=${status}`;
      if (type) url += `&session_type=${type}`;
      const res = await api.get(url, { headers });
      setSessions(res.data.sessions || []);
      setSessionsTotal(res.data.total || 0);
      setSessionsPage(page);
    } catch (err: any) { console.error('Sessions error:', err?.response?.data || err.message); }
  };

  const fetchTransactions = async (page = 0, status = transStatusFilter, type = transTypeFilter) => {
    try {
      const headers = await getAuthHeader();
      let url = `/admin/transactions-enriched?limit=${PAGE_SIZE}&skip=${page * PAGE_SIZE}`;
      if (status) url += `&status=${status}`;
      if (type) url += `&session_type=${type}`;
      const res = await api.get(url, { headers });
      setTransactions(res.data.transactions || []);
      setTransTotal(res.data.total || 0);
      setTransPage(page);
    } catch (err: any) { console.error('Transactions error:', err?.response?.data || err.message); }
  };

  const fetchAdminProfile = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/auth/me', { headers });
      setAdminUser(res.data);
      setProfileName(res.data.fullName || '');
      setProfilePhone(res.data.phone || '');
      setProfileEmail(res.data.email || '');
    } catch (err: any) { console.error('Profile error:', err?.response?.data || err.message); }
  };

  const fetchPayouts = async () => {
    try {
      const headers = await getAuthHeader();
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/admin/payouts/pending', { headers }),
        api.get('/admin/payouts/history', { headers }),
      ]);
      setPayoutsData(pendingRes.data);
      setPayoutsHistory(historyRes.data?.payouts || []);
    } catch (err: any) { console.error('Payouts error:', err?.response?.data || err.message); }
  };

  // --- Action Handlers ---
  const handlePayTrainer = async (trainerId: string, name: string) => {
    Alert.alert('Confirm Payout', `Transfer pending balance to ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pay Now', onPress: async () => {
          setPayingTrainerId(trainerId);
          try {
            const headers = await getAuthHeader();
            const res = await api.post('/admin/payouts/pay-trainer', { trainerId }, { headers });
            toast.success(res.data.message);
            fetchPayouts();
          } catch (err: any) { toast.error(err?.response?.data?.detail || 'Payout failed'); }
          finally { setPayingTrainerId(null); }
        },
      },
    ]);
  };

  const handlePayAll = async () => {
    Alert.alert('Batch Payout', `Pay all ${payoutsData?.eligibleCount || 0} eligible trainers?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pay All', onPress: async () => {
          setPayingAll(true);
          try {
            const headers = await getAuthHeader();
            const res = await api.post('/admin/payouts/pay-all', {}, { headers });
            toast.success(res.data.message);
            fetchPayouts();
          } catch (err: any) { toast.error(err?.response?.data?.detail || 'Batch payout failed'); }
          finally { setPayingAll(false); }
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
    } catch { toast.error('Failed to load user details'); }
  };

  /** iter96b: open the user's actual profile screen (not just the admin modal). */
  const handleOpenUserProfile = (user: any) => {
    if (!user) return;
    const roles: string[] = user.roles || [];
    if (roles.includes('trainer')) {
      router.push(`/trainee/trainer-detail?trainerId=${user.id}` as any);
    } else if (roles.includes('trainee')) {
      router.push(`/trainer/trainee-detail?traineeId=${user.id}` as any);
    } else {
      toast.error('No profile available for this user');
    }
  };

  const handleRemoveUser = (userId: string, userName: string) => {
    Alert.alert('Remove User', `Permanently remove ${userName} and all their data?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.delete(`/admin/users/${userId}`, { headers });
            toast.success(`${userName} has been removed`);
            setUserDetailVisible(false);
            fetchUsers();
          } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to remove user'); }
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
      toast.success(`Message sent to ${messageRecipient.name}`);
      setMessageModalVisible(false);
      setMessageText('');
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed to send'); }
  };

  const handleRefund = (sessionId: string, amount: number) => {
    Alert.alert('Refund Payment', `Refund $${(amount / 100).toFixed(2)} for this session?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Refund', style: 'destructive', onPress: async () => {
          try {
            const headers = await getAuthHeader();
            await api.post('/admin/refund', { sessionId, reason: 'Admin refund' }, { headers });
            toast.success('Payment has been refunded');
            fetchTransactions();
          } catch (err: any) { toast.error(err?.response?.data?.detail || 'Refund failed'); }
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
            toast.success('Payment confirmed');
            fetchTransactions();
          } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed'); }
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
      toast.success('Profile updated successfully');
      setProfileModalVisible(false);
      fetchAdminProfile();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Update failed'); }
  };

  const handleLogout = async () => {
    // iter96b: must clear AuthContext state — otherwise the user object remains
    // in-memory and tab-bar redirects bounce admin back to dashboard.
    try {
      await authLogout();
    } catch { /* fallthrough */ }
    await AsyncStorage.multiRemove(['auth_token', 'active_role', 'user', 'currentUser']);
    // iter98d (Task 2): go straight to sign-in, not the Welcome A/B splash
    router.replace('/auth/login');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      const headers = await getAuthHeader();
      await api.post('/auth/change-password', { currentPassword, newPassword }, { headers });
      toast.success('Password changed successfully');
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to change password');
    }
  };

  // --- Tab Loading ---
  const loadTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      if (tab === 'overview') { await fetchDashboard(); await fetchLeaderboard(); await fetchEarningsSummary(); }
      else if (tab === 'users') await fetchUsers();
      else if (tab === 'verifications') await fetchVerifications();
      else if (tab === 'sessions') await fetchSessions();
      else if (tab === 'payments') await fetchTransactions();
      else if (tab === 'payouts') await fetchPayouts();
      else if (tab === 'profile') await fetchAdminProfile();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTab(activeTab); }, [activeTab]);

  const onRefresh = () => { setRefreshing(true); loadTab(activeTab); };

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'overview', icon: 'grid', label: 'Overview' },
    { id: 'users', icon: 'people', label: 'Users' },
    { id: 'verifications', icon: 'shield-checkmark', label: 'Verify' },
    { id: 'sessions', icon: 'calendar', label: 'Sessions' },
    { id: 'subscriptions', icon: 'repeat', label: 'Subs' },
    { id: 'payments', icon: 'card', label: 'Payments' },
    { id: 'payouts', icon: 'wallet', label: 'Payouts' },
    { id: 'safety', icon: 'shield-half', label: 'Safety' },
    { id: 'profile', icon: 'person-circle', label: 'Profile' },
  ];

  // --- User Detail Modal ---
  const renderUserDetailModal = () => (
    <Modal visible={userDetailVisible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>User Details</Text>
            <TouchableOpacity onPress={() => setUserDetailVisible(false)} data-testid="close-user-modal">
              <Ionicons name="close" size={24} color={'#0A0E1A'} />
            </TouchableOpacity>
          </View>
          {selectedUser && (
            <TouchableOpacity
              onPress={() => {
                setUserDetailVisible(false);
                handleOpenUserProfile(selectedUser.user);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF7A00', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, gap: 8 }}
              data-testid="open-user-profile-btn"
            >
              <Ionicons name="person-circle" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800' }}>Open Full Profile</Text>
            </TouchableOpacity>
          )}
          {selectedUser && (
            <ScrollView style={s.modalBody}>
              <View style={s.modalSection}>
                <Text style={s.modalSectionTitle}>Basic Info</Text>
                <Text style={s.modalField}>Name: {selectedUser.user?.fullName}</Text>
                <Text style={s.modalField}>Email: {selectedUser.user?.email}</Text>
                <Text style={s.modalField}>Phone: {selectedUser.user?.phone}</Text>
                <Text style={s.modalField}>Roles: {selectedUser.user?.roles?.join(', ')}</Text>
                {(selectedUser.user?.city || selectedUser.user?.state) && (
                  <Text style={s.modalField}>Location: {[selectedUser.user?.city, selectedUser.user?.state].filter(Boolean).join(', ')}</Text>
                )}
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
                  style={[s.actionBtn, { backgroundColor: '#FF6A00', flex: 1 }]}
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

  // --- Message Modal ---
  const renderMessageModal = () => (
    <Modal visible={messageModalVisible} animationType="slide" transparent>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.modalContent, { maxHeight: '50%' }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Message {messageRecipient?.name}</Text>
            <TouchableOpacity onPress={() => setMessageModalVisible(false)} data-testid="close-message-modal">
              <Ionicons name="close" size={24} color={'#0A0E1A'} />
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
              style={[s.actionBtn, { backgroundColor: '#FF6A00', justifyContent: 'center', marginTop: 12 }]}
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

  // --- Profile Edit Modal ---
  const renderProfileModal = () => (
    <Modal visible={profileModalVisible} animationType="slide" transparent>
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.modalContent, { maxHeight: '60%' }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setProfileModalVisible(false)} data-testid="close-profile-modal">
              <Ionicons name="close" size={24} color={'#0A0E1A'} />
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
              style={[s.actionBtn, { backgroundColor: '#FF6A00', justifyContent: 'center', marginTop: 16 }]}
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
      <RapidBg variant="admin-dashboard" style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={s.headerBackBtn}
            data-testid="admin-header-back-btn"
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Admin Panel</Text>
            <Text style={s.headerSub}>RapidReps Management</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} data-testid="admin-logout-btn" accessibilityLabel="Log out" accessibilityRole="button">
            <Ionicons name="log-out-outline" size={22} color={C.white} />
          </TouchableOpacity>
        </View>
      </RapidBg>

      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarScroll}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[s.tab, activeTab === tab.id && s.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              data-testid={`admin-tab-${tab.id}`}
            >
              <Ionicons name={tab.icon as any} size={17} color={activeTab === tab.id ? '#FF6A00' : C.gray} />
              <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={'#FF6A00'} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingBox}><ActivityIndicator size="large" color={'#FF6A00'} /><Text style={s.loadingText}>Loading...</Text></View>
        ) : (
          <>
            {activeTab === 'overview' && <PremiumOverviewTab dashboard={dashboard} leaderboard={leaderboard} setActiveTab={setActiveTab} />}
            {activeTab === 'users' && (
              <UsersTab
                users={users} usersTotal={usersTotal} usersPage={usersPage}
                userSearch={userSearch} onSearchChange={setUserSearch}
                userRoleFilter={userRoleFilter} onRoleFilterChange={setUserRoleFilter}
                fetchUsers={fetchUsers}
                onViewUser={handleViewUser} onMessageUser={handleOpenMessage} onRemoveUser={handleRemoveUser}
              />
            )}
            {activeTab === 'verifications' && <VerificationsTab verifications={verifications} fetchVerifications={fetchVerifications} />}
            {activeTab === 'sessions' && (
              <SessionsTab
                sessions={sessions} sessionsTotal={sessionsTotal} sessionsPage={sessionsPage}
                sessionStatusFilter={sessionStatusFilter} onStatusFilterChange={setSessionStatusFilter}
                sessionTypeFilter={sessionTypeFilter} onTypeFilterChange={setSessionTypeFilter}
                fetchSessions={fetchSessions}
              />
            )}
            {activeTab === 'subscriptions' && (
              <SubscriptionsTab />
            )}
            {activeTab === 'payments' && (
              <PaymentsTab
                transactions={transactions} transTotal={transTotal} transPage={transPage}
                transStatusFilter={transStatusFilter} onTransStatusFilterChange={setTransStatusFilter}
                transTypeFilter={transTypeFilter} onTransTypeFilterChange={setTransTypeFilter}
                fetchTransactions={fetchTransactions}
                onRefund={handleRefund} onConfirmPayment={handleConfirmPayment}
              />
            )}
            {activeTab === 'payouts' && (
              <PayoutsTab
                payoutsData={payoutsData} payoutsHistory={payoutsHistory}
                payingTrainerId={payingTrainerId} payingAll={payingAll}
                onPayTrainer={handlePayTrainer} onPayAll={handlePayAll}
              />
            )}
            {activeTab === 'safety' && <SafetyTab />}
            {activeTab === 'profile' && <ProfileTab adminUser={adminUser} onEditProfile={() => setProfileModalVisible(true)} onChangePassword={() => setPasswordModalVisible(true)} />}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {renderUserDetailModal()}
      {renderMessageModal()}
      {renderProfileModal()}
      {/* Change Password Modal */}
      <Modal visible={passwordModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.modalContent, { maxHeight: '60%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)} data-testid="close-password-modal">
                <Ionicons name="close" size={24} color={'#0A0E1A'} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={s.inputLabel}>Current Password</Text>
              <TextInput
                style={s.textInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Enter current password"
                data-testid="current-password-input"
              />
              <Text style={s.inputLabel}>New Password</Text>
              <TextInput
                style={s.textInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Enter new password"
                data-testid="new-password-input"
              />
              <Text style={s.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={s.textInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Confirm new password"
                data-testid="confirm-password-input"
              />
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#FF6A00', justifyContent: 'center', marginTop: 16 }]}
                onPress={handleChangePassword}
                data-testid="save-password-btn"
              >
                <Ionicons name="lock-closed" size={18} color={C.white} />
                <Text style={s.actionBtnText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

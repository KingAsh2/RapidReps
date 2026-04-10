import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, api, getAuthHeader } from './AdminShared';

type SafetyView = 'active' | 'log' | 'events' | 'duration';

export const SafetyTab = () => {
  const [view, setView] = useState<SafetyView>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [verificationLogs, setVerificationLogs] = useState<any[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<any>(null);
  const [durationData, setDurationData] = useState<any[]>([]);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideSessionId, setOverrideSessionId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeader();
      if (view === 'active') {
        const res = await api.get('/safety-check/admin/active-sessions', { headers });
        setActiveSessions(res.data.activeSessions || []);
      } else if (view === 'log') {
        const res = await api.get('/safety-check/admin/verification-log', { headers });
        setVerificationLogs(res.data.logs || []);
      } else if (view === 'events') {
        const res = await api.get('/safety-check/admin/safety-events', { headers });
        setSafetyEvents(res.data);
      } else if (view === 'duration') {
        const res = await api.get('/safety-check/admin/duration-tracking', { headers });
        setDurationData(res.data.sessions || []);
      }
    } catch (err) {
      console.error('Safety data load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOverride = async () => {
    if (!overrideSessionId || !overrideReason) {
      Alert.alert('Error', 'Session ID and reason are required');
      return;
    }
    try {
      const headers = await getAuthHeader();
      await api.post('/safety-check/admin/override', {
        sessionId: overrideSessionId,
        reason: overrideReason,
      }, { headers });
      Alert.alert('Success', 'Session verification overridden');
      setOverrideModal(false);
      setOverrideSessionId('');
      setOverrideReason('');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Override failed');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={st.container}>
      {/* View Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabBar}>
        {[
          { key: 'active', label: 'Active Sessions', icon: 'pulse' },
          { key: 'log', label: 'Verification Log', icon: 'document-text' },
          { key: 'events', label: 'Safety Events', icon: 'warning' },
          { key: 'duration', label: 'Duration Tracking', icon: 'timer' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[st.tab, view === tab.key && st.tabActive]}
            onPress={() => setView(tab.key as SafetyView)}
            data-testid={`safety-tab-${tab.key}`}
          >
            <Ionicons name={tab.icon as any} size={16} color={view === tab.key ? C.white : C.gray} />
            <Text style={[st.tabText, view === tab.key && st.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Override Button */}
      <TouchableOpacity
        style={st.overrideBtn}
        onPress={() => setOverrideModal(true)}
        data-testid="safety-override-btn"
      >
        <Ionicons name="key" size={16} color={C.warning} />
        <Text style={st.overrideBtnText}>Admin Override</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={st.loadingWrap}>
          <ActivityIndicator size="large" color={C.orange} />
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Sessions View */}
          {view === 'active' && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Running Sessions ({activeSessions.length})</Text>
              {activeSessions.length === 0 ? (
                <View style={st.empty}>
                  <Ionicons name="pulse-outline" size={32} color={C.gray} />
                  <Text style={st.emptyText}>No active verified sessions</Text>
                </View>
              ) : activeSessions.map((s, i) => (
                <View key={i} style={st.card} data-testid={`active-session-${i}`}>
                  <View style={st.cardHeader}>
                    <View style={[st.statusDot, { backgroundColor: s.remainingSeconds > 0 ? C.success : C.warning }]} />
                    <Text style={st.cardTitle}>{s.trainerName} → {s.traineeName}</Text>
                  </View>
                  <View style={st.cardGrid}>
                    <View style={st.gridItem}>
                      <Text style={st.gridLabel}>Type</Text>
                      <Text style={st.gridValue}>{s.bookingType === 'in_home' ? 'At Home' : 'In Person'}</Text>
                    </View>
                    <View style={st.gridItem}>
                      <Text style={st.gridLabel}>Booked</Text>
                      <Text style={st.gridValue}>{s.bookedDuration} min</Text>
                    </View>
                    <View style={st.gridItem}>
                      <Text style={st.gridLabel}>Remaining</Text>
                      <Text style={[st.gridValue, { color: s.remainingSeconds < 300 ? C.error : C.success, fontWeight: '800' }]}>
                        {formatTime(s.remainingSeconds)}
                      </Text>
                    </View>
                    <View style={st.gridItem}>
                      <Text style={st.gridLabel}>Timer</Text>
                      <Text style={st.gridValue}>{s.timerState}</Text>
                    </View>
                  </View>
                  <Text style={st.cardMeta}>Started: {formatDate(s.sessionStartedAt)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Verification Log */}
          {view === 'log' && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Verification Log ({verificationLogs.length})</Text>
              {verificationLogs.length === 0 ? (
                <View style={st.empty}>
                  <Ionicons name="document-text-outline" size={32} color={C.gray} />
                  <Text style={st.emptyText}>No verification attempts yet</Text>
                </View>
              ) : verificationLogs.map((log, i) => (
                <View key={i} style={st.card} data-testid={`verification-log-${i}`}>
                  <View style={st.cardHeader}>
                    <View style={[st.statusDot, { backgroundColor: log.result === 'success' ? C.success : log.result === 'override' ? C.warning : C.error }]} />
                    <Text style={st.cardTitle}>{log.action || 'badge_scan'}</Text>
                    <View style={[st.badge, { backgroundColor: log.result === 'success' ? '#E8F5E9' : log.result === 'override' ? '#FFF8E1' : '#FFEBEE' }]}>
                      <Text style={[st.badgeText, { color: log.result === 'success' ? C.success : log.result === 'override' ? C.warning : C.error }]}>
                        {log.result?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={st.cardMeta}>Session: {log.sessionId || '-'}</Text>
                  <Text style={st.cardMeta}>Reason: {log.reason || '-'}</Text>
                  <Text style={st.cardMeta}>Time: {formatDate(log.timestamp)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Safety Events */}
          {view === 'events' && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Safety Events</Text>
              <Text style={st.subTitle}>Failed Verifications ({safetyEvents?.failedVerifications?.length || 0})</Text>
              {(safetyEvents?.failedVerifications || []).map((e: any, i: number) => (
                <View key={i} style={[st.card, { borderLeftWidth: 3, borderLeftColor: C.error }]} data-testid={`safety-event-${i}`}>
                  <Text style={st.cardTitle}>{e.reason}</Text>
                  <Text style={st.cardMeta}>Session: {e.sessionId || '-'} | {formatDate(e.timestamp)}</Text>
                </View>
              ))}
              <Text style={[st.subTitle, { marginTop: 16 }]}>Admin Overrides ({safetyEvents?.overrides?.length || 0})</Text>
              {(safetyEvents?.overrides || []).map((o: any, i: number) => (
                <View key={i} style={[st.card, { borderLeftWidth: 3, borderLeftColor: C.warning }]}>
                  <Text style={st.cardTitle}>Override by {o.adminName}</Text>
                  <Text style={st.cardMeta}>Reason: {o.reason}</Text>
                  <Text style={st.cardMeta}>Session: {o.sessionId} | {formatDate(o.timestamp)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Duration Tracking */}
          {view === 'duration' && (
            <View style={st.section}>
              <Text style={st.sectionTitle}>Duration Tracking ({durationData.length})</Text>
              {durationData.length === 0 ? (
                <View style={st.empty}>
                  <Ionicons name="timer-outline" size={32} color={C.gray} />
                  <Text style={st.emptyText}>No completed verified sessions</Text>
                </View>
              ) : durationData.map((s, i) => (
                <View key={i} style={st.card} data-testid={`duration-${i}`}>
                  <View style={st.cardHeader}>
                    <Text style={st.cardTitle}>{s.trainerName} → {s.traineeName}</Text>
                  </View>
                  <View style={st.cardGrid}>
                    <View style={st.gridItem}>
                      <Text style={st.gridLabel}>Booked</Text>
                      <Text style={st.gridValue}>{s.bookedDuration} min</Text>
                    </View>
                    <View style={st.gridItem}>
                      <Text style={st.gridLabel}>Actual</Text>
                      <Text style={st.gridValue}>{s.actualDuration ? `${s.actualDuration} min` : '-'}</Text>
                    </View>
                    <View style={st.gridItem}>
                      <Text style={st.gridLabel}>Diff</Text>
                      <Text style={[st.gridValue, { color: s.difference > 5 ? C.warning : s.difference < -5 ? C.error : C.success }]}>
                        {s.difference != null ? `${s.difference > 0 ? '+' : ''}${s.difference} min` : '-'}
                      </Text>
                    </View>
                  </View>
                  <Text style={st.cardMeta}>{s.bookingType === 'in_home' ? 'At Home' : 'In Person'} | {formatDate(s.sessionStartedAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Override Modal */}
      <Modal visible={overrideModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Admin Override</Text>
            <Text style={st.modalSubtitle}>Manually verify a session without QR scan</Text>
            <TextInput
              style={st.input}
              placeholder="Session ID"
              value={overrideSessionId}
              onChangeText={setOverrideSessionId}
              placeholderTextColor={C.gray}
              data-testid="override-session-id-input"
            />
            <TextInput
              style={[st.input, { height: 80 }]}
              placeholder="Override reason"
              value={overrideReason}
              onChangeText={setOverrideReason}
              multiline
              placeholderTextColor={C.gray}
              data-testid="override-reason-input"
            />
            <View style={st.modalActions}>
              <TouchableOpacity
                style={st.modalCancel}
                onPress={() => setOverrideModal(false)}
              >
                <Text style={st.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.modalConfirm}
                onPress={handleOverride}
                data-testid="override-confirm-btn"
              >
                <Text style={st.modalConfirmText}>Override</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexGrow: 0, paddingHorizontal: 12, paddingVertical: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F0F2F5', marginRight: 8,
  },
  tabActive: { backgroundColor: C.orange },
  tabText: { fontSize: 13, fontWeight: '700', color: C.gray },
  tabTextActive: { color: C.white },
  overrideBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end',
    marginRight: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFF8E1', borderRadius: 10, borderWidth: 1, borderColor: '#FFE0B2',
  },
  overrideBtnText: { fontSize: 13, fontWeight: '700', color: C.warning },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  section: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subTitle: { fontSize: 14, fontWeight: '700', color: C.gray },
  card: {
    backgroundColor: '#141929', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
    shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  cardMeta: { fontSize: 12, color: C.gray, marginTop: 2 },
  cardGrid: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  gridItem: { flex: 1, backgroundColor: '#1A2035', borderRadius: 10, padding: 10, alignItems: 'center' },
  gridLabel: { fontSize: 11, fontWeight: '600', color: C.gray, marginBottom: 2 },
  gridValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: C.gray },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { backgroundColor: '#141929', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: C.gray, marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: '#E8ECF0', borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: '#FFFFFF', marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#F0F2F5' },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: C.gray },
  modalConfirm: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: C.warning },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: C.white },
});

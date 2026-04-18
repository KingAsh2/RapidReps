import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/contexts/AuthContext';
import { useAlert } from '../src/contexts/AlertContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const api = axios.create({ baseURL: `${API_URL}/api` });

const COLORS = {
  orange: '#FF6A00', orangeLight: '#FF9F1C', navy: '#0A0E1A',
  navyLight: '#141929', white: '#FFFFFF', gray: '#5a6785',
  success: '#00C853', error: '#FF4757', warning: '#FFA502',
  card: 'rgba(255,255,255,0.06)', cardBorder: 'rgba(255,255,255,0.12)',
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_SLOTS = ['morning', 'afternoon', 'evening'];

export default function SubscriptionsScreen() {
  const { user, token } = useAuth();
  const toast = useAlert();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchSubs = async () => {
    try {
      const t = token || await AsyncStorage.getItem('auth_token');
      const res = await api.get('/subscriptions', { headers: { Authorization: `Bearer ${t}` } });
      setSubscriptions(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchSubs(); }, []);

  const handleAction = async (id: string, action: string) => {
    try {
      const t = token || await AsyncStorage.getItem('auth_token');
      await api.put(`/subscriptions/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${t}` } });
      toast.success(`Subscription ${action}ed`);
      fetchSubs();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Action failed'); }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: COLORS.success, pending: COLORS.warning, paused: COLORS.gray,
      cancelled: COLORS.error, declined: COLORS.error,
    };
    return (
      <View style={[st.badge, { backgroundColor: colors[status] || COLORS.gray }]}>
        <Text style={st.badgeText}>{status.toUpperCase()}</Text>
      </View>
    );
  };

  if (loading) return (
    <View style={st.center}><ActivityIndicator size="large" color={COLORS.orange} /></View>
  );

  return (
    <SafeAreaView style={st.container}>
      <LinearGradient colors={[COLORS.navy, '#0D1220']} style={StyleSheet.absoluteFill} />
      <View style={st.header}>
        <Text style={st.title}>Subscriptions</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={st.addBtn} data-testid="create-subscription-btn">
          <Ionicons name="add-circle" size={28} color={COLORS.orange} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubs(); }} tintColor={COLORS.orange} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {subscriptions.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.gray} />
            <Text style={st.emptyTitle}>No Subscriptions</Text>
            <Text style={st.emptySub}>Set up recurring sessions with your trainer</Text>
          </View>
        ) : subscriptions.map((sub) => (
          <View key={sub.id} style={st.card} data-testid={`subscription-card-${sub.id}`}>
            <View style={st.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={st.cardName}>{sub.otherParty?.fullName || 'Unknown'}</Text>
                <Text style={st.cardRole}>{sub.role === 'trainee' ? 'Trainer' : 'Trainee'}</Text>
              </View>
              {getStatusBadge(sub.status)}
            </View>

            <View style={st.cardStats}>
              <View style={st.stat}>
                <Ionicons name="repeat" size={16} color={COLORS.orange} />
                <Text style={st.statText}>{sub.sessionsPerWeek}x/week</Text>
              </View>
              <View style={st.stat}>
                <Ionicons name="time" size={16} color={COLORS.orange} />
                <Text style={st.statText}>{sub.durationMinutes}min</Text>
              </View>
              <View style={st.stat}>
                <Ionicons name="cash" size={16} color={COLORS.success} />
                <Text style={st.statText}>${(sub.totalPerSessionCents / 100).toFixed(0)}/session</Text>
              </View>
            </View>

            <View style={st.cardMeta}>
              <Text style={st.metaText}>
                Monthly est: <Text style={{ color: COLORS.orange, fontWeight: '700' }}>${(sub.monthlyEstimateCents / 100).toFixed(0)}</Text>
              </Text>
              <Text style={st.metaText}>Completed: {sub.sessionsCompleted || 0}</Text>
            </View>

            {/* Action buttons based on role and status */}
            <View style={st.actions}>
              {sub.role === 'trainer' && sub.status === 'pending' && (
                <>
                  <TouchableOpacity onPress={() => handleAction(sub.id, 'accept')} style={[st.actionBtn, { backgroundColor: COLORS.success }]} data-testid={`accept-sub-${sub.id}`}>
                    <Text style={st.actionText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAction(sub.id, 'decline')} style={[st.actionBtn, { backgroundColor: COLORS.error }]} data-testid={`decline-sub-${sub.id}`}>
                    <Text style={st.actionText}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
              {sub.status === 'active' && (
                <TouchableOpacity onPress={() => handleAction(sub.id, 'pause')} style={[st.actionBtn, { backgroundColor: COLORS.warning }]} data-testid={`pause-sub-${sub.id}`}>
                  <Text style={st.actionText}>Pause</Text>
                </TouchableOpacity>
              )}
              {sub.status === 'paused' && (
                <TouchableOpacity onPress={() => handleAction(sub.id, 'resume')} style={[st.actionBtn, { backgroundColor: COLORS.success }]} data-testid={`resume-sub-${sub.id}`}>
                  <Text style={st.actionText}>Resume</Text>
                </TouchableOpacity>
              )}
              {(sub.status === 'active' || sub.status === 'paused') && (
                <TouchableOpacity onPress={() => handleAction(sub.id, 'cancel')} style={[st.actionBtn, { backgroundColor: COLORS.error }]} data-testid={`cancel-sub-${sub.id}`}>
                  <Text style={st.actionText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <CreateSubscriptionModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchSubs} token={token} toast={toast} />
    </SafeAreaView>
  );
}

function CreateSubscriptionModal({ visible, onClose, onCreated, token, toast }: any) {
  const [trainerId, setTrainerId] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timeSlot, setTimeSlot] = useState('morning');
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleCreate = async () => {
    if (!trainerId.trim()) { toast.error('Enter a trainer ID'); return; }
    setSubmitting(true);
    try {
      const t = token || await AsyncStorage.getItem('auth_token');
      await api.post('/subscriptions', {
        trainerId, sessionsPerWeek, preferredDays: selectedDays,
        preferredTimeSlot: timeSlot, durationMinutes: duration,
      }, { headers: { Authorization: `Bearer ${t}` } });
      toast.success('Subscription request sent!');
      onCreated();
      onClose();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={st.modalOverlay}>
        <View style={st.modalContent}>
          <Text style={st.modalTitle}>New Subscription</Text>

          <Text style={st.label}>Trainer ID</Text>
          <TextInput style={st.input} value={trainerId} onChangeText={setTrainerId}
            placeholder="Trainer's user ID" placeholderTextColor="#555" data-testid="sub-trainer-id-input" />

          <Text style={st.label}>Sessions per Week: {sessionsPerWeek}</Text>
          <View style={st.sliderRow}>
            {[1,2,3,4,5,6,7].map(n => (
              <TouchableOpacity key={n} onPress={() => setSessionsPerWeek(n)}
                style={[st.numBtn, sessionsPerWeek === n && st.numBtnActive]} data-testid={`sessions-${n}`}>
                <Text style={[st.numText, sessionsPerWeek === n && st.numTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.label}>Preferred Days</Text>
          <View style={st.daysRow}>
            {DAYS.map(d => (
              <TouchableOpacity key={d} onPress={() => toggleDay(d)}
                style={[st.dayChip, selectedDays.includes(d) && st.dayChipActive]}>
                <Text style={[st.dayText, selectedDays.includes(d) && st.dayTextActive]}>
                  {d.slice(0,3).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.label}>Time Preference</Text>
          <View style={st.sliderRow}>
            {TIME_SLOTS.map(t => (
              <TouchableOpacity key={t} onPress={() => setTimeSlot(t)}
                style={[st.timeChip, timeSlot === t && st.timeChipActive]}>
                <Text style={[st.timeText, timeSlot === t && st.timeTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity onPress={onClose} style={[st.modalBtn, { backgroundColor: '#333' }]}>
              <Text style={st.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} style={[st.modalBtn, { backgroundColor: COLORS.orange, flex: 1 }]}
              disabled={submitting} data-testid="submit-subscription-btn">
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={st.modalBtnText}>Subscribe</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.navy },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  addBtn: { padding: 4 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  emptySub: { fontSize: 14, color: COLORS.gray },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.cardBorder },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardName: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  cardRole: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  cardStats: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: COLORS.white, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metaText: { fontSize: 12, color: COLORS.gray },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  actionText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.navyLight, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.gray, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.white, borderWidth: 1, borderColor: COLORS.cardBorder },
  sliderRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  numBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  numBtnActive: { backgroundColor: COLORS.orange },
  numText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },
  numTextActive: { color: COLORS.white },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  dayChipActive: { backgroundColor: COLORS.orange },
  dayText: { fontSize: 12, fontWeight: '600', color: COLORS.gray },
  dayTextActive: { color: COLORS.white },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  timeChipActive: { backgroundColor: COLORS.orange },
  timeText: { fontSize: 13, fontWeight: '600', color: COLORS.gray, textTransform: 'capitalize' },
  timeTextActive: { color: COLORS.white },
  modalBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', flex: 1 },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});

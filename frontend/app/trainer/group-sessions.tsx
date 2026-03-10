import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, TextInput, Modal, ScrollView, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { groupSessionAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { toast } from '../../src/utils/toast';

const backgroundImage = require('../../assets/images/bg-group-gym.png');

const COLORS = { orange: '#FF6A00', teal: '#1a2a5e', navy: '#1a2a5e', white: '#FFFFFF', gray: '#5a6785', success: '#00D26A', error: '#FF4757' };

export default function TrainerGroupSessionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [price, setPrice] = useState('12');
  const [duration, setDuration] = useState('60');
  const [creating, setCreating] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDuration, setEditDuration] = useState('');

  useEffect(() => { load(); }, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await groupSessionAPI.list(tab);
      setSessions(data.sessions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Title required'); return; }
    setCreating(true);
    try {
      const dateTime = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days from now
      await groupSessionAPI.create({
        title: title.trim(),
        description: description.trim(),
        sessionType: 'outdoor',
        dateTime,
        durationMinutes: parseInt(duration) || 60,
        capacity: parseInt(capacity) || 10,
        pricePerPersonCents: Math.round((parseFloat(price) || 12) * 100),
        tags: [],
      });
      setShowCreate(false);
      setTitle(''); setDescription(''); setCapacity('10'); setPrice('12'); setDuration('60');
      toast.success('Group session created!');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed to create session'); }
    finally { setCreating(false); }
  };

  const handleStart = async (id: string) => {
    try {
      await groupSessionAPI.start(id);
      toast.success('Session started!');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const handleComplete = async (id: string) => {
    try {
      await groupSessionAPI.complete(id);
      toast.success('Session completed!');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const openEdit = (item: any) => {
    setEditingSession(item);
    setEditTitle(item.title || '');
    setEditDescription(item.description || '');
    setEditCapacity(String(item.capacity || 10));
    setEditPrice(String((item.pricePerPersonCents || 1200) / 100));
    setEditDuration(String(item.durationMinutes || 60));
  };

  const handleEdit = async () => {
    if (!editingSession) return;
    try {
      await groupSessionAPI.edit(editingSession.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        capacity: parseInt(editCapacity) || 10,
        pricePerPersonCents: Math.round((parseFloat(editPrice) || 12) * 100),
        durationMinutes: parseInt(editDuration) || 60,
      });
      setEditingSession(null);
      toast.success('Session updated!');
      load();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed to update'); }
  };

  const renderSession = ({ item }: { item: any }) => (
    <View style={styles.card} data-testid={`trainer-group-${item.id}`}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDesc}>{item.description}</Text>
        </View>
        <View style={styles.participantBadge}>
          <Ionicons name="people" size={14} color={COLORS.teal} />
          <Text style={styles.participantText}>{item.participantCount}/{item.capacity}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar" size={14} color={COLORS.gray} />
          <Text style={styles.metaText}>{new Date(item.dateTime).toLocaleDateString()}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time" size={14} color={COLORS.gray} />
          <Text style={styles.metaText}>{item.durationMinutes} min</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="cash" size={14} color={COLORS.gray} />
          <Text style={styles.metaText}>${(item.pricePerPersonCents / 100).toFixed(2)}/person</Text>
        </View>
      </View>
      {item.status === 'upcoming' && item.trainerId === user?.id && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => openEdit(item)} style={[styles.actionBtn, { flex: 1, backgroundColor: COLORS.teal }]} data-testid={`edit-group-${item.id}`}>
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleStart(item.id)} style={[styles.actionBtn, { flex: 1 }]} data-testid={`start-group-${item.id}`}>
            <Text style={styles.actionBtnText}>Start Session</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status === 'in_progress' && (
        <TouchableOpacity onPress={() => handleComplete(item.id)} style={[styles.actionBtn, { backgroundColor: COLORS.success }]} data-testid={`complete-group-${item.id}`}>
          <Text style={styles.actionBtnText}>Complete Session</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <LinearGradient colors={['rgba(247, 147, 30, 0.88)', 'rgba(247, 147, 30, 0.80)', 'rgba(255, 165, 38, 0.75)']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Group Sessions</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn} data-testid="create-group-session-btn">
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['upcoming', 'completed'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={sessions}
        renderItem={renderSession}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.teal} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>{tab === 'upcoming' ? 'No upcoming group sessions. Tap + to create one!' : 'No completed sessions yet.'}</Text>
          </View>
        }
      />

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Create Group Session</Text>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput style={styles.input} placeholder="e.g. HIIT in the Park" value={title} onChangeText={setTitle} placeholderTextColor={COLORS.gray} />
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput style={[styles.input, { minHeight: 70 }]} placeholder="What's this session about?" value={description} onChangeText={setDescription} multiline placeholderTextColor={COLORS.gray} />
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Capacity</Text>
                  <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="numeric" placeholderTextColor={COLORS.gray} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Price ($)</Text>
                  <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor={COLORS.gray} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Duration (min)</Text>
                  <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={COLORS.gray} />
                </View>
              </View>
              <View style={styles.modalBtnRow}>
                <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreate} style={styles.createBtn} disabled={creating} data-testid="submit-create-group">
                  <LinearGradient colors={[COLORS.teal, '#2a3a6e']} style={styles.createBtnGrad}>
                    <Text style={styles.createBtnText}>{creating ? 'Creating...' : 'Create'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editingSession} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: '#1a2a5e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 16 }}>Edit Session</Text>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#888" value={editTitle} onChangeText={setEditTitle} data-testid="edit-title" />
            <TextInput style={[styles.input, { minHeight: 60 }]} placeholder="Description" placeholderTextColor="#888" multiline value={editDescription} onChangeText={setEditDescription} data-testid="edit-desc" />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Capacity" placeholderTextColor="#888" keyboardType="numeric" value={editCapacity} onChangeText={setEditCapacity} data-testid="edit-capacity" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Price ($)" placeholderTextColor="#888" keyboardType="numeric" value={editPrice} onChangeText={setEditPrice} data-testid="edit-price" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Duration" placeholderTextColor="#888" keyboardType="numeric" value={editDuration} onChangeText={setEditDuration} data-testid="edit-duration" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setEditingSession(null)} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEdit} style={[styles.actionBtn, { flex: 1 }]} data-testid="save-edit-btn">
                <Text style={styles.actionBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,207,193,0.3)', alignItems: 'center', justifyContent: 'center' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(0,207,193,0.15)' },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.teal },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: COLORS.gray, lineHeight: 18 },
  participantBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,207,193,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  participantText: { fontSize: 13, fontWeight: '700', color: COLORS.teal },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: COLORS.gray },
  actionBtn: { backgroundColor: COLORS.orange, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.navy, marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.navy, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 14, color: COLORS.navy },
  formRow: { flexDirection: 'row', gap: 10 },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.gray },
  createBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  createBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

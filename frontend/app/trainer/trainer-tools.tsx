import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, RefreshControl, Modal, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { trainerToolsAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { toast } from '../../src/utils/toast';

const { width } = Dimensions.get('window');
const COLORS = { orange: '#FF6A00', teal: '#00CFC1', navy: '#1a2a5e', white: '#FFFFFF', offWhite: '#F8F9FA', gray: '#8892b0', success: '#00D26A' };

type ActiveTab = 'clients' | 'plans' | 'notes';

export default function TrainerToolsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<ActiveTab>('clients');
  const [clients, setClients] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');

  useEffect(() => { loadData(); }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'clients') {
        const d = await trainerToolsAPI.getClients();
        setClients(d.clients || []);
      } else if (tab === 'plans') {
        const d = await trainerToolsAPI.listPlans();
        setPlans(d || []);
      } else {
        const d = await trainerToolsAPI.listNotes();
        setNotes(d || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedClientId) return;
    try {
      await trainerToolsAPI.createNote({ traineeId: selectedClientId, note: noteText.trim(), tags: [] });
      setShowNoteModal(false);
      setNoteText('');
      toast.success('Note saved');
      if (tab === 'notes') loadData();
    } catch (e) { toast.error('Failed to save note'); }
  };

  const renderClient = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.clientCard}
      onPress={() => { setSelectedClientId(item.traineeId); setShowNoteModal(true); }}
      data-testid={`client-${item.traineeId}`}
    >
      <View style={styles.clientAvatar}>
        <Ionicons name="person" size={24} color={COLORS.teal} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.clientName}>{item.fullName}</Text>
        <Text style={styles.clientMeta}>{item.sessionCount} sessions{item.hasProgress ? ' | Progress tracked' : ''}</Text>
      </View>
      <Ionicons name="create-outline" size={20} color={COLORS.gray} />
    </TouchableOpacity>
  );

  const renderPlan = ({ item }: { item: any }) => (
    <View style={styles.planCard} data-testid={`plan-${item.id}`}>
      <Text style={styles.planTitle}>{item.title}</Text>
      <Text style={styles.planDesc}>{item.description}</Text>
      <Text style={styles.planMeta}>{(item.exercises || []).length} exercises</Text>
    </View>
  );

  const renderNote = ({ item }: { item: any }) => (
    <View style={styles.noteCard} data-testid={`note-${item.id}`}>
      <Text style={styles.noteText}>{item.note}</Text>
      <View style={styles.noteFooter}>
        <Text style={styles.noteDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        {item.tags?.length > 0 && (
          <View style={styles.tagRow}>
            {item.tags.map((t: string, i: number) => (
              <View key={i} style={styles.tag}><Text style={styles.tagLabel}>{t}</Text></View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const tabs: { key: ActiveTab; label: string; icon: string }[] = [
    { key: 'clients', label: 'Clients', icon: 'people' },
    { key: 'plans', label: 'Plans', icon: 'clipboard' },
    { key: 'notes', label: 'Notes', icon: 'document-text' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[COLORS.navy, '#0f1d42']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trainer Tools</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabActive]}>
            <Ionicons name={t.icon as any} size={18} color={tab === t.key ? COLORS.teal : COLORS.gray} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tab === 'clients' ? clients : tab === 'plans' ? plans : notes}
        renderItem={tab === 'clients' ? renderClient : tab === 'plans' ? renderPlan : renderNote}
        keyExtractor={item => item.id || item.traineeId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={COLORS.teal} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>Nothing here yet. Complete sessions to see {tab} here.</Text>
          </View>
        }
      />

      {/* Add Note Modal */}
      <Modal visible={showNoteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Session Note</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Notes about the session..."
              placeholderTextColor={COLORS.gray}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setShowNoteModal(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddNote} style={styles.modalSave} data-testid="save-note-btn">
                <LinearGradient colors={[COLORS.teal, '#18A09D']} style={styles.modalSaveGrad}>
                  <Text style={styles.modalSaveText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  tabActive: { backgroundColor: 'rgba(0,207,193,0.15)' },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.teal },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  clientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, marginBottom: 8 },
  clientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,207,193,0.15)', alignItems: 'center', justifyContent: 'center' },
  clientName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  clientMeta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  planCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 8 },
  planTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  planDesc: { fontSize: 13, color: COLORS.gray, marginBottom: 8 },
  planMeta: { fontSize: 11, color: COLORS.teal, fontWeight: '600' },
  noteCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 8 },
  noteText: { fontSize: 14, color: '#e0e0e0', lineHeight: 20, marginBottom: 8 },
  noteFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteDate: { fontSize: 11, color: COLORS.gray },
  tagRow: { flexDirection: 'row', gap: 4 },
  tag: { backgroundColor: 'rgba(0,207,193,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagLabel: { fontSize: 10, color: COLORS.teal, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 16, color: COLORS.navy },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.gray },
  modalSave: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  modalSaveGrad: { paddingVertical: 14, alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

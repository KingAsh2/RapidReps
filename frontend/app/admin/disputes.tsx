import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
  RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { disputesAPI, DisputeDoc } from '../../src/services/api';
import { toast } from '../../src/utils/toast';

const COLORS = {
  white: '#FFFFFF',
  orange: '#FF6A00',
  success: '#00D68F',
  warning: '#FFAA00',
  error: '#FF4757',
  gray: 'rgba(255,255,255,0.65)',
};

type Action = 'refund_partial' | 'refund_full' | 'deny' | 'request_info' | null;

export default function AdminDisputesScreen() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<DisputeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('open');
  const [active, setActive] = useState<DisputeDoc | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await disputesAPI.adminList(filter || undefined);
      setDisputes(list);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not load disputes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openAction = (d: DisputeDoc, a: Action) => {
    setActive(d);
    setAction(a);
    setAmountStr('');
    setNotes('');
  };

  const closeAction = () => {
    setActive(null);
    setAction(null);
    setAmountStr('');
    setNotes('');
  };

  const submit = async () => {
    if (!active || !action) return;
    try {
      setSubmitting(true);
      if (action === 'refund_partial') {
        const cents = Math.round(parseFloat(amountStr || '0') * 100);
        if (!cents || cents <= 0) {
          Alert.alert('Invalid amount', 'Enter a positive dollar amount.');
          return;
        }
        await disputesAPI.adminRefundPartial(active.id, cents, notes);
        toast.success(`Refunded $${(cents / 100).toFixed(2)}`);
      } else if (action === 'refund_full') {
        await disputesAPI.adminRefundFull(active.id, notes);
        toast.success('Full refund issued');
      } else if (action === 'deny') {
        await disputesAPI.adminDeny(active.id, notes);
        toast.success('Dispute denied');
      } else if (action === 'request_info') {
        if (notes.trim().length < 5) {
          Alert.alert('Add a question', 'Tell the user what info you need.');
          return;
        }
        await disputesAPI.adminRequestInfo(active.id, notes);
        toast.success('Info request sent');
      }
      closeAction();
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#0D1117', '#141929']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="admin-disputes-back">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DISPUTE QUEUE</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.filterRow}>
          {[
            { k: 'open', l: 'OPEN' },
            { k: 'info_requested', l: 'AWAITING USER' },
            { k: '', l: 'ALL' },
          ].map((f) => (
            <TouchableOpacity
              key={f.k}
              style={[styles.filterChip, filter === f.k && styles.filterChipActive]}
              onPress={() => setFilter(f.k)}
              data-testid={`admin-filter-${f.k || 'all'}`}
            >
              <Text style={[styles.filterText, filter === f.k && styles.filterTextActive]}>{f.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={COLORS.white} /></View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
          >
            {disputes.length === 0 && (
              <Text style={styles.empty}>No disputes in this view.</Text>
            )}
            {disputes.map((d) => {
              const sessionPriceCents = Math.round(((d.session?.price as number) || 0) * 100);
              return (
                <View key={d.id} style={styles.card} data-testid={`dispute-card-${d.id}`}>
                  <TouchableOpacity onPress={() => router.push(`/dispute/${d.id}`)}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor(d.status) }]} />
                      <Text style={styles.cardReason}>{d.reason.replace(/_/g, ' ').toUpperCase()}</Text>
                      <Text style={styles.cardRole}>{d.openedByRole.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={3}>{d.description}</Text>
                    {sessionPriceCents > 0 && (
                      <Text style={styles.cardMeta}>
                        Session ${(sessionPriceCents / 100).toFixed(2)} · {d.session?.paymentStatus || 'paid'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {(d.status === 'open' || d.status === 'info_requested') && (
                    <View style={styles.actionRow}>
                      <ActionBtn label="REFUND PARTIAL" color={COLORS.success} onPress={() => openAction(d, 'refund_partial')} testId={`act-partial-${d.id}`} />
                      <ActionBtn label="REFUND FULL" color={COLORS.success} onPress={() => openAction(d, 'refund_full')} testId={`act-full-${d.id}`} />
                      <ActionBtn label="REQUEST INFO" color={COLORS.orange} onPress={() => openAction(d, 'request_info')} testId={`act-info-${d.id}`} />
                      <ActionBtn label="DENY" color={COLORS.error} onPress={() => openAction(d, 'deny')} testId={`act-deny-${d.id}`} />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Action modal */}
      <Modal visible={!!action} transparent animationType="fade" onRequestClose={closeAction}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>{actionLabel(action)}</Text>
            {action === 'refund_partial' && (
              <TextInput
                style={styles.input}
                placeholder="Amount in USD (e.g. 12.50)"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="decimal-pad"
                value={amountStr}
                onChangeText={setAmountStr}
                data-testid="admin-partial-amount"
              />
            )}
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
              placeholder={action === 'request_info' ? 'What do you need from the user?' : 'Notes (optional)'}
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              value={notes}
              onChangeText={setNotes}
              data-testid="admin-action-notes"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={closeAction} data-testid="admin-action-cancel">
                <Text style={styles.modalBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.orange, opacity: submitting ? 0.5 : 1 }]}
                onPress={submit}
                disabled={submitting}
                data-testid="admin-action-confirm"
              >
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>CONFIRM</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ActionBtn({ label, color, onPress, testId }: { label: string; color: string; onPress: () => void; testId: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actionBtn, { borderColor: color }]} data-testid={testId}>
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function actionLabel(a: Action) {
  switch (a) {
    case 'refund_partial': return 'PARTIAL REFUND';
    case 'refund_full': return 'FULL REFUND';
    case 'deny': return 'DENY DISPUTE';
    case 'request_info': return 'REQUEST MORE INFO';
    default: return '';
  }
}

function statusColor(s: string) {
  if (s === 'approved_full' || s === 'approved_partial') return COLORS.success;
  if (s === 'denied') return COLORS.error;
  if (s === 'info_requested') return COLORS.orange;
  return COLORS.warning;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.white, letterSpacing: 1 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  filterChipActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  filterText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  filterTextActive: { color: '#FFF' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 80 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  cardReason: { flex: 1, color: COLORS.white, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  cardRole: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  cardDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  cardMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 10 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  actionBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBody: { width: '100%', backgroundColor: '#141929', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  modalTitle: { color: COLORS.white, fontWeight: '900', fontSize: 14, letterSpacing: 1, marginBottom: 14 },
  input: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: COLORS.white, fontSize: 14, marginBottom: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});

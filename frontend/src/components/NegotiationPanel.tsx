/**
 * NegotiationPanel — Propose / Counter / Accept time + location BEFORE payment.
 *
 * Drives the backend negotiation state machine at
 *   /api/sessions/{id}/negotiation/{propose|counter|accept|reject|timeline}
 *
 * Payment unlocks ONLY when negotiationStatus === 'agreed' (paymentReady=true).
 *
 * Props:
 *   sessionId        — string  Mongo ObjectId of the session
 *   currentUserRole  — 'trainee' | 'trainer'
 *   isVirtual        — boolean If true, location is not required.
 *   onAgreed         — () => void  Fired once both parties agree (parent re-fetches & unlocks pay).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { negotiationAPI, NegotiationTimeline } from '../services/api';
import { toast } from '../utils/toast';
import { haptic } from '../utils/haptics';
import { formatApiError } from '../utils/formatApiError';

const C = {
  bg: '#0E121C',
  card: '#141A28',
  border: 'rgba(255,255,255,0.08)',
  orange: '#FF7A00',
  orangeGlow: '#FF9B2F',
  text: '#FFFFFF',
  textMuted: '#7C8295',
  textSec: '#C6CBD9',
  success: '#00D68F',
  error: '#EF4444',
};

interface Props {
  sessionId: string;
  currentUserRole: 'trainee' | 'trainer';
  isVirtual?: boolean;
  onAgreed?: () => void;
  onChange?: (data: NegotiationTimeline) => void;
}

const STATUS_LABEL: Record<string, string> = {
  proposed_by_trainee: 'Trainee proposed',
  proposed_by_trainer: 'Trainer proposed',
  countered_by_trainee: 'Trainee countered',
  countered_by_trainer: 'Trainer countered',
  agreed: 'Agreed — Payment unlocked',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const NegotiationPanel: React.FC<Props> = ({
  sessionId,
  currentUserRole,
  isVirtual = false,
  onAgreed,
  onChange,
}) => {
  const [data, setData] = useState<NegotiationTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form state
  const [editorOpen, setEditorOpen] = useState(false);
  const [mode, setMode] = useState<'propose' | 'counter'>('propose');
  const [proposedTime, setProposedTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  });
  const [address, setAddress] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const load = async () => {
    try {
      const tl = await negotiationAPI.timeline(sessionId);
      setData(tl);
      onChange?.(tl);
      if (tl.negotiationStatus === 'agreed') onAgreed?.();
    } catch (e: any) {
      // Silent: panel just hides until session exists
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const status = data?.negotiationStatus || null;
  const pendingStatuses = useMemo(
    () => new Set([
      'proposed_by_trainee',
      'proposed_by_trainer',
      'countered_by_trainee',
      'countered_by_trainer',
    ]),
    [],
  );

  // Is it MY turn to respond?
  const myTurn = useMemo(() => {
    if (!status) return false; // no proposal — I can propose
    if (!pendingStatuses.has(status)) return false;
    const lastByTrainee = status.endsWith('_by_trainee');
    return currentUserRole === 'trainee' ? !lastByTrainee : lastByTrainee;
  }, [status, currentUserRole, pendingStatuses]);

  // Can I make a fresh proposal? (no proposal yet, or last one was rejected/expired)
  const canPropose = useMemo(() => {
    if (!status) return true;
    return status === 'rejected' || status === 'expired';
  }, [status]);

  const openEditor = (m: 'propose' | 'counter') => {
    setMode(m);
    // Pre-fill from existing proposal when countering
    if (m === 'counter' && data?.proposedTime) {
      setProposedTime(new Date(data.proposedTime));
    }
    if (m === 'counter' && data?.proposedLocation?.address) {
      setAddress(data.proposedLocation.address);
    }
    setEditorOpen(true);
  };

  const submit = async () => {
    if (!isVirtual && !address.trim()) {
      toast.error('Please enter a location for the session.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        proposedTime: proposedTime.toISOString(),
        proposedLocation: isVirtual ? null : { address: address.trim() },
      };
      if (mode === 'propose') {
        await negotiationAPI.propose(sessionId, payload);
      } else {
        await negotiationAPI.counter(sessionId, payload);
      }
      haptic.success();
      toast.success(mode === 'propose' ? 'Proposal sent' : 'Counter sent');
      setEditorOpen(false);
      await load();
    } catch (e: any) {
      haptic.error();
      toast.error(formatApiError(e, 'Could not send proposal'));
    } finally {
      setBusy(false);
    }
  };

  // iter106ah: trainer wants a "one last confirm" modal before locking in the
  // session (since acceptance flips paymentReady=true and the trainee gets
  // charged the next moment). We gate the accept button behind a small modal.
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await negotiationAPI.accept(sessionId);
      haptic.success();
      toast.success('Agreed! The trainee can now pay.');
      setShowAcceptConfirm(false);
      await load();
    } catch (e: any) {
      haptic.error();
      toast.error(formatApiError(e, 'Could not accept'));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await negotiationAPI.reject(sessionId);
      haptic.medium();
      toast.success('Proposal rejected.');
      await load();
    } catch (e: any) {
      toast.error(formatApiError(e, 'Could not reject'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.card, { alignItems: 'center' }]}>
        <ActivityIndicator color={C.orange} />
      </View>
    );
  }

  // If session already paid/agreed and parent doesn't want details, render compact agreed card
  if (status === 'agreed') {
    return (
      <View style={s.card} testID="negotiation-agreed">
        <View style={s.headerRow}>
          <View style={[s.badge, { backgroundColor: 'rgba(0,214,143,0.15)', borderColor: 'rgba(0,214,143,0.5)' }]}>
            <Ionicons name="checkmark-circle" size={14} color={C.success} />
            <Text style={[s.badgeText, { color: C.success }]}>AGREED</Text>
          </View>
          <Text style={s.headerTitle}>Session Locked</Text>
        </View>
        <View style={s.detailRow}>
          <Ionicons name="calendar" size={16} color={C.orangeGlow} />
          <Text style={s.detailText}>
            {data?.agreedTime ? new Date(data.agreedTime).toLocaleString() : '—'}
          </Text>
        </View>
        {!isVirtual && data?.agreedLocation?.address && (
          <View style={s.detailRow}>
            <Ionicons name="location" size={16} color={C.orangeGlow} />
            <Text style={s.detailText}>{data.agreedLocation.address}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.card} testID="negotiation-panel">
      <View style={s.headerRow}>
        <View style={s.badge}>
          <Ionicons name="time-outline" size={14} color={C.orangeGlow} />
          <Text style={s.badgeText}>{status ? STATUS_LABEL[status] || 'NEGOTIATING' : 'NO PROPOSAL'}</Text>
        </View>
        {data?.expiresInMinutes != null && (
          <Text style={s.expiry}>{Math.max(0, data.expiresInMinutes)}m left</Text>
        )}
      </View>

      <Text style={s.title}>
        {status === 'agreed'
          ? 'Both parties agreed — pay to confirm.'
          : myTurn
            ? 'Your turn — respond to the proposal'
            : status
              ? `Waiting on the ${status.endsWith('_by_trainee') ? 'trainer' : 'trainee'}…`
              : 'Propose a time & location to start.'}
      </Text>

      {/* Pending proposal preview */}
      {data?.proposedTime && pendingStatuses.has(status || '') && (
        <View style={s.proposalBox}>
          <Text style={s.label}>CURRENT PROPOSAL</Text>
          <View style={s.detailRow}>
            <Ionicons name="calendar" size={16} color={C.orangeGlow} />
            <Text style={s.detailText}>{new Date(data.proposedTime).toLocaleString()}</Text>
          </View>
          {!isVirtual && data.proposedLocation?.address && (
            <View style={s.detailRow}>
              <Ionicons name="location" size={16} color={C.orangeGlow} />
              <Text style={s.detailText}>{data.proposedLocation.address}</Text>
            </View>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={s.actions}>
        {canPropose && (
          <TouchableOpacity
            style={[s.btn, s.btnPrimary]}
            onPress={() => openEditor('propose')}
            disabled={busy}
            testID="negotiation-propose-btn"
          >
            <Ionicons name="paper-plane" size={16} color="#FFF" />
            <Text style={s.btnPrimaryText}>Propose</Text>
          </TouchableOpacity>
        )}
        {myTurn && (
          <>
            <TouchableOpacity
              style={[s.btn, s.btnSuccess]}
              onPress={() => (currentUserRole === 'trainer' ? setShowAcceptConfirm(true) : accept())}
              disabled={busy}
              testID="negotiation-accept-btn"
            >
              <Ionicons name="checkmark" size={16} color="#FFF" />
              <Text style={s.btnPrimaryText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnOutline]}
              onPress={() => openEditor('counter')}
              disabled={busy}
              testID="negotiation-counter-btn"
            >
              <Ionicons name="swap-horizontal" size={16} color={C.text} />
              <Text style={s.btnOutlineText}>Counter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnGhost]}
              onPress={reject}
              disabled={busy}
              testID="negotiation-reject-btn"
            >
              <Ionicons name="close" size={16} color={C.error} />
              <Text style={[s.btnOutlineText, { color: C.error }]}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Editor modal */}
      <Modal visible={editorOpen} animationType="slide" transparent>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {mode === 'propose' ? 'Propose Session Details' : 'Counter-Proposal'}
              </Text>
              <TouchableOpacity onPress={() => setEditorOpen(false)} testID="negotiation-editor-close">
                <Ionicons name="close" size={24} color={C.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
              <Text style={s.label}>SESSION TIME</Text>
              <View style={s.timeRow}>
                <TouchableOpacity
                  style={s.timeBtn}
                  onPress={() => setShowDatePicker(true)}
                  testID="negotiation-date-btn"
                >
                  <Ionicons name="calendar-outline" size={18} color={C.orangeGlow} />
                  <Text style={s.timeText}>{proposedTime.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.timeBtn}
                  onPress={() => setShowTimePicker(true)}
                  testID="negotiation-time-btn"
                >
                  <Ionicons name="time-outline" size={18} color={C.orangeGlow} />
                  <Text style={s.timeText}>
                    {proposedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={proposedTime}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, d) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (d) {
                      const next = new Date(proposedTime);
                      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      setProposedTime(next);
                    }
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={proposedTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (d) {
                      const next = new Date(proposedTime);
                      next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                      setProposedTime(next);
                    }
                  }}
                />
              )}

              {!isVirtual && (
                <>
                  <Text style={[s.label, { marginTop: 18 }]}>LOCATION</Text>
                  <TextInput
                    style={s.input}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Park, gym, address…"
                    placeholderTextColor={C.textMuted}
                    testID="negotiation-address-input"
                  />
                </>
              )}

              <TouchableOpacity
                style={[s.submitBtn, busy && { opacity: 0.6 }]}
                onPress={submit}
                disabled={busy}
                testID="negotiation-submit-btn"
              >
                {busy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.submitText}>
                    {mode === 'propose' ? 'Send Proposal' : 'Send Counter'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* iter106ah: Trainer one-last-confirm modal before accepting.
          Shows the proposed time/location so the trainer can sanity-check
          before flipping paymentReady=true (which auto-charges the trainee). */}
      <Modal visible={showAcceptConfirm} animationType="fade" transparent onRequestClose={() => setShowAcceptConfirm(false)}>
        <View style={s.modalBg}>
          <View style={[s.modalCard, { maxHeight: undefined }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Accept this session?</Text>
              <TouchableOpacity onPress={() => setShowAcceptConfirm(false)} testID="accept-confirm-close">
                <Ionicons name="close" size={24} color={C.text} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 18, gap: 12 }}>
              <Text style={{ color: C.textSec, fontSize: 14, lineHeight: 20 }}>
                Confirming will lock in this time &amp; location and notify the trainee to pay. You can&apos;t un-accept after this — they&apos;ll be charged on confirm.
              </Text>
              {data?.proposedTime ? (
                <View style={s.proposalBox}>
                  <Text style={s.label}>PROPOSED</Text>
                  <View style={s.detailRow}>
                    <Ionicons name="calendar" size={16} color={C.orangeGlow} />
                    <Text style={s.detailText}>{new Date(data.proposedTime).toLocaleString()}</Text>
                  </View>
                  {!isVirtual && data.proposedLocation?.address ? (
                    <View style={s.detailRow}>
                      <Ionicons name="location" size={16} color={C.orangeGlow} />
                      <Text style={s.detailText}>{data.proposedLocation.address}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <TouchableOpacity
                  style={[s.btn, s.btnOutline, { flex: 1, justifyContent: 'center' }]}
                  onPress={() => setShowAcceptConfirm(false)}
                  disabled={busy}
                  testID="accept-confirm-cancel"
                >
                  <Text style={s.btnOutlineText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.btnSuccess, { flex: 1, justifyContent: 'center' }]}
                  onPress={accept}
                  disabled={busy}
                  testID="accept-confirm-yes"
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Text style={s.btnPrimaryText}>Yes, accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,155,47,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,155,47,0.40)',
  },
  badgeText: { color: C.orangeGlow, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  expiry: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  title: { color: C.text, fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 14 },
  proposalBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: { color: C.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  detailText: { color: C.text, fontSize: 13, fontWeight: '600', flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  btnPrimary: { backgroundColor: C.orange },
  btnSuccess: { backgroundColor: C.success },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnGhost: { backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  btnPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  btnOutlineText: { color: C.text, fontSize: 13, fontWeight: '800' },
  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '900' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  timeText: { color: C.text, fontSize: 14, fontWeight: '700' },
  input: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    color: C.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  submitBtn: {
    backgroundColor: C.orange,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  submitText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
});

export default NegotiationPanel;

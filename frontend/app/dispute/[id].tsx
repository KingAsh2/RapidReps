import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { disputesAPI, DisputeDoc } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { toast } from '../../src/utils/toast';

const COLORS = {
  white: '#FFFFFF',
  orange: '#FF6A00',
  success: '#00D68F',
  warning: '#FFAA00',
  error: '#FF4757',
  gray: 'rgba(255,255,255,0.65)',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: 'OPEN', color: COLORS.warning },
  info_requested: { label: 'INFO REQUESTED', color: COLORS.orange },
  approved_full: { label: 'FULL REFUND ISSUED', color: COLORS.success },
  approved_partial: { label: 'PARTIAL REFUND ISSUED', color: COLORS.success },
  denied: { label: 'DENIED', color: COLORS.error },
  resolved: { label: 'RESOLVED', color: COLORS.gray },
};

export default function DisputeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [dispute, setDispute] = useState<DisputeDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [responseDraft, setResponseDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await disputesAPI.get(id);
      setDispute(d);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Could not load dispute.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const submitResponse = async () => {
    if (!id) return;
    if (responseDraft.trim().length < 5) {
      Alert.alert('Add more detail', 'Please share a complete response.');
      return;
    }
    try {
      setSubmitting(true);
      await disputesAPI.respond(id, responseDraft.trim());
      toast.success('Response sent.');
      setResponseDraft('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not submit response.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <LinearGradient colors={['#0A0E1A', '#0D1117']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={COLORS.white} />
      </View>
    );
  }

  if (!dispute) return null;

  const isOpener = user && String((user as any).id) === dispute.openedBy;
  const meta = STATUS_META[dispute.status] || STATUS_META.open;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#0D1117', '#141929']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="dispute-detail-back">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DISPUTE</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
        >
          <View style={[styles.statusPill, { backgroundColor: meta.color }]}>
            <Text style={styles.statusPillText}>{meta.label}</Text>
          </View>

          <Text style={styles.reasonHeading}>{dispute.reason.replace(/_/g, ' ').toUpperCase()}</Text>
          <Text style={styles.description}>{dispute.description}</Text>

          {!!dispute.adminInfoRequest && (
            <View style={[styles.card, { borderColor: COLORS.orange }]}>
              <Text style={styles.cardLabel}>ADMIN ASKED</Text>
              <Text style={styles.cardBody}>{dispute.adminInfoRequest}</Text>
              {!!dispute.openerResponse && (
                <>
                  <Text style={[styles.cardLabel, { marginTop: 14 }]}>YOUR RESPONSE</Text>
                  <Text style={styles.cardBody}>{dispute.openerResponse}</Text>
                </>
              )}
              {dispute.status === 'info_requested' && isOpener && !dispute.openerResponse && (
                <>
                  <TextInput
                    style={styles.textarea}
                    placeholder="Type your response..."
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    value={responseDraft}
                    onChangeText={setResponseDraft}
                    multiline
                    maxLength={2000}
                    data-testid="dispute-response-input"
                  />
                  <TouchableOpacity
                    style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
                    onPress={submitResponse}
                    disabled={submitting}
                    data-testid="dispute-response-submit"
                  >
                    <LinearGradient colors={['#FF6A00', '#FF3D00']} style={styles.submitGradient}>
                      {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>SEND RESPONSE</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {!!dispute.adminNotes && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ADMIN NOTES</Text>
              <Text style={styles.cardBody}>{dispute.adminNotes}</Text>
            </View>
          )}

          {dispute.refundAmountCents != null && (
            <View style={[styles.card, { borderColor: COLORS.success }]}>
              <Text style={styles.cardLabel}>REFUND AMOUNT</Text>
              <Text style={[styles.cardBody, { fontSize: 22, fontWeight: '900', color: COLORS.success }]}>
                ${(dispute.refundAmountCents / 100).toFixed(2)}
              </Text>
              {!!dispute.stripeRefundId && (
                <Text style={styles.cardMeta}>Stripe ref: {dispute.stripeRefundId}</Text>
              )}
            </View>
          )}

          <Text style={styles.timestamp}>Opened {new Date(dispute.createdAt).toLocaleString()}</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.white, letterSpacing: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, marginBottom: 14 },
  statusPillText: { color: '#000', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  reasonHeading: { color: COLORS.white, fontSize: 22, fontWeight: '900', letterSpacing: 0.5, marginBottom: 10 },
  description: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21, marginBottom: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  cardBody: { color: COLORS.white, fontSize: 14, lineHeight: 21 },
  cardMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 6 },
  textarea: {
    marginTop: 12, minHeight: 90, padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    color: COLORS.white, fontSize: 14, textAlignVertical: 'top',
  },
  submitBtn: { marginTop: 12, borderRadius: 22, overflow: 'hidden' },
  submitGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1.2 },
  timestamp: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginTop: 20 },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { disputesAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';

const COLORS = { white: '#FFFFFF', orange: '#FF6A00', error: '#FF4757', gray: 'rgba(255,255,255,0.6)' };

const REASONS = [
  { key: 'no_show', label: 'Trainer / trainee no-show' },
  { key: 'late', label: 'Significantly late' },
  { key: 'safety', label: 'Safety concern' },
  { key: 'misrepresented', label: 'Service was not as described' },
  { key: 'duplicate_charge', label: 'Duplicate or wrong charge' },
  { key: 'other', label: 'Other' },
];

export default function OpenDisputeScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!sessionId) return;
    if (!reason) {
      Alert.alert('Please choose a reason', 'Tap one of the categories above.');
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert('Tell us more', 'A short explanation (at least 10 characters) helps the admin team resolve this faster.');
      return;
    }
    try {
      setSubmitting(true);
      const r = await disputesAPI.open(sessionId, reason, description.trim());
      toast.success('Dispute opened. Admin team has been notified.');
      router.replace(`/dispute/${r.disputeId}`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Could not open dispute. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#0D1117', '#141929']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="open-dispute-back">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>REPORT AN ISSUE</Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.lead}>
              Tell us what happened. An admin will review within 24 hours and may issue a full or partial refund, deny the claim, or ask for more info.
            </Text>

            <Text style={styles.sectionLabel}>What went wrong?</Text>
            <View style={styles.reasonsWrap}>
              {REASONS.map((r) => {
                const active = reason === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setReason(r.key)}
                    style={[styles.reasonChip, active && styles.reasonChipActive]}
                    data-testid={`dispute-reason-${r.key}`}
                  >
                    <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Describe what happened</Text>
            <TextInput
              style={styles.textarea}
              placeholder="e.g. Trainer never arrived. I waited 25 min and messaged them; no reply."
              placeholderTextColor="rgba(255,255,255,0.55)"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={2000}
              data-testid="dispute-description-input"
            />
            <Text style={styles.charCount}>{description.length} / 2000</Text>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
              onPress={submit}
              disabled={submitting}
              data-testid="dispute-submit-btn"
            >
              <LinearGradient colors={['#FF6A00', '#FF3D00']} style={styles.submitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>SUBMIT REPORT</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  lead: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21, marginBottom: 24 },
  sectionLabel: { color: COLORS.white, fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  reasonsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  reasonChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  reasonChipActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  reasonText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  reasonTextActive: { color: '#FFF', fontWeight: '900' },
  textarea: {
    minHeight: 140, padding: 16, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    color: COLORS.white, fontSize: 14, lineHeight: 21,
    textAlignVertical: 'top',
  },
  charCount: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'right', marginTop: 6 },
  submitBtn: { marginTop: 28, borderRadius: 24, overflow: 'hidden' },
  submitGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },
});

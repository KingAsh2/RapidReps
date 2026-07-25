/**
 * trainer/kyc.tsx — iter106aw.
 *
 * Trainer-facing KYC (identity verification) screen — Option B: trainer
 * uploads a gov-ID photo + optional selfie + their exact legal name, and
 * an admin manually reviews before payouts unlock.
 *
 * Status states rendered:
 *   - not_submitted  → upload form
 *   - submitted      → "Under review" card
 *   - approved       → success card + "Go to earnings"
 *   - rejected       → shows admin notes + re-upload form
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAlert } from '../../src/contexts/AlertContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const api = axios.create({ baseURL: `${API_URL}/api` });

const COLORS = {
  bg: '#0A0E1A', card: '#141929', ink: '#FFFFFF', mute: '#8790A6',
  accent: '#FF6A00', good: '#00C853', bad: '#FF4757', warn: '#FFA502',
};

type KycStatus = 'not_submitted' | 'submitted' | 'approved' | 'rejected';

export default function TrainerKycScreen() {
  const toast = useAlert();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<KycStatus>('not_submitted');
  const [notes, setNotes] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [fullLegalName, setFullLegalName] = useState('');
  const [uploading, setUploading] = useState<'doc' | 'selfie' | null>(null);

  const getHeaders = async () => {
    const t = await AsyncStorage.getItem('auth_token');
    return { Authorization: `Bearer ${t}` };
  };

  const load = async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const r = await api.get('/trainer/kyc/status', { headers });
      setStatus((r.data.status as KycStatus) || 'not_submitted');
      setNotes(r.data.notes || null);
      setDocumentUrl(r.data.documentUrl || null);
      setSelfieUrl(r.data.selfieUrl || null);
      setFullLegalName(r.data.fullLegalName || '');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to load KYC status');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const pickAndUpload = async (kind: 'doc' | 'selfie') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast.error('Photo library permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85, base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(kind);
    try {
      const headers = await getHeaders();
      const r = await api.post('/trainer/upload-verification-file-base64', {
        data: result.assets[0].base64,
        stepId: kind === 'doc' ? 'kyc_document' : 'kyc_selfie',
        filename: `kyc-${kind}.jpg`,
        contentType: 'image/jpeg',
      }, { headers });
      const url = r.data.url;
      if (kind === 'doc') setDocumentUrl(url);
      else setSelfieUrl(url);
      toast.success(kind === 'doc' ? 'ID uploaded' : 'Selfie uploaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Upload failed');
    } finally { setUploading(null); }
  };

  const submit = async () => {
    if (!documentUrl) { toast.error('Please upload your government ID'); return; }
    if (fullLegalName.trim().length < 2) { toast.error('Enter your full legal name as it appears on the ID'); return; }
    setSubmitting(true);
    try {
      const headers = await getHeaders();
      await api.post('/trainer/kyc/submit', {
        documentUrl, selfieUrl, fullLegalName: fullLegalName.trim(),
      }, { headers });
      toast.success('Submitted for review');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </SafeAreaView>
    );
  }

  const showForm = status === 'not_submitted' || status === 'rejected';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="kyc-back-btn">
          <Ionicons name="chevron-back" size={26} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity Verification</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {status === 'submitted' && (
          <View style={[styles.card, { borderColor: COLORS.warn }]} testID="kyc-under-review">
            <Ionicons name="hourglass-outline" size={28} color={COLORS.warn} />
            <Text style={styles.cardTitle}>Under Review</Text>
            <Text style={styles.cardBody}>We received your documents. This usually takes 24–48h. You'll get a push notification when approved.</Text>
          </View>
        )}

        {status === 'approved' && (
          <View style={[styles.card, { borderColor: COLORS.good }]} testID="kyc-approved">
            <Ionicons name="shield-checkmark" size={28} color={COLORS.good} />
            <Text style={styles.cardTitle}>Verified</Text>
            <Text style={styles.cardBody}>You're all set. Payouts are now unlocked.</Text>
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 14 }]} onPress={() => router.push('/trainer/earnings' as any)}>
              <Text style={styles.primaryBtnText}>Go to Earnings</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'rejected' && (
          <View style={[styles.card, { borderColor: COLORS.bad, marginBottom: 20 }]} testID="kyc-rejected">
            <Ionicons name="alert-circle" size={28} color={COLORS.bad} />
            <Text style={styles.cardTitle}>Verification Failed</Text>
            {!!notes && <Text style={styles.cardBody}>Reason from admin: {notes}</Text>}
            <Text style={[styles.cardBody, { marginTop: 6 }]}>Upload new documents below and resubmit.</Text>
          </View>
        )}

        {showForm && (
          <>
            <Text style={styles.sectionTitle}>Government-issued ID</Text>
            <Text style={styles.hint}>Driver's license, passport, or state ID. Photo must be clear and in-focus.</Text>
            <TouchableOpacity style={styles.uploadTile} onPress={() => pickAndUpload('doc')} disabled={uploading !== null} data-testid="kyc-upload-doc">
              {documentUrl ? (
                <Image source={{ uri: documentUrl.startsWith('http') ? documentUrl : `${API_URL}${documentUrl}` }} style={styles.preview} />
              ) : (
                <>
                  <Ionicons name="card-outline" size={30} color={COLORS.mute} />
                  <Text style={styles.uploadLabel}>Tap to upload ID</Text>
                </>
              )}
              {uploading === 'doc' && <ActivityIndicator color={COLORS.accent} style={styles.uploadOverlay} />}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Selfie holding your ID (optional but recommended)</Text>
            <Text style={styles.hint}>Speeds up manual review.</Text>
            <TouchableOpacity style={styles.uploadTile} onPress={() => pickAndUpload('selfie')} disabled={uploading !== null} data-testid="kyc-upload-selfie">
              {selfieUrl ? (
                <Image source={{ uri: selfieUrl.startsWith('http') ? selfieUrl : `${API_URL}${selfieUrl}` }} style={styles.preview} />
              ) : (
                <>
                  <Ionicons name="happy-outline" size={30} color={COLORS.mute} />
                  <Text style={styles.uploadLabel}>Tap to upload selfie</Text>
                </>
              )}
              {uploading === 'selfie' && <ActivityIndicator color={COLORS.accent} style={styles.uploadOverlay} />}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Full legal name (exact match on ID)</Text>
            <TextInput
              value={fullLegalName}
              onChangeText={setFullLegalName}
              placeholder="e.g. Ashton J Bundy"
              placeholderTextColor={COLORS.mute}
              style={styles.input}
              autoCapitalize="words"
              data-testid="kyc-legal-name"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 24, opacity: submitting || !documentUrl ? 0.6 : 1 }]}
              onPress={submit}
              disabled={submitting || !documentUrl}
              data-testid="kyc-submit-btn"
            >
              {submitting
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.primaryBtnText}>{status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  content: { padding: 18, paddingBottom: 60 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, borderWidth: 1, alignItems: 'flex-start', gap: 6 },
  cardTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '700', marginTop: 6 },
  cardBody: { color: COLORS.mute, fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  hint: { color: COLORS.mute, fontSize: 12, marginBottom: 10, lineHeight: 16 },
  uploadTile: {
    height: 160, borderRadius: 14, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...(Platform.OS === 'web' ? {} : {}),
  },
  uploadLabel: { color: COLORS.mute, fontSize: 13, fontWeight: '600', marginTop: 8 },
  uploadOverlay: { position: 'absolute' },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  input: {
    color: COLORS.ink, fontSize: 15, backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
});

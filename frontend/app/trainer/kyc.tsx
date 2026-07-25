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
// iter106ax: Ladder-inspired premium tokens + button.
import { LADDER, LADDER_TYPE } from '../../src/theme/ladder';
import { LadderButton } from '../../src/components/ladder/LadderButton';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const api = axios.create({ baseURL: `${API_URL}/api` });

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
        <ActivityIndicator color={LADDER.accent} size="large" />
      </SafeAreaView>
    );
  }

  const showForm = status === 'not_submitted' || status === 'rejected';

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="kyc-back-btn" hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={LADDER.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity Verification</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* iter106ax: editorial serif hero — the design language's signature. */}
        {showForm && (
          <>
            <Text style={styles.heroLabel}>Step 1 of 1</Text>
            <Text style={styles.hero}>Verify your{"\n"}identity.</Text>
            <Text style={styles.heroSub}>
              We ID-check every trainer before payouts unlock. This usually clears in 24–48 hours.
            </Text>
          </>
        )}

        {status === 'submitted' && (
          <View style={[styles.card, { borderColor: LADDER.warning }]} testID="kyc-under-review">
            <Ionicons name="hourglass-outline" size={28} color={LADDER.warning} />
            <Text style={styles.cardTitle}>Under Review</Text>
            <Text style={styles.cardBody}>We received your documents. This usually takes 24–48h. You'll get a push notification when approved.</Text>
          </View>
        )}

        {status === 'approved' && (
          <View style={[styles.card, { borderColor: LADDER.success }]} testID="kyc-approved">
            <Ionicons name="shield-checkmark" size={28} color={LADDER.success} />
            <Text style={styles.cardTitle}>Verified</Text>
            <Text style={styles.cardBody}>You're all set. Payouts are now unlocked.</Text>
            <LadderButton
              label="Go to Earnings"
              onPress={() => router.push('/trainer/earnings' as any)}
              variant="primary"
              fullWidth
              style={{ marginTop: 16 }}
              testID="kyc-go-earnings"
            />
          </View>
        )}

        {status === 'rejected' && (
          <View style={[styles.card, { borderColor: LADDER.error, marginBottom: 20 }]} testID="kyc-rejected">
            <Ionicons name="alert-circle" size={28} color={LADDER.error} />
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
                  <Ionicons name="card-outline" size={30} color={LADDER.textSecondary} />
                  <Text style={styles.uploadLabel}>Tap to upload ID</Text>
                </>
              )}
              {uploading === 'doc' && <ActivityIndicator color={LADDER.accent} style={styles.uploadOverlay} />}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Selfie holding your ID <Text style={styles.sectionTitleMuted}>· Optional</Text></Text>
            <Text style={styles.hint}>Speeds up manual review.</Text>
            <TouchableOpacity style={styles.uploadTile} onPress={() => pickAndUpload('selfie')} disabled={uploading !== null} data-testid="kyc-upload-selfie">
              {selfieUrl ? (
                <Image source={{ uri: selfieUrl.startsWith('http') ? selfieUrl : `${API_URL}${selfieUrl}` }} style={styles.preview} />
              ) : (
                <>
                  <Ionicons name="happy-outline" size={30} color={LADDER.textSecondary} />
                  <Text style={styles.uploadLabel}>Tap to upload selfie</Text>
                </>
              )}
              {uploading === 'selfie' && <ActivityIndicator color={LADDER.accent} style={styles.uploadOverlay} />}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Full legal name <Text style={styles.sectionTitleMuted}>· Exact match on ID</Text></Text>
            <TextInput
              value={fullLegalName}
              onChangeText={setFullLegalName}
              placeholder="e.g. Ashton J Bundy"
              placeholderTextColor={LADDER.textTertiary}
              style={styles.input}
              autoCapitalize="words"
              data-testid="kyc-legal-name"
            />

            <LadderButton
              label={status === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
              onPress={submit}
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={!documentUrl}
              style={{ marginTop: 28 }}
              testID="kyc-submit-btn"
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LADDER.bgBase },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: LADDER.borderSubtle,
  },
  headerTitle: { ...LADDER_TYPE.label, color: LADDER.textPrimary, letterSpacing: 1.2 },
  content: { padding: 20, paddingBottom: 60 },

  // iter106ax: editorial hero — massive serif on tap-and-go screens.
  heroLabel: { ...LADDER_TYPE.label, marginBottom: 12 },
  hero: { ...LADDER_TYPE.h1, marginBottom: 12 },
  heroSub: { ...LADDER_TYPE.bodyMuted, marginBottom: 32 },

  card: {
    backgroundColor: LADDER.bgCard, borderRadius: 12, padding: 20,
    borderWidth: 1, alignItems: 'flex-start', gap: 6,
  },
  cardTitle: { ...LADDER_TYPE.h3, fontSize: 18, marginTop: 8 },
  cardBody: { ...LADDER_TYPE.bodyMuted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { ...LADDER_TYPE.label, color: LADDER.textPrimary, marginTop: 24, marginBottom: 8 },
  sectionTitleMuted: { color: LADDER.textTertiary, letterSpacing: 1.2 },
  hint: { ...LADDER_TYPE.bodySmall, marginBottom: 12 },
  uploadTile: {
    height: 168, borderRadius: 12, backgroundColor: LADDER.bgCard,
    borderWidth: 1, borderColor: LADDER.borderSubtle, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...(Platform.OS === 'web' ? {} : {}),
  },
  uploadLabel: { ...LADDER_TYPE.bodySmall, color: LADDER.textSecondary, marginTop: 10 },
  uploadOverlay: { position: 'absolute' },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  input: {
    ...LADDER_TYPE.body,
    backgroundColor: LADDER.bgCard,
    borderWidth: 1, borderColor: LADDER.borderSubtle,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14,
  },
});

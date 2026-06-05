import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert, Dimensions, Modal, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/contexts/AuthContext';
import { toast } from '../../src/utils/toast';
import { uploadHighlightChunked } from '../../src/utils/uploadHighlightChunked';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');
const THUMB_SIZE = (width - 52) / 2;

// iter102b: server stores `/api/files/...` paths; RN Image/Video need absolute URLs.
const resolveUrl = (u?: string) => {
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return `${API_URL}${u}`;
};

interface Highlight {
  url: string;
  type: 'video' | 'photo';
  caption?: string;
  createdAt?: string;
  thumbnailUrl?: string;
}

export default function HighlightUpload() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [successVisible, setSuccessVisible] = useState(false);
  const successScale = React.useRef(new Animated.Value(0)).current;

  const showSuccessModal = () => {
    setSuccessVisible(true);
    successScale.setValue(0);
    Animated.spring(successScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    setTimeout(() => setSuccessVisible(false), 1400);
  };

  // XHR-based upload so we can show real-time progress (fetch on RN doesn't expose progress events).
  const uploadWithProgress = (url: string, body: FormData | string, headers: Record<string, string>): Promise<{ ok: boolean; status: number; data: any }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
        }
      };
      xhr.onload = () => {
        let parsed: any = {};
        try { parsed = JSON.parse(xhr.responseText || '{}'); } catch {}
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data: parsed });
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(body as any);
    });
  };

  useEffect(() => {
    if (user?.id) {
      loadHighlights();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const loadHighlights = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/trainer-profiles/${user.id}/highlights`);
      if (!res.ok) {
        setHighlights([]);
        return;
      }
      const data = await res.json();
      setHighlights(data.highlights || []);
    } catch { setHighlights([]); } finally { setLoading(false); }
  };

  const pickAndUpload = async (mediaType: 'video' | 'photo') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      videoMaxDuration: 30,
      base64: mediaType === 'photo' ? true : false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const asset = result.assets[0];
      
      // For photos, try base64 upload first (more reliable on iOS)
      if (mediaType === 'photo' && asset.base64) {
        const res = await uploadWithProgress(
          `${API_URL}/api/trainer-profiles/${user?.id}/highlights/base64`,
          JSON.stringify({
            data: asset.base64,
            filename: 'highlight.jpg',
            contentType: 'image/jpeg',
            caption: '',
          }),
          { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        );
        if (res.ok) {
          showSuccessModal();
          loadHighlights();
          return;
        }
      }
      
      // For large videos, use chunked upload (bypasses 20–30 MB proxy ceilings).
      if (mediaType === 'video' && user?.id) {
        try {
          const ext = asset.uri.split('.').pop() || 'mp4';
          await uploadHighlightChunked({
            userId: user.id,
            uri: asset.uri,
            filename: `highlight.${ext}`,
            contentType: 'video/mp4',
            caption: '',
            onProgress: (pct) => setUploadProgress(pct),
          });
          showSuccessModal();
          loadHighlights();
          return;
        } catch (chunkErr: any) {
          // Fall through to FormData path if chunked init/append failed
          // (legacy small-clip path is still reliable for ≤20 MB files).
          console.warn('[highlight-upload] chunked failed, falling back to FormData:', chunkErr?.message);
        }
      }

      // Fallback to FormData upload (videos use this path directly)
      const formData = new FormData();
      const ext = asset.uri.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
      formData.append('file', { uri: asset.uri, name: `highlight.${ext}`, type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg' } as any);
      formData.append('caption', '');

      const res = await uploadWithProgress(
        `${API_URL}/api/trainer-profiles/${user?.id}/highlights`,
        formData,
        { Authorization: `Bearer ${token}` },
      );
      if (res.ok) {
        showSuccessModal();
        loadHighlights();
      } else {
        toast.error(res.data?.detail || 'Upload failed. Try a smaller file.');
      }
    } catch (err) {
      toast.error('Upload failed. Check your connection and try again.');
    } finally { setUploading(false); setUploadProgress(0); }
  };

  const deleteHighlight = async (index: number) => {
    Alert.alert('Delete Highlight', 'Remove this highlight?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await fetch(`${API_URL}/api/trainer-profiles/${user?.id}/highlights/${index}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Removed');
            loadHighlights();
          } catch { toast.error('Failed to delete'); }
        }
      },
    ]);
  };

  const renderHighlight = ({ item, index }: { item: Highlight; index: number }) => (
    <View style={s.highlightCard}>
      {item.type === 'video' ? (
        item.thumbnailUrl ? (
          // iter96b: poster image instead of mounting a Video for each grid tile
          <Image source={{ uri: resolveUrl(item.thumbnailUrl) }} style={s.highlightMedia} />
        ) : (
          <Video source={{ uri: resolveUrl(item.url) }} style={s.highlightMedia} resizeMode={ResizeMode.COVER} shouldPlay={false} isMuted />
        )
      ) : (
        <Image source={{ uri: resolveUrl(item.url) }} style={s.highlightMedia} />
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={s.highlightOverlay}>
        {item.type === 'video' && (
          <View style={s.videoBadge}>
            <Ionicons name="play" size={10} color="#FFF" />
          </View>
        )}
      </LinearGradient>
      <TouchableOpacity style={s.deleteBtn} onPress={() => deleteHighlight(index)} data-testid={`delete-highlight-${index}`}>
        <Ionicons name="close-circle" size={24} color="rgba(255,71,87,0.9)" />
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient colors={['#0A0E1A', '#141929']} style={s.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Highlight Reel</Text>
            <Text style={s.headerSub}>Showcase your training style</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Upload Buttons */}
        <View style={s.uploadRow}>
          <TouchableOpacity style={s.uploadBtn} onPress={() => pickAndUpload('video')} disabled={uploading} data-testid="upload-video-btn">
            <LinearGradient colors={['#FF6A00', '#FF3D00']} style={s.uploadBtnGradient}>
              {uploading ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={s.uploadBtnText}>{uploadProgress > 0 ? `${uploadProgress}%` : 'UPLOADING…'}</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="videocam" size={20} color="#FFF" />
                  <Text style={s.uploadBtnText}>ADD VIDEO</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.uploadBtn} onPress={() => pickAndUpload('photo')} disabled={uploading} data-testid="upload-photo-btn">
            <View style={s.uploadBtnOutline}>
              <Ionicons name="images" size={20} color="#FF6A00" />
              <Text style={[s.uploadBtnText, { color: '#FF6A00' }]}>ADD PHOTO</Text>
            </View>
          </TouchableOpacity>
        </View>

        {uploading && uploadProgress > 0 && (
          <View style={s.progressBarTrack} data-testid="upload-progress-bar">
            <View style={[s.progressBarFill, { width: `${uploadProgress}%` }]} />
          </View>
        )}

        <Text style={s.tipText}>Upload short clips (under 30s) and photos that showcase your coaching energy</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#FF6A00" style={{ marginTop: 40 }} />
        ) : highlights.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="film-outline" size={56} color="rgba(255,255,255,0.12)" />
            <Text style={s.emptyTitle}>No highlights yet</Text>
            <Text style={s.emptyText}>Upload your first clip to start building your reel</Text>
          </View>
        ) : (
          <FlatList
            data={highlights}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderHighlight}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
          />
        )}
      </SafeAreaView>

      {/* Upload success modal (iter84 #6) — replaces toast with celebratory checkmark */}
      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}>
        <View style={s.successOverlay} data-testid="highlight-upload-success-modal">
          <Animated.View style={[s.successCard, { transform: [{ scale: successScale }] }]}>
            <LinearGradient colors={['#00C853', '#00E676']} style={s.successCheckCircle}>
              <Ionicons name="checkmark" size={48} color="#FFF" />
            </LinearGradient>
            <Text style={s.successTitle}>Uploaded!</Text>
            <Text style={s.successSub}>Your highlight is live on your profile</Text>
          </Animated.View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  headerSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  uploadRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  uploadBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  uploadBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  uploadBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, borderWidth: 1.5, borderColor: 'rgba(255,106,0,0.3)', borderRadius: 14 },
  uploadBtnText: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 0.8 },
  tipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingHorizontal: 40, marginBottom: 20 },
  highlightCard: { width: THUMB_SIZE, height: THUMB_SIZE * 1.3, borderRadius: 16, overflow: 'hidden', backgroundColor: '#141929' },
  highlightMedia: { width: '100%', height: '100%' },
  highlightOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 10 },
  videoBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,106,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { position: 'absolute', top: 6, right: 6, zIndex: 10 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  emptyText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textAlign: 'center', maxWidth: 260 },
  progressBarTrack: { height: 4, marginHorizontal: 20, marginTop: 4, marginBottom: 8, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FF6A00', borderRadius: 2 },
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,14,26,0.85)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  successCard: { backgroundColor: '#141929', borderRadius: 24, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(0,200,83,0.3)' },
  successCheckCircle: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 4, shadowColor: '#00C853', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  successTitle: { fontSize: 24, fontFamily: 'Oswald_700Bold', color: '#FFF', letterSpacing: 1 },
  successSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});

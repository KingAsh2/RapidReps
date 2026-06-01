import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/contexts/AuthContext';
import { toast } from '../../src/utils/toast';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');
const THUMB_SIZE = (width - 52) / 2;

interface Highlight {
  url: string;
  type: 'video' | 'photo';
  caption?: string;
  createdAt?: string;
}

export default function TraineeHighlightUpload() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
      const res = await fetch(`${API_URL}/api/trainee-profiles/${user.id}/highlights`);
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
    try {
      const asset = result.assets[0];

      if (mediaType === 'photo' && asset.base64) {
        const res = await fetch(`${API_URL}/api/trainee-profiles/${user?.id}/highlights/base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            data: asset.base64,
            filename: 'highlight.jpg',
            contentType: 'image/jpeg',
            caption: '',
          }),
        });
        if (res.ok) {
          toast.success('Highlight uploaded!');
          loadHighlights();
          return;
        }
      }

      const formData = new FormData();
      const ext = asset.uri.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg');
      formData.append('file', { uri: asset.uri, name: `highlight.${ext}`, type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg' } as any);
      formData.append('caption', '');

      const res = await fetch(`${API_URL}/api/trainee-profiles/${user?.id}/highlights`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        toast.success('Highlight uploaded!');
        loadHighlights();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.detail || 'Upload failed. Try a smaller file.');
      }
    } catch (err) {
      toast.error('Upload failed. Check your connection and try again.');
    } finally { setUploading(false); }
  };

  const deleteHighlight = async (index: number) => {
    Alert.alert('Delete Highlight', 'Remove this highlight?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await fetch(`${API_URL}/api/trainee-profiles/${user?.id}/highlights/${index}`, {
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
        <Video source={{ uri: item.url }} style={s.highlightMedia} resizeMode={ResizeMode.COVER} shouldPlay={false} isMuted />
      ) : (
        <Image source={{ uri: item.url }} style={s.highlightMedia} />
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={s.highlightOverlay}>
        {item.type === 'video' && (
          <View style={s.videoBadge}>
            <Ionicons name="play" size={10} color="#FFF" />
          </View>
        )}
      </LinearGradient>
      <TouchableOpacity style={s.deleteBtn} onPress={() => deleteHighlight(index)} data-testid={`trainee-delete-highlight-${index}`} accessibilityLabel="Delete highlight" accessibilityRole="button">
        <Ionicons name="close-circle" size={24} color="rgba(255,71,87,0.9)" />
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient colors={['#0A0E1A', '#141929']} style={s.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Back" accessibilityRole="button" data-testid="trainee-highlight-back">
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Highlight Reel</Text>
            <Text style={s.headerSub}>Showcase your fitness journey</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={s.uploadRow}>
          <TouchableOpacity style={s.uploadBtn} onPress={() => pickAndUpload('video')} disabled={uploading} data-testid="trainee-upload-video-btn" accessibilityLabel="Upload a video highlight" accessibilityRole="button">
            <LinearGradient colors={['#FF6A00', '#FF3D00']} style={s.uploadBtnGradient}>
              {uploading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="videocam" size={20} color="#FFF" />
                  <Text style={s.uploadBtnText}>ADD VIDEO</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.uploadBtn} onPress={() => pickAndUpload('photo')} disabled={uploading} data-testid="trainee-upload-photo-btn" accessibilityLabel="Upload a photo highlight" accessibilityRole="button">
            <View style={s.uploadBtnOutline}>
              <Ionicons name="images" size={20} color="#FF6A00" />
              <Text style={[s.uploadBtnText, { color: '#FF6A00' }]}>ADD PHOTO</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={s.tipText}>Upload short clips (under 30s) and photos that show off your progress and energy</Text>

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
});

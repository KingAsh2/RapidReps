import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  Dimensions,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { toast } from '../utils/toast';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_W } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_W - 64) / 3;

const COLORS = {
  orange: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8a95b0',
  red: '#FF4757',
};

interface GalleryItem {
  url: string;
  type: 'photo' | 'video';
  caption?: string;
  storagePath?: string;
}

interface Props {
  gallery: GalleryItem[];
  editable?: boolean;
  onGalleryUpdated?: (gallery: GalleryItem[]) => void;
}

export const ProfileGallery = ({ gallery, editable = false, onGalleryUpdated }: Props) => {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [uploading, setUploading] = useState(false);

  if (gallery.length === 0 && !editable) return null;

  const resolveUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
  };

  const pickMedia = async (type: 'photo' | 'video') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'photo' ? ['images'] : ['videos'],
      allowsEditing: type === 'photo',
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFile(result.assets[0]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFile(result.assets[0]);
  };

  const uploadFile = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const uri = asset.uri;
      const filename = uri.split('/').pop() || 'file.jpg';
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = asset.type === 'video' ? `video/${ext === 'mov' ? 'quicktime' : ext}` : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mimeType } as any);

      const res = await axios.post(`${API_URL}/api/gallery/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000,
      });

      if (res.data.success) {
        toast.success(res.data.mediaType === 'video' ? 'Video uploaded!' : 'Photo uploaded!');
        onGalleryUpdated?.([...gallery, res.data.item]);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const deleteItem = async (index: number) => {
    Alert.alert('Delete', 'Remove this from your gallery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('auth_token');
            const res = await axios.delete(`${API_URL}/api/gallery/${index}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
              toast.success('Removed');
              onGalleryUpdated?.(res.data.gallery);
              setViewerVisible(false);
            }
          } catch {
            toast.error('Failed to delete');
          }
        },
      },
    ]);
  };

  const showAddMenu = () => {
    Alert.alert('Add to Gallery', 'Choose a source', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Photo from Library', onPress: () => pickMedia('photo') },
      { text: 'Video from Library', onPress: () => pickMedia('video') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="images" size={18} color={COLORS.orange} />
        <Text style={styles.title}>Gallery</Text>
        <Text style={styles.count}>{gallery.length}</Text>
        {editable && (
          <TouchableOpacity onPress={showAddMenu} style={styles.addBtn} disabled={uploading} data-testid="gallery-add-btn">
            {uploading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="add" size={18} color={COLORS.white} />}
          </TouchableOpacity>
        )}
      </View>

      {gallery.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="camera-outline" size={28} color={COLORS.gray} />
          <Text style={styles.emptyText}>
            {editable ? 'Tap + to add photos or videos' : 'No photos or videos yet'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {gallery.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.thumb}
              onPress={() => { setSelectedIdx(idx); setViewerVisible(true); }}
              data-testid={`gallery-thumb-${idx}`}
            >
              <Image source={{ uri: resolveUrl(item.url) }} style={styles.thumbImg} />
              {item.type === 'video' && (
                <View style={styles.playOverlay}>
                  <Ionicons name="play" size={24} color={COLORS.white} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={viewerVisible} transparent animationType="fade">
        <View style={styles.viewer}>
          <View style={styles.viewerTopBar}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)} data-testid="gallery-viewer-close">
              <Ionicons name="close" size={28} color={COLORS.white} />
            </TouchableOpacity>
            {editable && (
              <TouchableOpacity style={styles.viewerDelete} onPress={() => deleteItem(selectedIdx)} data-testid="gallery-viewer-delete">
                <Ionicons name="trash" size={22} color={COLORS.red} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={gallery}
            horizontal
            pagingEnabled
            initialScrollIndex={selectedIdx}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            onMomentumScrollEnd={(e) => setSelectedIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            keyExtractor={(_, i) => String(i)}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: resolveUrl(item.url) }} style={styles.viewerImage} resizeMode="contain" />
                {item.caption ? <Text style={styles.viewerCaption}>{item.caption}</Text> : null}
              </View>
            )}
          />
          <Text style={styles.viewerCounter}>{selectedIdx + 1} / {gallery.length}</Text>
        </View>
      </Modal>
    </View>
  );
};

const SOCIAL_PLATFORMS = [
  { key: 'instagram', icon: 'logo-instagram', color: '#E1306C', prefix: 'https://instagram.com/' },
  { key: 'tiktok', icon: 'logo-tiktok', color: '#000000', prefix: 'https://tiktok.com/@' },
  { key: 'youtube', icon: 'logo-youtube', color: '#FF0000', prefix: 'https://youtube.com/@' },
  { key: 'twitter', icon: 'logo-twitter', color: '#1DA1F2', prefix: 'https://x.com/' },
  { key: 'website', icon: 'globe-outline', color: COLORS.navy, prefix: '' },
];

interface SocialLinksProps {
  socialLinks: Record<string, string>;
}

export const SocialLinksDisplay = ({ socialLinks }: SocialLinksProps) => {
  if (!socialLinks || Object.values(socialLinks).every(v => !v)) return null;

  const openLink = (url: string) => {
    const full = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(full).catch(() => {});
  };

  return (
    <View style={styles.socialContainer}>
      <View style={styles.header}>
        <Ionicons name="link" size={18} color={COLORS.orange} />
        <Text style={styles.title}>Social</Text>
      </View>
      <View style={styles.socialRow}>
        {SOCIAL_PLATFORMS.map(p => {
          const value = socialLinks[p.key];
          if (!value) return null;
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.socialBtn, { backgroundColor: `${p.color}15` }]}
              onPress={() => openLink(value.startsWith('http') ? value : `${p.prefix}${value}`)}
              data-testid={`social-${p.key}`}
            >
              <Ionicons name={p.icon as any} size={20} color={p.color} />
              <Text style={[styles.socialLabel, { color: p.color }]} numberOfLines={1}>
                {p.key === 'website' ? 'Website' : `@${value.replace(/^@/, '')}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingHorizontal: 4 },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.white, flex: 1 },
  count: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.orange, justifyContent: 'center', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  thumbImg: { width: '100%', height: '100%' },
  playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: COLORS.gray },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  viewerTopBar: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
  viewerClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  viewerDelete: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,71,87,0.2)', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: SCREEN_W - 32, height: SCREEN_W - 32 },
  viewerCaption: { color: COLORS.white, fontSize: 14, marginTop: 12, textAlign: 'center', paddingHorizontal: 20 },
  viewerCounter: { position: 'absolute', bottom: 50, alignSelf: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  socialContainer: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  socialLabel: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
});

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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_W - 64) / 3;

const COLORS = {
  orange: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8a95b0',
  grayLight: '#F5F6F8',
};

interface GalleryItem {
  url: string;
  type: 'photo' | 'video';
  caption?: string;
}

interface Props {
  gallery: GalleryItem[];
  editable?: boolean;
  onAdd?: () => void;
}

export const ProfileGallery = ({ gallery, editable = false, onAdd }: Props) => {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (gallery.length === 0 && !editable) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="images" size={18} color={COLORS.orange} />
        <Text style={styles.title}>Gallery</Text>
        <Text style={styles.count}>{gallery.length}</Text>
        {editable && onAdd && (
          <TouchableOpacity onPress={onAdd} style={styles.addBtn} data-testid="gallery-add-btn">
            <Ionicons name="add" size={18} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>

      {gallery.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="camera-outline" size={28} color={COLORS.gray} />
          <Text style={styles.emptyText}>No photos or videos yet</Text>
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
              <Image source={{ uri: item.url }} style={styles.thumbImg} />
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
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)} data-testid="gallery-viewer-close">
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <FlatList
            data={gallery}
            horizontal
            pagingEnabled
            initialScrollIndex={selectedIdx}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            keyExtractor={(_, i) => String(i)}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_W, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: item.url }} style={styles.viewerImage} resizeMode="contain" />
                {item.caption ? <Text style={styles.viewerCaption}>{item.caption}</Text> : null}
              </View>
            )}
          />
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
  viewerClose: { position: 'absolute', top: 60, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: SCREEN_W - 32, height: SCREEN_W - 32 },
  viewerCaption: { color: COLORS.white, fontSize: 14, marginTop: 12, textAlign: 'center', paddingHorizontal: 20 },
  socialContainer: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  socialLabel: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
});

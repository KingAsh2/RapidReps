/**
 * InstagramSection — Profile widget that displays a user's curated IG media in a 4-col grid.
 * - Pass `targetUserId` to view ANOTHER user's curated media (public view).
 * - Omit `targetUserId` to show OWN linked status with "Link / Manage / Refresh" controls.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator,
  Linking, Alert, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { instagramAPI, IgMediaItem } from '../services/api';
import { toast } from '../utils/toast';
import { haptic } from '../utils/haptics';

interface Props {
  targetUserId?: string; // public view if provided
}

export const InstagramSection: React.FC<Props> = ({ targetUserId }) => {
  const router = useRouter();
  const isPublicView = !!targetUserId;

  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [items, setItems] = useState<IgMediaItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isPublicView) {
        const r = await instagramAPI.getPublicMedia(targetUserId!);
        setLinked(r.linked);
        setUsername(r.username || null);
        setItems(r.items);
      } else {
        const s = await instagramAPI.status();
        setLinked(s.linked);
        setUsername(s.username || null);
        if (s.linked) {
          const m = await instagramAPI.getMedia();
          // Only show the selected (curated) items on the profile view
          setItems(m.items.filter((it) => it.isSelected));
        } else {
          setItems([]);
        }
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isPublicView, targetUserId]);

  useEffect(() => { load(); }, [load]);

  // ── Own-view: Link / Refresh / Manage / Unlink ──
  const handleLink = async () => {
    setLinking(true);
    try {
      const { authorization_url } = await instagramAPI.oauthStart();
      const result = await WebBrowser.openAuthSessionAsync(
        authorization_url,
        'rapidreps://instagram-callback',
      );
      if (result.type === 'success' && result.url) {
        // Parse code+state from the redirect URL
        const url = new URL(result.url.replace('rapidreps://', 'https://placeholder/'));
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (code && state) {
          try {
            const cb = await instagramAPI.oauthCallback(code, state);
            haptic.success();
            toast.success(`@${cb.username} linked! Pick which posts to show on your profile.`);
            router.push('/instagram/curator');
            load();
          } catch (err: any) {
            const detail = err?.response?.data?.detail;
            if (detail && typeof detail === 'object' && detail.code === 'PERSONAL_ACCOUNT_NOT_SUPPORTED') {
              router.push('/instagram/personal-account-help');
            } else {
              toast.error(typeof detail === 'string' ? detail : 'Failed to link Instagram');
            }
          }
        }
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail;
      if (typeof msg === 'string' && msg.includes('not yet configured')) {
        toast.info('Instagram linking will be available once setup is complete');
      } else {
        toast.error('Could not open Instagram');
      }
    } finally {
      setLinking(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const r = await instagramAPI.refresh();
      haptic.success();
      toast.success('Instagram refreshed');
      setItems(r.items.filter((i) => i.isSelected));
    } catch {
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      'Unlink Instagram?',
      'Your IG posts will no longer appear on your profile. You can re-link anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await instagramAPI.unlink();
              toast.success('Instagram unlinked');
              setLinked(false);
              setItems([]);
            } catch {
              toast.error('Unlink failed');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#FF7F00" />
      </View>
    );
  }

  // ── Public view: not linked → render nothing ──
  if (isPublicView && !linked) return null;
  // ── Public view: linked but no curated items → render nothing ──
  if (isPublicView && items.length === 0) return null;

  return (
    <View style={styles.card} data-testid="instagram-section">
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={['#833ab4', '#fd1d1d', '#fcb045']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.igIconBubble}
          >
            <Ionicons name="logo-instagram" size={18} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <Text style={styles.title}>Instagram</Text>
            {username && <Text style={styles.handle}>@{username}</Text>}
          </View>
        </View>

        {!isPublicView && linked && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleRefresh}
              disabled={refreshing}
              data-testid="ig-refresh-btn"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#FF7F00" />
              ) : (
                <Ionicons name="refresh" size={16} color="#FF7F00" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/instagram/curator')}
              data-testid="ig-curate-btn"
            >
              <Ionicons name="grid" size={16} color="#FF7F00" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleUnlink}
              data-testid="ig-unlink-btn"
             accessibilityLabel="Unlink Instagram account" accessibilityRole="button">
              <Ionicons name="unlink" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Body */}
      {!linked && !isPublicView ? (
        <TouchableOpacity
          style={styles.linkCta}
          onPress={handleLink}
          disabled={linking}
          data-testid="ig-link-btn"
        >
          <LinearGradient
            colors={['#833ab4', '#fd1d1d', '#fcb045']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.linkCtaInner}
          >
            {linking ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="logo-instagram" size={18} color="#FFFFFF" />
                <Text style={styles.linkCtaText}>Link Instagram</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : items.length === 0 && !isPublicView ? (
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={() => router.push('/instagram/curator')}
        >
          <Text style={styles.emptyText}>
            Pick which posts to show on your profile →
          </Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={items}
          numColumns={4}
          scrollEnabled={false}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ gap: 4 }}
          columnWrapperStyle={{ gap: 4 }}
          renderItem={({ item }) => {
            const isVideoOrReel =
              item.media_type === 'VIDEO' ||
              item.media_product_type === 'REELS' ||
              item.media_type === 'CAROUSEL_ALBUM';
            const uri = item.thumbnail_url || item.media_url;
            return (
              <TouchableOpacity
                style={styles.tile}
                onPress={() => item.permalink && Linking.openURL(item.permalink)}
              >
                {uri && (
                  <Image source={{ uri }} style={styles.tileImg} resizeMode="cover" />
                )}
                {isVideoOrReel && (
                  <View style={styles.playOverlay}>
                    <Ionicons
                      name={item.media_product_type === 'REELS' ? 'film' : 'play'}
                      size={14}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  igIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  handle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,127,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,127,0,0.18)',
  },
  linkCta: { borderRadius: 12, overflow: 'hidden' },
  linkCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  linkCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  emptyCta: {
    backgroundColor: 'rgba(255,127,0,0.08)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  emptyText: { color: '#FF7F00', fontSize: 13, fontWeight: '700' },
  tile: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tileImg: { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InstagramSection;

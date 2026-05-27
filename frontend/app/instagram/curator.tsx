/**
 * Instagram Media Curator — user multi-selects which of their 8 most recent
 * IG posts/reels show publicly on their profile.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import { instagramAPI, IgMediaItem } from '../../src/services/api';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';

export default function InstagramCuratorScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<IgMediaItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const r = await instagramAPI.getMedia();
      setItems(r.items);
      setSelected(new Set(r.items.filter((i) => i.isSelected).map((i) => i.id)));
    } catch {
      toast.error('Could not load Instagram media');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => {
    haptic.selection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await instagramAPI.curate(Array.from(selected));
      haptic.success();
      toast.success(`${r.selectedCount} post${r.selectedCount === 1 ? '' : 's'} will show on your profile`);
      router.back();
    } catch {
      toast.error('Could not save selection');
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const r = await instagramAPI.refresh();
      setItems(r.items);
      setSelected(new Set(r.items.filter((i) => i.isSelected).map((i) => i.id)));
      haptic.success();
      toast.success('Pulled your latest 8 posts from Instagram');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pick what shows</Text>
          <Text style={styles.subtitle}>Tap to toggle each post on or off</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing} style={styles.headerBtn}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#FF7F00" />
          ) : (
            <Ionicons name="refresh" size={20} color="#FF7F00" />
          )}
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF7F00" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="logo-instagram" size={40} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>No recent Instagram posts found</Text>
          <TouchableOpacity onPress={onRefresh} style={{ marginTop: 16 }}>
            <Text style={{ color: '#FF7F00', fontWeight: '700' }}>Try refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <Text style={styles.counter}>
            {selected.size} of {items.length} selected
          </Text>
          <View style={styles.grid}>
            {items.map((m) => {
              const isVideoOrReel =
                m.media_type === 'VIDEO' ||
                m.media_product_type === 'REELS' ||
                m.media_type === 'CAROUSEL_ALBUM';
              const uri = m.thumbnail_url || m.media_url;
              const isOn = selected.has(m.id);
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.tile, isOn && styles.tileSelected]}
                  onPress={() => toggle(m.id)}
                  activeOpacity={0.85}
                  data-testid={`ig-curator-tile-${m.id}`}
                >
                  {uri && (
                    <Image
                      source={{ uri }}
                      style={[styles.tileImg, !isOn && { opacity: 0.35 }]}
                      resizeMode="cover"
                    />
                  )}
                  {isVideoOrReel && (
                    <View style={styles.playOverlay}>
                      <Ionicons
                        name={m.media_product_type === 'REELS' ? 'film' : 'play'}
                        size={16}
                        color="#FFFFFF"
                      />
                    </View>
                  )}
                  <View style={styles.checkbox}>
                    {isOn ? (
                      <View style={styles.checkOn}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.checkOff} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Save bar */}
      {!loading && items.length > 0 && (
        <View style={styles.saveBar}>
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={styles.saveBtnWrap}
            data-testid="ig-curator-save-btn"
          >
            <LinearGradient
              colors={['#833ab4', '#fd1d1d', '#fcb045']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.saveText}>
                    Save ({selected.size} {selected.size === 1 ? 'post' : 'posts'})
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0E1A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginTop: 12 },
  scrollBody: { padding: 16, paddingBottom: 100 },
  counter: {
    color: '#FF7F00',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '31.5%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: { borderColor: '#FF7F00' },
  tileImg: { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  checkOn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF7F00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOff: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(10,14,26,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  saveBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
});

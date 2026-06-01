import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useAuth } from '../../src/contexts/AuthContext';
import { traineeAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface Track {
  trackId: string;
  trackName: string;
  artistName: string;
  artworkUrl: string;
  previewUrl: string;
  trackViewUrl: string;
  collectionName: string;
}

export default function TraineeVibeSetup() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentVibe, setCurrentVibe] = useState<Track | null>(null);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCurrentVibe();
    return () => { cleanupAudio(); };
  }, []);

  const loadCurrentVibe = async () => {
    try {
      const profile = await traineeAPI.getProfile(user?.id as string);
      if (profile?.vibeTrackTitle) {
        setCurrentVibe({
          trackId: profile.vibeTrackId || '',
          trackName: profile.vibeTrackTitle,
          artistName: profile.vibeArtistName || '',
          artworkUrl: profile.vibeArtworkUrl || '',
          previewUrl: profile.vibePreviewUrl || '',
          trackViewUrl: profile.vibeAppleMusicUrl || '',
          collectionName: '',
        });
      }
    } catch { /* no current vibe */ }
  };

  const cleanupAudio = async () => {
    if (previewSound) {
      try { await previewSound.stopAsync(); await previewSound.unloadAsync(); } catch { }
    }
  };

  const searchTracks = useCallback(async () => {
    if (query.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/api/music/search?q=${encodeURIComponent(query)}&limit=15`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      toast.error('Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const previewTrack = async (track: Track) => {
    await cleanupAudio();
    if (playingId === track.trackId) {
      setPlayingId(null);
      return;
    }
    if (!track.previewUrl) { toast.info('No preview available'); return; }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        { shouldPlay: true, volume: 0.7 },
        (status) => {
          if (status.isLoaded && status.didJustFinish) setPlayingId(null);
        }
      );
      setPreviewSound(sound);
      setPlayingId(track.trackId);
    } catch { toast.error('Could not play preview'); }
  };

  const selectTrack = async (track: Track) => {
    await cleanupAudio();
    setPlayingId(null);
    if (!user?.id || !token) {
      toast.error('Please log in to save your vibe');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/trainee-profiles/${user.id}/vibe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vibeTrackTitle: track.trackName,
          vibeArtistName: track.artistName,
          vibeArtworkUrl: track.artworkUrl,
          vibePreviewUrl: track.previewUrl,
          vibeAppleMusicUrl: track.trackViewUrl,
          vibeTrackId: track.trackId,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to save');
      }
      setCurrentVibe(track);
      toast.success('Vibe saved!');
    } catch (err: any) { toast.error(err.message || 'Failed to save vibe'); } finally { setSaving(false); }
  };

  const removeVibe = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/trainee-profiles/${user?.id}/vibe`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentVibe(null);
      toast.success('Vibe removed');
    } catch { toast.error('Failed to remove vibe'); } finally { setSaving(false); }
  };

  const renderTrack = ({ item }: { item: Track }) => {
    const isPlaying = playingId === item.trackId;
    const isSelected = currentVibe?.trackId === item.trackId;
    return (
      <TouchableOpacity
        style={[s.trackRow, isSelected && s.trackRowSelected]}
        onPress={() => previewTrack(item)}
        activeOpacity={0.7}
        data-testid={`trainee-track-${item.trackId}`}
      >
        {item.artworkUrl ? (
          <Image source={{ uri: item.artworkUrl }} style={s.trackArt} />
        ) : (
          <View style={[s.trackArt, s.trackArtPlaceholder]}>
            <Ionicons name="musical-notes" size={18} color="#FF6A00" />
          </View>
        )}
        <View style={s.trackInfo}>
          <Text style={s.trackName} numberOfLines={1}>{item.trackName}</Text>
          <Text style={s.trackArtist} numberOfLines={1}>{item.artistName}</Text>
        </View>
        {isPlaying && (
          <View style={s.playingIndicator}>
            <View style={[s.bar, { height: 10 }]} />
            <View style={[s.bar, { height: 16 }]} />
            <View style={[s.bar, { height: 8 }]} />
          </View>
        )}
        <TouchableOpacity
          style={[s.selectBtn, isSelected && s.selectBtnActive]}
          onPress={() => selectTrack(item)}
          data-testid={`trainee-select-track-${item.trackId}`}
        >
          <Ionicons name={isSelected ? 'checkmark' : 'add'} size={18} color={isSelected ? '#FFF' : '#FF6A00'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#0A0E1A', '#141929']} style={s.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Back" accessibilityRole="button" data-testid="trainee-vibe-back">
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Your Vibe</Text>
            <Text style={s.headerSub}>Choose your profile anthem</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {currentVibe && (
          <View style={s.currentVibe} data-testid="trainee-current-vibe-card">
            <LinearGradient colors={['rgba(255,106,0,0.12)', 'rgba(20,25,41,0.95)']} style={s.currentVibeGradient}>
              <Text style={s.currentVibeLabel}>YOUR VIBE</Text>
              <View style={s.currentVibeRow}>
                {currentVibe.artworkUrl ? (
                  <Image source={{ uri: currentVibe.artworkUrl }} style={s.currentVibeArt} />
                ) : (
                  <View style={[s.currentVibeArt, { backgroundColor: 'rgba(255,106,0,0.15)', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="musical-notes" size={24} color="#FF6A00" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.currentVibeTitle} numberOfLines={1}>{currentVibe.trackName}</Text>
                  <Text style={s.currentVibeArtist} numberOfLines={1}>{currentVibe.artistName}</Text>
                </View>
                <TouchableOpacity onPress={removeVibe} style={s.removeBtn} data-testid="trainee-remove-vibe-btn" accessibilityLabel="Remove music selection" accessibilityRole="button">
                  <Ionicons name="close-circle" size={24} color="rgba(255,71,87,0.7)" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={s.searchRow}>
          <View style={s.searchInput}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={s.searchText}
              placeholder="Search songs..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={searchTracks}
              returnKeyType="search"
              data-testid="trainee-vibe-search-input"
            />
          </View>
          <TouchableOpacity onPress={searchTracks} style={s.searchBtn} data-testid="trainee-vibe-search-btn">
            <LinearGradient colors={['#FF6A00', '#FF3D00']} style={s.searchBtnGradient}>
              {searching ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="search" size={20} color="#FFF" />}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.trackId}
          renderItem={renderTrack}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            !searching ? (
              <View style={s.emptyState}>
                <Ionicons name="musical-notes-outline" size={48} color="rgba(255,255,255,0.15)" />
                <Text style={s.emptyText}>Search for a song to set as your profile anthem</Text>
              </View>
            ) : null
          }
        />

        {saving && (
          <View style={s.savingOverlay}>
            <ActivityIndicator size="large" color="#FF6A00" />
          </View>
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
  currentVibe: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,106,0,0.15)' },
  currentVibeGradient: { padding: 16 },
  currentVibeLabel: { fontSize: 10, fontWeight: '900', color: '#FF6A00', letterSpacing: 1.5, marginBottom: 10 },
  currentVibeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currentVibeArt: { width: 56, height: 56, borderRadius: 12 },
  currentVibeTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  currentVibeArtist: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  removeBtn: { padding: 6 },
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  searchInput: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchText: { flex: 1, fontSize: 15, color: '#FFF', paddingVertical: 12 },
  searchBtn: { borderRadius: 14, overflow: 'hidden' },
  searchBtnGradient: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  trackRowSelected: { borderColor: 'rgba(255,106,0,0.3)', backgroundColor: 'rgba(255,106,0,0.06)' },
  trackArt: { width: 48, height: 48, borderRadius: 10 },
  trackArtPlaceholder: { backgroundColor: 'rgba(255,106,0,0.12)', justifyContent: 'center', alignItems: 'center' },
  trackInfo: { flex: 1 },
  trackName: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  trackArtist: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  playingIndicator: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  bar: { width: 3, backgroundColor: '#FF6A00', borderRadius: 1.5 },
  selectBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,106,0,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,106,0,0.2)' },
  selectBtnActive: { backgroundColor: '#FF6A00', borderColor: '#FF6A00' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textAlign: 'center', maxWidth: 250 },
  savingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,14,26,0.8)', justifyContent: 'center', alignItems: 'center' },
});

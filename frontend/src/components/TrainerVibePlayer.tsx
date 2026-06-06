import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Linking } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { registerActiveAudio, releaseActiveAudio } from '../utils/audioCoordinator';

interface VibeData {
  vibeTrackTitle?: string | null;
  vibeArtistName?: string | null;
  vibeArtworkUrl?: string | null;
  vibePreviewUrl?: string | null;
  vibeAppleMusicUrl?: string | null;
  vibeTrackId?: string | null;
}

interface Props {
  vibe: VibeData;
  autoPlay?: boolean;
  compact?: boolean;
}

const MUTE_KEY = '@rapidreps_vibe_muted';

export const TrainerVibePlayer = ({ vibe, autoPlay = true, compact = false }: Props) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [freshPreviewUrl, setFreshPreviewUrl] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  // Synchronous lock to prevent two simultaneous playPreview() calls from racing useEffects.
  const playLockRef = useRef(false);
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  const getPreviewUrl = () => freshPreviewUrl || vibe.vibePreviewUrl;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    initAutoPlay();
    return () => {
      mountedRef.current = false;
      cleanupSound();
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // iter102af — Tab/screen focus loop:
  //   - On BLUR  → stop & unload audio so it doesn't bleed across screens.
  //   - On RE-FOCUS → reset replay-guards and let the autoplay effect below
  //                   restart the preview from the top.
  //
  // This makes the contract you asked for hold on every surface:
  //   "song plays when in profile tab and stops when leaving — autoplay then
  //    autostop — same for visitors viewing your profile."
  //
  // useFocusEffect is a no-op on screens not wrapped in a navigator (e.g.
  // unit tests rendering this component bare), so we don't need a try/catch.
  // ────────────────────────────────────────────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      // Returning to focus: clear the "already played this mount" guard so
      // the autoplay effect below fires again on this fresh visit.
      setHasPlayed(false);
      setPreviewEnded(false);
      return () => {
        // Losing focus: stop and unload the current preview.
        if (sound) {
          (async () => {
            try { await releaseActiveAudio(sound); } catch { /* ignore */ }
          })();
          if (mountedRef.current) {
            setSound(null);
            setIsPlaying(false);
          }
        }
        playLockRef.current = false;
      };
    }, [sound])
  );

  const initAutoPlay = async () => {
    // Load mute preference first
    try {
      const val = await AsyncStorage.getItem(MUTE_KEY);
      if (val === 'true') {
        setIsMuted(true);
        return;
      }
    } catch { /* ignore */ }
    
    // Re-fetch fresh preview URL if we have a trackId (iTunes URLs expire)
    if (vibe.vibeTrackId) {
      try {
        const res = await fetch(`${API_URL}/api/music/lookup?trackId=${vibe.vibeTrackId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.previewUrl) setFreshPreviewUrl(data.previewUrl);
        }
      } catch { /* use stored URL */ }
    }

    if (autoPlay && !hasPlayed) {
      // Small delay to let state settle
      setTimeout(() => {
        if (mountedRef.current) playPreview();
      }, 300);
    }
  };

  useEffect(() => {
    if (autoPlay && !hasPlayed && !isMuted && getPreviewUrl()) {
      playPreview();
    }
  }, [isMuted, freshPreviewUrl, hasPlayed]);

  const cleanupSound = async () => {
    if (sound) {
      try { await releaseActiveAudio(sound); } catch { /* ignore */ }
    }
  };

  const playPreview = async () => {
    const url = getPreviewUrl();
    if (!url || hasPlayed || playLockRef.current) return;
    playLockRef.current = true; // synchronous lock — second concurrent caller exits immediately
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 0.6 },
        (status) => {
          if (!mountedRef.current) return;
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPreviewEnded(true);
              progressAnim.setValue(0);
            }
            if (status.isPlaying && status.durationMillis) {
              const pct = status.positionMillis / status.durationMillis;
              progressAnim.setValue(pct);
            }
          }
        }
      );
      // iter97 (#1): register globally so any prior playing audio stops first
      await registerActiveAudio(newSound);
      if (mountedRef.current) {
        setSound(newSound);
        setIsPlaying(true);
        setHasPlayed(true);
        startPulse();
      }
    } catch (err) {
      console.log('Vibe playback error:', err);
      playLockRef.current = false; // release lock on failure so retry is possible
    }
  };

  const togglePlayPause = async () => {
    if (!sound) {
      if (vibe.vibePreviewUrl) {
        setHasPlayed(false);
        setPreviewEnded(false);
        await playPreview();
      }
      return;
    }
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else if (status.isLoaded) {
        await sound.playAsync();
        setIsPlaying(true);
        startPulse();
      }
    } catch { /* ignore */ }
  };

  const toggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await AsyncStorage.setItem(MUTE_KEY, String(newMuted));
    if (newMuted && sound) {
      try { await sound.stopAsync(); await sound.unloadAsync(); } catch { /* ignore */ }
      setSound(null);
      setIsPlaying(false);
    }
  };

  const openAppleMusic = () => {
    if (vibe.vibeAppleMusicUrl) {
      Linking.openURL(vibe.vibeAppleMusicUrl).catch(() => {});
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  if (!vibe.vibeTrackTitle) return null;

  if (compact) {
    return (
      <View style={cs.container} data-testid="vibe-badge-compact">
        <Ionicons name="musical-notes" size={12} color="#FF6A00" />
        <Text style={cs.text} numberOfLines={1}>{vibe.vibeTrackTitle}</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]} data-testid="trainer-vibe-player">
      <LinearGradient
        colors={['rgba(255,106,0,0.12)', 'rgba(20,25,41,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Artwork */}
        <TouchableOpacity onPress={togglePlayPause} activeOpacity={0.8}>
          <Animated.View style={{ transform: [{ scale: isPlaying ? pulseAnim : 1 }] }}>
            {vibe.vibeArtworkUrl ? (
              <Image source={{ uri: vibe.vibeArtworkUrl }} style={styles.artwork} />
            ) : (
              <View style={[styles.artwork, styles.artworkPlaceholder]}>
                <Ionicons name="musical-notes" size={20} color="#FF6A00" />
              </View>
            )}
            <View style={styles.playOverlay}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color="#FFF" />
            </View>
          </Animated.View>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.label}>TRAINER VIBE</Text>
          <Text style={styles.title} numberOfLines={1}>{vibe.vibeTrackTitle}</Text>
          <Text style={styles.artist} numberOfLines={1}>{vibe.vibeArtistName}</Text>
          {/* Progress bar */}
          {isPlaying && (
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, { flex: progressAnim }]} />
              <View style={{ flex: 1 }} />
            </View>
          )}
          {previewEnded && vibe.vibeAppleMusicUrl && (
            <TouchableOpacity onPress={openAppleMusic} style={styles.appleMusicCta} data-testid="apple-music-cta">
              <Ionicons name="logo-apple" size={12} color="#FF6A00" />
              <Text style={styles.appleMusicText}>Listen on Apple Music</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Mute control */}
        <TouchableOpacity onPress={toggleMute} style={styles.muteBtn} data-testid="vibe-mute-btn" accessibilityLabel="Toggle audio preview" accessibilityRole="button">
          <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

const cs = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,106,0,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  text: { fontSize: 10, fontWeight: '700', color: '#FF6A00', maxWidth: 80 },
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.15)',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  artwork: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  artworkPlaceholder: {
    backgroundColor: 'rgba(255,106,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF6A00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF6A00',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  artist: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  progressBar: {
    flexDirection: 'row',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6A00',
    borderRadius: 1,
  },
  appleMusicCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  appleMusicText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6A00',
  },
  muteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

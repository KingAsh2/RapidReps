import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Linking } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VibeData {
  vibeTrackTitle?: string | null;
  vibeArtistName?: string | null;
  vibeArtworkUrl?: string | null;
  vibePreviewUrl?: string | null;
  vibeAppleMusicUrl?: string | null;
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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    loadMutePreference();
    return () => {
      mountedRef.current = false;
      cleanupSound();
    };
  }, []);

  useEffect(() => {
    if (autoPlay && !hasPlayed && !isMuted && vibe.vibePreviewUrl) {
      playPreview();
    }
  }, [isMuted]);

  const loadMutePreference = async () => {
    try {
      const val = await AsyncStorage.getItem(MUTE_KEY);
      if (val === 'true') setIsMuted(true);
      else if (autoPlay && vibe.vibePreviewUrl && !hasPlayed) {
        playPreview();
      }
    } catch { /* ignore */ }
  };

  const cleanupSound = async () => {
    if (sound) {
      try { await sound.stopAsync(); await sound.unloadAsync(); } catch { /* ignore */ }
    }
  };

  const playPreview = async () => {
    if (!vibe.vibePreviewUrl || hasPlayed) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: vibe.vibePreviewUrl },
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
      if (mountedRef.current) {
        setSound(newSound);
        setIsPlaying(true);
        setHasPlayed(true);
        startPulse();
      }
    } catch (err) {
      console.log('Vibe playback error:', err);
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
        <TouchableOpacity onPress={toggleMute} style={styles.muteBtn} data-testid="vibe-mute-btn">
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

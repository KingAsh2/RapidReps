import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Text } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  videoUrl: string;
  /** Max preview length in ms. After this point we stop and fade out so the rest of the page is still readable. */
  previewMs?: number;
  /** Optional poster image to show before the video kicks in. */
  posterUrl?: string;
  /** Optional callback when user taps the mute button. */
  onMuteToggle?: (muted: boolean) => void;
}

/**
 * 15-second auto-preview of the trainer's first highlight video (Instagram Reels style).
 * - Muted by default (autoplay requirement on iOS/Android)
 * - Tap to unmute
 * - Stops + fades after `previewMs` (default 15s) so it doesn't loop endlessly
 * - Uses Range-streamed `/api/files/...` thanks to iter75 backend Range support
 */
export const TrainerHeroVideoPreview: React.FC<Props> = ({ videoUrl, previewMs = 15000, posterUrl, onMuteToggle }) => {
  const videoRef = useRef<Video>(null);
  const [muted, setMuted] = useState(true);
  const [stopped, setStopped] = useState(false);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // Stop preview after previewMs
    stopTimerRef.current = setTimeout(() => {
      videoRef.current?.pauseAsync().catch(() => {});
      Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => {
        setStopped(true);
      });
    }, previewMs);

    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      videoRef.current?.unloadAsync().catch(() => {});
    };
  }, [videoUrl, previewMs, fadeAnim]);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      onMuteToggle?.(next);
      return next;
    });
  };

  if (stopped) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]} pointerEvents="box-none">
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isMuted={muted}
        shouldPlay
        isLooping={false}
        usePoster={!!posterUrl}
        posterSource={posterUrl ? { uri: posterUrl } : undefined}
        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          // If the clip naturally finishes before previewMs, end gracefully too.
          if (status.didJustFinish) {
            Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setStopped(true));
          }
        }}
      />
      {/* Bottom-to-top gradient so hero text overlay stays readable */}
      <LinearGradient
        colors={['rgba(10,14,26,0.0)', 'rgba(10,14,26,0.55)', 'rgba(10,14,26,0.95)']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Mute toggle pill - top-right */}
      <TouchableOpacity
        onPress={toggleMute}
        style={styles.muteBtn}
        accessibilityLabel={muted ? 'Unmute preview video' : 'Mute preview video'}
        data-testid="hero-video-mute-btn"
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#FFFFFF" />
      </TouchableOpacity>
      {/* "PREVIEW" badge */}
      <View style={styles.previewBadge} pointerEvents="none">
        <View style={styles.previewDot} />
        <Text style={styles.previewText}>LIVE PREVIEW</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  muteBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  previewBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,106,0,0.85)',
    zIndex: 4,
  },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  previewText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

export default TrainerHeroVideoPreview;

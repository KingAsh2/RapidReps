import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, Animated, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { haptic } from '../utils/haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

/**
 * Resolve a stored file path to an absolute URL.
 * Server returns paths like "/api/files/..." that need the API host prepended.
 */
const resolveUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
};

const { width } = Dimensions.get('window');
const REEL_WIDTH = width * 0.55;
const REEL_HEIGHT = REEL_WIDTH * 1.4;

interface Highlight {
  url: string;
  type: 'video' | 'photo';
  caption?: string;
  createdAt?: string;
  thumbnailUrl?: string; // Server-generated poster frame for videos (iter83)
}

interface Props {
  highlights: Highlight[];
  trainerName?: string;
}

export const HighlightReel = ({ highlights, trainerName }: Props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  // iter106ap: long-press preview index. While the user is pressing-and-holding
  // a tile, we treat that tile as the "active" one so its muted video plays
  // inline. Release → fall back to scroll-driven activeIndex. Instagram-style
  // sneak peek without opening the full viewer modal.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [viewerLoading, setViewerLoading] = useState(false);
  // iter106ao: start the modal video MUTED on open. Autoplay-with-sound is
  // blocked on web/iOS Safari and silently fails the load — that was a major
  // cause of "tap play, nothing happens". User can unmute via the corner btn.
  const [viewerMuted, setViewerMuted] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const viewerVideoRef = useRef<Video | null>(null);
  const fadeAnims = useRef(highlights.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Stagger entrance
    Animated.stagger(100, fadeAnims.map(anim =>
      Animated.spring(anim, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true })
    )).start();
  }, []);

  if (!highlights || highlights.length === 0) return null;

  const openViewer = (idx: number) => {
    setViewerIdx(idx);
    setViewerLoading(true);
    setViewerError(null);
    setViewerMuted(true);
    setViewerVisible(true);
  };

  // iter106ao: nuke + remount the video to retry a failed load.
  const retryViewer = () => {
    const idx = viewerIdx;
    setViewerError(null);
    setViewerLoading(true);
    setViewerVisible(false);
    setTimeout(() => {
      setViewerIdx(idx);
      setViewerVisible(true);
    }, 60);
  };

  return (
    <View style={styles.container} data-testid="highlight-reel">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={['#FF6A00', '#FF3D00']} style={styles.headerIcon}>
            <Ionicons name="film" size={14} color="#FFF" />
          </LinearGradient>
          <Text style={styles.headerTitle}>HIGHLIGHT REEL</Text>
        </View>
        <Text style={styles.headerCount}>{highlights.length} clips</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={REEL_WIDTH + 12}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (REEL_WIDTH + 12));
          setActiveIndex(idx);
        }}
      >
        {highlights.map((item, idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.reelCard,
              {
                opacity: fadeAnims[idx] || 1,
                transform: [{
                  scale: (fadeAnims[idx] || new Animated.Value(1)).interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                }],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => openViewer(idx)}
              onLongPress={() => {
                // iter106ap: long-press → sneak-peek (mutes other tiles,
                // plays this one inline). Light haptic so the user feels
                // the "lock" happen.
                haptic.selection();
                setPreviewIndex(idx);
              }}
              onPressOut={() => {
                if (previewIndex !== null) setPreviewIndex(null);
              }}
              delayLongPress={250}
              style={styles.reelTouchable}
              data-testid={`highlight-${idx}`}
            >
              {item.type === 'video' ? (
                item.thumbnailUrl ? (
                  // Use server-generated thumbnail as instant poster, only mount
                  // the <Video> component when this card is the active one.
                  // This is the fix for "thumbnails not visible" + "long load times".
                  (idx === activeIndex || idx === previewIndex) ? (
                    <Video
                      source={{ uri: resolveUrl(item.url) }}
                      style={styles.reelMedia}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay
                      isLooping
                      isMuted
                      posterSource={{ uri: resolveUrl(item.thumbnailUrl) }}
                      usePoster
                      useNativeControls={false}
                      progressUpdateIntervalMillis={1000}
                    />
                  ) : (
                    <Image source={{ uri: resolveUrl(item.thumbnailUrl) }} style={styles.reelMedia} />
                  )
                ) : (
                  <Video
                    source={{ uri: resolveUrl(item.url) }}
                    style={styles.reelMedia}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={idx === activeIndex || idx === previewIndex}
                    isLooping
                    isMuted
                    useNativeControls={false}
                    progressUpdateIntervalMillis={1000}
                  />
                )
              ) : (
                <Image source={{ uri: resolveUrl(item.url) }} style={styles.reelMedia} />
              )}

              {/* Gradient overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.reelOverlay}
              >
                {item.caption && (
                  <Text style={styles.reelCaption} numberOfLines={2}>{item.caption}</Text>
                )}
              </LinearGradient>

              {/* iter106ao: prominent CENTER play button for videos. Was a
                  tiny corner badge before — users didn't realise the card
                  was tappable. Frosted-glass disc with shadow reads as the
                  primary "tap to watch" affordance. */}
              {item.type === 'video' && (
                <View style={styles.centerPlayBtnWrap} pointerEvents="none">
                  <View style={styles.centerPlayBtn}>
                    <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
                  </View>
                </View>
              )}

              {/* Active indicator ring */}
              {idx === activeIndex && (
                <View style={styles.activeRing} />
              )}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      {highlights.length > 1 && (
        <View style={styles.dots}>
          {highlights.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, idx === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Full-screen viewer */}
      <Modal visible={viewerVisible} transparent animationType="fade">
        <View style={styles.viewer}>
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerVisible(false)}
            data-testid="highlight-viewer-close"
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>

          {highlights[viewerIdx]?.type === 'video' ? (
            <View style={styles.viewerMediaWrap}>
              {viewerLoading && (
                <View style={styles.viewerLoader} pointerEvents="none">
                  <ActivityIndicator size="large" color="#FF6A00" />
                  <Text style={styles.viewerLoaderText}>Loading clip…</Text>
                </View>
              )}
              <Video
                ref={(r) => { viewerVideoRef.current = r; }}
                key={`viewer-video-${viewerIdx}-${viewerError ? 'err' : 'ok'}`}
                source={{ uri: resolveUrl(highlights[viewerIdx].url) }}
                style={styles.viewerMedia}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                // iter106ao: ALWAYS open muted. Web/iOS Safari blocks
                // autoplay-with-sound silently, leading to the "tap play,
                // nothing happens" symptom. User unmutes via the corner btn.
                isMuted={viewerMuted}
                useNativeControls
                onLoadStart={() => { setViewerLoading(true); setViewerError(null); }}
                onLoad={() => setViewerLoading(false)}
                onReadyForDisplay={() => setViewerLoading(false)}
                onError={(err) => {
                  setViewerLoading(false);
                  // expo-av error shape varies; coerce to a friendly string.
                  setViewerError(typeof err === 'string' ? err : 'Could not load this clip');
                }}
                progressUpdateIntervalMillis={1000}
              />

              {/* iter106ao: mute/unmute toggle. Sits top-left so it's reachable
                  with the thumb without colliding with the close button. */}
              <TouchableOpacity
                style={styles.muteBtn}
                onPress={() => setViewerMuted((m) => !m)}
                data-testid="highlight-mute-toggle"
              >
                <Ionicons name={viewerMuted ? 'volume-mute' : 'volume-high'} size={20} color="#FFF" />
              </TouchableOpacity>

              {/* iter106ao: explicit error state with a Retry CTA — was an
                  invisible failure before, looked like a black-screen freeze. */}
              {viewerError && (
                <View style={styles.viewerErrorWrap}>
                  <Ionicons name="alert-circle" size={36} color="#FF6A00" />
                  <Text style={styles.viewerErrorText}>This clip won&apos;t load right now.</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={retryViewer} data-testid="highlight-retry">
                    <Ionicons name="refresh" size={16} color="#FFFFFF" />
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <Image
              source={{ uri: resolveUrl(highlights[viewerIdx].url) }}
              style={styles.viewerMedia}
              resizeMode="contain"
            />
          )}

          {highlights[viewerIdx]?.caption && (
            <View style={styles.viewerCaptionBar}>
              <Text style={styles.viewerCaption}>{highlights[viewerIdx].caption}</Text>
            </View>
          )}

          {/* Nav arrows */}
          {viewerIdx > 0 && (
            <TouchableOpacity style={[styles.navArrow, styles.navLeft]} onPress={() => { setViewerLoading(true); setViewerIdx(viewerIdx - 1); }}>
              <Ionicons name="chevron-back" size={28} color="#FFF" />
            </TouchableOpacity>
          )}
          {viewerIdx < highlights.length - 1 && (
            <TouchableOpacity style={[styles.navArrow, styles.navRight]} onPress={() => { setViewerLoading(true); setViewerIdx(viewerIdx + 1); }}>
              <Ionicons name="chevron-forward" size={28} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5 },
  headerCount: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  scrollContent: { paddingLeft: 4, paddingRight: 20 },
  reelCard: { width: REEL_WIDTH, height: REEL_HEIGHT, marginRight: 12, borderRadius: 18, overflow: 'hidden', backgroundColor: '#141929' },
  reelTouchable: { flex: 1 },
  reelMedia: { width: '100%', height: '100%' },
  reelOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 40 },
  playBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,106,0,0.9)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  // iter106ao: prominent centre play button + viewer mute/retry styles.
  centerPlayBtnWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  muteBtn: {
    position: 'absolute', top: 54, left: 20, zIndex: 8,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  viewerErrorWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 12, zIndex: 6,
    paddingHorizontal: 32,
  },
  viewerErrorText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FF6A00', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, marginTop: 4,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  reelCaption: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', lineHeight: 16 },
  activeRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18, borderWidth: 2, borderColor: '#FF6A00' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { backgroundColor: '#FF6A00', width: 18, borderRadius: 3 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', top: 54, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  viewerMedia: { width: width, height: width * 1.5 },
  viewerMediaWrap: { width: width, height: width * 1.5, justifyContent: 'center', alignItems: 'center' },
  viewerLoader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 12, zIndex: 5 },
  viewerLoaderText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
  viewerCaptionBar: { position: 'absolute', bottom: 60, left: 20, right: 20 },
  viewerCaption: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  navArrow: { position: 'absolute', top: '50%', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  navLeft: { left: 12 },
  navRight: { right: 12 },
});

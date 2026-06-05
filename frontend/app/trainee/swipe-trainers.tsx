/**
 * Tinder-style swipeable trainer discovery (iter98d Task 6).
 *
 * - Full-screen card stack of nearby trainers (filtered by availability + proximity).
 * - Each card shows the FULL public profile: photo, name, accent color, distance,
 *   rate, vibe (audio plays on top card), highlight chips, personality tag.
 * - Swipe RIGHT  → "Like" / Save
 * - Swipe LEFT   → "Pass"
 * - Swipe UP     → Open full trainer detail page
 * - Audio is stopped on unmount via stopAllAudio(); when the next card moves to top,
 *   the previous card unmounts which releases its TrainerVibePlayer.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { traineeAPI } from '../../src/services/api';
import { UserAvatar } from '../../src/components/UserAvatar';
import { TrainerVibePlayer } from '../../src/components/TrainerVibePlayer';
import FloatingOrangeBg from '../../src/components/FloatingOrangeBg';
import { stopAllAudio } from '../../src/utils/audioCoordinator';
import { haptic } from '../../src/utils/haptics';
import { toast } from '../../src/utils/toast';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

interface Trainer {
  trainerId?: string; userId?: string; id?: string;
  fullName?: string;
  profilePhoto?: string;
  avatarUrl?: string;
  accentColor?: string;
  accentColorAuto?: string;
  distance?: number;
  rating?: number;
  ratingAverage?: number;
  totalSessions?: number;
  outdoor60Cents?: number;
  outdoorRateCents?: number;
  bio?: string;
  personalityTag?: string;
  vibeTrackTitle?: string;
  vibeArtistName?: string;
  vibePreviewUrl?: string;
  vibeTrackId?: string;
  vibeArtworkUrl?: string;
  isAvailable?: boolean;
  specialties?: string[];
  // iter102g: full-profile preview fields
  highlights?: Array<{ url: string; thumbnailUrl?: string; type: 'photo' | 'video' }>;
  introVideoUrl?: string;
}

// iter102g: backend serves /api/files/... relative paths — Image needs absolute URL
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const resolveUrl = (u?: string) => {
  if (!u) return '';
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return `${API_URL}${u}`;
};

export default function SwipeTrainersScreen() {
  const router = useRouter();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  // Load nearby + filter by availability. Uses last known coords from AsyncStorage
  // (set by the home screen) so we don't have to re-request geolocation here.
  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const latStr = await AsyncStorage.getItem('user_latitude');
        const lngStr = await AsyncStorage.getItem('user_longitude');
        const lat = latStr ? parseFloat(latStr) : 40.7128;   // NYC fallback
        const lng = lngStr ? parseFloat(lngStr) : -74.0060;
        const res = await traineeAPI.getNearbyTrainers(lat, lng, 25);
        const list: Trainer[] = (res?.trainers || []).filter(
          (t: Trainer) => t.isAvailable !== false
        );
        setTrainers(list);
      } catch (e) {
        toast.error('Could not load nearby trainers');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      try { stopAllAudio(); } catch { /* no-op */ }
    };
  }, []);

  const advance = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    rotate.value = 0;
    setIndex((i) => i + 1);
  }, [translateX, translateY, rotate]);

  const handleLike = useCallback(() => {
    haptic.success();
    toast.success('Saved');
    advance();
  }, [advance]);

  const handlePass = useCallback(() => {
    haptic.medium();
    advance();
  }, [advance]);

  const handleOpenProfile = useCallback((t: Trainer) => {
    haptic.medium();
    const tid = t.trainerId || t.userId || t.id;
    if (tid) router.push({ pathname: '/trainee/trainer-detail', params: { trainerId: tid } });
  }, [router]);

  // Swipe gesture on top card
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotate.value = (e.translationX / SCREEN_W) * 12; // degrees
    })
    .onEnd((e) => {
      const xMag = Math.abs(e.translationX);
      const yMag = e.translationY;
      if (xMag > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(direction * SCREEN_W * 1.4, { duration: 260 });
        translateY.value = withTiming(e.translationY, { duration: 260 });
        rotate.value = withTiming(direction * 18, { duration: 260 });
        if (direction === 1) runOnJS(handleLike)();
        else runOnJS(handlePass)();
      } else if (yMag < -SCREEN_H * 0.18) {
        // Swipe up → open full profile
        const currentTrainer = trainers[index];
        if (currentTrainer) {
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          rotate.value = withSpring(0);
          runOnJS(handleOpenProfile)(currentTrainer);
        }
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    });

  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  // ---------------- Render ----------------
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <FloatingOrangeBg />
        <View style={styles.center}>
          <ActivityIndicator color="#FF6A00" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const remaining = trainers.slice(index);
  const currentTrainer = remaining[0];
  const nextTrainer = remaining[1];

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0E1A' }}>
      <View style={styles.root}>
        <FloatingOrangeBg />
        <SafeAreaView style={styles.safe} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} data-testid="back-btn">
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Discover Trainers</Text>
            <View style={styles.iconBtn}>
              <Text style={styles.countText}>{remaining.length}</Text>
            </View>
          </View>

          {/* Card stack */}
          <View style={styles.stack} data-testid="swipe-stack">
            {!currentTrainer ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle" size={56} color="#FF6A00" />
                <Text style={styles.emptyTitle}>You're all caught up</Text>
                <Text style={styles.emptySub}>No more trainers nearby right now. Check back soon.</Text>
                <TouchableOpacity style={styles.refreshBtn} onPress={() => router.back()} data-testid="empty-back-btn">
                  <Text style={styles.refreshBtnText}>Back to Home</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {nextTrainer ? (
                  <View style={[styles.card, styles.cardBehind]} pointerEvents="none">
                    <TrainerSwipeCard trainer={nextTrainer} isTop={false} />
                  </View>
                ) : null}

                <GestureDetector gesture={panGesture}>
                  <Animated.View style={[styles.card, topCardStyle]}>
                    <TrainerSwipeCard trainer={currentTrainer} isTop={true} />

                    {/* NOPE / LIKE overlays */}
                    <Animated.View style={[styles.stamp, styles.nopeStamp, nopeOpacity]} pointerEvents="none">
                      <Text style={[styles.stampText, { color: '#FF4757' }]}>NOPE</Text>
                    </Animated.View>
                    <Animated.View style={[styles.stamp, styles.likeStamp, likeOpacity]} pointerEvents="none">
                      <Text style={[styles.stampText, { color: '#00D68F' }]}>LIKE</Text>
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
              </>
            )}
          </View>

          {/* Action bar */}
          {currentTrainer ? (
            <View style={styles.actionsBar}>
              <ActionButton icon="close" color="#FF4757" onPress={handlePass} testId="pass-btn" />
              <ActionButton
                icon="eye"
                color="#5EC8FF"
                onPress={() => handleOpenProfile(currentTrainer)}
                testId="open-profile-btn"
                size={56}
              />
              <ActionButton icon="heart" color="#00D68F" onPress={handleLike} testId="like-btn" />
            </View>
          ) : null}
          <Text style={styles.hint}>Swipe right to save • left to pass • up to open profile</Text>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

// ============================================================
// Card component — full-bleed profile, accent-color theming
// ============================================================
const TrainerSwipeCard = ({ trainer, isTop }: { trainer: Trainer; isTop: boolean }) => {
  const router = useRouter();
  const accent = trainer.accentColor || trainer.accentColorAuto || '#FF6A00';
  const fullName = trainer.fullName || 'Trainer';
  const photo = trainer.profilePhoto || trainer.avatarUrl;
  const rate = (trainer.outdoor60Cents || trainer.outdoorRateCents || 0) / 100;
  const rating = trainer.rating || trainer.ratingAverage || 0;

  return (
    <View style={cardStyles.card}>
      {/* Photo / fallback */}
      {photo ? (
        <Image source={{ uri: photo }} style={cardStyles.photo} />
      ) : (
        <LinearGradient
          colors={['#1F2436', '#0A0E1A']}
          style={cardStyles.photo}
        >
          <View style={cardStyles.fallbackAvatar}>
            <UserAvatar user={{ fullName }} size={140} />
          </View>
        </LinearGradient>
      )}

      {/* Bottom gradient + content overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(10,14,26,0.4)', 'rgba(10,14,26,0.95)']}
        locations={[0, 0.4, 1]}
        style={cardStyles.gradient}
        pointerEvents="none"
      />

      {/* Accent edge */}
      <View style={[cardStyles.accentEdge, { backgroundColor: accent }]} pointerEvents="none" />

      {/* Available badge */}
      {trainer.isAvailable ? (
        <View style={cardStyles.availPill}>
          <View style={cardStyles.availDot} />
          <Text style={cardStyles.availText}>Available now</Text>
        </View>
      ) : null}

      {/* Vibe player — only on top card to keep one source playing */}
      {isTop && trainer.vibeTrackTitle && (trainer.vibePreviewUrl || trainer.vibeTrackId) ? (
        <View style={cardStyles.vibeWrap}>
          <TrainerVibePlayer vibe={trainer as any} autoPlay={true} />
        </View>
      ) : null}

      {/* Bottom info */}
      <View style={cardStyles.infoBlock}>
        <View style={cardStyles.nameRow}>
          <Text style={cardStyles.name} numberOfLines={1}>{fullName}</Text>
          {trainer.distance !== undefined && trainer.distance !== null ? (
            <View style={cardStyles.distPill}>
              <Ionicons name="location" size={11} color="#FFF" />
              <Text style={cardStyles.distText}>{trainer.distance.toFixed(1)} mi</Text>
            </View>
          ) : null}
        </View>

        <View style={cardStyles.metaRow}>
          {rating > 0 ? (
            <View style={cardStyles.metaItem}>
              <Ionicons name="star" size={13} color="#FFB300" />
              <Text style={cardStyles.metaText}>{rating.toFixed(1)}</Text>
            </View>
          ) : null}
          {trainer.totalSessions ? (
            <View style={cardStyles.metaItem}>
              <Ionicons name="barbell" size={13} color="#5EC8FF" />
              <Text style={cardStyles.metaText}>{trainer.totalSessions} sessions</Text>
            </View>
          ) : null}
          {rate > 0 ? (
            <View style={[cardStyles.metaItem, { backgroundColor: `${accent}30`, borderColor: accent, borderWidth: 1 }]}>
              <Text style={[cardStyles.metaText, { color: accent, fontWeight: '800' }]}>${rate}/hr</Text>
            </View>
          ) : null}
        </View>

        {trainer.personalityTag ? (
          <View style={[cardStyles.tagPill, { borderColor: accent }]}>
            <Ionicons name="sparkles" size={11} color={accent} />
            <Text style={[cardStyles.tagText, { color: accent }]}>{trainer.personalityTag}</Text>
          </View>
        ) : null}

        {trainer.bio ? (
          <Text style={cardStyles.bio} numberOfLines={2}>{trainer.bio}</Text>
        ) : null}

        {trainer.specialties && trainer.specialties.length > 0 ? (
          <View style={cardStyles.specRow}>
            {trainer.specialties.slice(0, 3).map((s, i) => (
              <View key={i} style={cardStyles.specChip}>
                <Text style={cardStyles.specChipText}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* iter102g: Highlight strip — shows the trainer's first ≤6 highlights
            so the swipe card feels like a true profile preview. Tapping a
            thumbnail jumps to the full trainer-detail screen (with the entire
            HighlightReel). */}
        {trainer.highlights && trainer.highlights.length > 0 ? (
          <View style={cardStyles.highlightStrip}>
            {trainer.highlights.slice(0, 6).map((h, i) => {
              const thumb = h.thumbnailUrl ? resolveUrl(h.thumbnailUrl) : (h.type === 'photo' ? resolveUrl(h.url) : '');
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    const tid = trainer.trainerId || trainer.userId || trainer.id;
                    router.push(`/trainee/trainer-detail?trainerId=${tid}`);
                  }}
                  activeOpacity={0.85}
                  style={cardStyles.highlightThumb}
                  data-testid={`swipe-highlight-thumb-${i}`}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#141929' }}>
                      <Ionicons name="play" size={14} color="rgba(255,255,255,0.6)" />
                    </View>
                  )}
                  {h.type === 'video' ? (
                    <View style={cardStyles.highlightPlayBadge}>
                      <Ionicons name="play" size={8} color="#FFF" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
};

// ============================================================
// Action button (round circular icon)
// ============================================================
const ActionButton = ({ icon, color, onPress, testId, size = 48 }: any) => (
  <TouchableOpacity onPress={onPress} data-testid={testId} activeOpacity={0.75}>
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 2, borderColor: color,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: color, shadowOpacity: 0.4, shadowRadius: 10,
      }}
    >
      <Ionicons name={icon} size={size === 56 ? 26 : 22} color={color} />
    </View>
  </TouchableOpacity>
);

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0E1A' },
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  countText: { fontSize: 12, fontWeight: '800', color: '#FF6A00' },

  stack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    width: SCREEN_W * 0.92,
    height: SCREEN_H * 0.66,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#141929',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  cardBehind: { transform: [{ scale: 0.96 }, { translateY: 12 }], opacity: 0.8 },

  stamp: {
    position: 'absolute', top: 60,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, borderWidth: 4,
  },
  nopeStamp: { right: 20, borderColor: '#FF4757', transform: [{ rotate: '12deg' }] },
  likeStamp: { left: 20, borderColor: '#00D68F', transform: [{ rotate: '-12deg' }] },
  stampText: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },

  emptyState: { alignItems: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 14 },
  emptySub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 18 },
  refreshBtn: {
    marginTop: 18, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22,
    backgroundColor: '#FF6A00',
  },
  refreshBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  actionsBar: {
    flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center',
    paddingVertical: 14,
  },
  hint: {
    fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center',
    paddingBottom: Platform.OS === 'ios' ? 18 : 24,
  },
});

const cardStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#141929' },
  photo: { width: '100%', height: '100%', position: 'absolute' },
  fallbackAvatar: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  accentEdge: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, opacity: 0.85,
  },
  availPill: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,214,143,0.95)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  availText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },

  vibeWrap: {
    position: 'absolute', top: 14, right: 14, width: 180,
    backgroundColor: 'rgba(20,25,41,0.85)', borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  infoBlock: { position: 'absolute', left: 18, right: 18, bottom: 18, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.4 },
  distPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  distText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  metaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
  },
  metaText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  tagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,106,0,0.18)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 11,
    borderWidth: 1, marginTop: 2,
  },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },

  bio: { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 18, marginTop: 2 },

  specRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  specChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  specChipText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  // iter102g: highlight strip on swipe card
  highlightStrip: { flexDirection: 'row', gap: 6, marginTop: 10 },
  highlightThumb: {
    width: 46, height: 46, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#141929',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
  },
  highlightPlayBadge: {
    position: 'absolute', bottom: 2, left: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#FF6A00',
    alignItems: 'center', justifyContent: 'center',
  },
});

/**
 * Discover Trainees — trainer-facing browse feed.
 * Surfaces trainees who've built out their showcase (vibe / highlight / accent / bio / tag).
 * Tapping a card routes to the cinematic /trainer/trainee-detail page.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { toast } from '../../src/utils/toast';
import { PersonalityTagBadge } from '../../src/components/PersonalityTagBadge';
import RapidBg from '../../src/components/RapidBg';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

interface TraineeCard {
  userId: string;
  fullName: string;
  profilePhoto: string | null;
  bio: string | null;
  fitnessGoals: string | null;
  currentFitnessLevel: string | null;
  personalityTag: string | null;
  accentColor: string | null;
  vibeTrackTitle: string | null;
  vibeArtistName: string | null;
  vibeArtworkUrl: string | null;
  firstHighlight: { url: string; type: 'video' | 'photo' } | null;
  highlightCount: number;
}

const COLORS = {
  white: '#FFFFFF',
  orangeHot: '#FF6A00',
};

export default function DiscoverTraineesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [trainees, setTrainees] = useState<TraineeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTrainees();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [loading]);

  const loadTrainees = async () => {
    try {
      const res = await fetch(`${API_URL}/api/trainees/discover?limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setTrainees([]);
        return;
      }
      const data = await res.json();
      setTrainees(data.trainees || []);
    } catch (e) {
      toast.error('Could not load trainees');
      setTrainees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTrainees();
  };

  const openShowcase = (userId: string) => {
    router.push({ pathname: '/trainer/trainee-detail', params: { traineeId: userId } });
  };

  return (
    <RapidBg variant="trainer-discover-trainees" style={s.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="discover-back-btn" accessibilityLabel="Back" accessibilityRole="button">
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Discover Trainees</Text>
            <Text style={s.headerSub}>Browse athletes who've shown their vibe</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.orangeHot} />
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.white} />}
            >
              {trainees.length === 0 ? (
                <View style={s.emptyState}>
                  <Ionicons name="people-outline" size={56} color="rgba(255,255,255,0.15)" />
                  <Text style={s.emptyTitle}>No showcase trainees yet</Text>
                  <Text style={s.emptyText}>Trainees who set up their vibe, highlights, or personality will appear here</Text>
                </View>
              ) : (
                trainees.map((t) => <TraineeFeedCard key={t.userId} trainee={t} onPress={() => openShowcase(t.userId)} />)
              )}
            </ScrollView>
          </Animated.View>
        )}
      </SafeAreaView>
    </RapidBg>
  );
}

function TraineeFeedCard({ trainee, onPress }: { trainee: TraineeCard; onPress: () => void }) {
  const accent = trainee.accentColor || COLORS.orangeHot;
  // iter97 (#18): include avatarUrl + photoUrl in fallback chain, not just firstHighlight
  const fallbackPhoto = (trainee as any).avatarUrl
    || (trainee as any).profilePhotoUrl
    || trainee.profilePhoto
    || null;
  const heroUri = trainee.firstHighlight?.url
    ? `${API_URL}${trainee.firstHighlight.url}`
    : (fallbackPhoto || null);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.card, { borderColor: `${accent}33` }]}
      data-testid={`trainee-card-${trainee.userId}`}
      accessibilityLabel={`Open ${trainee.fullName}'s profile`}
      accessibilityRole="button"
    >
      <View style={s.cardImageWrap}>
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={s.cardImage} />
        ) : (
          <LinearGradient colors={['#1A1F38', '#0A0E1A']} style={s.cardImage} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(10,14,26,0.4)', 'rgba(10,14,26,0.92)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Accent glow strip */}
        <View style={[s.accentStrip, { backgroundColor: accent }]} />

        {/* Top-left badges */}
        <View style={s.topLeftBadges}>
          {trainee.highlightCount > 0 && (
            <View style={s.metaBadge}>
              <Ionicons name="film" size={11} color="#FFF" />
              <Text style={s.metaBadgeText}>{trainee.highlightCount}</Text>
            </View>
          )}
          {trainee.vibeTrackTitle && (
            <View style={s.metaBadge}>
              <Ionicons name="musical-notes" size={11} color="#FFF" />
            </View>
          )}
        </View>

        {/* Bottom content */}
        <View style={s.cardContent}>
          {trainee.personalityTag && (
            <View style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
              <PersonalityTagBadge tag={trainee.personalityTag} />
            </View>
          )}
          <Text style={s.cardName} numberOfLines={1}>{trainee.fullName}</Text>
          {trainee.bio ? (
            <Text style={s.cardBio} numberOfLines={2}>{trainee.bio}</Text>
          ) : trainee.fitnessGoals ? (
            <Text style={s.cardBio} numberOfLines={2}>{trainee.fitnessGoals}</Text>
          ) : null}

          {trainee.vibeTrackTitle && (
            <View style={[s.vibeChip, { borderColor: `${accent}55`, backgroundColor: `${accent}1A` }]}>
              {trainee.vibeArtworkUrl ? (
                <Image source={{ uri: trainee.vibeArtworkUrl }} style={s.vibeArt} />
              ) : (
                <View style={[s.vibeArt, { backgroundColor: `${accent}33`, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="musical-notes" size={10} color={accent} />
                </View>
              )}
              <Text style={[s.vibeText, { color: accent }]} numberOfLines={1}>
                {trainee.vibeTrackTitle} · {trainee.vibeArtistName}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', textAlign: 'center' },
  headerSub: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 2 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  emptyText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 260, lineHeight: 19 },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.15,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    backgroundColor: '#141929',
  },
  cardImageWrap: { flex: 1, position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  accentStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  topLeftBadges: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', gap: 6 },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  metaBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  cardContent: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  cardName: { fontSize: 24, fontFamily: 'Oswald_700Bold', color: '#FFF', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardBio: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)', lineHeight: 18, marginTop: 4 },
  vibeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, marginTop: 10, alignSelf: 'flex-start', maxWidth: '100%' },
  vibeArt: { width: 22, height: 22, borderRadius: 5 },
  vibeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, flexShrink: 1 },
});

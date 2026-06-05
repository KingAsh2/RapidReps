/**
 * Trainee Detail Screen — Cinematic public showcase of a trainee profile.
 * Mirrors the trainer-detail.tsx aesthetic: parallax hero, layered gradients,
 * vibe player, highlight reel, accent color theming, staggered entrance animations.
 *
 * Opened by trainers (e.g., from messages, sessions, or "View Profile" links)
 * to see a trainee's vibe, story, goals, highlight reel, and personality.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { traineeAPI, chatAPI } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { toast } from '../../src/utils/toast';
import InstagramSection from '../../src/components/InstagramSection';
import { TrainerVibePlayer } from '../../src/components/TrainerVibePlayer';
import { HighlightReel } from '../../src/components/HighlightReel';
import { TrainerHeroVideoPreview } from '../../src/components/TrainerHeroVideoPreview';
import { PersonalityTagBadge } from '../../src/components/PersonalityTagBadge';
import FloatingOrangeBg from '../../src/components/FloatingOrangeBg';
import RapidBg from '../../src/components/RapidBg';

const { width } = Dimensions.get('window');

const COLORS = {
  white: '#FFFFFF',
  orangeHot: '#FF6A00',
  success: '#00C853',
  error: '#FF4757',
  gold: '#FFD700',
};

const FITNESS_LEVEL_LABEL: Record<string, string> = {
  beginner: 'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced: 'ADVANCED',
  expert: 'EXPERT',
};

export default function TraineeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const traineeId = (params.traineeId || params.userId) as string;
  const showAcceptCTA = params.showAcceptCTA === 'true';
  const sessionRequestId = params.sessionRequestId as string | undefined;
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [trainee, setTrainee] = useState<any>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [sessionCount, setSessionCount] = useState<number>(0);

  // Cinematic entrance animations (mirroring trainer-detail.tsx)
  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const heroScaleAnim = useRef(new Animated.Value(1.2)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const nameSlideAnim = useRef(new Animated.Value(30)).current;
  const nameScaleAnim = useRef(new Animated.Value(0.85)).current;
  const statsSlideAnim = useRef(new Animated.Value(40)).current;
  const vibeSlideAnim = useRef(new Animated.Value(50)).current;
  const ctaSlideAnim = useRef(new Animated.Value(60)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTraineeDetails();
    // iter98d (Task 5): stop any vibe audio when leaving this profile
    return () => {
      try {
        const { stopAllAudio } = require('../../src/utils/audioCoordinator');
        stopAllAudio();
      } catch { /* no-op */ }
    };
  }, [traineeId]);

  useEffect(() => {
    if (!loading && trainee) {
      Animated.parallel([
        Animated.timing(heroFadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(heroScaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]).start();
      Animated.timing(headerAnim, { toValue: 1, duration: 500, delay: 250, useNativeDriver: true }).start();
      Animated.spring(nameScaleAnim, { toValue: 1, friction: 6, tension: 80, delay: 300, useNativeDriver: true }).start();
      Animated.stagger(80, [
        Animated.spring(nameSlideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
        Animated.spring(statsSlideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
        Animated.spring(vibeSlideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
        Animated.spring(ctaSlideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
      ]).start();
      Animated.spring(contentAnim, { toValue: 1, friction: 8, tension: 40, delay: 500, useNativeDriver: true }).start();
    }
  }, [loading, trainee]);

  const loadTraineeDetails = async () => {
    if (!traineeId) {
      setLoading(false);
      return;
    }
    try {
      const traineeData = await traineeAPI.getProfile(traineeId);
      setTrainee(traineeData);
      try {
        const hlRes = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/trainee-profiles/${traineeId}/highlights`);
        const hlData = await hlRes.json();
        setHighlights(hlData.highlights || []);
      } catch { /* no highlights */ }
    } catch (error) {
      console.error('Error loading trainee:', error);
      showAlert({
        title: 'Loading Failed',
        message: 'Failed to load trainee profile',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!traineeId) return;
    try {
      const conv = await chatAPI.getOrCreateConversation(traineeId);
      router.push(`/messages/chat?conversationId=${conv.conversationId}&userId=${traineeId}&userName=${encodeURIComponent(trainee?.fullName || 'Trainee')}`);
    } catch (e) {
      toast.error('Could not open conversation');
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100, 200],
    outputRange: [1, 0.85, 1],
    extrapolate: 'clamp',
  });
  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <RapidBg variant="trainer-trainee-detail" style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
      <FloatingOrangeBg />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.orangeHot} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!trainee) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0A0E1A', '#141929']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Ionicons name="person-circle-outline" size={64} color="rgba(255,255,255,0.2)" />
            <Text style={styles.loadingText}>Profile not found</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="trainee-detail-back-empty">
              <Text style={styles.backBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const accent = trainee.accentColor || trainee.accentColorAuto || COLORS.orangeHot;
  const photoUri = trainee.profilePhoto || trainee.avatarUrl || null;
  const fullName = trainee.fullName || 'Athlete';

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0E1A', '#141929']} style={styles.headerGradient} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="trainee-detail-back" accessibilityLabel="Back" accessibilityRole="button">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleMessage} style={styles.headerBtn} data-testid="trainee-detail-message-btn" accessibilityLabel="Open chat" accessibilityRole="button">
              <Ionicons name="chatbubble" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        >
          {/* CINEMATIC HERO */}
          <Animated.View style={{ opacity: heroFadeAnim }}>
            <Animated.View style={{
              transform: [
                { scale: heroScaleAnim },
                { translateY: scrollY.interpolate({ inputRange: [-100, 0, 300], outputRange: [-50, 0, 80], extrapolate: 'clamp' }) },
              ],
            }}>
              <View style={styles.heroSection} data-testid="trainee-hero-section">
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.heroImage} />
                ) : (
                  <LinearGradient colors={['#1A1F38', '#0A0E1A']} style={styles.heroImage} />
                )}

                {(() => {
                  const firstVideo = (highlights || []).find((h: any) => h?.type === 'video' && h?.url);
                  if (!firstVideo) return null;
                  return (
                    <TrainerHeroVideoPreview
                      videoUrl={firstVideo.url}
                      previewMs={15000}
                      posterUrl={photoUri}
                    />
                  );
                })()}

                <LinearGradient
                  colors={['transparent', 'rgba(10,14,26,0.3)', 'rgba(10,14,26,0.85)', '#0A0E1A']}
                  locations={[0, 0.3, 0.65, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(10,14,26,0.4)', 'transparent', 'rgba(10,14,26,0.4)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.heroGlowOrb, { backgroundColor: `${accent}14` }]} />
              </View>
            </Animated.View>

            {/* Hero Content */}
            <View style={styles.heroContent}>
              {/* Fitness Level badge */}
              <View style={[styles.heroAvailableBadge, { backgroundColor: `${accent}1F`, borderColor: `${accent}33` }]}>
                <View style={[styles.heroAvailableDot, { backgroundColor: accent }]} />
                <Text style={[styles.heroAvailableText, { color: accent }]}>
                  {FITNESS_LEVEL_LABEL[trainee.currentFitnessLevel || 'beginner']}
                </Text>
              </View>

              {/* Name */}
              <Animated.View style={{ transform: [{ translateY: nameSlideAnim }, { scale: nameScaleAnim }], opacity: headerAnim }}>
                <Text style={styles.heroName} data-testid="trainee-hero-name">{fullName}</Text>
                {trainee.bio ? (
                  <Text style={styles.heroTagline} numberOfLines={3}>{trainee.bio}</Text>
                ) : trainee.fitnessGoals ? (
                  <Text style={styles.heroTagline} numberOfLines={3}>{trainee.fitnessGoals}</Text>
                ) : null}
              </Animated.View>

              {/* Personality tag */}
              {trainee.personalityTag && (
                <Animated.View style={{ transform: [{ translateY: statsSlideAnim }], opacity: headerAnim }}>
                  <PersonalityTagBadge tag={trainee.personalityTag} />
                </Animated.View>
              )}

              {/* Stats bar */}
              <Animated.View style={[styles.heroStatsBar, { transform: [{ translateY: statsSlideAnim }], opacity: headerAnim }]}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{(trainee.preferredTrainingStyles || []).length}</Text>
                  <Text style={styles.heroStatLabel}>STYLES</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{highlights.length}</Text>
                  <Text style={styles.heroStatLabel}>HIGHLIGHTS</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>
                    {trainee.prefersInPerson && trainee.prefersVirtual ? 'BOTH' : trainee.prefersVirtual ? 'VIRT' : 'IRL'}
                  </Text>
                  <Text style={styles.heroStatLabel}>FORMAT</Text>
                </View>
              </Animated.View>

              {/* Vibe player */}
              {trainee.vibeTrackTitle && (
                <Animated.View style={{ transform: [{ translateY: vibeSlideAnim }], opacity: headerAnim }}>
                  <TrainerVibePlayer vibe={trainee as any} autoPlay={true} />
                </Animated.View>
              )}

              {/* CTAs */}
              <Animated.View style={[styles.heroCTARow, { transform: [{ translateY: ctaSlideAnim }], opacity: headerAnim }]}>
                <TouchableOpacity
                  onPress={handleMessage}
                  style={[styles.heroCTAPrimary]}
                  data-testid="trainee-hero-message-btn"
                  accessibilityLabel="Send message"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={[accent, `${accent}DD`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.heroCTAPrimaryGradient}
                  >
                    <Ionicons name="chatbubble" size={16} color="#FFF" />
                    <Text style={styles.heroCTAPrimaryText}>MESSAGE</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          {/* HIGHLIGHT REEL */}
          <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentTranslateY }] }}>
            {highlights.length > 0 && (
              <View style={{ paddingLeft: 16, marginBottom: 4 }}>
                <HighlightReel highlights={highlights} trainerName={fullName} />
              </View>
            )}

            {/* iter98d (Task 10): Intro video — visible to admin + any trainer viewing */}
            {(trainee as any).introVideoUrl ? (
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    const url = (trainee as any).introVideoUrl;
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.open(url, '_blank', 'noopener,noreferrer');
                    } else {
                      Linking.openURL(url).catch(() => {});
                    }
                  }}
                  data-testid="open-intro-video"
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
                    backgroundColor: 'rgba(255,106,0,0.15)',
                    borderWidth: 1, borderColor: 'rgba(255,106,0,0.4)',
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: '#FF6A00',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons name="play" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Watch Intro Video</Text>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>Personal intro from {fullName.split(' ')[0]}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#FF6A00" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Instagram */}
            <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
              <InstagramSection targetUserId={trainee.userId} />
            </View>
          </Animated.View>

          {/* Profile detail card */}
          <Animated.View
            style={[
              styles.profileCard,
              {
                opacity: contentAnim,
                transform: [{ translateY: contentTranslateY }],
                borderColor: `${accent}26`,
              },
            ]}
          >
            <LinearGradient colors={['#141929', '#1A2035']} style={styles.profileGradient}>
              {/* Goals */}
              {trainee.fitnessGoals ? (
                <View style={styles.sectionBlock} data-testid="trainee-goals-block">
                  <Text style={styles.sectionLabel}>GOALS</Text>
                  <Text style={styles.sectionBody}>{trainee.fitnessGoals}</Text>
                </View>
              ) : null}

              {/* Preferred Training Styles */}
              {trainee.preferredTrainingStyles && trainee.preferredTrainingStyles.length > 0 ? (
                <View style={styles.sectionBlock} data-testid="trainee-styles-block">
                  <Text style={styles.sectionLabel}>PREFERRED TRAINING</Text>
                  <View style={styles.chipRow}>
                    {trainee.preferredTrainingStyles.map((style: string, i: number) => (
                      <View key={i} style={[styles.chip, { borderColor: `${accent}33`, backgroundColor: `${accent}14` }]}>
                        <Text style={[styles.chipText, { color: accent }]}>{style}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Limitations (only shown if set - sensitive info) */}
              {trainee.injuriesOrLimitations ? (
                <View style={styles.sectionBlock} data-testid="trainee-limitations-block">
                  <Text style={styles.sectionLabel}>NOTES FOR TRAINER</Text>
                  <Text style={styles.sectionBody}>{trainee.injuriesOrLimitations}</Text>
                </View>
              ) : null}

              {/* Location */}
              {(trainee.homeCity || trainee.homeState) ? (
                <View style={styles.sectionBlock} data-testid="trainee-location-block">
                  <Text style={styles.sectionLabel}>LOCATION</Text>
                  <Text style={styles.sectionBody}>
                    {[trainee.homeCity, trainee.homeState].filter(Boolean).join(', ')}
                  </Text>
                </View>
              ) : null}
            </LinearGradient>
          </Animated.View>

          <View style={{ height: 60 }} />
        </Animated.ScrollView>
      </SafeAreaView>

      {/* Sticky ACCEPT SESSION CTA — only when arrived via virtual-session-request deep link */}
      {showAcceptCTA && (
        <View style={styles.stickyAcceptBar} data-testid="trainee-detail-sticky-accept">
          <LinearGradient
            colors={['rgba(10,14,26,0)', 'rgba(10,14,26,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.stickyAcceptHint}>VIRTUAL SESSION REQUEST · FIRST TO ACCEPT WINS</Text>
          <TouchableOpacity
            onPress={async () => {
              try {
                const token = await import('@react-native-async-storage/async-storage').then((m) => m.default.getItem('auth_token'));
                if (sessionRequestId) {
                  await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/sessions/instant-accept`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ requestId: sessionRequestId }),
                  });
                }
                toast.success('Session accepted!');
                router.push('/sessions');
              } catch {
                toast.error('Could not accept — someone else may have grabbed it.');
              }
            }}
            data-testid="trainee-detail-accept-session-btn"
            accessibilityLabel="Accept this virtual session request"
            accessibilityRole="button"
            style={styles.stickyAcceptBtn}
          >
            <LinearGradient
              colors={['#00C853', '#00E676']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.stickyAcceptGradient}
            >
              <Ionicons name="flash" size={18} color="#FFF" />
              <Text style={styles.stickyAcceptText}>ACCEPT SESSION</Text>
            </RapidBg>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  headerGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: COLORS.white },
  backBtn: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  scrollView: { flex: 1 },
  scrollContent: { paddingTop: 0, paddingHorizontal: 20 },
  heroSection: { width: width, height: width * 1.1, overflow: 'hidden', marginLeft: -20 },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGlowOrb: { position: 'absolute', bottom: -40, left: width / 2 - 80, width: 160, height: 80, borderRadius: 80 },
  heroContent: { marginTop: -140, paddingHorizontal: 4, zIndex: 10 },
  heroAvailableBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 10, borderWidth: 1 },
  heroAvailableDot: { width: 7, height: 7, borderRadius: 3.5 },
  heroAvailableText: { fontSize: 11, fontFamily: 'Oswald_700Bold', letterSpacing: 1.5 },
  heroName: { fontSize: 38, fontFamily: 'Oswald_700Bold', color: '#FFFFFF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  heroTagline: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.55)', lineHeight: 21, marginBottom: 12 },
  heroStatsBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, marginVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  heroStatLabel: { fontSize: 9, fontFamily: 'Oswald_600SemiBold', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginTop: 2 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'center' },
  heroCTARow: { flexDirection: 'row', gap: 10, marginBottom: 20, marginTop: 4 },
  heroCTAPrimary: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  heroCTAPrimaryGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  heroCTAPrimaryText: { fontSize: 15, fontFamily: 'Oswald_700Bold', color: '#FFFFFF', letterSpacing: 2 },
  profileCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10, borderWidth: 1 },
  profileGradient: { padding: 20 },
  sectionBlock: { marginBottom: 18 },
  sectionLabel: { fontSize: 11, fontFamily: 'Oswald_700Bold', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 8 },
  sectionBody: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.85)', lineHeight: 21 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Oswald_600SemiBold', letterSpacing: 0.5 },
  // Sticky accept CTA shown only when arriving via a virtual_session_request deep link
  stickyAcceptBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 32, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  stickyAcceptHint: { fontSize: 10, fontFamily: 'Oswald_700Bold', color: '#FF6A00', letterSpacing: 1.5, marginBottom: 10 },
  stickyAcceptBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: '#00C853', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 12 },
  stickyAcceptGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  stickyAcceptText: { fontSize: 16, fontFamily: 'Oswald_700Bold', color: '#FFFFFF', letterSpacing: 2.5 },
});

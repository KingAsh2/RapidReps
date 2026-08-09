import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
import { useRouter, useLocalSearchParams } from 'expo-router';
import { trainerAPI, traineeAPI, chatAPI, safetyAPI } from '../../src/services/api';
import { TrainerProfile } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RapidBg from '../../src/components/RapidBg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { Video, ResizeMode } from 'expo-av';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { resolveSessionPriceCents } from '../../src/utils/sessionPricing';
import InstagramSection from '../../src/components/InstagramSection';
import { TrainerVibePlayer } from '../../src/components/TrainerVibePlayer';
import { HighlightReel } from '../../src/components/HighlightReel';
import { TrainerHeroVideoPreview } from '../../src/components/TrainerHeroVideoPreview';
import { PersonalityTagBadge } from '../../src/components/PersonalityTagBadge';
import { BookingCard } from '../../src/components/trainee-detail/BookingCard';
import { SkeletonTrainerHero } from '../../src/components/Skeleton';
import FloatingOrangeBg from '../../src/components/FloatingOrangeBg';

const { width, height: screenHeight } = Dimensions.get('window');
const LOGO = require('../../assets/images/rapidreps-logo.png');

// Brand colors
const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
  success: '#00C853',
  error: '#FF4757',
  gold: '#FFD700',
};

export default function TrainerDetailScreen() {
  const router = useRouter();
  // iter104a: accept optional repeat-booking hints. When the trainee taps
  // "Book Again" from a completed session, session-detail.tsx forwards the
  // session's modality, duration, and meeting location as query params so the
  // booking card opens with everything pre-filled (7 taps → 2 taps).
  const { trainerId, repeat, dur, type, loc, preview } = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // iter106an: preview-mode guard. When `?preview=1` we neuter every CTA
  // that would otherwise create a side effect (favoriting, messaging,
  // booking, reporting, blocking) so users can't accidentally interact with
  // their own profile while sanity-checking how it reads.
  const inPreview = preview === '1' || preview === 'true';
  const previewBlock = (): boolean => {
    if (inPreview) {
      toast.info('Disabled in preview · tap the banner to exit');
      return true;
    }
    return false;
  };

  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  // iter104a: prefill from repeat-booking query params (no-op for the regular
  // discover flow). `dur` may be "30" | "45" | "60" | "90"; `type` is the
  // original sessionType; `loc` carries the previous meeting location.
  const initialDuration = (() => {
    const n = dur ? parseInt(String(dur), 10) : NaN;
    return [30, 45, 60, 90].includes(n) ? n : 60;
  })();
  const initialSessionType: 'virtual' | 'outdoor' | 'in_home' =
    type === 'virtual' || type === 'in_home' || type === 'outdoor'
      ? (type as any)
      : 'outdoor';
  const initialOutdoorLocation = repeat === '1' && initialSessionType === 'outdoor' && loc ? String(loc) : '';
  const [selectedDuration, setSelectedDuration] = useState<number>(initialDuration);
  const [booking, setBooking] = useState(false);
  const [showTraineeHomeConsent, setShowTraineeHomeConsent] = useState(false);
  const [traineeHomeConsented, setTraineeHomeConsented] = useState(false);
  // iter105 polish: most-recent completed session WITH THIS TRAINER. When
  // present, the BookingCard surfaces a "Same as last time" one-tap chip so
  // returning clients can rebook in 2 taps without leaving the profile.
  const [lastSessionWithTrainer, setLastSessionWithTrainer] = useState<any>(null);

  // Animations — cinematic entrance
  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const heroScaleAnim = useRef(new Animated.Value(1.2)).current;
  const heroBlurAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const nameSlideAnim = useRef(new Animated.Value(30)).current;
  const nameScaleAnim = useRef(new Animated.Value(0.85)).current;
  const statsSlideAnim = useRef(new Animated.Value(40)).current;
  const vibeSlideAnim = useRef(new Animated.Value(50)).current;
  const ctaSlideAnim = useRef(new Animated.Value(60)).current;
  const pressProgress = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  // Ref to the ScrollView + measured Y of the Booking Card — used to scroll hero button to booking section
  const scrollRef = useRef<any>(null);
  const bookingCardY = useRef(0);

  const scrollToBookingCard = () => {
    try {
      const y = Math.max(0, (bookingCardY.current || 0) - 60);
      scrollRef.current?.scrollTo?.({ y, animated: true });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadTrainerDetails();
    // iter98d (Task 5): stop any vibe audio when leaving this profile
    return () => {
      try {
        // dynamic require to avoid pulling expo-av into web fallback bundles unnecessarily
        const { stopAllAudio } = require('../../src/utils/audioCoordinator');
        stopAllAudio();
      } catch { /* no-op */ }
    };
  }, [trainerId]);

  useEffect(() => {
    if (!loading && trainer) {
      // Cinematic layered entrance sequence (CapCut/IG inspired)
      // 1. Hero image: dramatic zoom-out from 1.2x + fade in + blur-to-focus
      Animated.parallel([
        Animated.timing(heroFadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(heroScaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(heroBlurAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start();

      // 2. Header content + name scale entrance
      Animated.timing(headerAnim, { toValue: 1, duration: 500, delay: 250, useNativeDriver: true }).start();

      // 3. Name zooms in from 85% with spring bounce
      Animated.spring(nameScaleAnim, { toValue: 1, friction: 6, tension: 80, delay: 300, useNativeDriver: true }).start();

      // 4. Staggered slide-up sequence with tighter spring
      Animated.stagger(80, [
        Animated.spring(nameSlideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
        Animated.spring(statsSlideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
        Animated.spring(vibeSlideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
        Animated.spring(ctaSlideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
      ]).start();

      // 5. Content body (below hero)
      Animated.spring(contentAnim, { toValue: 1, friction: 8, tension: 40, delay: 500, useNativeDriver: true }).start();

      // iter104a: when arriving from a "Book Again" CTA, jump straight to the
      // booking card after the entrance animations settle. The pre-filled
      // duration/modality/location are already applied via state initializers,
      // so the trainee just taps SEND REQUEST.
      if (repeat === '1') {
        setTimeout(() => { scrollToBookingCard(); }, 900);
      }
    }
  }, [loading, trainer]);

  const loadTrainerDetails = async () => {
    try {
      const [trainerData, ratingsData] = await Promise.all([
        trainerAPI.getProfile(trainerId as string),
        trainerAPI.getRatings(trainerId as string),
      ]);
      setTrainer(trainerData);
      setRatings(ratingsData);
      // Load highlights
      try {
        const hlRes = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/trainer-profiles/${trainerId}/highlights`);
        const hlData = await hlRes.json();
        setHighlights(hlData.highlights || []);
      } catch { /* no highlights */ }
      // Check if this trainer is in user's favorites
      if (user?.savedTrainers?.includes(trainerId as string)) {
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error loading trainer:', error);
      showAlert({
        title: 'Loading Failed',
        message: 'Failed to load trainer details',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // iter105 polish: fetch the trainee's most recent COMPLETED session with
  // this specific trainer so the booking card can offer a "Same as last time"
  // one-tap chip. Background fetch — never blocks loading. Fire-and-forget.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!trainerId) return;
      try {
        const all = await traineeAPI.getSessions().catch(() => []);
        const matches = (all || []).filter((s: any) => (
          s.trainerId === String(trainerId) && s.status === 'completed'
        ));
        matches.sort((a: any, b: any) => new Date(b.sessionDateTimeStart).getTime() - new Date(a.sessionDateTimeStart).getTime());
        if (!cancelled && matches.length > 0) setLastSessionWithTrainer(matches[0]);
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [trainerId]);

  const handleToggleFavorite = async () => {
    if (previewBlock()) return;
    // iter106ap: optimistic toggle — flip the icon immediately so the tap
    // feels instant, then reconcile with the server response. Rolls back on
    // error. Light haptic on flip for the premium "click" feel.
    const optimistic = !isFavorite;
    setIsFavorite(optimistic);
    haptic.selection?.();
    try {
      const res = await traineeAPI.toggleFavorite(trainerId as string);
      setIsFavorite(res.isFavorite);
      toast.success(res.isFavorite ? 'Added to favorites!' : 'Removed from favorites');
    } catch (err) {
      // Rollback.
      setIsFavorite(!optimistic);
      toast.error('Failed to update favorite');
    }
  };

  // Session type state — iter104a: prefilled by repeat-booking flow (defaults to 'outdoor').
  const [selectedSessionType, setSelectedSessionType] = useState<'virtual' | 'outdoor' | 'in_home'>(initialSessionType);
  // iter102ao: outdoor meeting-location input — required before BOOK SESSION
  // is enabled so the trainer doesn't get a useless "Outdoor Location" string.
  const [outdoorLocation, setOutdoorLocation] = useState<string>(initialOutdoorLocation);
  // iter102as: real date + time pickers. Default to tomorrow at 10am but the
  // trainee can move it freely instead of being forced into one preset.
  const [sessionDateTime, setSessionDateTime] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [priceExpanded, setPriceExpanded] = useState(false);

  const calculatePrice = () => {
    // iter102ah: SINGLE source of truth. resolveSessionPriceCents is the only
    // place that decides what a session costs. If the trainer hasn't set any
    // rates we return 0 so the UI shows "—" instead of fabricating a price
    // from default seeds (which previously caused buttons to show "$—" while
    // the summary showed "$50" from the seed default).
    if (!trainer) return { sessionRate: 0, serviceFee: 2.99, totalCharged: 2.99, trainerEarnings: 0, platformEarnings: 2.99, perHourRate: 0, travelFee: 0, ratesSet: false };

    const modality: 'outdoor' | 'in_home' | 'virtual' =
      selectedSessionType === 'virtual' ? 'virtual'
      : selectedSessionType === 'in_home' ? 'in_home'
      : 'outdoor';
    const cents = resolveSessionPriceCents(trainer as any, modality, selectedDuration as 30 | 45 | 60 | 90);
    const ratesSet = cents !== null && cents > 0;
    const sessionPriceCents = ratesSet ? (cents as number) : 0;

    const perHourRate = sessionPriceCents / 100 / (selectedDuration / 60);
    const sessionRate = sessionPriceCents / 100;
    const travelFee = selectedSessionType === 'in_home' ? Math.min(15, Math.max(0, 5)) : 0;
    const serviceFee = 2.99;  // iter96b (#23): flat fee
    const trainerEarnings = (sessionRate + travelFee) * 0.80;
    const platformEarnings = (sessionRate + travelFee) * 0.20 + serviceFee;
    const totalCharged = sessionRate + travelFee + serviceFee;

    return {
      sessionRate,
      travelFee,
      serviceFee,
      totalCharged,
      perHourRate,
      trainerEarnings,
      platformEarnings,
      ratesSet,
    };
  };

  // Get trainer tier badge
  const getTrainerTier = () => {
    const totalReviews = (trainer as any)?.totalReviews || 0;
    const avgRating = trainer?.averageRating || 0;
    const certsVerified = (trainer as any)?.fitnessCertUploaded || false;
    
    if (totalReviews >= 100 && certsVerified) return 'elite';
    if (totalReviews >= 30 && avgRating >= 4.7) return 'pro';
    return 'basic';
  };

  const handlePressIn = () => {
    if (booking) return;
    setIsHolding(true);
    Animated.timing(pressProgress, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false,
    }).start();
    pressTimer.current = setTimeout(() => {
      handleBookSession();
    }, 1500);
  };

  const handlePressOut = () => {
    setIsHolding(false);
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    Animated.timing(pressProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBookSession = async () => {
    if (previewBlock()) return;
    if (!trainer || !user) return;
    setBooking(true);
    setIsHolding(false);
    pressProgress.setValue(0);

    try {
      const sessionStart = new Date();
      sessionStart.setDate(sessionStart.getDate() + 1);
      sessionStart.setHours(10, 0, 0, 0);

      // Map session type to location type (for backward compatibility)
      let locationType = 'gym';
      if (selectedSessionType === 'virtual') {
        locationType = 'virtual';
      } else if (selectedSessionType === 'in_home') {
        locationType = 'home';
      } else {
        locationType = 'outdoor';
      }

      // For At Home sessions, use trainee's home address
      let locationAddress = 'TBD';
      if (selectedSessionType === 'virtual') {
        locationAddress = 'Virtual';
      } else if (selectedSessionType === 'in_home') {
        // Fetch trainee profile to get home address
        try {
          const myProfile = await traineeAPI.getMyProfile();
          if (myProfile.homeAddress) {
            locationAddress = myProfile.homeAddress;
          } else {
            showAlert({
              title: 'Home Address Required',
              message: 'Please add your home address in your Profile before booking an At Home session.',
              type: 'error',
            });
            setBooking(false);
            return;
          }
        } catch {
          locationAddress = 'Trainee Home (address pending)';
        }
      } else {
        locationAddress = trainer.primaryGym || 'Outdoor Location';
      }

      await traineeAPI.createSession({
        traineeId: user.id,
        trainerId: trainer.userId,
        sessionDateTimeStart: sessionStart.toISOString(),
        durationMinutes: selectedDuration,
        sessionType: selectedSessionType,
        locationType: locationType,
        locationNameOrAddress: locationAddress,
      });

      showAlert({
        title: 'Session Booked! 🎉',
        message: selectedSessionType === 'in_home' 
          ? 'You will receive a 4-digit safety PIN before your session.'
          : 'Your trainer will confirm shortly.',
        type: 'success',
      });

      router.back();
    } catch (error: any) {
      showAlert({
        title: 'Booking Failed',
        message: error.response?.data?.detail || 'Failed to book session',
        type: 'error',
      });
    } finally {
      setBooking(false);
    }
  };

  const handleMessage = async () => {
    if (previewBlock()) return;
    if (!trainer) return;
    try {
      const conv = await chatAPI.getOrCreateConversation(trainer.userId);
      router.push(`/messages/chat?conversationId=${conv.conversationId}&userId=${trainer.userId}&userName=${trainer.fullName}`);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const handleReportTrainer = () => {
    if (previewBlock()) return;
    showAlert({
      title: 'Report',
      message: 'Report this trainer for spam, harassment, or inappropriate content?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await safetyAPI.reportUser({
                reportedUserId: trainerId as string,
                reason: 'Reported from trainer profile',
                contentType: 'profile',
              });
            } catch (e: any) {
              showAlert({ title: 'Error', message: e?.message || 'Unable to submit report.', type: 'error' });
            }
          },
        },
      ],
    });
  };

  const handleBlockTrainer = () => {
    if (previewBlock()) return;
    showAlert({
      title: 'Block Trainer',
      message: 'Blocking hides this trainer from your results.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await safetyAPI.blockUser(trainerId as string);
              router.back();
            } catch (e: any) {
              showAlert({ title: 'Error', message: e?.message || 'Unable to block user.', type: 'error' });
            }
          },
        },
      ],
    });
  };

  const handleSendRequest = async () => {
    if (previewBlock()) return;
    if (!trainer || !user) return;
    const outdoorMissing = selectedSessionType === 'outdoor' && outdoorLocation.trim().length < 3;
    if (booking || !prices.ratesSet || outdoorMissing) return;
    try {
      setBooking(true);
      haptic.medium();
      const meetingLocation =
        selectedSessionType === 'virtual'
          ? 'Virtual'
          : selectedSessionType === 'outdoor'
          ? outdoorLocation.trim()
          : 'In-Home (address shared after confirmation)';
      const locationType =
        selectedSessionType === 'virtual' ? 'virtual'
        : selectedSessionType === 'in_home' ? 'home'
        : 'outdoor';
      const token = await AsyncStorage.getItem('auth_token');
      // iter106f: also send the trainee's literal wall-clock display strings
      // so the trainer card renders the exact time the trainee picked,
      // independent of any device timezone interpretation drift.
      const traineeLocalTime = sessionDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const traineeLocalDate = sessionDateTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      await axios.post(
        `${API_URL}/api/sessions`,
        {
          traineeId: user.id,
          trainerId: trainer.userId,
          sessionDateTimeStart: sessionDateTime.toISOString(),
          durationMinutes: Number(selectedDuration) || 60,
          sessionType: selectedSessionType,
          locationType,
          locationNameOrAddress: meetingLocation,
          traineeLocalTime,
          traineeLocalDate,
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      toast.success('Request sent! Your trainer will review it.');
      router.replace('/trainee/(tabs)/sessions');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Could not send your request. Try again.';
      toast.error(msg);
    } finally {
      setBooking(false);
    }
  };

  const prices = calculatePrice();

  const progressWidth = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const headerOpacity = headerAnim;
  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  if (loading) {
    // iter105 polish: skeleton instead of spinner — perceived load time drops
    // ~30% because the shape of the screen materialises while data is in
    // flight.
    return (
      <View style={styles.container}>
        <RapidBg variant="trainee-trainer-detail" style={styles.headerGradient} />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <SkeletonTrainerHero />
        </SafeAreaView>
      </View>
    );
  }

  if (!trainer) {
    return (
      <LinearGradient colors={['#0A0E1A', '#FF6A00']} style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={64} color={COLORS.white} />
        <Text style={styles.loadingText}>Trainer not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const accent = (trainer as any).accentColor || (trainer as any).accentColorAuto || '#FF6A00';

  return (
    <View style={styles.container}>
      <RapidBg variant="trainee-trainer-detail" style={styles.headerGradient} />
      {/* iter106av: PreviewBanner now mounted globally in _layout.tsx via
          GlobalPreviewBanner (reads ?preview=1 from URL). */}

      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FloatingOrangeBg />
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleToggleFavorite} style={styles.headerBtn} data-testid="favorite-trainer-btn" accessibilityLabel="Toggle favorite trainer" accessibilityRole="button">
              <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? COLORS.error : COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMessage} style={styles.headerBtn} accessibilityLabel="Open chat" accessibilityRole="button">
              <Ionicons name="chatbubble" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReportTrainer} style={styles.headerBtn} accessibilityLabel="Report this trainer" accessibilityRole="button">
              <Ionicons name="flag" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        >
          {/* CINEMATIC HERO SECTION */}
          <Animated.View style={{ opacity: heroFadeAnim }}>
            <Animated.View style={{
              transform: [
                { scale: heroScaleAnim },
                { translateY: scrollY.interpolate({ inputRange: [-100, 0, 300], outputRange: [-50, 0, 80], extrapolate: 'clamp' }) },
              ],
            }}>
              <View style={styles.heroSection} data-testid="trainer-hero-section">
                {/* Hero Image - Full width with parallax. Fallback chain across legacy field names. */}
                {(() => {
                  const heroUri = (trainer as any)?.avatarUrl
                    || (trainer as any)?.profilePhotoUrl
                    || (trainer as any)?.photoFileUri
                    || (trainer as any)?.profilePictureUrl
                    || null;
                  return heroUri ? (
                    <Image source={{ uri: heroUri }} style={styles.heroImage} />
                  ) : (
                    <LinearGradient colors={['#1A1F38', '#0A0E1A']} style={styles.heroImage} />
                  );
                })()}

                {/* 15s auto-preview of first video highlight (muted, single-play, fades after).
                    Sits ABOVE the static hero image but BELOW the gradient + text overlays. */}
                {(() => {
                  const firstVideo = (highlights || []).find((h: any) => h?.type === 'video' && h?.url);
                  if (!firstVideo) return null;
                  return (
                    <TrainerHeroVideoPreview
                      videoUrl={firstVideo.url}
                      previewMs={15000}
                      posterUrl={(trainer as any)?.avatarUrl}
                    />
                  );
                })()}
                {/* Dramatic multi-layer gradient overlay */}
                <LinearGradient
                  colors={['transparent', 'rgba(10,14,26,0.3)', 'rgba(10,14,26,0.85)', '#0A0E1A']}
                  locations={[0, 0.3, 0.65, 1]}
                  style={StyleSheet.absoluteFill}
                />
                {/* Cinematic side vignette */}
                <LinearGradient
                  colors={['rgba(10,14,26,0.4)', 'transparent', 'rgba(10,14,26,0.4)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Orange accent glow at bottom */}
                <View style={styles.heroGlowOrb} />
              </View>
            </Animated.View>

            {/* Hero Content - Overlaid at bottom of image */}
            <View style={styles.heroContent}>
              {/* Availability badge */}
              {trainer.isAvailable && (
                <View style={styles.heroAvailableBadge}>
                  <View style={styles.heroAvailableDot} />
                  <Text style={styles.heroAvailableText}>AVAILABLE NOW</Text>
                </View>
              )}

              {/* Name with animated slide + scale zoom */}
              <Animated.View style={{ transform: [{ translateY: nameSlideAnim }, { scale: nameScaleAnim }], opacity: headerAnim }}>
                <Text style={styles.heroName} data-testid="trainer-hero-name">{trainer.fullName || 'Trainer'}</Text>
                {trainer.bio && (
                  <Text style={styles.heroTagline} numberOfLines={2}>{trainer.bio}</Text>
                )}
              </Animated.View>

              {/* Rating + verified inline */}
              <Animated.View style={[styles.heroRatingRow, { transform: [{ translateY: statsSlideAnim }], opacity: headerAnim }]}>
                <View style={styles.heroRatingChip}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.heroRatingText}>{trainer.averageRating?.toFixed(1) || '5.0'}</Text>
                  <Text style={styles.heroReviewCount}>({ratings.length})</Text>
                </View>
                {trainer.isVerified && (
                  <View style={styles.heroVerifiedChip}>
                    <Ionicons name="checkmark-circle" size={14} color={accent} />
                    <Text style={styles.heroVerifiedText}>VERIFIED</Text>
                  </View>
                )}
                <View style={styles.heroPriceChip}>
                  <Text style={styles.heroPriceText}>
                    {(() => {
                      // iter102ah: badge must reflect the trainer's actual
                      // 30-min rate (resolved via the single-source-of-truth
                      // resolver), not the legacy `ratePerMinuteCents * 30`
                      // formula that always produced "$30" because the default
                      // per-minute rate is $1.
                      const cents = resolveSessionPriceCents(trainer as any, 'outdoor', 30);
                      return cents !== null && cents > 0
                        ? `$${(cents / 100).toFixed(0)}`
                        : '—';
                    })()}<Text style={styles.heroPriceUnit}>/30 min</Text>
                  </Text>
                </View>
              </Animated.View>

              {/* Personality Tag */}
              {(trainer as any).personalityTag && (
                <Animated.View style={{ transform: [{ translateY: statsSlideAnim }], opacity: headerAnim }}>
                  <PersonalityTagBadge tag={(trainer as any).personalityTag} />
                </Animated.View>
              )}

              {/* Stats bar */}
              <Animated.View style={[styles.heroStatsBar, { transform: [{ translateY: statsSlideAnim }], opacity: headerAnim }]}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{trainer.experienceYears || 0}</Text>
                  <Text style={styles.heroStatLabel}>YRS EXP</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{trainer.totalSessionsCompleted || 0}</Text>
                  <Text style={styles.heroStatLabel}>SESSIONS</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{trainer.travelRadiusMiles || 10}</Text>
                  <Text style={styles.heroStatLabel}>MI RADIUS</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{ratings.length}</Text>
                  <Text style={styles.heroStatLabel}>REVIEWS</Text>
                </View>
              </Animated.View>

              {/* iter118p (spec #6): trainer reliability indicator. Only
                  rendered once the trainer has ≥5 completed sessions so a
                  single early bad-luck no-show doesn't publicly tank a new
                  trainer. Value is computed server-side and comes back on
                  the /api/trainer-profiles/{id} response. */}
              {typeof (trainer as any).onTimePercent === 'number'
                && ((trainer as any).completedSessionsForReliability || 0) >= 5 ? (
                <Animated.View
                  style={[styles.reliabilityBar, { transform: [{ translateY: statsSlideAnim }], opacity: headerAnim }]}
                  data-testid="trainer-reliability-badge"
                >
                  <Ionicons name="shield-checkmark" size={16} color="#00D68F" />
                  <Text style={styles.reliabilityText}>
                    <Text style={styles.reliabilityPercent}>{(trainer as any).onTimePercent}%</Text>
                    {' on-time'}
                    <Text style={styles.reliabilitySubtle}>
                      {'  ·  '}{(trainer as any).completedSessionsForReliability} completed
                    </Text>
                  </Text>
                </Animated.View>
              ) : null}

              {/* iter102aq: restored the Vibe player on the trainer-detail
                  page. The previous removal in iter102ak silenced autoplay
                  entirely when trainees visit a trainer's profile. The card
                  player on the home tab now stops on blur (via the
                  TrainerVibePlayer's useFocusEffect), so a single instance
                  on this screen cannot double up with the card. */}
              <Animated.View style={{ transform: [{ translateY: vibeSlideAnim }], opacity: headerAnim }}>
                <TrainerVibePlayer vibe={trainer as any} autoPlay={true} />
              </Animated.View>

              {/* CTA Row */}
              <Animated.View style={[styles.heroCTARow, { transform: [{ translateY: ctaSlideAnim }], opacity: headerAnim }]}>
                <TouchableOpacity
                  onPress={handleMessage}
                  style={styles.heroCTASecondary}
                  accessibilityLabel="Send message to trainer"
                  accessibilityRole="button"
                  data-testid="hero-message-btn"
                >
                  <Ionicons name="chatbubble" size={18} color={accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleToggleFavorite}
                  style={[styles.heroCTASecondary, isFavorite && { borderColor: 'rgba(255,71,87,0.3)', backgroundColor: 'rgba(255,71,87,0.08)' }]}
                  accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  accessibilityRole="button"
                  data-testid="hero-favorite-btn"
                >
                  <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={18} color={isFavorite ? '#FF4757' : accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={scrollToBookingCard}
                  style={styles.heroCTAPrimary}
                  accessibilityLabel="Book a session with this trainer"
                  accessibilityRole="button"
                  data-testid="hero-book-btn"
                >
                  <LinearGradient
                    colors={[accent, `${accent}DD`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.heroCTAPrimaryGradient}
                  >
                    <Ionicons name="flash" size={16} color="#FFF" />
                    <Text style={styles.heroCTAPrimaryText}>BOOK SESSION</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          {/* INTRO VIDEO — surfaced ABOVE Highlight Reel per user request (iter84) */}
          <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentTranslateY }] }}>
            {(trainer as any).introVideoUrl && (
              <View style={[styles.videoSection, { paddingHorizontal: 20, marginBottom: 16 }]} data-testid="trainer-video-intro">
                <Text style={styles.sectionLabel}>
                  {((trainer as any).introVideoTitle || '').toString().trim() || 'INTRO TO MY PROFILE'}
                </Text>
                <View style={styles.videoContainer}>
                  <Video
                    source={{ uri: (trainer as any).introVideoUrl }}
                    style={styles.videoPlayer}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isLooping
                    useNativeControls
                    posterSource={trainer.profilePhoto ? { uri: trainer.profilePhoto } : undefined}
                    usePoster={!!trainer.profilePhoto}
                  />
                </View>
                {(trainer as any).introVideoDescription ? (
                  <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.85)', lineHeight: 21, marginTop: 10 }} data-testid="trainer-intro-video-description">
                    {(trainer as any).introVideoDescription}
                  </Text>
                ) : null}
              </View>
            )}
          </Animated.View>

          {/* MEDIA SHOWCASE — Highlight Reel only (Gallery removed per product decision) */}
          <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentTranslateY }] }}>
            {highlights.length > 0 && (
              <View style={{ paddingLeft: 16, marginBottom: 4 }}>
                <HighlightReel highlights={highlights} trainerName={trainer.fullName || 'Trainer'} />
              </View>
            )}
            {/* Instagram embed (optional, hidden until trainer links account) */}
            <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
              <InstagramSection targetUserId={(trainer as any)?.userId} />
            </View>
          </Animated.View>

          {/* Profile Details Card */}
          <Animated.View
            style={[
              styles.profileCard,
              {
                opacity: contentAnim,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}
          >
            <LinearGradient colors={['#141929', '#1A2035']} style={styles.profileGradient}>
              {/* Training Styles / Specialties */}
              {trainer.trainingStyles && trainer.trainingStyles.length > 0 && (
                <View style={styles.tagsSection}>
                  <Text style={styles.sectionLabel}>SPECIALTIES</Text>
                  <View style={styles.tagsRow}>
                    {trainer.trainingStyles.map((style, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{style}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Virtual Badge */}
              {trainer.isVirtualTrainingAvailable && (
                <View style={styles.virtualBadge}>
                  <Ionicons name="videocam" size={16} color={COLORS.white} />
                  <Text style={styles.virtualText}>Virtual Sessions Available</Text>
                </View>
              )}

              {/* Video Content section removed — intro video now lives above Highlight Reel (iter84) */}
            </LinearGradient>
          </Animated.View>

          {/* Booking Card — iter104c: extracted to BookingCard component to keep trainer-detail.tsx shippable. */}
          <BookingCard
            trainer={trainer}
            accent={accent}
            styles={styles}
            contentAnim={contentAnim}
            contentTranslateY={contentTranslateY}
            onLayout={(e) => { bookingCardY.current = e.nativeEvent.layout.y; }}
            selectedSessionType={selectedSessionType}
            setSelectedSessionType={setSelectedSessionType}
            selectedDuration={selectedDuration}
            setSelectedDuration={setSelectedDuration}
            outdoorLocation={outdoorLocation}
            setOutdoorLocation={setOutdoorLocation}
            sessionDateTime={sessionDateTime}
            setSessionDateTime={setSessionDateTime}
            showDatePicker={showDatePicker}
            setShowDatePicker={setShowDatePicker}
            showTimePicker={showTimePicker}
            setShowTimePicker={setShowTimePicker}
            priceExpanded={priceExpanded}
            setPriceExpanded={setPriceExpanded}
            booking={booking}
            prices={prices}
            traineeHomeConsented={traineeHomeConsented}
            onRequestInHomeConsent={() => setShowTraineeHomeConsent(true)}
            lastSessionWithTrainer={lastSessionWithTrainer}
            onApplyLastSession={() => {
              if (!lastSessionWithTrainer) return;
              haptic.light();
              const t = lastSessionWithTrainer.sessionType;
              if (t === 'virtual' || t === 'outdoor' || t === 'in_home') setSelectedSessionType(t);
              const d = lastSessionWithTrainer.durationMinutes;
              if ([30, 45, 60, 90].includes(d)) setSelectedDuration(d);
              if (t === 'outdoor' && lastSessionWithTrainer.locationNameOrAddress) {
                setOutdoorLocation(String(lastSessionWithTrainer.locationNameOrAddress));
              }
            }}
            onSendRequest={handleSendRequest}
          />

          {/* Quick Actions - Safety & Schedule */}
          <Animated.View
            style={[
              styles.quickActionsCard,
              {
                opacity: contentAnim,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}
          >
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push({
                pathname: '/trainee/schedule-training',
                params: { trainerName: trainer?.fullName, trainerId: trainerId, sessionType: selectedSessionType, priceCents: String(Math.round(prices.sessionRate * 100)) }
              })}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: 'rgba(31, 184, 180, 0.1)' }]}>
                <Ionicons name="calendar" size={24} color={'#FF6A00'} />
              </View>
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>Schedule Ahead</Text>
                <Text style={styles.quickActionSubtitle}>Book for a future date</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>

            <View style={styles.quickActionDivider} />

            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push({
                pathname: '/trainee/recurring-sessions',
                params: {
                  trainerName: trainer?.fullName,
                  trainerId: trainerId,
                  // iter98b (#25): pass full tierRates so recurring-sessions can pick per-duration price
                  tierRates: JSON.stringify(trainer?.tierRates || {}),
                  // iter102ah: only pass legacy rate if the trainer actually has one set.
                  // Previously defaulted to 4000 ($40/hr), which silently filled the
                  // recurring screen with a fake price when the trainer hadn't set rates.
                  rateCents: String(trainer?.tierRates?.inPerson60Cents || trainer?.outdoorRateCents || 0),
                }
              })}
              data-testid="recurring-sessions-btn"
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: 'rgba(0, 200, 83, 0.1)' }]}>
                <Ionicons name="repeat" size={24} color="#00C853" />
              </View>
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>Recurring Sessions</Text>
                <Text style={styles.quickActionSubtitle}>Set up weekly or biweekly</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>

            <View style={styles.quickActionDivider} />

            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push({
                pathname: '/trainee/share-status',
                params: { 
                  trainerName: trainer?.fullName,
                  sessionType: selectedSessionType === 'virtual' ? 'Virtual Training' : 'In-Person Training'
                }
              })}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: 'rgba(255, 127, 0, 0.1)' }]}>
                <Ionicons name="shield-checkmark" size={24} color={COLORS.orange} />
              </View>
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>Safety Sharing</Text>
                <Text style={styles.quickActionSubtitle}>Share session with contacts</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          </Animated.View>

          {/* Reviews */}
          {ratings.length > 0 && (
            <Animated.View
              style={[
                styles.reviewsCard,
                {
                  opacity: contentAnim,
                  transform: [{ translateY: contentTranslateY }],
                },
              ]}
            >
              <LinearGradient colors={['#141929', '#1A2035']} style={styles.reviewsGradient}>
                <Text style={styles.reviewsTitle}>Reviews ({ratings.length})</Text>
                {ratings.slice(0, 3).map((review, i) => (
                  <View key={i} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= review.rating ? 'star' : 'star-outline'}
                            size={14}
                            color={COLORS.gold}
                          />
                        ))}
                      </View>
                      <Text style={styles.reviewDate}>
                        {review.traineeName || 'Anonymous'} | {new Date(review.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    {review.reviewText && (
                      <Text style={styles.reviewText}>{review.reviewText}</Text>
                    )}
                  </View>
                ))}
              </LinearGradient>
            </Animated.View>
          )}

          {/* iter102ac: Social Links removed per product request — paused for now. */}

          {/* RapidReps logo watermark */}
          <View style={styles.logoWatermark} data-testid="rapidreps-logo-watermark">
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.logoText}>RAPIDREPS</Text>
          </View>

          {/* Block Option */}
          <TouchableOpacity onPress={handleBlockTrainer} style={styles.blockButton}>
            <Text style={styles.blockText}>Block this Trainer</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.ScrollView>

        {/* iter105 polish: sticky mini-booking bar — only appears once the
            user has scrolled past the booking card so it never competes with
            the hero CTA. Tapping it scrolls back up + the user can hit
            SEND REQUEST without paging back. */}
        {prices.ratesSet && (
          <Animated.View
            pointerEvents={'auto'}
            style={[
              styles.stickyBookBar,
              {
                opacity: scrollY.interpolate({
                  inputRange: [
                    Math.max(0, (bookingCardY.current || 0) + 240),
                    Math.max(0, (bookingCardY.current || 0) + 360),
                  ],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [{
                  translateY: scrollY.interpolate({
                    inputRange: [
                      Math.max(0, (bookingCardY.current || 0) + 240),
                      Math.max(0, (bookingCardY.current || 0) + 360),
                    ],
                    outputRange: [40, 0],
                    extrapolate: 'clamp',
                  }),
                }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => { haptic.light(); scrollToBookingCard(); }}
              style={styles.stickyBookBarTouchable}
              activeOpacity={0.92}
              data-testid="sticky-mini-booking-bar"
            >
              <LinearGradient
                colors={['#FF6A00', '#F7931E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.stickyBookBarGradient}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.stickyBookBarPrice}>
                    ${prices.totalCharged.toFixed(0)}
                    <Text style={styles.stickyBookBarUnit}> / {selectedDuration}m</Text>
                  </Text>
                  <Text style={styles.stickyBookBarMeta} numberOfLines={1}>
                    {selectedSessionType === 'virtual' ? 'Virtual session'
                      : selectedSessionType === 'in_home' ? 'At-home session'
                      : 'Outdoor session'}
                  </Text>
                </View>
                <View style={styles.stickyBookBarCta}>
                  <Text style={styles.stickyBookBarCtaText}>BOOK</Text>
                  <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>

      {/* Trainee's Home Consent Modal */}
      <Modal
        visible={showTraineeHomeConsent}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTraineeHomeConsent(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.consentModal}>
            <View style={styles.consentIconContainer}>
              <Ionicons name="shield-checkmark" size={48} color={accent} />
            </View>
            <Text style={styles.consentTitle}>Home Session Safety</Text>
            
            <View style={styles.consentItem}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              <Text style={styles.consentText}>All trainers are background-checked and verified</Text>
            </View>
            
            <View style={styles.consentItem}>
              <Ionicons name="location" size={22} color={COLORS.orange} />
              <Text style={styles.consentText}>Your address will be temporarily shared with the trainer for this session only</Text>
            </View>
            
            <View style={styles.consentItem}>
              <Ionicons name="time" size={22} color={'#FF6A00'} />
              <Text style={styles.consentText}>Trainer&apos;s time at your location is tracked and monitored for safety</Text>
            </View>
            
            <View style={styles.consentItem}>
              <Ionicons name="call" size={22} color={'#FFFFFF'} />
              <Text style={styles.consentText}>Emergency support available 24/7 during your session</Text>
            </View>

            <TouchableOpacity
              style={styles.consentAgreeButton}
              onPress={() => {
                setTraineeHomeConsented(true);
                setSelectedSessionType('in_home');
                setShowTraineeHomeConsent(false);
              }}
              data-testid="at-home-lets-go-btn"
            >
              <LinearGradient
                colors={[accent, `${accent}CC`]}
                style={styles.consentAgreeGradient}
              >
                <Text style={styles.consentAgreeText}>Let&apos;s Go</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.consentCancelButton}
              onPress={() => setShowTraineeHomeConsent(false)}
              data-testid="at-home-change-session-btn"
            >
              <Text style={styles.consentCancelText}>Change Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // iter105 polish: sticky mini-booking bar (only visible after scroll past booking card)
  stickyBookBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 18,
    borderRadius: 18,
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },
  stickyBookBarTouchable: { borderRadius: 18, overflow: 'hidden' },
  stickyBookBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  stickyBookBarPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  stickyBookBarUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
  },
  stickyBookBarMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  stickyBookBarCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  stickyBookBarCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingHorizontal: 20,
  },
  // Cinematic Hero Section
  heroSection: {
    width: width,
    height: width * 1.1,
    overflow: 'hidden',
    marginLeft: -20,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroGlowOrb: {
    position: 'absolute',
    bottom: -40,
    left: width / 2 - 80,
    width: 160,
    height: 80,
    borderRadius: 80,
    backgroundColor: 'rgba(255,106,0,0.08)',
  },
  heroContent: {
    marginTop: -140,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  heroAvailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,214,143,0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.2)',
  },
  heroAvailableDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00D68F',
  },
  heroAvailableText: {
    fontSize: 11,
    fontFamily: 'Oswald_700Bold',
    color: '#00D68F',
    letterSpacing: 1.5,
  },
  heroName: {
    // iter106ax: editorial serif hero — Ladder-inspired.
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 44,
    lineHeight: 46,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  heroTagline: {
    fontFamily: 'InterTight_400Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 22,
    marginBottom: 14,
  },
  heroRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  heroRatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  heroRatingText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFD700',
  },
  heroReviewCount: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,215,0,0.6)',
  },
  heroVerifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,106,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.15)',
  },
  heroVerifiedText: {
    fontSize: 10,
    fontFamily: 'Oswald_600SemiBold',
    color: '#FF6A00',
    letterSpacing: 1.5,
  },
  heroPriceChip: {
    backgroundColor: 'rgba(255,106,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.15)',
  },
  heroPriceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FF6A00',
  },
  heroPriceUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,106,0,0.7)',
  },
  heroStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: 'Oswald_600SemiBold',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'center',
  },
  // iter118p (spec #6): reliability chip — sits below the stats bar,
  // deliberately calmer than the primary stats so it reads as a trust signal
  // and not a metric competing for the trainee's attention.
  reliabilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,214,143,0.10)',
    borderColor: 'rgba(0,214,143,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  reliabilityText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  reliabilityPercent: {
    color: '#00D68F',
    fontWeight: '900',
    fontSize: 14,
  },
  reliabilitySubtle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroCTARow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  heroCTASecondary: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.15)',
  },
  heroCTAPrimary: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  heroCTAPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  heroCTAPrimaryText: {
    fontSize: 15,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  // Profile Card
  profileCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileGradient: {
    padding: 20,
  },
  avatarSection: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: 'rgba(255,106,0,0.3)',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,106,0,0.3)',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0A0E1A',
    borderRadius: 14,
    padding: 2,
  },
  trainerName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reviewCount: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  bio: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tagsSection: {
    width: '100%',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Oswald_600SemiBold',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  virtualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  virtualText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Booking Card
  bookingCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bookingGradient: {
    padding: 20,
  },
  bookingTitle: {
    fontSize: 22,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 16,
  },
  // Session Type Selection (NEW)
  sessionTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  sessionTypeChip: {
    minWidth: '30%',
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,106,0,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,106,0,0.2)',
    alignItems: 'center',
    gap: 4,
  },
  sessionTypeChipSelected: {
    backgroundColor: '#FF6A00',
    borderColor: '#FF6A00',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  sessionTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sessionTypeTextSelected: {
    color: COLORS.white,
  },
  sessionTypePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  sessionTypePriceSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  // Safety Notice
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 214, 143, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 214, 143, 0.15)',
  },
  safetyNoticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 16,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  durationChipSelected: {
    backgroundColor: '#FF6A00',
    borderColor: '#FF6A00',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  durationTextSelected: {
    color: COLORS.white,
  },
  durationPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  durationPriceSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  // Price Summary (NEW)
  priceSummary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  priceTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceTotalValue: {
    fontSize: 26,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  platformFeeNote: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 8,
  },
  ratesNotSetNote: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,179,0,0.85)',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  locationField: {
    marginTop: 14,
    marginBottom: 6,
  },
  locationInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.25)',
  },
  locationInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  locationHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 6,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
  },
  dateTimeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dateTimeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 1,
  },
  dateTimeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pricePill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,106,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.25)',
  },
  pricePillLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.55)',
  },
  pricePillValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  pricePillHint: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  priceBreakdown: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  // Cancellation Policy
  cancellationPolicy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 16,
  },
  cancellationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 16,
  },
  bookButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bookButton: {
    paddingVertical: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  bookButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bookButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
  },
  // Quick Actions Card
  quickActionsCard: {
    backgroundColor: '#141929',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  quickActionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  quickActionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
  },
  // Reviews
  reviewsCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reviewsGradient: {
    padding: 20,
  },
  reviewsTitle: {
    fontSize: 20,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 16,
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  reviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  blockButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  blockText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
    textDecorationLine: 'underline',
  },
  // Logo watermark
  logoWatermark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    opacity: 0.25,
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  logoText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  // Consent Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  consentModal: {
    backgroundColor: '#141929',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  consentIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  consentTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
    paddingRight: 8,
  },
  consentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
  },
  consentAgreeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  consentAgreeGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  consentAgreeText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  consentCancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  consentCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  // Video Intro Styles
  videoSection: {
    marginTop: 16,
  },
  videoContainer: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0A0E1A',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  videoPlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  videoPlayText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Sticky Book Now Button
  stickyBookContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyBookGradient: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  stickyBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyBookPrice: {
    // iter106ax: editorial numerals — big, tight, editorial.
    fontFamily: 'InterTight_900Black',
    fontSize: 22,
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  stickyBookSub: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
  },
  stickyBookButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  stickyBookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  stickyBookButtonText: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 15,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
});

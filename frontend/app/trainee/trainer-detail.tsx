import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Animated,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { trainerAPI, traineeAPI, chatAPI, safetyAPI } from '../../src/services/api';
import { TrainerProfile } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { Video, ResizeMode } from 'expo-av';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { ProfileGallery, SocialLinksDisplay } from '../../src/components/ProfileSections';
import InstagramSection from '../../src/components/InstagramSection';
import { TrainerVibePlayer } from '../../src/components/TrainerVibePlayer';
import { HighlightReel } from '../../src/components/HighlightReel';
import { TrainerHeroVideoPreview } from '../../src/components/TrainerHeroVideoPreview';
import { PersonalityTagBadge } from '../../src/components/PersonalityTagBadge';

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
  const { trainerId } = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [booking, setBooking] = useState(false);
  const [showTraineeHomeConsent, setShowTraineeHomeConsent] = useState(false);
  const [traineeHomeConsented, setTraineeHomeConsented] = useState(false);

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

  const handleToggleFavorite = async () => {
    try {
      const res = await traineeAPI.toggleFavorite(trainerId as string);
      setIsFavorite(res.isFavorite);
      toast.success(res.isFavorite ? 'Added to favorites!' : 'Removed from favorites');
    } catch (err) {
      toast.error('Failed to update favorite');
    }
  };

  // Session type state
  const [selectedSessionType, setSelectedSessionType] = useState<'virtual' | 'outdoor' | 'in_home'>('outdoor');

  const calculatePrice = () => {
    if (!trainer) return { sessionRate: 0, serviceFee: 2, totalCharged: 2, trainerEarnings: 0, platformEarnings: 2, perHourRate: 0 };
    
    // Get trainer's per-hour earnings rate (what they set = their 80% cut)
    let trainerHourlyCents: number;
    switch (selectedSessionType) {
      case 'virtual':
        trainerHourlyCents = trainer.virtualRateCents || 3000;
        break;
      case 'in_home':
        trainerHourlyCents = trainer.inHomeRateCents || 6000;
        break;
      default:
        trainerHourlyCents = trainer.outdoorRateCents || 4000;
    }
    
    // Full price = trainer rate / 0.80 (trainer gets 80%, platform gets 20%)
    const fullHourlyCents = Math.round(trainerHourlyCents / 0.80);
    const perHourRate = fullHourlyCents / 100;
    const sessionRate = (fullHourlyCents / 100) * (selectedDuration / 60);
    const travelFee = selectedSessionType === 'in_home' ? Math.min(15, Math.max(0, 5)) : 0;
    
    // Pricing model:
    // User pays: full session rate + travel fee + $2 service fee
    // Trainer gets 80% of (session rate + travel fee)
    // Platform gets 20% of (session rate + travel fee) + $2 service fee
    const serviceFee = 2.00;
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
    if (!trainer) return;
    try {
      const conv = await chatAPI.getOrCreateConversation(trainer.userId);
      router.push(`/messages/chat?conversationId=${conv.conversationId}&userId=${trainer.userId}&userName=${trainer.fullName}`);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const handleReportTrainer = () => {
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
    return (
      <LinearGradient
        colors={['#0A0E1A', '#141929', '#FF6A00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading trainer...</Text>
      </LinearGradient>
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
      <LinearGradient
        colors={['#0A0E1A', '#141929']}
        style={styles.headerGradient}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleToggleFavorite} style={styles.headerBtn} data-testid="favorite-trainer-btn">
              <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? COLORS.error : COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMessage} style={styles.headerBtn}>
              <Ionicons name="chatbubble" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReportTrainer} style={styles.headerBtn}>
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
                      const perMin = (trainer.ratePerMinuteCents || 0) / 100;
                      const thirtyMin = perMin * 30;
                      return thirtyMin > 0 ? `$${thirtyMin.toFixed(0)}` : '—';
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

              {/* Trainer Vibe Player */}
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

              {/* Video Content Section */}
              {(trainer as any).introVideoUrl && (
                <View style={styles.videoSection} data-testid="trainer-video-intro">
                  <Text style={styles.sectionLabel}>VIDEO CONTENT</Text>
                  <View style={styles.videoContainer}>
                    <Video
                      source={{ uri: (trainer as any).introVideoUrl }}
                      style={styles.videoPlayer}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay
                      isLooping
                      isMuted
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.4)']}
                      style={styles.videoOverlay}
                    >
                      <View style={styles.videoPlayBadge}>
                        <Ionicons name="play" size={14} color={COLORS.white} />
                        <Text style={styles.videoPlayText}>Intro</Text>
                      </View>
                    </LinearGradient>
                  </View>
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          {/* Booking Card */}
          <Animated.View
            onLayout={(e) => { bookingCardY.current = e.nativeEvent.layout.y; }}
            style={[
              styles.bookingCard,
              {
                opacity: contentAnim,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}
          >
            <LinearGradient colors={['#141929', '#1A2035']} style={styles.bookingGradient}>
              <Text style={styles.bookingTitle}>Book a Session</Text>

              {/* Session Type Selection - NEW PRD */}
              <Text style={styles.sectionLabel}>SESSION TYPE</Text>
              <View style={styles.sessionTypeRow}>
                {trainer.offersVirtual && (
                  <TouchableOpacity
                    onPress={() => setSelectedSessionType('virtual')}
                    style={[
                      styles.sessionTypeChip,
                      selectedSessionType === 'virtual' && styles.sessionTypeChipSelected,
                    ]}
                    data-testid="session-type-virtual"
                  >
                    <Ionicons 
                      name="videocam" 
                      size={18} 
                      color={selectedSessionType === 'virtual' ? COLORS.white : COLORS.orange} 
                    />
                    <Text style={[
                      styles.sessionTypeText,
                      selectedSessionType === 'virtual' && styles.sessionTypeTextSelected
                    ]}>
                      Virtual
                    </Text>
                    <Text style={[
                      styles.sessionTypePrice,
                      selectedSessionType === 'virtual' && styles.sessionTypePriceSelected
                    ]}>
                      from ${trainer.virtualRateCents ? Math.round(trainer.virtualRateCents / 0.80 / 100) : 38}
                    </Text>
                  </TouchableOpacity>
                )}
                {(trainer.offersInPerson || trainer.offersOutdoor) && (
                  <TouchableOpacity
                    onPress={() => setSelectedSessionType('outdoor')}
                    style={[
                      styles.sessionTypeChip,
                      selectedSessionType === 'outdoor' && styles.sessionTypeChipSelected,
                    ]}
                    data-testid="session-type-outdoor"
                  >
                    <Ionicons 
                      name="sunny" 
                      size={18} 
                      color={selectedSessionType === 'outdoor' ? COLORS.white : COLORS.orange} 
                    />
                    <Text style={[
                      styles.sessionTypeText,
                      selectedSessionType === 'outdoor' && styles.sessionTypeTextSelected
                    ]}>
                      Outdoor
                    </Text>
                    <Text style={[
                      styles.sessionTypePrice,
                      selectedSessionType === 'outdoor' && styles.sessionTypePriceSelected
                    ]}>
                      from ${trainer.outdoorRateCents ? Math.round(trainer.outdoorRateCents / 0.80 / 100) : 50}
                    </Text>
                  </TouchableOpacity>
                )}
                {trainer.offersInHome && (
                  <TouchableOpacity
                    onPress={() => {
                      if (!traineeHomeConsented) {
                        setShowTraineeHomeConsent(true);
                      } else {
                        setSelectedSessionType('in_home');
                      }
                    }}
                    style={[
                      styles.sessionTypeChip,
                      selectedSessionType === 'in_home' && styles.sessionTypeChipSelected,
                    ]}
                    data-testid="session-type-at-home"
                  >
                    <Ionicons 
                      name="home" 
                      size={18} 
                      color={selectedSessionType === 'in_home' ? COLORS.white : COLORS.orange} 
                    />
                    <Text style={[
                      styles.sessionTypeText,
                      selectedSessionType === 'in_home' && styles.sessionTypeTextSelected
                    ]}>
                      At Home
                    </Text>
                    <Text style={[
                      styles.sessionTypePrice,
                      selectedSessionType === 'in_home' && styles.sessionTypePriceSelected
                    ]}>
                      from ${trainer.inHomeRateCents ? Math.round(trainer.inHomeRateCents / 0.80 / 100) : 75}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Safety PIN Notice for In-Home */}
              {selectedSessionType === 'in_home' && (
                <View style={styles.safetyNotice}>
                  <Ionicons name="shield-checkmark" size={18} color={accent} />
                  <Text style={styles.safetyNoticeText}>
                    You'll receive a 4-digit safety PIN to verify your trainer
                  </Text>
                </View>
              )}

              {/* Duration Selection */}
              <Text style={styles.sectionLabel}>SESSION DURATION</Text>
              <View style={styles.durationRow}>
                {(trainer.sessionDurationsOffered || [30, 45, 60]).map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    onPress={() => setSelectedDuration(duration)}
                    style={[
                      styles.durationChip,
                      selectedDuration === duration && styles.durationChipSelected,
                    ]}
                    data-testid={`duration-${duration}`}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        selectedDuration === duration && styles.durationTextSelected,
                      ]}
                    >
                      {duration} min
                    </Text>
                    <Text
                      style={[
                        styles.durationPrice,
                        selectedDuration === duration && styles.durationPriceSelected,
                      ]}
                    >
                      ${((prices.perHourRate || 0) * (duration / 60) + 2).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Price Summary — Trainee View (clean, no fee breakdown) */}
              <View style={styles.priceSummary}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{selectedDuration} min session</Text>
                  <Text style={styles.priceValue}>${prices.sessionRate.toFixed(2)}</Text>
                </View>
                {prices.travelFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Travel Fee</Text>
                    <Text style={styles.priceValue}>${prices.travelFee.toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Service Fee</Text>
                  <Text style={styles.priceValue}>$2.00</Text>
                </View>
                <View style={styles.priceDivider} />
                <View style={styles.priceRow}>
                  <Text style={styles.priceTotalLabel}>Total</Text>
                  <Text style={styles.priceTotalValue}>${prices.totalCharged.toFixed(2)}</Text>
                </View>
              </View>

              {/* Cancellation Policy */}
              <View style={styles.cancellationPolicy}>
                <Ionicons name="information-circle" size={16} color={COLORS.gray} />
                <Text style={styles.cancellationText}>
                  Free cancellation if pending • 
                  {selectedSessionType === 'virtual' && ' $15 fee after confirmed'}
                  {selectedSessionType === 'outdoor' && ' $25 fee after confirmed'}
                  {selectedSessionType === 'in_home' && ' $35 fee after confirmed'}
                </Text>
              </View>

              {/* BOOK SESSION — single tap, navigates to Confirm Booking */}
              <TouchableOpacity
                onPress={() => {
                  if (booking || !trainer) return;
                  const start = new Date();
                  start.setDate(start.getDate() + 1);
                  start.setHours(10, 0, 0, 0);
                  router.push({
                    pathname: '/trainee/confirm-booking',
                    params: {
                      trainerName: trainer.fullName || 'Trainer',
                      trainerId: trainer.userId,
                      date: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                      time: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      duration: String(selectedDuration),
                      sessionType: selectedSessionType,
                      priceCents: String(Math.round((prices.sessionRate || 0) * 100)),
                      sessionDateTimeStartIso: start.toISOString(),
                      locationNameOrAddress: selectedSessionType === 'virtual'
                        ? 'Virtual'
                        : (trainer.primaryGym || 'Outdoor Location'),
                    },
                  });
                }}
                disabled={booking || !trainer}
                style={styles.bookButtonWrapper}
                data-testid="book-session-btn"
              >
                <LinearGradient
                  colors={booking ? [COLORS.gray, COLORS.grayLight] : [COLORS.orangeHot, COLORS.orange]}
                  style={styles.bookButton}
                >
                  <View style={styles.bookButtonContent}>
                    <Ionicons name="flash" size={22} color={COLORS.white} />
                    <Text style={styles.bookButtonText}>BOOK SESSION</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>

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
                params: { trainerName: trainer?.fullName, trainerId: trainerId }
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

          {/* Social Links */}
          <View style={{ paddingHorizontal: 20 }}>
            <SocialLinksDisplay socialLinks={(trainer as any)?.socialLinks || {}} />
          </View>

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
              <Text style={styles.consentText}>Trainer's time at your location is tracked and monitored for safety</Text>
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
                <Text style={styles.consentAgreeText}>Let's Go</Text>
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
    fontSize: 38,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTagline: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 21,
    marginBottom: 12,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stickyBookSub: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  stickyBookButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  stickyBookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  stickyBookButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

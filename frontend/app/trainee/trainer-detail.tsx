import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

const { width } = Dimensions.get('window');

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
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [booking, setBooking] = useState(false);
  const [showTraineeHomeConsent, setShowTraineeHomeConsent] = useState(false);
  const [traineeHomeConsented, setTraineeHomeConsented] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const pressProgress = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    loadTrainerDetails();
  }, [trainerId]);

  useEffect(() => {
    if (!loading && trainer) {
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.spring(contentAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 200);
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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
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
              {/* Avatar */}
              <View style={styles.avatarSection}>
                {trainer.avatarUrl ? (
                  <Image source={{ uri: trainer.avatarUrl }} style={styles.avatar} />
                ) : (
                  <LinearGradient colors={[COLORS.orange, COLORS.orangeLight]} style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={50} color={COLORS.white} />
                  </LinearGradient>
                )}
                {trainer.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={28} color={'#FF6A00'} />
                  </View>
                )}
              </View>

              {/* Name & Rating */}
              <Text style={styles.trainerName}>{trainer.fullName || 'Trainer'}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={18} color={COLORS.gold} />
                <Text style={styles.ratingText}>
                  {trainer.averageRating?.toFixed(1) || '5.0'}
                </Text>
                <Text style={styles.reviewCount}>({ratings.length} reviews)</Text>
              </View>

              {/* Bio */}
              {trainer.bio && (
                <Text style={styles.bio}>{trainer.bio}</Text>
              )}

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{trainer.experienceYears || 0}</Text>
                  <Text style={styles.statLabel}>Years Exp</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{trainer.travelRadiusMiles || 10}</Text>
                  <Text style={styles.statLabel}>Mile Radius</Text>
                </View>
              </View>

              {/* Training Styles */}
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

              {/* Video Intro */}
              {(trainer as any).introVideoUrl && (
                <View style={styles.videoSection} data-testid="trainer-video-intro">
                  <Text style={styles.sectionLabel}>INTRO VIDEO</Text>
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
                  <Ionicons name="shield-checkmark" size={18} color={'#FF6A00'} />
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

              {/* Hold to Book Button */}
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={booking}
                style={styles.bookButtonWrapper}
              >
                <LinearGradient
                  colors={booking ? [COLORS.gray, COLORS.grayLight] : [COLORS.orangeHot, COLORS.orange]}
                  style={styles.bookButton}
                >
                  <Animated.View style={[styles.progressOverlay, { width: progressWidth }]} />
                  <View style={styles.bookButtonContent}>
                    {booking ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name={isHolding ? "finger-print" : "calendar"} size={22} color={COLORS.white} />
                        <Text style={styles.bookButtonText}>
                          {isHolding ? 'Hold to Confirm...' : 'Hold to Book Session'}
                        </Text>
                      </>
                    )}
                  </View>
                </LinearGradient>
              </Pressable>
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

          {/* Gallery & Social Links */}
          <View style={{ paddingHorizontal: 20 }}>
            <ProfileGallery gallery={(trainer as any)?.gallery || []} />
            <SocialLinksDisplay socialLinks={(trainer as any)?.socialLinks || {}} />
          </View>

          {/* Block Option */}
          <TouchableOpacity onPress={handleBlockTrainer} style={styles.blockButton}>
            <Text style={styles.blockText}>Block this Trainer</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
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
              <Ionicons name="shield-checkmark" size={48} color={'#FF6A00'} />
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
                colors={['#FF6A00', '#FF9F1C']}
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
    paddingHorizontal: 20,
    paddingTop: 10,
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
    padding: 24,
    alignItems: 'center',
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
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
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
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
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
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
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
});

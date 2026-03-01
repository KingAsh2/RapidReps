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

const { width } = Dimensions.get('window');

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#8892b0',
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

  // Session type state
  const [selectedSessionType, setSelectedSessionType] = useState<'virtual' | 'outdoor' | 'in_home'>('outdoor');

  const calculatePrice = () => {
    if (!trainer) return { base: 0, final: 0, platformFee: 0, travelFee: 0 };
    
    // Get rate based on session type (PRD Rule #1)
    let baseRateCents: number;
    switch (selectedSessionType) {
      case 'virtual':
        baseRateCents = (trainer as any).virtualRateCents || 3000; // $30 min
        break;
      case 'in_home':
        baseRateCents = (trainer as any).inHomeRateCents || 6000; // $60 min
        break;
      default:
        baseRateCents = (trainer as any).outdoorRateCents || 4000; // $40 min
    }
    
    const basePrice = baseRateCents / 100;
    const platformFee = basePrice * 0.20; // 20% platform fee (PRD Rule #2)
    const travelFee = selectedSessionType === 'in_home' ? 5 : 0; // Example travel fee
    const finalPrice = basePrice + travelFee;
    
    return { 
      base: basePrice, 
      final: finalPrice, 
      platformFee,
      travelFee,
      trainerEarnings: finalPrice - platformFee
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

      await traineeAPI.createSession({
        traineeId: user.id,
        trainerId: trainer.userId,
        sessionDateTimeStart: sessionStart.toISOString(),
        durationMinutes: selectedDuration,
        sessionType: selectedSessionType, // NEW: PRD session type
        locationType: locationType,
        locationNameOrAddress: selectedSessionType === 'virtual' ? 'Virtual' : (trainer.primaryGym || 'TBD'),
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
        colors={[COLORS.teal, COLORS.tealLight, COLORS.orange]}
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
      <LinearGradient colors={[COLORS.teal, COLORS.orange]} style={styles.loadingContainer}>
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
        colors={[COLORS.teal, COLORS.tealLight]}
        style={styles.headerGradient}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
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
            <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.profileGradient}>
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
                    <Ionicons name="checkmark-circle" size={28} color={COLORS.teal} />
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
                  <Text style={styles.statValue}>${(trainer.ratePerMinuteCents / 100).toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Per Min</Text>
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
            <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.bookingGradient}>
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
                      from $30
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
                      from $40
                    </Text>
                  </TouchableOpacity>
                )}
                {(trainer as any).offersInHome && (
                  <TouchableOpacity
                    onPress={() => setSelectedSessionType('in_home')}
                    style={[
                      styles.sessionTypeChip,
                      selectedSessionType === 'in_home' && styles.sessionTypeChipSelected,
                    ]}
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
                      In-Home
                    </Text>
                    <Text style={[
                      styles.sessionTypePrice,
                      selectedSessionType === 'in_home' && styles.sessionTypePriceSelected
                    ]}>
                      from $60
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Trainee's Home Option */}
                {(trainer as any).offersInHome && (
                  <TouchableOpacity
                    onPress={() => {
                      if (!traineeHomeConsented) {
                        setShowTraineeHomeConsent(true);
                      } else {
                        setSelectedSessionType('trainee_home');
                      }
                    }}
                    style={[
                      styles.sessionTypeChip,
                      selectedSessionType === 'trainee_home' && styles.sessionTypeChipSelected,
                    ]}
                  >
                    <Ionicons 
                      name="location" 
                      size={18} 
                      color={selectedSessionType === 'trainee_home' ? COLORS.white : COLORS.orange} 
                    />
                    <Text style={[
                      styles.sessionTypeText,
                      selectedSessionType === 'trainee_home' && styles.sessionTypeTextSelected
                    ]}>
                      Your Home
                    </Text>
                    <Text style={[
                      styles.sessionTypePrice,
                      selectedSessionType === 'trainee_home' && styles.sessionTypePriceSelected
                    ]}>
                      from $60
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Safety PIN Notice for In-Home */}
              {selectedSessionType === 'in_home' && (
                <View style={styles.safetyNotice}>
                  <Ionicons name="shield-checkmark" size={18} color={COLORS.teal} />
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
                  >
                    <Text
                      style={[
                        styles.durationText,
                        selectedDuration === duration && styles.durationTextSelected,
                      ]}
                    >
                      {duration} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Price Summary - Updated for PRD */}
              <View style={styles.priceSummary}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Session Rate</Text>
                  <Text style={styles.priceValue}>${prices.base.toFixed(2)}</Text>
                </View>
                {prices.travelFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Travel Fee</Text>
                    <Text style={styles.priceValue}>${prices.travelFee.toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.priceDivider} />
                <View style={styles.priceRow}>
                  <Text style={styles.priceTotalLabel}>Total</Text>
                  <Text style={styles.priceTotalValue}>${prices.final.toFixed(2)}</Text>
                </View>
                <Text style={styles.platformFeeNote}>
                  20% service fee included • Trainer earns ${prices.trainerEarnings?.toFixed(2) || prices.final.toFixed(2)}
                </Text>
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
                params: { trainerName: trainer?.fullName, trainerId: trainerId }
              })}
            >
              <View style={[styles.quickActionIconBg, { backgroundColor: 'rgba(31, 184, 180, 0.1)' }]}>
                <Ionicons name="calendar" size={24} color={COLORS.teal} />
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
              <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.reviewsGradient}>
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
              <Ionicons name="shield-checkmark" size={48} color={COLORS.teal} />
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
              <Ionicons name="time" size={22} color={COLORS.teal} />
              <Text style={styles.consentText}>Trainer's time at your location is tracked and monitored for safety</Text>
            </View>
            
            <View style={styles.consentItem}>
              <Ionicons name="call" size={22} color={COLORS.navy} />
              <Text style={styles.consentText}>Emergency support available 24/7 during your session</Text>
            </View>

            <TouchableOpacity
              style={styles.consentAgreeButton}
              onPress={() => {
                setTraineeHomeConsented(true);
                setSelectedSessionType('trainee_home');
                setShowTraineeHomeConsent(false);
              }}
            >
              <LinearGradient
                colors={[COLORS.teal, '#18A09D']}
                style={styles.consentAgreeGradient}
              >
                <Text style={styles.consentAgreeText}>I Understand & Agree</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.consentCancelButton}
              onPress={() => setShowTraineeHomeConsent(false)}
            >
              <Text style={styles.consentCancelText}>Cancel</Text>
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
    backgroundColor: COLORS.grayLight,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
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
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 2,
  },
  trainerName: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.navy,
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
    color: COLORS.navy,
  },
  reviewCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
  },
  bio: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#D0D4D8',
  },
  tagsSection: {
    width: '100%',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gray,
    letterSpacing: 1,
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: COLORS.teal,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  virtualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.teal,
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  bookingGradient: {
    padding: 20,
  },
  bookingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 16,
  },
  // Session Type Selection (NEW)
  sessionTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  sessionTypeChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FFF5EB',
    borderWidth: 2,
    borderColor: COLORS.orange,
    alignItems: 'center',
    gap: 4,
  },
  sessionTypeChipSelected: {
    backgroundColor: COLORS.orange,
    borderColor: COLORS.orange,
  },
  sessionTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
  },
  sessionTypeTextSelected: {
    color: COLORS.white,
  },
  sessionTypePrice: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray,
  },
  sessionTypePriceSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  // Safety Notice
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8FFF5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  safetyNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.navy,
    lineHeight: 16,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.grayLight,
    alignItems: 'center',
  },
  durationChipSelected: {
    backgroundColor: COLORS.teal,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
  },
  durationTextSelected: {
    color: COLORS.white,
  },
  // Price Summary (NEW)
  priceSummary: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
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
    color: COLORS.gray,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navy,
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  priceTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  priceTotalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.navy,
  },
  platformFeeNote: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray,
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
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.gray,
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
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
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
    color: COLORS.navy,
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
  },
  quickActionDivider: {
    height: 1,
    backgroundColor: COLORS.grayLight,
    marginHorizontal: 16,
  },
  // Reviews
  reviewsCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  reviewsGradient: {
    padding: 20,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 16,
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
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
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray,
  },
  reviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.navy,
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
    backgroundColor: COLORS.white,
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
    color: COLORS.navy,
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
    color: COLORS.gray,
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
    color: COLORS.gray,
  },
  // Video Intro Styles
  videoSection: {
    marginTop: 16,
  },
  videoContainer: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
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
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});

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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { trainerAPI, traineeAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainerProfile } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';

export default function TrainerDetailScreen() {
  const router = useRouter();
  const { trainerId } = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [booking, setBooking] = useState(false);
  
  // Long press animation states
  const pressProgress = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => {
    loadTrainerDetails();
  }, [trainerId]);

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
      Alert.alert('Error', 'Failed to load trainer details');
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = () => {
    if (!trainer) return { base: 0, discount: 0, final: 0, platformFee: 0, trainerEarns: 0 };
    
    const basePrice = (trainer.ratePerMinuteCents * selectedDuration) / 100;
    // Note: Discount will be calculated by backend based on session history
    const discount = 0; // Backend calculates this
    const finalPrice = basePrice - discount;
    const platformFee = finalPrice * 0.10;
    const trainerEarns = finalPrice - platformFee;

    return { base: basePrice, discount, final: finalPrice, platformFee, trainerEarns };
  };

  const handlePressIn = () => {
    if (booking) return;
    
    setIsHolding(true);
    
    // Animate the progress bar
    Animated.timing(pressProgress, {
      toValue: 1,
      duration: 1500, // 1.5 seconds to complete
      useNativeDriver: false,
    }).start();
    
    // Set timer to complete the action
    pressTimer.current = setTimeout(() => {
      handleBookSession();
    }, 1500);
  };

  const handlePressOut = () => {
    setIsHolding(false);
    
    // Cancel the timer
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    
    // Reset the animation
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
      const sessionStart = new Date(selectedDate);
      sessionStart.setHours(10, 0, 0, 0); // Default to 10 AM for now

      await traineeAPI.createSession({
        traineeId: user.id,
        trainerId: trainer.userId,
        sessionDateTimeStart: sessionStart.toISOString(),
        durationMinutes: selectedDuration,
        locationType: trainer.offersInPerson ? 'gym' : 'virtual',
        locationNameOrAddress: trainer.primaryGym || 'Virtual',
      });

      Alert.alert('Success!', 'Session booking requested! The trainer will review your request.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to book session');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!trainer) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Trainer not found</Text>
      </View>
    );
  }

  const pricing = calculatePrice();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trainer Profile</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.scrollView}>
        {/* Trainer Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.trainerHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={48} color={Colors.primary} />
            </View>
            <View style={styles.trainerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.trainerName}>Trainer</Text>
                {trainer.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={18} color={Colors.warning} />
                <Text style={styles.ratingText}>
                  {trainer.averageRating.toFixed(1)} ({trainer.totalSessionsCompleted} sessions)
                </Text>
              </View>
              <View style={styles.priceRow}>
                <Ionicons name="cash-outline" size={18} color={Colors.primary} />
                <Text style={styles.priceText}>
                  ${(trainer.ratePerMinuteCents / 100).toFixed(2)}/min
                </Text>
              </View>
            </View>
          </View>

          {trainer.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{trainer.bio}</Text>
            </View>
          )}

          {/* Experience & Certifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            <View style={styles.experienceRow}>
              <Ionicons name="trophy" size={20} color={Colors.primary} />
              <Text style={styles.experienceText}>{trainer.experienceYears} years</Text>
            </View>
            {trainer.certifications.length > 0 && (
              <View style={styles.certifications}>
                {trainer.certifications.map((cert, index) => (
                  <View key={index} style={styles.certBadge}>
                    <Text style={styles.certText}>{cert}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Training Styles */}
          {trainer.trainingStyles.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Training Styles</Text>
              <View style={styles.stylesContainer}>
                {trainer.trainingStyles.map((style, index) => (
                  <View key={index} style={styles.styleChip}>
                    <Text style={styles.styleText}>{style}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Location */}
          {trainer.primaryGym && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={20} color={Colors.primary} />
                <Text style={styles.locationText}>{trainer.primaryGym}</Text>
              </View>
              {trainer.offersVirtual && (
                <View style={styles.locationRow}>
                  <Ionicons name="videocam" size={20} color={Colors.neonBlue} />
                  <Text style={styles.locationText}>Virtual sessions available</Text>
                </View>
              )}
            </View>
          )}

          {/* Reviews */}
          {ratings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reviews ({ratings.length})</Text>
              {ratings.slice(0, 3).map((rating) => (
                <View key={rating.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewStars}>
                      {[...Array(5)].map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < rating.rating ? 'star' : 'star-outline'}
                          size={16}
                          color={Colors.warning}
                        />
                      ))}
                    </View>
                    <Text style={styles.reviewDate}>
                      {new Date(rating.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {rating.reviewText && (
                    <Text style={styles.reviewText}>{rating.reviewText}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Booking Section */}
        <View style={styles.bookingCard}>
          <Text style={styles.bookingTitle}>Book a Session</Text>

          {/* Duration Selection */}
          <View style={styles.durationSection}>
            <Text style={styles.inputLabel}>Session Duration</Text>
            <View style={styles.durationButtons}>
              {trainer.sessionDurationsOffered.map((duration) => (
                <TouchableOpacity
                  key={duration}
                  onPress={() => setSelectedDuration(duration)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      selectedDuration === duration
                        ? Colors.gradientOrangeStart
                        : ['#FFFFFF', '#FFFFFF']
                    }
                    style={[
                      styles.durationButton,
                      selectedDuration === duration && styles.durationButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationButtonText,
                        selectedDuration === duration && styles.durationButtonTextSelected,
                      ]}
                    >
                      {duration} min
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price Breakdown */}
          <View style={styles.priceBreakdown}>
            <Text style={styles.inputLabel}>Price Breakdown</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Session ({selectedDuration} min)</Text>
              <Text style={styles.priceValue}>${pricing.base.toFixed(2)}</Text>
            </View>
            {pricing.discount > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Multi-session discount</Text>
                <Text style={[styles.priceValue, styles.discountText]}>
                  -${pricing.discount.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${pricing.final.toFixed(2)}</Text>
            </View>
            <Text style={styles.feeNote}>
              Includes 10% platform fee · Trainer earns ${pricing.trainerEarns.toFixed(2)}
            </Text>
          </View>

          {/* Lock In Button with Long Press */}
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={booking}
            style={styles.lockInContainer}
          >
            <LinearGradient
              colors={booking ? ['#CCCCCC', '#999999'] : Colors.gradientOrangeStart}
              style={styles.bookButton}
            >
              {/* Animated Progress Fill */}
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: pressProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
              
              {/* Button Content */}
              <View style={styles.buttonContent}>
                <Text style={styles.bookButtonText}>
                  {booking ? 'Booking...' : isHolding ? 'Hold to Lock In 💪🏾' : 'Lock In 💪🏾'}
                </Text>
                {!booking && !isHolding && (
                  <Text style={styles.holdHintText}>
                    Press & hold
                  </Text>
                )}
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.white,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  trainerHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  trainerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trainerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.navy,
    marginRight: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.navy,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.navy,
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  experienceText: {
    fontSize: 15,
    color: Colors.navy,
  },
  certifications: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  certBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  certText: {
    fontSize: 13,
    color: Colors.navy,
    fontWeight: '500',
  },
  stylesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  styleText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 15,
    color: Colors.navy,
  },
  reviewCard: {
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  reviewText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  bookingCard: {
    backgroundColor: Colors.white,
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  bookingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.navy,
    marginBottom: 20,
  },
  durationSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
    marginBottom: 12,
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  durationButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  durationButtonSelected: {
    borderColor: 'transparent',
  },
  durationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.navy,
  },
  durationButtonTextSelected: {
    color: Colors.white,
  },
  priceBreakdown: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 15,
    color: Colors.navy,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.navy,
  },
  discountText: {
    color: Colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.navy,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  feeNote: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  lockInContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },
  bookButton: {
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 3,
    borderColor: Colors.navy,
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 0,
  },
  buttonContent: {
    zIndex: 1,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  holdHintText: {
    fontSize: 12,
    color: Colors.white,
    marginTop: 4,
    opacity: 0.9,
    fontWeight: '600',
  },
});

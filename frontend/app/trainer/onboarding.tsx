import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { trainerAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';

const { width } = Dimensions.get('window');

// Vibrant brand colors
const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  orangeGlow: '#FFB347',
  teal: '#1a2a5e',
  tealLight: '#22E8DF',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
  success: '#00D26A',
  error: '#FF4757',
  gold: '#FFD700',
};

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  required: boolean;
  action?: () => void;
}

export default function TrainerOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<any>(null);
  const [pricingLimits, setPricingLimits] = useState<any>(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOnboardingStatus();
  }, []);

  useEffect(() => {
    if (!loading && onboardingStatus) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Animate progress bar
      const completedCount = onboardingStatus.completedRequirements?.length || 0;
      const totalCount = (onboardingStatus.completedRequirements?.length || 0) + (onboardingStatus.missingRequirements?.length || 0);
      const progress = totalCount > 0 ? completedCount / totalCount : 0;
      
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [loading, onboardingStatus]);

  const loadOnboardingStatus = async () => {
    try {
      const [status, pricing] = await Promise.all([
        trainerAPI.getOnboardingStatus(),
        trainerAPI.getPricingLimits(),
      ]);
      setOnboardingStatus(status);
      setPricingLimits(pricing);
    } catch (error) {
      console.error('Error loading onboarding status:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to load onboarding status',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOnboardingStatus();
  };

  const handleUpdateVerification = async (type: string) => {
    try {
      setLoading(true);
      await trainerAPI.updateVerification(type as any, true);
      await loadOnboardingStatus();
      showAlert({
        title: 'Updated! ✓',
        message: 'Verification status updated successfully',
        type: 'success',
      });
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Failed to update verification',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const getSteps = (): OnboardingStep[] => {
    if (!onboardingStatus) return [];
    
    const completed = onboardingStatus.completedRequirements || [];
    
    return [
      {
        id: 'government_id',
        title: 'Government ID',
        description: 'Upload a valid government-issued ID',
        icon: 'id-card',
        completed: completed.includes('Government ID verification'),
        required: true,
        action: () => handleUpdateVerification('government_id'),
      },
      {
        id: 'ssn_check',
        title: 'SSN Identity Check',
        description: 'Verify your identity with SSN',
        icon: 'shield-checkmark',
        completed: completed.includes('SSN identity check'),
        required: true,
        action: () => handleUpdateVerification('ssn_check'),
      },
      {
        id: 'background_check',
        title: 'Background Check',
        description: 'National criminal background screening',
        icon: 'search',
        completed: completed.includes('Background check'),
        required: true,
        action: () => handleUpdateVerification('background_check'),
      },
      {
        id: 'sex_offender_check',
        title: 'Sex Offender Screening',
        description: 'National sex offender registry check',
        icon: 'alert-circle',
        completed: completed.includes('Sex offender screening'),
        required: true,
        action: () => handleUpdateVerification('sex_offender_check'),
      },
      {
        id: 'cpr_aed_cert',
        title: 'CPR/AED Certification',
        description: 'Upload your CPR/AED certificate',
        icon: 'heart',
        completed: completed.includes('CPR/AED certification'),
        required: true,
        action: () => handleUpdateVerification('cpr_aed_cert'),
      },
      {
        id: 'fitness_cert',
        title: 'Fitness Certification',
        description: 'Upload your fitness certification (optional)',
        icon: 'ribbon',
        completed: completed.includes('Fitness certification'),
        required: false,
        action: () => handleUpdateVerification('fitness_cert'),
      },
      {
        id: 'intro_video',
        title: 'Intro Video',
        description: '10-30 second introduction video',
        icon: 'videocam',
        completed: completed.includes('Intro video'),
        required: true,
        action: () => router.push('/trainer/upload-video'),
      },
      {
        id: 'profile',
        title: 'Complete Profile',
        description: 'Bio, training styles, and pricing',
        icon: 'person',
        completed: completed.includes('Profile bio') && completed.includes('Training styles'),
        required: true,
        action: () => router.push('/trainer/edit-profile'),
      },
    ];
  };

  const steps = getSteps();
  const completedSteps = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={[COLORS.orange, COLORS.orangeLight]} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.loadingText}>Loading verification status...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.orange, COLORS.orangeLight]}
        style={styles.headerGradient}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trainer Verification</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.orange} />
          }
        >
          {/* Status Card */}
          <Animated.View
            style={[
              styles.statusCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <LinearGradient
              colors={onboardingStatus?.canGoLive ? [COLORS.success, '#00A854'] : [COLORS.navy, '#2a3f7e']}
              style={styles.statusGradient}
            >
              <View style={styles.statusIconContainer}>
                <Ionicons
                  name={onboardingStatus?.canGoLive ? 'checkmark-shield' : 'hourglass'}
                  size={48}
                  color={COLORS.white}
                />
              </View>
              <Text style={styles.statusTitle}>
                {onboardingStatus?.canGoLive ? 'You\'re Verified! ✓' : 'Complete Verification'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {onboardingStatus?.canGoLive
                  ? 'You can now accept sessions and appear in search'
                  : `${totalSteps - completedSteps} steps remaining to go live`}
              </Text>
              
              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBackground}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{completedSteps}/{totalSteps} Complete</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Tier Badge */}
          {pricingLimits && (
            <Animated.View
              style={[
                styles.tierCard,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              <View style={styles.tierHeader}>
                <Ionicons
                  name={pricingLimits.trainerTier === 'elite' ? 'diamond' : pricingLimits.trainerTier === 'pro' ? 'star' : 'fitness'}
                  size={24}
                  color={pricingLimits.trainerTier === 'elite' ? COLORS.gold : pricingLimits.trainerTier === 'pro' ? COLORS.teal : COLORS.orange}
                />
                <Text style={styles.tierTitle}>
                  {pricingLimits.trainerTier.toUpperCase()} TRAINER
                </Text>
              </View>
              <Text style={styles.tierDescription}>
                {pricingLimits.trainerTier === 'basic' && 'Complete 30+ reviews with 4.7★ rating to become PRO'}
                {pricingLimits.trainerTier === 'pro' && 'Complete 100+ reviews with certifications to become ELITE'}
                {pricingLimits.trainerTier === 'elite' && 'You\'re ranked higher in search results!'}
              </Text>
              <View style={styles.tierStats}>
                <View style={styles.tierStat}>
                  <Text style={styles.tierStatValue}>{pricingLimits.totalReviews}</Text>
                  <Text style={styles.tierStatLabel}>Reviews</Text>
                </View>
                <View style={styles.tierStatDivider} />
                <View style={styles.tierStat}>
                  <Text style={styles.tierStatValue}>{pricingLimits.averageRating?.toFixed(1) || '0.0'}</Text>
                  <Text style={styles.tierStatLabel}>Rating</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Verification Steps */}
          <Text style={styles.sectionTitle}>Verification Checklist</Text>
          
          {steps.map((step, index) => (
            <Animated.View
              key={step.id}
              style={[
                styles.stepCard,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              <TouchableOpacity
                style={styles.stepContent}
                onPress={step.action}
                disabled={step.completed}
              >
                <View style={[
                  styles.stepIcon,
                  step.completed ? styles.stepIconCompleted : styles.stepIconPending
                ]}>
                  <Ionicons
                    name={step.completed ? 'checkmark' : step.icon as any}
                    size={24}
                    color={step.completed ? COLORS.white : COLORS.orange}
                  />
                </View>
                <View style={styles.stepInfo}>
                  <View style={styles.stepTitleRow}>
                    <Text style={[
                      styles.stepTitle,
                      step.completed && styles.stepTitleCompleted
                    ]}>
                      {step.title}
                    </Text>
                    {!step.required && (
                      <View style={styles.optionalBadge}>
                        <Text style={styles.optionalText}>Optional</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
                {!step.completed && (
                  <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}

          {/* Pricing Info */}
          {pricingLimits && (
            <View style={styles.pricingCard}>
              <Text style={styles.pricingTitle}>Your Pricing Limits</Text>
              <Text style={styles.pricingSubtitle}>Based on your {pricingLimits.trainerTier} tier</Text>
              
              <View style={styles.pricingRow}>
                <View style={styles.pricingItem}>
                  <Ionicons name="videocam" size={20} color={COLORS.orange} />
                  <Text style={styles.pricingLabel}>Virtual</Text>
                  <Text style={styles.pricingValue}>
                    ${pricingLimits.pricingLimits.virtual.minCents / 100} - ${pricingLimits.pricingLimits.virtual.maxCents / 100}
                  </Text>
                </View>
                <View style={styles.pricingItem}>
                  <Ionicons name="sunny" size={20} color={COLORS.orange} />
                  <Text style={styles.pricingLabel}>Outdoor</Text>
                  <Text style={styles.pricingValue}>
                    ${pricingLimits.pricingLimits.outdoor.minCents / 100} - ${pricingLimits.pricingLimits.outdoor.maxCents / 100}
                  </Text>
                </View>
                <View style={styles.pricingItem}>
                  <Ionicons name="home" size={20} color={COLORS.orange} />
                  <Text style={styles.pricingLabel}>In-Home</Text>
                  <Text style={styles.pricingValue}>
                    ${pricingLimits.pricingLimits.inHome.minCents / 100} - ${pricingLimits.pricingLimits.inHome.maxCents / 100}
                  </Text>
                </View>
              </View>
              
              <View style={styles.feeInfo}>
                <Ionicons name="information-circle" size={16} color={COLORS.gray} />
                <Text style={styles.feeText}>
                  Platform fee: {pricingLimits.platformFeePercent}% per session
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Status Card
  statusCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  statusGradient: {
    padding: 24,
    alignItems: 'center',
  },
  statusIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Tier Card
  tierCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  tierTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    letterSpacing: 0.5,
  },
  tierDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
    marginBottom: 16,
  },
  tierStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    padding: 16,
  },
  tierStat: {
    flex: 1,
    alignItems: 'center',
  },
  tierStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.navy,
  },
  tierStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 4,
  },
  tierStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.grayLight,
    marginHorizontal: 16,
  },
  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  // Step Card
  stepCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  stepContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepIconPending: {
    backgroundColor: '#FFF5EB',
    borderWidth: 2,
    borderColor: COLORS.orange,
  },
  stepIconCompleted: {
    backgroundColor: COLORS.success,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
  },
  stepTitleCompleted: {
    color: COLORS.success,
  },
  stepDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
    marginTop: 2,
  },
  optionalBadge: {
    backgroundColor: COLORS.grayLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optionalText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray,
  },
  // Pricing Card
  pricingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  pricingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 4,
  },
  pricingSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pricingItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  pricingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 6,
    marginBottom: 4,
  },
  pricingValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navy,
  },
  feeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  feeText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
  },
});

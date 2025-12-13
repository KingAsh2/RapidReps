import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Badge icons mapping
const BADGE_ICONS: { [key: string]: any } = {
  milestone_master: '🎯',
  weekend_warrior: '🏋️',
  streak_star: '🔥',
  early_bird: '🌅',
  night_owl: '🦉',
  top_trainer: '👑',
  new_client_champ: '🤝',
  flexibility_guru: '🧘',
  feedback_favorite: '⭐',
  double_duty: '⚡',
};

interface Badge {
  badgeType: string;
  badgeName: string;
  description: string;
  isUnlocked: boolean;
  progress: number;
  target: number;
  reward?: string;
  unlockedAt?: string;
}

interface BadgeCardProps {
  badge: Badge;
  onPress: () => void;
}

const BadgeCard: React.FC<BadgeCardProps> = ({ badge, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: badge.progress / badge.target,
      duration: 800,
      useNativeDriver: false,
    }).start();

    // Pulse animation for unlocked badges
    if (badge.isUnlocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [badge.progress, badge.target, badge.isUnlocked]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          styles.badgeCard,
          { transform: [{ scale: scaleAnim }] },
          badge.isUnlocked && styles.badgeCardUnlocked,
        ]}
      >
        {/* Glow effect for unlocked badges */}
        {badge.isUnlocked && (
          <Animated.View
            style={[
              styles.glowEffect,
              { opacity: glowOpacity },
            ]}
          />
        )}

        {/* Badge Icon */}
        <View style={[styles.iconContainer, !badge.isUnlocked && styles.iconLocked]}>
          <Text style={styles.badgeIcon}>
            {BADGE_ICONS[badge.badgeType] || '🏆'}
          </Text>
          {badge.isUnlocked && (
            <View style={styles.checkmarkBadge}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            </View>
          )}
          {!badge.isUnlocked && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={32} color={Colors.textLight} />
            </View>
          )}
        </View>

        {/* Badge Name */}
        <Text style={[styles.badgeName, !badge.isUnlocked && styles.badgeNameLocked]}>
          {badge.badgeName}
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth },
                badge.isUnlocked && styles.progressFillComplete,
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {badge.progress} / {badge.target}
          </Text>
        </View>

        {/* Reward Badge */}
        {badge.reward && badge.isUnlocked && (
          <View style={styles.rewardBadge}>
            <Ionicons name="gift" size={12} color={Colors.white} />
            <Text style={styles.rewardText}>Reward!</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Badge unlock modal with confetti
const BadgeUnlockModal: React.FC<{
  visible: boolean;
  badge: Badge | null;
  onClose: () => void;
}> = ({ visible, badge, onClose }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (visible && badge) {
      // Badge scale animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();

      // Confetti animations
      confettiAnims.forEach((anim, index) => {
        Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: 600,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: (Math.random() - 0.5) * 400,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotate, {
            toValue: Math.random() * 720,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      scaleAnim.setValue(0);
      confettiAnims.forEach((anim) => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
        anim.opacity.setValue(1);
      });
    }
  }, [visible, badge]);

  if (!badge) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        {/* Confetti */}
        {confettiAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.confetti,
              {
                left: width / 2 - 10 + (Math.random() - 0.5) * 100,
                top: 200,
                backgroundColor: ['#FF6B35', '#F7931E', '#FDC830', '#37B5E6'][index % 4],
                transform: [
                  { translateY: anim.translateY },
                  { translateX: anim.translateX },
                  { rotate: anim.rotate.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  })},
                ],
                opacity: anim.opacity,
              },
            ]}
          />
        ))}

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <LinearGradient
            colors={[Colors.secondary, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            <Text style={styles.modalTitle}>Badge Unlocked! 🎉</Text>
            
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalIcon}>
                {BADGE_ICONS[badge.badgeType] || '🏆'}
              </Text>
            </View>

            <Text style={styles.modalBadgeName}>{badge.badgeName}</Text>
            <Text style={styles.modalDescription}>{badge.description}</Text>

            {badge.reward && (
              <View style={styles.modalRewardBox}>
                <Ionicons name="gift" size={20} color={Colors.warning} />
                <Text style={styles.modalRewardText}>{badge.reward}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.modalButton} onPress={onClose}>
              <LinearGradient
                colors={[Colors.white, Colors.white]}
                style={styles.modalButtonGradient}
              >
                <Text style={styles.modalButtonText}>Awesome! 💪</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function TrainerAchievementsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [discountRemaining, setDiscountRemaining] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/trainer/achievements`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setBadges(response.data.badges);
      setTotalSessions(response.data.totalCompletedSessions);
      setDiscountRemaining(response.data.discountSessionsRemaining);
    } catch (error) {
      console.error('Error loading achievements:', error);
      showAlert({
        title: 'Loading Failed',
        message: 'Could not load your achievements. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBadgePress = (badge: Badge) => {
    setSelectedBadge(badge);
    if (badge.isUnlocked) {
      setShowUnlockModal(true);
    } else {
      showAlert({
        title: badge.badgeName,
        message: `${badge.description}\n\nProgress: ${badge.progress} / ${badge.target}${badge.reward ? `\n\nReward: ${badge.reward}` : ''}`,
        type: 'info',
      });
    }
  };

  const unlockedCount = badges.filter(b => b.isUnlocked).length;
  const totalBadges = badges.length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading achievements...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.warning, '#FFA500']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{unlockedCount}/{totalBadges}</Text>
            <Text style={styles.statLabel}>Badges Earned</Text>
          </View>
          {discountRemaining > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{discountRemaining}</Text>
                <Text style={styles.statLabel}>Discounts Left</Text>
              </View>
            </>
          )}
        </View>
      </LinearGradient>

      {/* Badges Grid */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Your Badges</Text>
        <View style={styles.badgesGrid}>
          {badges.map((badge, index) => (
            <BadgeCard
              key={index}
              badge={badge}
              onPress={() => handleBadgePress(badge)}
            />
          ))}
        </View>

        {/* Discount Info */}
        {discountRemaining > 0 && (
          <View style={styles.discountInfo}>
            <LinearGradient
              colors={[Colors.success, '#2ecc71']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.discountGradient}
            >
              <Ionicons name="gift" size={32} color={Colors.white} />
              <View style={styles.discountTextContainer}>
                <Text style={styles.discountTitle}>Active Reward! 🎉</Text>
                <Text style={styles.discountText}>
                  5% service fee on your next {discountRemaining} session{discountRemaining > 1 ? 's' : ''}
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Badge Unlock Modal */}
      <BadgeUnlockModal
        visible={showUnlockModal}
        badge={selectedBadge}
        onClose={() => setShowUnlockModal(false)}
      />
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textLight,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
  },
  headerSpacer: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 16,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeCard: {
    width: (width - 48) / 2,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    position: 'relative',
  },
  badgeCardUnlocked: {
    borderColor: Colors.warning,
  },
  glowEffect: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 16,
    backgroundColor: Colors.warning,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  iconLocked: {
    backgroundColor: Colors.textLight,
    opacity: 0.3,
  },
  badgeIcon: {
    fontSize: 48,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 40,
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.white,
    borderRadius: 12,
  },
  badgeName: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeNameLocked: {
    color: Colors.textLight,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBackground: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: 4,
  },
  progressFillComplete: {
    backgroundColor: Colors.success,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  rewardText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.white,
  },
  discountInfo: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.navy,
  },
  discountGradient: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  discountTextContainer: {
    flex: 1,
  },
  discountTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 4,
  },
  discountText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  modalContent: {
    width: width - 60,
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: Colors.navy,
  },
  modalGradient: {
    padding: 32,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    fontSize: 64,
  },
  modalBadgeName: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalRewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  modalRewardText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  modalButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.white,
  },
  modalButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
  },
});

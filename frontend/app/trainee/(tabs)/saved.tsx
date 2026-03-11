import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/contexts/AuthContext';
import { traineeAPI } from '../../../src/services/api';
import { toast } from '../../../src/utils/toast';

const { width } = Dimensions.get('window');

// Brand colors - UNIFIED DESIGN SYSTEM
const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
  error: '#FF4757',
  warning: '#FFB300',
};

// Background image
const backgroundImage = require('../../../assets/images/bg-battle-ropes.png');

export default function SavedTrainersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedTrainers, setSavedTrainers] = useState<any[]>([]);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const heartPulseAnim = useRef(new Animated.Value(1)).current;
  const headerBounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSavedTrainers();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.spring(headerAnim, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.spring(listAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
          delay: 200,
        }),
      ]).start();

      // Heart pulse animation loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(heartPulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(heartPulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(heartPulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(heartPulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.delay(2000),
        ])
      ).start();

      // Header bounce
      Animated.spring(headerBounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const loadSavedTrainers = async () => {
    try {
      setLoading(true);
      const response = await traineeAPI.getSavedTrainers();
      setSavedTrainers(response.savedTrainers || []);
    } catch (error) {
      console.error('Error loading saved trainers:', error);
      setSavedTrainers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSavedTrainers();
  };

  const handleRemoveFavorite = async (trainerId: string) => {
    try {
      await traineeAPI.toggleFavorite(trainerId);
      setSavedTrainers(savedTrainers.filter(t => t.id !== trainerId));
      toast.success('Trainer removed from favorites');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove trainer');
    }
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  const listTranslateY = listAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const renderTrainer = (trainer: any, index: number) => {
    return (
      <Animated.View
        key={trainer.id}
        style={{
          opacity: listAnim,
          transform: [{ 
            translateY: listAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            })
          }],
        }}
      >
        <TouchableOpacity
          style={styles.trainerThumbnail}
          onPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.id}`)}
          activeOpacity={0.85}
        >
          {/* Trainer Avatar */}
          {trainer.profilePhoto ? (
            <Image source={{ uri: trainer.profilePhoto }} style={styles.thumbnailAvatar} />
          ) : (
            <LinearGradient
              colors={[COLORS.teal, COLORS.tealLight]}
              style={styles.thumbnailAvatarPlaceholder}
            >
              <Text style={styles.thumbnailInitials}>
                {trainer.name.split(' ').map((n: string) => n[0]).join('')}
              </Text>
            </LinearGradient>
          )}
          
          {/* Verified Badge */}
          {trainer.isVerified && (
            <View style={styles.thumbnailVerified}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.teal} />
            </View>
          )}
          
          {/* Heart Button */}
          <TouchableOpacity
            style={styles.thumbnailHeart}
            onPress={(e) => {
              e.stopPropagation();
              handleRemoveFavorite(trainer.id);
            }}
          >
            <Ionicons name="heart" size={14} color={COLORS.error} />
          </TouchableOpacity>
          
          {/* Trainer Name */}
          <Text style={styles.thumbnailName} numberOfLines={1}>{trainer.name.split(' ')[0]}</Text>
          
          {/* Rating */}
          <View style={styles.thumbnailRating}>
            <Ionicons name="star" size={10} color={COLORS.warning} />
            <Text style={styles.thumbnailRatingText}>{trainer.rating?.toFixed(1)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient
          colors={['rgba(247, 147, 30, 0.85)', 'rgba(247, 147, 30, 0.75)', 'rgba(255, 165, 38, 0.7)']}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.loadingText}>Loading saved trainers...</Text>
        </LinearGradient>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      {/* Orange overlay */}
      <LinearGradient
        colors={['rgba(247, 147, 30, 0.85)', 'rgba(247, 147, 30, 0.75)', 'rgba(255, 165, 38, 0.7)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={styles.headerIcon}>
            <Ionicons name="heart" size={28} color={COLORS.white} />
          </View>
          <Text style={styles.headerTitle}>SAVED TRAINERS</Text>
          <Text style={styles.headerSubtitle}>
            {savedTrainers.length} trainer{savedTrainers.length !== 1 ? 's' : ''} in your list
          </Text>
        </Animated.View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={COLORS.white} 
            />
          }
        >
          {savedTrainers.length === 0 ? (
            <Animated.View 
              style={[
                styles.emptyCard,
                { 
                  opacity: listAnim,
                  transform: [{ translateY: listTranslateY }]
                }
              ]}
            >
              <View style={styles.emptyIconBg}>
                <Ionicons name="heart-outline" size={64} color={COLORS.orange} />
              </View>
              <Text style={styles.emptyTitle}>No Saved Trainers Yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the ❤️ icon on any trainer's profile to save them for quick access later
              </Text>
              <TouchableOpacity 
                style={styles.exploreButton}
                onPress={() => router.push('/trainee/(tabs)/home')}
              >
                <LinearGradient
                  colors={[COLORS.teal, COLORS.tealLight]}
                  style={styles.exploreButtonGradient}
                >
                  <Ionicons name="search" size={20} color={COLORS.white} />
                  <Text style={styles.exploreButtonText}>Explore Trainers</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={styles.trainersGrid}>
              {savedTrainers.map((trainer, index) => renderTrainer(trainer, index))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  trainersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  trainerThumbnail: {
    width: (width - 32 - 36) / 4,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 10,
    shadowColor: '#1a2a5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  thumbnailAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 6,
  },
  thumbnailAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  thumbnailInitials: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  thumbnailVerified: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    padding: 2,
  },
  thumbnailHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    padding: 4,
  },
  thumbnailName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 2,
  },
  thumbnailRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  thumbnailRatingText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray,
  },
  trainersList: {
    gap: 16,
  },
  trainerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1a2a5e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardAccent: {
    height: 4,
    backgroundColor: COLORS.teal,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  trainerAvatar: {
    width: 70,
    height: 70,
    borderRadius: 16,
    marginRight: 14,
  },
  trainerAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  trainerInfo: {
    flex: 1,
  },
  trainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  trainerName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(31, 184, 180, 0.1)',
    borderRadius: 10,
    padding: 2,
  },
  trainerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navy,
  },
  metaSubtext: {
    fontSize: 13,
    color: COLORS.gray,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.grayLight,
    marginHorizontal: 10,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.teal,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navy,
  },
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specialtyTag: {
    backgroundColor: 'rgba(255, 127, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  specialtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navy,
  },
  heartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 40,
    marginTop: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 127, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  exploreButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  exploreButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});

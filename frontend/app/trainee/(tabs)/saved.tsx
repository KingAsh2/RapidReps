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

const { width } = Dimensions.get('window');

// Brand colors - UNIFIED DESIGN SYSTEM
const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#8892b0',
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

  useEffect(() => {
    loadSavedTrainers();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 400,
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
    }
  }, [loading]);

  const loadSavedTrainers = async () => {
    try {
      setLoading(true);
      // Mock data for demonstration
      const mockSavedTrainers = [
        {
          id: '1',
          name: 'Sarah Johnson',
          profilePhoto: null,
          rating: 4.9,
          reviewCount: 127,
          specialties: ['HIIT', 'Strength Training'],
          hourlyRate: 75,
          isVerified: true,
          bio: 'Certified personal trainer with 8+ years of experience in high-intensity training.',
        },
        {
          id: '2',
          name: 'Mike Chen',
          profilePhoto: null,
          rating: 4.8,
          reviewCount: 89,
          specialties: ['Yoga', 'Flexibility'],
          hourlyRate: 65,
          isVerified: true,
          bio: 'RYT-500 certified yoga instructor specializing in vinyasa and power yoga.',
        },
      ];
      setSavedTrainers(mockSavedTrainers);
    } catch (error) {
      console.error('Error loading saved trainers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSavedTrainers();
  };

  const handleRemoveFavorite = (trainerId: string) => {
    setSavedTrainers(savedTrainers.filter(t => t.id !== trainerId));
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
              outputRange: [30 * (index + 1), 0],
            })
          }],
        }}
      >
        <TouchableOpacity
          style={styles.trainerCard}
          onPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.id}`)}
          activeOpacity={0.9}
        >
          {/* Accent stripe */}
          <View style={styles.cardAccent} />
          
          <View style={styles.cardContent}>
            {/* Trainer Avatar */}
            {trainer.profilePhoto ? (
              <Image source={{ uri: trainer.profilePhoto }} style={styles.trainerAvatar} />
            ) : (
              <LinearGradient
                colors={[COLORS.teal, COLORS.tealLight]}
                style={styles.trainerAvatarPlaceholder}
              >
                <Text style={styles.avatarInitials}>
                  {trainer.name.split(' ').map((n: string) => n[0]).join('')}
                </Text>
              </LinearGradient>
            )}

            {/* Trainer Info */}
            <View style={styles.trainerInfo}>
              <View style={styles.trainerHeader}>
                <Text style={styles.trainerName}>{trainer.name}</Text>
                {trainer.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.teal} />
                  </View>
                )}
              </View>
              
              <View style={styles.trainerMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="star" size={14} color={COLORS.warning} />
                  <Text style={styles.metaText}>{trainer.rating?.toFixed(1)}</Text>
                  <Text style={styles.metaSubtext}>({trainer.reviewCount})</Text>
                </View>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <Text style={styles.priceText}>${trainer.hourlyRate}/hr</Text>
                </View>
              </View>

              <View style={styles.specialtiesRow}>
                {trainer.specialties?.slice(0, 2).map((spec: string, i: number) => (
                  <View key={i} style={styles.specialtyTag}>
                    <Text style={styles.specialtyText}>{spec}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Heart Button */}
            <TouchableOpacity
              style={styles.heartButton}
              onPress={(e) => {
                e.stopPropagation();
                handleRemoveFavorite(trainer.id);
              }}
            >
              <Animated.View style={{ transform: [{ scale: heartPulseAnim }] }}>
                <Ionicons name="heart" size={24} color={COLORS.error} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Book Now Button */}
          <TouchableOpacity 
            style={styles.bookButton}
            onPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.id}`)}
          >
            <LinearGradient
              colors={[COLORS.orange, COLORS.orangeLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookButtonGradient}
            >
              <Text style={styles.bookButtonText}>Book Session</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
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
          <Text style={styles.headerTitle}>SAVED TRAINERS ❤️</Text>
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
            <View style={styles.trainersList}>
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
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.orange,
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

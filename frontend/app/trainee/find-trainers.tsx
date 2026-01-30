import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
  Image,
  ScrollView,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { traineeAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const IS_WEB = Platform.OS === 'web';

// Polling interval for live updates (15 seconds)
const LOCATION_POLL_INTERVAL = 15000;

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealDark: '#0D8B88',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  gray: '#8892b0',
  success: '#00D68F',
  error: '#FF4757',
};

interface NearbyTrainer {
  id: string;
  trainerId: string;
  fullName: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  etaMinutes: number;
  averageRating: number;
  ratePerMinuteCents: number;
  trainingStyles: string[];
  bio?: string;
  totalSessionsCompleted?: number;
}

export default function FindTrainersScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const flatListRef = useRef<FlatList>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trainers, setTrainers] = useState<NearbyTrainer[]>([]);
  const [selectedTrainerIndex, setSelectedTrainerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Refs for polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Load data on mount
  useEffect(() => {
    requestLocationAndLoadTrainers();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Start polling when we have location
  useEffect(() => {
    if (userLocation && locationPermission) {
      startLivePolling();
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [userLocation, locationPermission]);

  const startLivePolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      if (userLocation) {
        loadNearbyTrainers(userLocation.latitude, userLocation.longitude, true);
      }
    }, LOCATION_POLL_INTERVAL);
  };

  const requestLocationAndLoadTrainers = async () => {
    try {
      setLoading(true);

      // For web demo, use LA coordinates
      if (IS_WEB) {
        const demoCoords = { latitude: 34.0522, longitude: -118.2437 };
        setLocationPermission(true);
        setUserLocation(demoCoords);
        await loadNearbyTrainers(demoCoords.latitude, demoCoords.longitude, false);
        setLoading(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationPermission(false);
        setLoading(false);
        return;
      }

      setLocationPermission(true);

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);
      await loadNearbyTrainers(coords.latitude, coords.longitude, false);

    } catch (error) {
      console.error('Error getting location:', error);
      // Fallback to LA for demo
      const demoCoords = { latitude: 34.0522, longitude: -118.2437 };
      setLocationPermission(true);
      setUserLocation(demoCoords);
      await loadNearbyTrainers(demoCoords.latitude, demoCoords.longitude, false);
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyTrainers = async (lat: number, lng: number, isPolling: boolean = false) => {
    try {
      if (!isPolling) setRefreshing(true);
      const response = await traineeAPI.getNearbyTrainers(lat, lng, 25);
      setTrainers(response.trainers || []);
    } catch (error) {
      console.error('Error loading trainers:', error);
    } finally {
      if (!isPolling) setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (userLocation) {
      await loadNearbyTrainers(userLocation.latitude, userLocation.longitude, false);
    }
  };

  const handleViewProfile = (trainer: NearbyTrainer) => {
    router.push(`/trainee/trainer-detail?trainerId=${trainer.trainerId}`);
  };

  const renderTrainerCard = ({ item: trainer, index }: { item: NearbyTrainer; index: number }) => (
    <Animated.View style={[styles.trainerCard, { opacity: fadeAnim }]}>
      <View style={styles.cardGlass}>
        {/* Trainer Header */}
        <View style={styles.trainerHeader}>
          <View style={styles.avatarContainer}>
            {trainer.avatarUrl ? (
              <Image source={{ uri: trainer.avatarUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{trainer.fullName.charAt(0)}</Text>
              </LinearGradient>
            )}
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
            </View>
          </View>

          <View style={styles.trainerInfo}>
            <Text style={styles.trainerName}>{trainer.fullName}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color={COLORS.orange} />
              <Text style={styles.ratingText}>{trainer.averageRating.toFixed(1)}</Text>
              <Text style={styles.sessionsText}>• {trainer.totalSessionsCompleted || 0} sessions</Text>
            </View>
          </View>
        </View>

        {/* Training Styles */}
        {trainer.trainingStyles.length > 0 && (
          <View style={styles.stylesContainer}>
            {trainer.trainingStyles.slice(0, 3).map((style, idx) => (
              <View key={idx} style={styles.styleTag}>
                <Text style={styles.styleText}>{style}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ETA Info - Uber style */}
        <View style={styles.etaContainer}>
          <View style={styles.etaItem}>
            <Ionicons name="time-outline" size={20} color={COLORS.teal} />
            <Text style={styles.etaValue}>{trainer.etaMinutes}</Text>
            <Text style={styles.etaLabel}>min away</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Ionicons name="location-outline" size={20} color={COLORS.orange} />
            <Text style={styles.etaValue}>{trainer.distanceMiles}</Text>
            <Text style={styles.etaLabel}>miles</Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaItem}>
            <Ionicons name="cash-outline" size={20} color={COLORS.success} />
            <Text style={styles.etaValue}>${(trainer.ratePerMinuteCents / 100).toFixed(0)}</Text>
            <Text style={styles.etaLabel}>per min</Text>
          </View>
        </View>

        {/* Bio */}
        {trainer.bio && (
          <Text style={styles.bio} numberOfLines={2}>{trainer.bio}</Text>
        )}

        {/* Action Button */}
        <TouchableOpacity 
          style={styles.bookButton} 
          onPress={() => handleViewProfile(trainer)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[COLORS.orange, COLORS.orangeHot]}
            style={styles.bookButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.bookButtonText}>View Profile & Book</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // Permission denied view
  if (locationPermission === false) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.navy, COLORS.navyLight]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <Ionicons name="location-outline" size={64} color={COLORS.orange} />
            <Text style={styles.permissionTitle}>Location Required</Text>
            <Text style={styles.permissionText}>
              RapidReps needs your location to show nearby trainers and estimate arrival times.
            </Text>
            <TouchableOpacity style={styles.enableButton} onPress={requestLocationAndLoadTrainers}>
              <LinearGradient colors={[COLORS.orange, COLORS.orangeHot]} style={styles.enableButtonGradient}>
                <Text style={styles.enableButtonText}>Enable Location</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButtonPerm} onPress={() => router.back()}>
              <Text style={styles.backButtonPermText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Loading view
  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.navy, COLORS.navyLight]} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.orange} />
          <Text style={styles.loadingText}>Finding trainers near you...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.navy, COLORS.navyLight]} style={StyleSheet.absoluteFill} />
      
      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Find Trainers</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="refresh" size={24} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={18} color={COLORS.teal} />
            <Text style={styles.statText}>{trainers.length} trainers nearby</Text>
          </View>
          {userLocation && (
            <View style={styles.statItem}>
              <Ionicons name="navigate" size={18} color={COLORS.orange} />
              <Text style={styles.statText}>Your location active</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Trainer Cards */}
      {trainers.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={trainers}
          renderItem={renderTrainerCard}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + 16}
          decelerationRate="fast"
          contentContainerStyle={styles.cardsContainer}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 16));
            setSelectedTrainerIndex(index);
          }}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="fitness-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No Trainers Available</Text>
          <Text style={styles.emptyText}>There are no trainers nearby at the moment. Try again later!</Text>
        </View>
      )}

      {/* Pagination Dots */}
      {trainers.length > 1 && (
        <View style={styles.pagination}>
          {trainers.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === selectedTrainerIndex && styles.paginationDotActive
              ]}
            />
          ))}
        </View>
      )}

      {/* Bottom Hint */}
      <View style={styles.bottomHint}>
        <Ionicons name="swap-horizontal" size={16} color={COLORS.gray} />
        <Text style={styles.hintText}>Swipe to see more trainers</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 214, 143, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
    letterSpacing: 0.5,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  // Cards
  cardsContainer: {
    paddingHorizontal: (width - CARD_WIDTH) / 2,
    paddingVertical: 20,
  },
  trainerCard: {
    width: CARD_WIDTH,
    marginHorizontal: 8,
  },
  cardGlass: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // Trainer Header
  trainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: COLORS.teal,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.teal,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
  },
  trainerInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.orange,
    marginLeft: 4,
  },
  sessionsText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 6,
  },

  // Training Styles
  stylesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  styleTag: {
    backgroundColor: 'rgba(31, 184, 180, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  styleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.teal,
  },

  // ETA Container
  etaContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  etaItem: {
    flex: 1,
    alignItems: 'center',
  },
  etaDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  etaValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 6,
  },
  etaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // Bio
  bio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 16,
  },

  // Book Button
  bookButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  paginationDotActive: {
    backgroundColor: COLORS.orange,
    width: 24,
  },

  // Bottom Hint
  bottomHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 32,
  },
  hintText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '500',
  },

  // Loading
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

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },

  // Permission
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 20,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  enableButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  enableButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  backButtonPerm: {
    marginTop: 16,
    padding: 12,
  },
  backButtonPermText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
});

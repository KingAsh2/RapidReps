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
const BOTTOM_SHEET_HEIGHT = 280;
const IS_WEB = Platform.OS === 'web';

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
  grayLight: '#E8ECF0',
  success: '#00D68F',
  error: '#FF4757',
};

// Uber-style dark map theme
const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

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
  sessionDurationsOffered: number[];
  bio?: string;
  experienceYears?: number;
  totalSessionsCompleted?: number;
}

export default function FindTrainersMapScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();

  // State
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trainers, setTrainers] = useState<NearbyTrainer[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<NearbyTrainer | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulse animation for user location
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Animate bottom sheet
  useEffect(() => {
    Animated.spring(bottomSheetAnim, {
      toValue: selectedTrainer ? 1 : 0,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [selectedTrainer]);

  // Request location and load trainers
  useEffect(() => {
    requestLocationAndLoadTrainers();
  }, []);

  const requestLocationAndLoadTrainers = async () => {
    try {
      setLoading(true);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationPermission(false);
        setLoading(false);
        return;
      }

      setLocationPermission(true);

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);

      // Load nearby trainers
      await loadNearbyTrainers(coords.latitude, coords.longitude);

    } catch (error) {
      console.error('Error getting location:', error);
      showAlert({
        type: 'error',
        title: 'Location Error',
        message: 'Could not get your location. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyTrainers = async (lat: number, lng: number) => {
    try {
      setRefreshing(true);
      const response = await traineeAPI.getNearbyTrainers(lat, lng, 25);
      setTrainers(response.trainers || []);
    } catch (error) {
      console.error('Error loading trainers:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (userLocation) {
      await loadNearbyTrainers(userLocation.latitude, userLocation.longitude);
    }
  };

  const handleTrainerPress = (trainer: NearbyTrainer) => {
    setSelectedTrainer(trainer);
  };

  const handleBookSession = (trainer?: NearbyTrainer) => {
    const t = trainer || selectedTrainer;
    if (t) {
      router.push(`/trainee/trainer-detail?trainerId=${t.trainerId}`);
    }
  };

  // Permission denied view
  if (locationPermission === false) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.navy, COLORS.navyLight]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <Ionicons name="location-outline" size={64} color={COLORS.orange} />
            <Text style={styles.permissionTitle}>Location Access Needed</Text>
            <Text style={styles.permissionText}>
              RapidReps needs your location to show nearby trainers and estimate their arrival time for your workouts.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestLocationAndLoadTrainers}
            >
              <LinearGradient
                colors={[COLORS.orange, COLORS.orangeHot]}
                style={styles.permissionButtonGradient}
              >
                <Text style={styles.permissionButtonText}>Enable Location</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
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
        <LinearGradient
          colors={[COLORS.navy, COLORS.navyLight]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.orange} />
          <Text style={styles.loadingText}>Finding trainers near you...</Text>
        </View>
      </View>
    );
  }

  // Trainer Card Component for list view
  const TrainerCard = ({ trainer }: { trainer: NearbyTrainer }) => (
    <TouchableOpacity 
      style={styles.trainerCard}
      onPress={() => handleBookSession(trainer)}
      activeOpacity={0.8}
    >
      <View style={styles.trainerCardContent}>
        <View style={styles.trainerAvatar}>
          {trainer.avatarUrl ? (
            <Image source={{ uri: trainer.avatarUrl }} style={styles.trainerAvatarImage} />
          ) : (
            <LinearGradient
              colors={[COLORS.teal, COLORS.tealDark]}
              style={styles.trainerAvatarPlaceholder}
            >
              <Text style={styles.trainerAvatarText}>
                {trainer.fullName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </View>

        <View style={styles.trainerDetails}>
          <Text style={styles.trainerName}>{trainer.fullName}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={COLORS.orange} />
            <Text style={styles.ratingText}>
              {trainer.averageRating.toFixed(1)} • {trainer.totalSessionsCompleted || 0} sessions
            </Text>
          </View>
          {trainer.trainingStyles.length > 0 && (
            <Text style={styles.stylesText} numberOfLines={1}>
              {trainer.trainingStyles.slice(0, 2).join(' • ')}
            </Text>
          )}
        </View>

        <View style={styles.trainerMeta}>
          <View style={styles.etaBadge}>
            <Ionicons name="time" size={14} color={COLORS.teal} />
            <Text style={styles.etaBadgeText}>{trainer.etaMinutes} min</Text>
          </View>
          <Text style={styles.distanceText}>{trainer.distanceMiles} mi</Text>
          <Text style={styles.rateText}>${(trainer.ratePerMinuteCents / 100).toFixed(0)}/min</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.navy, COLORS.navyLight, COLORS.teal]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Find Trainers</Text>
            <Text style={styles.headerSubtitle}>
              {trainers.length} available nearby
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleRefresh}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="refresh" size={24} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>

        {/* Location Info */}
        {userLocation && (
          <View style={styles.locationBanner}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              style={styles.locationBannerGradient}
            >
              <Ionicons name="location" size={20} color={COLORS.teal} />
              <Text style={styles.locationText}>
                Showing trainers within 25 miles of your location
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Trainer List */}
        {trainers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyCard}>
              <Ionicons name="fitness-outline" size={64} color={COLORS.white} />
              <Text style={styles.emptyTitle}>No Trainers Available</Text>
              <Text style={styles.emptySubtitle}>
                No trainers are currently available in your area. Try again later!
              </Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleRefresh}
              >
                <LinearGradient
                  colors={[COLORS.orange, COLORS.orangeHot]}
                  style={styles.refreshButtonGradient}
                >
                  <Ionicons name="refresh" size={20} color={COLORS.white} />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            data={trainers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TrainerCard trainer={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  safeArea: {
    flex: 1,
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
  permissionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  permissionButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  backButton: {
    marginTop: 16,
    padding: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // Location Banner
  locationBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  locationBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Trainer Card
  trainerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  trainerCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  trainerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
    overflow: 'hidden',
  },
  trainerAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  trainerAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainerAvatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  trainerDetails: {
    flex: 1,
  },
  trainerName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginLeft: 4,
  },
  stylesText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.teal,
  },
  trainerMeta: {
    alignItems: 'flex-end',
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 184, 180, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
    marginBottom: 4,
  },
  etaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.teal,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 2,
  },
  rateText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.orange,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  refreshButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  refreshButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
});

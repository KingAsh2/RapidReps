import React, { useState, useEffect, useRef, useCallback } from 'react';
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
const CARD_WIDTH = width * 0.75;
const CARD_MARGIN = 10;
const IS_WEB = Platform.OS === 'web';

// Polling interval for live updates (10 seconds)
const LOCATION_POLL_INTERVAL = 10000;

// ETA thresholds for notifications
const ETA_THRESHOLDS = {
  ARRIVING_SOON: 5,  // 5 minutes
  ALMOST_HERE: 2,    // 2 minutes
};

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
  black: '#000000',
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
  // For animation
  animatedCoord?: {
    latitude: Animated.Value;
    longitude: Animated.Value;
  };
  previousEta?: number;
}

interface ArrivingNotification {
  trainerId: string;
  trainerName: string;
  etaMinutes: number;
  type: 'arriving_soon' | 'almost_here';
}

export default function FindTrainersMapScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const flatListRef = useRef<FlatList>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trainers, setTrainers] = useState<NearbyTrainer[]>([]);
  const [selectedTrainerIndex, setSelectedTrainerIndex] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [arrivingNotification, setArrivingNotification] = useState<ArrivingNotification | null>(null);

  // Refs for polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousTrainersRef = useRef<Map<string, NearbyTrainer>>(new Map());

  // Animations
  const notificationAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const carouselScrollX = useRef(new Animated.Value(0)).current;

  // Start pulse animation
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

  // Request location and load trainers
  useEffect(() => {
    requestLocationAndLoadTrainers();
    
    return () => {
      // Cleanup polling on unmount
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Start live polling when we have location
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

  // Show/hide arriving notification
  useEffect(() => {
    if (arrivingNotification) {
      Animated.spring(notificationAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 5 seconds
      const timeout = setTimeout(() => {
        hideNotification();
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [arrivingNotification]);

  const hideNotification = () => {
    Animated.timing(notificationAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setArrivingNotification(null);
    });
  };

  const startLivePolling = () => {
    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Start new polling interval
    pollIntervalRef.current = setInterval(() => {
      if (userLocation) {
        loadNearbyTrainers(userLocation.latitude, userLocation.longitude, true);
      }
    }, LOCATION_POLL_INTERVAL);
  };

  const requestLocationAndLoadTrainers = async () => {
    try {
      setLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        // On web, use a default location for demo purposes
        if (IS_WEB) {
          console.log('Using demo location for web preview');
          const demoCoords = {
            latitude: 39.17,
            longitude: -76.77,
          };
          setLocationPermission(true);
          setUserLocation(demoCoords);
          await loadNearbyTrainers(demoCoords.latitude, demoCoords.longitude, false);
          setLoading(false);
          return;
        }
        
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
      
      // On web, use demo location as fallback
      if (IS_WEB) {
        const demoCoords = {
          latitude: 39.17,
          longitude: -76.77,
        };
        setLocationPermission(true);
        setUserLocation(demoCoords);
        await loadNearbyTrainers(demoCoords.latitude, demoCoords.longitude, false);
        return;
      }
      
      showAlert({
        type: 'error',
        title: 'Location Error',
        message: 'Could not get your location. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyTrainers = async (lat: number, lng: number, isPolling: boolean = false) => {
    try {
      if (!isPolling) setRefreshing(true);
      
      const response = await traineeAPI.getNearbyTrainers(lat, lng, 25);
      const newTrainers: NearbyTrainer[] = response.trainers || [];

      // Check for ETA changes and trigger notifications
      newTrainers.forEach((trainer) => {
        const previousTrainer = previousTrainersRef.current.get(trainer.trainerId);
        
        if (previousTrainer) {
          // Check if trainer is now arriving soon (crossed 5 min threshold)
          if (previousTrainer.etaMinutes > ETA_THRESHOLDS.ARRIVING_SOON && 
              trainer.etaMinutes <= ETA_THRESHOLDS.ARRIVING_SOON) {
            triggerArrivingNotification(trainer, 'arriving_soon');
          }
          // Check if trainer is almost here (crossed 2 min threshold)
          else if (previousTrainer.etaMinutes > ETA_THRESHOLDS.ALMOST_HERE && 
                   trainer.etaMinutes <= ETA_THRESHOLDS.ALMOST_HERE) {
            triggerArrivingNotification(trainer, 'almost_here');
          }
        }

        // Store previous ETA for next comparison
        trainer.previousEta = previousTrainer?.etaMinutes;
      });

      // Update previous trainers map
      const newPreviousMap = new Map<string, NearbyTrainer>();
      newTrainers.forEach(t => newPreviousMap.set(t.trainerId, t));
      previousTrainersRef.current = newPreviousMap;

      setTrainers(newTrainers);
    } catch (error) {
      console.error('Error loading trainers:', error);
    } finally {
      if (!isPolling) setRefreshing(false);
    }
  };

  const triggerArrivingNotification = (trainer: NearbyTrainer, type: 'arriving_soon' | 'almost_here') => {
    setArrivingNotification({
      trainerId: trainer.trainerId,
      trainerName: trainer.fullName,
      etaMinutes: trainer.etaMinutes,
      type,
    });
  };

  const handleRefresh = async () => {
    if (userLocation) {
      await loadNearbyTrainers(userLocation.latitude, userLocation.longitude, false);
    }
  };

  const handleTrainerCardPress = (index: number) => {
    setSelectedTrainerIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleBookSession = (trainer: NearbyTrainer) => {
    router.push(`/trainee/trainer-detail?trainerId=${trainer.trainerId}`);
  };

  const onCarouselScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: carouselScrollX } } }],
    { useNativeDriver: false }
  );

  const onMomentumScrollEnd = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_MARGIN * 2));
    setSelectedTrainerIndex(index);
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

  // Trainer Card Component for carousel
  const TrainerCarouselCard = ({ trainer, index }: { trainer: NearbyTrainer; index: number }) => {
    const isSelected = index === selectedTrainerIndex;
    
    const inputRange = [
      (index - 1) * (CARD_WIDTH + CARD_MARGIN * 2),
      index * (CARD_WIDTH + CARD_MARGIN * 2),
      (index + 1) * (CARD_WIDTH + CARD_MARGIN * 2),
    ];

    const scale = carouselScrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });

    const opacity = carouselScrollX.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[
        styles.carouselCard,
        { transform: [{ scale }], opacity }
      ]}>
        <TouchableOpacity 
          activeOpacity={0.95}
          onPress={() => handleBookSession(trainer)}
          style={styles.carouselCardInner}
        >
          {/* Trainer Avatar & Info Row */}
          <View style={styles.carouselTopRow}>
            <View style={styles.carouselAvatar}>
              {trainer.avatarUrl ? (
                <Image source={{ uri: trainer.avatarUrl }} style={styles.carouselAvatarImage} />
              ) : (
                <LinearGradient
                  colors={[COLORS.teal, COLORS.tealDark]}
                  style={styles.carouselAvatarPlaceholder}
                >
                  <Text style={styles.carouselAvatarText}>
                    {trainer.fullName.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              {/* Online indicator */}
              <View style={styles.onlineIndicator} />
            </View>

            <View style={styles.carouselInfo}>
              <Text style={styles.carouselName} numberOfLines={1}>{trainer.fullName}</Text>
              <View style={styles.carouselRatingRow}>
                <Ionicons name="star" size={14} color={COLORS.orange} />
                <Text style={styles.carouselRating}>{trainer.averageRating.toFixed(1)}</Text>
                <Text style={styles.carouselSessions}>• {trainer.totalSessionsCompleted || 0} sessions</Text>
              </View>
              {trainer.trainingStyles.length > 0 && (
                <Text style={styles.carouselStyles} numberOfLines={1}>
                  {trainer.trainingStyles.slice(0, 2).join(' • ')}
                </Text>
              )}
            </View>
          </View>

          {/* ETA & Distance Row */}
          <View style={styles.carouselMetaRow}>
            <View style={styles.carouselMetaItem}>
              <View style={styles.etaIconContainer}>
                <Ionicons name="time" size={20} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.carouselMetaValue}>{trainer.etaMinutes} min</Text>
                <Text style={styles.carouselMetaLabel}>arrival</Text>
              </View>
            </View>

            <View style={styles.carouselMetaDivider} />

            <View style={styles.carouselMetaItem}>
              <View style={[styles.etaIconContainer, { backgroundColor: COLORS.orange }]}>
                <Ionicons name="location" size={20} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.carouselMetaValue}>{trainer.distanceMiles} mi</Text>
                <Text style={styles.carouselMetaLabel}>away</Text>
              </View>
            </View>

            <View style={styles.carouselMetaDivider} />

            <View style={styles.carouselMetaItem}>
              <View style={[styles.etaIconContainer, { backgroundColor: COLORS.success }]}>
                <Ionicons name="cash" size={20} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.carouselMetaValue}>${(trainer.ratePerMinuteCents / 100).toFixed(0)}</Text>
                <Text style={styles.carouselMetaLabel}>per min</Text>
              </View>
            </View>
          </View>

          {/* Book Button */}
          <TouchableOpacity
            style={styles.carouselBookButton}
            onPress={() => handleBookSession(trainer)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[COLORS.orange, COLORS.orangeHot]}
              style={styles.carouselBookButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.carouselBookButtonText}>Book Session</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Main render
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.navy, COLORS.navyLight, '#0D8B88']}
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
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
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

        {/* Arriving Notification Banner */}
        {arrivingNotification && (
          <Animated.View style={[
            styles.notificationBanner,
            {
              opacity: notificationAnim,
              transform: [{
                translateY: notificationAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 0],
                }),
              }],
            },
          ]}>
            <LinearGradient
              colors={arrivingNotification.type === 'almost_here' 
                ? [COLORS.success, '#00B377'] 
                : [COLORS.orange, COLORS.orangeHot]}
              style={styles.notificationGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.notificationIconContainer}>
                <Ionicons 
                  name={arrivingNotification.type === 'almost_here' ? 'walk' : 'car'} 
                  size={24} 
                  color={COLORS.white} 
                />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>
                  {arrivingNotification.type === 'almost_here' 
                    ? '🏃 Almost Here!' 
                    : '🚗 Trainer Approaching!'}
                </Text>
                <Text style={styles.notificationText}>
                  {arrivingNotification.trainerName} is {arrivingNotification.etaMinutes} min away
                </Text>
              </View>
              <TouchableOpacity onPress={hideNotification} style={styles.notificationClose}>
                <Ionicons name="close" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Map Placeholder / Trainer Count */}
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapContent}>
            {/* User Location Indicator */}
            <Animated.View style={[styles.userLocationPulse, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.userLocationDot}>
                <Ionicons name="person" size={20} color={COLORS.white} />
              </View>
            </Animated.View>
            
            <Text style={styles.mapPlaceholderTitle}>
              {trainers.length} Trainer{trainers.length !== 1 ? 's' : ''} Available
            </Text>
            <Text style={styles.mapPlaceholderSubtitle}>
              Swipe cards below to see trainers
            </Text>

            {/* Mini trainer indicators */}
            <View style={styles.trainerIndicators}>
              {trainers.slice(0, 5).map((trainer, index) => (
                <View 
                  key={trainer.id} 
                  style={[
                    styles.miniTrainerDot,
                    index === selectedTrainerIndex && styles.miniTrainerDotSelected
                  ]}
                >
                  {trainer.avatarUrl ? (
                    <Image source={{ uri: trainer.avatarUrl }} style={styles.miniTrainerImage} />
                  ) : (
                    <Text style={styles.miniTrainerInitial}>
                      {trainer.fullName.charAt(0)}
                    </Text>
                  )}
                </View>
              ))}
              {trainers.length > 5 && (
                <View style={styles.miniTrainerMore}>
                  <Text style={styles.miniTrainerMoreText}>+{trainers.length - 5}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Trainer Carousel */}
        {trainers.length > 0 ? (
          <View style={styles.carouselContainer}>
            <Animated.FlatList
              ref={flatListRef}
              data={trainers}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
              onScroll={onCarouselScroll}
              onMomentumScrollEnd={onMomentumScrollEnd}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => (
                <TrainerCarouselCard trainer={item} index={index} />
              )}
            />
            
            {/* Pagination dots */}
            <View style={styles.paginationContainer}>
              {trainers.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleTrainerCardPress(index)}
                >
                  <View style={[
                    styles.paginationDot,
                    index === selectedTrainerIndex && styles.paginationDotActive
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyCard}>
              <Ionicons name="fitness-outline" size={64} color={COLORS.white} />
              <Text style={styles.emptyTitle}>No Trainers Available</Text>
              <Text style={styles.emptySubtitle}>
                No trainers are currently online in your area. Try again later!
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
    paddingVertical: 12,
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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(0, 214, 143, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
    letterSpacing: 0.5,
  },

  // Notification Banner
  notificationBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  notificationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  notificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 2,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  notificationClose: {
    padding: 4,
  },

  // Map Placeholder
  mapPlaceholder: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  mapContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  userLocationPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(31, 184, 180, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  userLocationDot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  mapPlaceholderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 8,
  },
  mapPlaceholderSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
  },
  trainerIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniTrainerDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navy,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  miniTrainerDotSelected: {
    borderColor: COLORS.orange,
    borderWidth: 3,
  },
  miniTrainerImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  miniTrainerInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  miniTrainerMore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniTrainerMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Carousel
  carouselContainer: {
    paddingBottom: 20,
  },
  carouselContent: {
    paddingHorizontal: (width - CARD_WIDTH) / 2 - CARD_MARGIN,
  },
  carouselCard: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
  },
  carouselCardInner: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  carouselTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  carouselAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  carouselAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  carouselAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselAvatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  carouselInfo: {
    flex: 1,
  },
  carouselName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 4,
  },
  carouselRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  carouselRating: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navy,
    marginLeft: 4,
  },
  carouselSessions: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginLeft: 4,
  },
  carouselStyles: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.teal,
  },

  // Meta Row
  carouselMetaRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.offWhite,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  carouselMetaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  carouselMetaValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
  },
  carouselMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
  },
  carouselMetaDivider: {
    width: 1,
    backgroundColor: COLORS.grayLight,
    marginHorizontal: 8,
  },

  // Book Button
  carouselBookButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  carouselBookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  carouselBookButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },

  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: COLORS.orange,
    width: 24,
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

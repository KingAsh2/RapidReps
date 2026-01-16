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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { traineeAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';

// Conditionally import MapView only on native platforms
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

const { width, height } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = 280;

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
  const mapRef = useRef<MapView>(null);

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

      // Center map on user location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 500);
      }

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
      
      // Re-center map
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...userLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 500);
      }
    }
  };

  const handleTrainerPress = (trainer: NearbyTrainer) => {
    setSelectedTrainer(trainer);
    
    // Animate to trainer location
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: (userLocation.latitude + trainer.latitude) / 2,
        longitude: (userLocation.longitude + trainer.longitude) / 2,
        latitudeDelta: Math.abs(userLocation.latitude - trainer.latitude) * 2.5,
        longitudeDelta: Math.abs(userLocation.longitude - trainer.longitude) * 2.5,
      }, 500);
    }
  };

  const handleBookSession = () => {
    if (selectedTrainer) {
      router.push(`/trainee/trainer-detail?trainerId=${selectedTrainer.trainerId}`);
    }
  };

  const handleMapPress = () => {
    setSelectedTrainer(null);
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

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={mapStyle}
        initialRegion={{
          latitude: userLocation?.latitude || 37.78825,
          longitude: userLocation?.longitude || -122.4324,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {/* User Location Marker */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Animated.View style={[styles.userMarker, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.userMarkerInner}>
                <View style={styles.userMarkerDot} />
              </View>
            </Animated.View>
          </Marker>
        )}

        {/* Trainer Markers */}
        {trainers.map((trainer) => (
          <Marker
            key={trainer.id}
            coordinate={{
              latitude: trainer.latitude,
              longitude: trainer.longitude,
            }}
            onPress={() => handleTrainerPress(trainer)}
          >
            <View style={[
              styles.trainerMarker,
              selectedTrainer?.id === trainer.id && styles.trainerMarkerSelected
            ]}>
              {trainer.avatarUrl ? (
                <Image source={{ uri: trainer.avatarUrl }} style={styles.trainerMarkerImage} />
              ) : (
                <Ionicons name="fitness" size={20} color={COLORS.white} />
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <SafeAreaView style={styles.headerContainer} edges={['top']}>
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
      </SafeAreaView>

      {/* Re-center button */}
      <TouchableOpacity
        style={styles.recenterButton}
        onPress={handleRefresh}
      >
        <Ionicons name="locate" size={24} color={COLORS.navy} />
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [
              {
                translateY: bottomSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [BOTTOM_SHEET_HEIGHT + 50, 0],
                }),
              },
            ],
          },
        ]}
      >
        {selectedTrainer && (
          <View style={styles.bottomSheetContent}>
            {/* Handle */}
            <View style={styles.bottomSheetHandle} />

            {/* Trainer Info */}
            <View style={styles.trainerInfo}>
              <View style={styles.trainerAvatar}>
                {selectedTrainer.avatarUrl ? (
                  <Image source={{ uri: selectedTrainer.avatarUrl }} style={styles.trainerAvatarImage} />
                ) : (
                  <LinearGradient
                    colors={[COLORS.teal, COLORS.tealDark]}
                    style={styles.trainerAvatarPlaceholder}
                  >
                    <Text style={styles.trainerAvatarText}>
                      {selectedTrainer.fullName.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </View>

              <View style={styles.trainerDetails}>
                <Text style={styles.trainerName}>{selectedTrainer.fullName}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color={COLORS.orange} />
                  <Text style={styles.ratingText}>
                    {selectedTrainer.averageRating.toFixed(1)} • {selectedTrainer.totalSessionsCompleted || 0} sessions
                  </Text>
                </View>
                {selectedTrainer.trainingStyles.length > 0 && (
                  <Text style={styles.stylesText} numberOfLines={1}>
                    {selectedTrainer.trainingStyles.slice(0, 3).join(' • ')}
                  </Text>
                )}
              </View>
            </View>

            {/* ETA & Distance */}
            <View style={styles.etaContainer}>
              <View style={styles.etaItem}>
                <Ionicons name="time-outline" size={24} color={COLORS.teal} />
                <Text style={styles.etaValue}>{selectedTrainer.etaMinutes} min</Text>
                <Text style={styles.etaLabel}>arrival</Text>
              </View>
              <View style={styles.etaDivider} />
              <View style={styles.etaItem}>
                <Ionicons name="location-outline" size={24} color={COLORS.orange} />
                <Text style={styles.etaValue}>{selectedTrainer.distanceMiles} mi</Text>
                <Text style={styles.etaLabel}>away</Text>
              </View>
              <View style={styles.etaDivider} />
              <View style={styles.etaItem}>
                <Ionicons name="cash-outline" size={24} color={COLORS.success} />
                <Text style={styles.etaValue}>${(selectedTrainer.ratePerMinuteCents / 100).toFixed(0)}</Text>
                <Text style={styles.etaLabel}>per min</Text>
              </View>
            </View>

            {/* Book Button */}
            <TouchableOpacity
              style={styles.bookButton}
              onPress={handleBookSession}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.orange, COLORS.orangeHot]}
                style={styles.bookButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="calendar" size={20} color={COLORS.white} />
                <Text style={styles.bookButtonText}>Book Session</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* No trainers message */}
      {trainers.length === 0 && !loading && (
        <View style={styles.noTrainersContainer}>
          <View style={styles.noTrainersCard}>
            <Ionicons name="fitness-outline" size={40} color={COLORS.gray} />
            <Text style={styles.noTrainersText}>No trainers available nearby</Text>
            <Text style={styles.noTrainersSubtext}>Try expanding your search area</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  map: {
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
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(26, 42, 94, 0.9)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
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
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // Re-center button
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 320,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },

  // User marker
  userMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 184, 180, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  userMarkerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },

  // Trainer marker
  trainerMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.navy,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  trainerMarkerSelected: {
    backgroundColor: COLORS.orange,
    borderColor: COLORS.orangeHot,
    transform: [{ scale: 1.2 }],
  },
  trainerMarkerImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_SHEET_HEIGHT,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  bottomSheetContent: {
    flex: 1,
    padding: 20,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.grayLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },

  // Trainer info
  trainerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  trainerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    overflow: 'hidden',
  },
  trainerAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  trainerAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainerAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  trainerDetails: {
    flex: 1,
  },
  trainerName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
    marginLeft: 4,
  },
  stylesText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.teal,
  },

  // ETA container
  etaContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.offWhite,
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
    backgroundColor: COLORS.grayLight,
    marginVertical: 4,
  },
  etaValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginTop: 6,
  },
  etaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 2,
  },

  // Book button
  bookButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  bookButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
  },

  // No trainers
  noTrainersContainer: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
  },
  noTrainersCard: {
    backgroundColor: 'rgba(26, 42, 94, 0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  noTrainersText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: 12,
  },
  noTrainersSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
});

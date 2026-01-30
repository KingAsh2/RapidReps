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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { traineeAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = 180;
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

// Uber-style dark map theme
const darkMapStyle = [
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
  bio?: string;
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

  // Refs for polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animations
  const cardAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for user marker
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Animate card when trainer is selected
  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: selectedTrainer ? 1 : 0,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [selectedTrainer]);

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
      centerOnUser();
    }
  };

  const centerOnUser = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  };

  const handleTrainerPress = (trainer: NearbyTrainer) => {
    setSelectedTrainer(trainer);
    
    // Center map between user and trainer
    if (mapRef.current && userLocation) {
      const midLat = (userLocation.latitude + trainer.latitude) / 2;
      const midLng = (userLocation.longitude + trainer.longitude) / 2;
      const latDelta = Math.abs(userLocation.latitude - trainer.latitude) * 2 + 0.01;
      const lngDelta = Math.abs(userLocation.longitude - trainer.longitude) * 2 + 0.01;
      
      mapRef.current.animateToRegion({
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(latDelta, 0.02),
        longitudeDelta: Math.max(lngDelta, 0.02),
      }, 400);
    }
  };

  const handleMapPress = () => {
    setSelectedTrainer(null);
  };

  const handleBookSession = () => {
    if (selectedTrainer) {
      router.push(`/trainee/trainer-detail?trainerId=${selectedTrainer.trainerId}`);
    }
  };

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
            <TouchableOpacity style={styles.permissionButton} onPress={requestLocationAndLoadTrainers}>
              <LinearGradient colors={[COLORS.orange, COLORS.orangeHot]} style={styles.permissionButtonGradient}>
                <Text style={styles.permissionButtonText}>Enable Location</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
      {/* Full Screen Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: userLocation?.latitude || 34.0522,
          longitude: userLocation?.longitude || -118.2437,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {/* User Location Marker - Pulsing Blue Dot */}
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userMarkerContainer}>
              <Animated.View style={[styles.userMarkerPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.userMarkerDot}>
                <View style={styles.userMarkerInner} />
              </View>
            </View>
          </Marker>
        )}

        {/* Trainer Markers - Uber-style car icons */}
        {trainers.map((trainer) => (
          <Marker
            key={trainer.id}
            coordinate={{ latitude: trainer.latitude, longitude: trainer.longitude }}
            onPress={() => handleTrainerPress(trainer)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[
              styles.trainerMarker,
              selectedTrainer?.id === trainer.id && styles.trainerMarkerSelected
            ]}>
              {trainer.avatarUrl ? (
                <Image source={{ uri: trainer.avatarUrl }} style={styles.trainerMarkerImage} />
              ) : (
                <View style={styles.trainerMarkerIcon}>
                  <Ionicons name="fitness" size={18} color={COLORS.white} />
                </View>
              )}
              <View style={styles.trainerMarkerArrow} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header Overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Find Trainers</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.headerButton} onPress={handleRefresh}>
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="refresh" size={24} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>

        {/* Trainer Count Badge */}
        <View style={styles.countBadge}>
          <Ionicons name="people" size={16} color={COLORS.white} />
          <Text style={styles.countText}>{trainers.length} trainers nearby</Text>
        </View>
      </SafeAreaView>

      {/* Recenter Button */}
      <TouchableOpacity style={styles.recenterButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color={COLORS.navy} />
      </TouchableOpacity>

      {/* Selected Trainer Card - Uber style bottom card */}
      <Animated.View
        style={[
          styles.trainerCard,
          {
            transform: [{
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [CARD_HEIGHT + 100, 0],
              }),
            }],
          },
        ]}
      >
        {selectedTrainer && (
          <View style={styles.trainerCardContent}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />

            {/* Trainer Info Row */}
            <View style={styles.trainerInfoRow}>
              <View style={styles.trainerAvatar}>
                {selectedTrainer.avatarUrl ? (
                  <Image source={{ uri: selectedTrainer.avatarUrl }} style={styles.trainerAvatarImage} />
                ) : (
                  <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.trainerAvatarPlaceholder}>
                    <Text style={styles.trainerAvatarText}>{selectedTrainer.fullName.charAt(0)}</Text>
                  </LinearGradient>
                )}
                <View style={styles.onlineIndicator} />
              </View>

              <View style={styles.trainerInfo}>
                <Text style={styles.trainerName}>{selectedTrainer.fullName}</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={COLORS.orange} />
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

            {/* ETA Row - Uber style */}
            <View style={styles.etaRow}>
              <View style={styles.etaItem}>
                <Ionicons name="time" size={20} color={COLORS.teal} />
                <Text style={styles.etaValue}>{selectedTrainer.etaMinutes} min</Text>
                <Text style={styles.etaLabel}>away</Text>
              </View>
              <View style={styles.etaDivider} />
              <View style={styles.etaItem}>
                <Ionicons name="location" size={20} color={COLORS.orange} />
                <Text style={styles.etaValue}>{selectedTrainer.distanceMiles} mi</Text>
                <Text style={styles.etaLabel}>distance</Text>
              </View>
              <View style={styles.etaDivider} />
              <View style={styles.etaItem}>
                <Ionicons name="cash" size={20} color={COLORS.success} />
                <Text style={styles.etaValue}>${(selectedTrainer.ratePerMinuteCents / 100).toFixed(0)}</Text>
                <Text style={styles.etaLabel}>per min</Text>
              </View>
            </View>

            {/* Book Button */}
            <TouchableOpacity style={styles.bookButton} onPress={handleBookSession} activeOpacity={0.8}>
              <LinearGradient
                colors={[COLORS.orange, COLORS.orangeHot]}
                style={styles.bookButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.bookButtonText}>Book Session</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Loading & Permission
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

  // Header Overlay
  headerOverlay: {
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
    paddingVertical: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(26, 42, 94, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 214, 143, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
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
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 42, 94, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Recenter Button
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: CARD_HEIGHT + 80,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },

  // User Marker - Pulsing blue dot like Uber
  userMarkerContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(31, 184, 180, 0.25)',
  },
  userMarkerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.teal,
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
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },

  // Trainer Marker - Uber-style
  trainerMarker: {
    alignItems: 'center',
  },
  trainerMarkerSelected: {
    transform: [{ scale: 1.2 }],
  },
  trainerMarkerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  trainerMarkerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  trainerMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.white,
    marginTop: -2,
  },

  // Bottom Trainer Card - Uber style
  trainerCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  trainerCardContent: {
    padding: 20,
    paddingBottom: 32,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },

  // Trainer Info
  trainerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  trainerAvatar: {
    position: 'relative',
    marginRight: 14,
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
  trainerInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 18,
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
    fontWeight: '600',
    color: COLORS.teal,
  },

  // ETA Row
  etaRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  etaItem: {
    flex: 1,
    alignItems: 'center',
  },
  etaDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  etaValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    marginTop: 4,
  },
  etaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 2,
  },

  // Book Button
  bookButton: {
    borderRadius: 14,
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
});

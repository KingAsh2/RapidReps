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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 280;
const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealDark: '#0D8B88',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  gray: '#8892b0',
  success: '#00D68F',
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

// Conditionally import react-native-maps only on native
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (IS_NATIVE) {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
  } catch (e) {
    console.warn('react-native-maps not available');
  }
}

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
}

interface TrainerMapProps {
  userLocation: { latitude: number; longitude: number } | null;
  trainers: NearbyTrainer[];
  onTrainerSelect: (trainer: NearbyTrainer) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function TrainerMapView({ 
  userLocation, 
  trainers, 
  onTrainerSelect, 
  onRefresh,
  refreshing 
}: TrainerMapProps) {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<NearbyTrainer | null>(null);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for user marker
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

  // Animate card when trainer is selected
  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: selectedTrainer ? 1 : 0,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [selectedTrainer]);

  const handleTrainerPress = (trainer: NearbyTrainer) => {
    setSelectedTrainer(trainer);
    onTrainerSelect(trainer);
    
    // Center map on trainer
    if (mapRef.current && userLocation) {
      const midLat = (userLocation.latitude + trainer.latitude) / 2;
      const midLng = (userLocation.longitude + trainer.longitude) / 2;
      
      mapRef.current.animateToRegion({
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 400);
    }
  };

  const handleMapPress = () => {
    setSelectedTrainer(null);
  };

  const handleViewProfile = () => {
    if (selectedTrainer) {
      router.push(`/trainee/trainer-detail?trainerId=${selectedTrainer.trainerId}`);
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

  // Show nothing on web - the parent component handles the Platform check
  if (!IS_NATIVE || !MapView || !Marker) {
    return null;
  }

  if (!userLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.orange} />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Header */}
      <View style={styles.mapHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.mapTitle}>Trainers Near You</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.countBadge}>
            <Ionicons name="people" size={14} color={COLORS.white} />
            <Text style={styles.countText}>{trainers.length}</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="refresh" size={18} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onPress={handleMapPress}
        >
          {/* User Location Marker */}
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userMarkerContainer}>
              <Animated.View style={[styles.userMarkerPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.userMarkerDot}>
                <Ionicons name="person" size={10} color={COLORS.white} />
              </View>
            </View>
          </Marker>

          {/* Trainer Markers */}
          {trainers.map((trainer) => (
            <Marker
              key={trainer.id}
              coordinate={{ latitude: trainer.latitude, longitude: trainer.longitude }}
              onPress={() => handleTrainerPress(trainer)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={[
                styles.trainerMarker,
                selectedTrainer?.id === trainer.id && styles.trainerMarkerSelected
              ]}>
                {trainer.avatarUrl ? (
                  <Image source={{ uri: trainer.avatarUrl }} style={styles.trainerMarkerImage} />
                ) : (
                  <View style={styles.trainerMarkerIcon}>
                    <Ionicons name="fitness" size={16} color={COLORS.white} />
                  </View>
                )}
                <View style={styles.trainerMarkerArrow} />
              </View>
            </Marker>
          ))}
        </MapView>

        {/* Recenter Button */}
        <TouchableOpacity style={styles.recenterBtn} onPress={centerOnUser}>
          <Ionicons name="locate" size={20} color={COLORS.navy} />
        </TouchableOpacity>

        {/* Selected Trainer Mini Card */}
        {selectedTrainer && (
          <Animated.View 
            style={[
              styles.miniCard,
              {
                opacity: cardAnim,
                transform: [{
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.miniCardContent}>
              <View style={styles.miniCardLeft}>
                {selectedTrainer.avatarUrl ? (
                  <Image source={{ uri: selectedTrainer.avatarUrl }} style={styles.miniCardAvatar} />
                ) : (
                  <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.miniCardAvatarPlaceholder}>
                    <Text style={styles.miniCardInitial}>{selectedTrainer.fullName.charAt(0)}</Text>
                  </LinearGradient>
                )}
                <View style={styles.miniCardInfo}>
                  <Text style={styles.miniCardName} numberOfLines={1}>{selectedTrainer.fullName}</Text>
                  <View style={styles.miniCardMeta}>
                    <Ionicons name="star" size={12} color={COLORS.orange} />
                    <Text style={styles.miniCardRating}>{selectedTrainer.averageRating.toFixed(1)}</Text>
                    <Text style={styles.miniCardDistance}>• {selectedTrainer.distanceMiles.toFixed(1)} mi</Text>
                    <Text style={styles.miniCardEta}>• {selectedTrainer.etaMinutes} min</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.miniCardBtn} onPress={handleViewProfile}>
                <LinearGradient colors={[COLORS.orange, COLORS.orangeHot]} style={styles.miniCardBtnGradient}>
                  <Text style={styles.miniCardBtnText}>View</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  loadingContainer: {
    height: MAP_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },

  // Header
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(26, 42, 94, 0.98)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 214, 143, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Map
  mapContainer: {
    height: MAP_HEIGHT,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // User Marker
  userMarkerContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 184, 180, 0.3)',
  },
  userMarkerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },

  // Trainer Marker
  trainerMarker: {
    alignItems: 'center',
  },
  trainerMarkerSelected: {
    transform: [{ scale: 1.15 }],
  },
  trainerMarkerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.orange,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  trainerMarkerImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    marginTop: -3,
  },

  // Recenter Button
  recenterBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  // Mini Card
  miniCard: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  miniCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  miniCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  miniCardAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  miniCardAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  miniCardInfo: {
    flex: 1,
  },
  miniCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 2,
  },
  miniCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniCardRating: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.orange,
    marginLeft: 3,
  },
  miniCardDistance: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray,
    marginLeft: 4,
  },
  miniCardEta: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray,
    marginLeft: 2,
  },
  miniCardBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 10,
  },
  miniCardBtnGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  miniCardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});

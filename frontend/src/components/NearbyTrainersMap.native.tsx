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
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const MAP_HEIGHT = 400;

const COLORS = {
  teal: '#1a2a5e',
  tealDark: '#0D8B88',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  success: '#00D68F',
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
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
}

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  trainers: NearbyTrainer[];
  onRefresh: () => void;
  refreshing: boolean;
}

export default function NearbyTrainersMap({ userLocation, trainers, onRefresh, refreshing }: Props) {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<NearbyTrainer | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const mapGlowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Map glow animation
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(mapGlowAnim, { toValue: 0.7, duration: 2000, useNativeDriver: true }),
        Animated.timing(mapGlowAnim, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
      ])
    );
    glow.start();

    return () => { pulse.stop(); glow.stop(); };
  }, []);

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: selectedTrainer ? 1 : 0,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [selectedTrainer]);

  const handleTrainerPress = (trainer: NearbyTrainer) => {
    setSelectedTrainer(trainer);
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: (userLocation.latitude + trainer.latitude) / 2,
        longitude: (userLocation.longitude + trainer.longitude) / 2,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }, 400);
    }
  };

  const centerOnUser = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 500);
    }
  };

  if (!userLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.orange} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Trainers Near You</Text>
          <View style={styles.liveBadge}>
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

      <View style={styles.mapWrapper}>
        <Animated.View style={[styles.mapGlow, { opacity: mapGlowAnim }]} />
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onPress={() => setSelectedTrainer(null)}
        >
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userMarker}>
              <Animated.View style={[styles.userPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.userDot}>
                <Ionicons name="person" size={12} color={COLORS.white} />
              </View>
            </View>
          </Marker>

          {trainers.map((trainer) => (
            <Marker
              key={trainer.id}
              coordinate={{ latitude: trainer.latitude, longitude: trainer.longitude }}
              onPress={() => handleTrainerPress(trainer)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.trainerMarkerContainer, selectedTrainer?.id === trainer.id && styles.trainerMarkerSelected]}>
                {/* Uber-style circular avatar with glow effect */}
                <View style={styles.trainerMarkerGlow}>
                  {trainer.avatarUrl ? (
                    <Image source={{ uri: trainer.avatarUrl }} style={styles.trainerMarkerAvatar} />
                  ) : (
                    <LinearGradient colors={[COLORS.orange, COLORS.orangeHot]} style={styles.trainerMarkerIcon}>
                      <Ionicons name="fitness" size={20} color={COLORS.white} />
                    </LinearGradient>
                  )}
                </View>
                {/* ETA badge like Uber shows for cars */}
                <View style={styles.etaBadge}>
                  <Text style={styles.etaBadgeText}>{trainer.etaMinutes}m</Text>
                </View>
              </View>
            </Marker>
          ))}
        </MapView>

        <TouchableOpacity style={styles.recenterBtn} onPress={centerOnUser}>
          <Ionicons name="locate" size={22} color={COLORS.navy} />
        </TouchableOpacity>

        {selectedTrainer && (
          <Animated.View style={[styles.trainerCard, { 
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }]
          }]}>
            {/* Uber-style drag indicator */}
            <View style={styles.dragIndicator} />
            
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                {selectedTrainer.avatarUrl ? (
                  <Image source={{ uri: selectedTrainer.avatarUrl }} style={styles.cardAvatar} />
                ) : (
                  <LinearGradient colors={[COLORS.orange, COLORS.orangeHot]} style={styles.cardAvatarPlaceholder}>
                    <Text style={styles.cardInitial}>{selectedTrainer.fullName.charAt(0)}</Text>
                  </LinearGradient>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>{selectedTrainer.fullName}</Text>
                  <View style={styles.cardMeta}>
                    <Ionicons name="star" size={14} color={COLORS.orange} />
                    <Text style={styles.cardRating}>{selectedTrainer.averageRating?.toFixed(1)}</Text>
                  </View>
                </View>
              </View>
              
              {/* Price section like Uber */}
              <View style={styles.priceSection}>
                <Text style={styles.priceLabel}>From</Text>
                <Text style={styles.priceValue}>${((selectedTrainer.ratePerMinuteCents * 30) / 100).toFixed(0)}</Text>
                <Text style={styles.priceUnit}>/30 min</Text>
              </View>
            </View>
            
            {/* ETA and distance row */}
            <View style={styles.etaRow}>
              <View style={styles.etaItem}>
                <Ionicons name="time-outline" size={16} color={COLORS.gray} />
                <Text style={styles.etaText}>{selectedTrainer.etaMinutes} min away</Text>
              </View>
              <View style={styles.etaItem}>
                <Ionicons name="location-outline" size={16} color={COLORS.gray} />
                <Text style={styles.etaText}>{selectedTrainer.distanceMiles?.toFixed(1)} miles</Text>
              </View>
            </View>
            
            {/* Book button */}
            <TouchableOpacity 
              style={styles.bookBtn}
              onPress={() => router.push(`/trainee/trainer-detail?trainerId=${selectedTrainer.trainerId}`)}
            >
              <LinearGradient colors={[COLORS.orange, COLORS.orangeHot]} style={styles.bookBtnGradient}>
                <Text style={styles.bookBtnText}>View Profile & Book</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: -20,
    marginBottom: 16,
    borderRadius: 0,
    overflow: 'visible',
    backgroundColor: COLORS.navy,
  },
  loadingBox: {
    height: MAP_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(26, 42, 94, 0.98)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  liveBadge: {
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
    fontSize: 13,
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
  mapWrapper: {
    height: MAP_HEIGHT,
    position: 'relative',
    overflow: 'visible',
  },
  mapGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 0,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  userMarker: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(31, 184, 180, 0.3)',
  },
  userDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  trainerMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerMarkerSelected: {
    transform: [{ scale: 1.2 }],
  },
  trainerMarkerGlow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(247, 147, 30, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  trainerMarkerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  trainerMarkerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  etaBadge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  etaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  trainerPin: {
    alignItems: 'center',
  },
  trainerPinSelected: {
    transform: [{ scale: 1.15 }],
  },
  trainerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.orange,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  trainerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  trainerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.white,
    marginTop: -3,
  },
  distanceLabel: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  distanceLabelText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  recenterBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141929',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  trainerCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#141929',
    borderRadius: 20,
    padding: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  cardAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardRating: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.orange,
    marginLeft: 3,
  },
  cardDistance: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  cardEta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  viewBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 12,
  },
  viewBtnGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Uber-style card enhancements
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  priceUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  etaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  etaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  etaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  bookBtn: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bookBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  bookBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
});

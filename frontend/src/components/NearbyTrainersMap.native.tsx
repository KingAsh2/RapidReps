import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, Platform, Animated, ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const { width: SCREEN_W } = Dimensions.get('window');
const MAP_HEIGHT = Dimensions.get('window').height * 0.52;

// Neon color palette — matching RapidReps brand
const NEON = {
  green: '#00FF6A',
  greenDim: '#00C853',
  orange: '#FF6A00',
  orangeGlow: '#FF9F1C',
  purple: '#B24BF3',
  teal: '#00E5CC',
  bg: '#0A0E14',
  card: '#111820',
  cardBorder: '#1C2630',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: 'rgba(255,255,255,0.45)',
  star: '#FFB800',
};

// Assign neon colors to trainers based on rating tier
const getMarkerColor = (rating: number, idx: number) => {
  if (rating >= 4.5) return NEON.green;
  if (rating >= 3.5) return NEON.orange;
  return NEON.purple;
};

// Ultra-dark map style matching the reference
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0D1117' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0D1117' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3B4A5C' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A2332' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1A2332' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1E2D3D' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1520' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0D1117' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1A2332' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4A5568' }] },
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
  const cardSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.spring(cardSlideAnim, {
      toValue: selectedTrainer ? 1 : 0,
      friction: 8, useNativeDriver: true,
    }).start();
  }, [selectedTrainer]);

  const handleTrainerPress = (trainer: NearbyTrainer) => {
    setSelectedTrainer(trainer);
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: (userLocation.latitude + trainer.latitude) / 2,
        longitude: (userLocation.longitude + trainer.longitude) / 2,
        latitudeDelta: 0.035, longitudeDelta: 0.035,
      }, 400);
    }
  };

  const centerOnUser = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Available now = all trainers sorted by rating
  const availableTrainers = [...trainers].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));

  if (!userLocation) {
    return (
      <View style={st.container}>
        <View style={st.loadingBox}>
          <ActivityIndicator size="large" color={NEON.green} />
          <Text style={st.loadingText}>Getting your location...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={st.container} data-testid="nearby-trainers-map">
      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <Ionicons name="location" size={20} color={NEON.green} />
          <Text style={st.title}>Nearby Trainers</Text>
        </View>
        <TouchableOpacity style={st.refreshBtn} onPress={onRefresh} data-testid="map-refresh-btn">
          {refreshing ? <ActivityIndicator size="small" color={NEON.green} /> : <Ionicons name="refresh" size={20} color={NEON.green} />}
        </TouchableOpacity>
      </View>

      {/* Count badge */}
      <View style={st.countRow}>
        <View style={st.countBadge}>
          <Ionicons name="people" size={14} color={NEON.green} />
          <Text style={st.countText}>{trainers.length} trainers nearby</Text>
        </View>
      </View>

      {/* Map */}
      <View style={st.mapWrapper}>
        <MapView
          ref={mapRef}
          style={st.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={darkMapStyle}
          initialRegion={{ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onPress={() => setSelectedTrainer(null)}
        >
          {/* User marker */}
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={st.userMarker}>
              <Animated.View style={[st.userPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={st.userDot}>
                <Ionicons name="person" size={10} color={NEON.bg} />
              </View>
            </View>
          </Marker>

          {/* Trainer neon markers */}
          {trainers.map((trainer, idx) => {
            const color = getMarkerColor(trainer.averageRating, idx);
            const isSelected = selectedTrainer?.id === trainer.id;
            return (
              <Marker
                key={trainer.id}
                coordinate={{ latitude: trainer.latitude, longitude: trainer.longitude }}
                onPress={() => handleTrainerPress(trainer)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[st.neonMarkerWrap, isSelected && { transform: [{ scale: 1.25 }] }]}>
                  {/* Outer glow ring */}
                  <View style={[st.neonGlowOuter, { borderColor: color, shadowColor: color }]} />
                  {/* Inner circle with initial */}
                  <View style={[st.neonCircle, { borderColor: color, backgroundColor: NEON.bg }]}>
                    <Text style={[st.neonInitial, { color }]}>{getInitials(trainer.fullName)}</Text>
                  </View>
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Recenter button */}
        <TouchableOpacity style={st.recenterBtn} onPress={centerOnUser}>
          <Ionicons name="locate" size={20} color={NEON.green} />
        </TouchableOpacity>

        {/* Selected trainer detail card */}
        {selectedTrainer && (
          <Animated.View style={[st.detailCard, {
            opacity: cardSlideAnim,
            transform: [{ translateY: cardSlideAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }]
          }]}>
            <View style={st.detailDrag} />
            <View style={st.detailRow}>
              <View style={[st.detailAvatar, { borderColor: getMarkerColor(selectedTrainer.averageRating, 0) }]}>
                <Text style={[st.detailInitial, { color: getMarkerColor(selectedTrainer.averageRating, 0) }]}>
                  {getInitials(selectedTrainer.fullName)}
                </Text>
              </View>
              <View style={st.detailInfo}>
                <Text style={st.detailName} numberOfLines={1}>{selectedTrainer.fullName}</Text>
                <View style={st.detailMeta}>
                  <Ionicons name="star" size={13} color={NEON.star} />
                  <Text style={st.detailRating}>{selectedTrainer.averageRating?.toFixed(1)}</Text>
                  <Text style={st.detailDist}>{selectedTrainer.distanceMiles?.toFixed(1)} mi</Text>
                </View>
              </View>
              <View style={st.detailPrice}>
                <Text style={st.detailPriceVal}>${((selectedTrainer.ratePerMinuteCents * 30) / 100).toFixed(0)}</Text>
                <Text style={st.detailPriceUnit}>/30 min</Text>
              </View>
            </View>
            <TouchableOpacity
              style={st.bookBtn}
              onPress={() => router.push(`/trainee/trainer-detail?trainerId=${selectedTrainer.trainerId}`)}
              data-testid="book-trainer-btn"
            >
              <Text style={st.bookBtnText}>View Profile & Book</Text>
              <Ionicons name="arrow-forward" size={16} color={NEON.bg} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* Available Now horizontal scroll */}
      {availableTrainers.length > 0 && (
        <View style={st.availSection}>
          <Text style={st.availTitle}>Available Now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.availScroll}>
            {availableTrainers.map((trainer, idx) => {
              const color = getMarkerColor(trainer.averageRating, idx);
              return (
                <TouchableOpacity
                  key={trainer.id}
                  style={st.availCard}
                  onPress={() => {
                    handleTrainerPress(trainer);
                    router.push(`/trainee/trainer-detail?trainerId=${trainer.trainerId}`);
                  }}
                  data-testid={`avail-card-${idx}`}
                >
                  <View style={[st.availCircle, { borderColor: color, shadowColor: color }]}>
                    <Text style={[st.availInitial, { color }]}>{getInitials(trainer.fullName)}</Text>
                  </View>
                  <Text style={st.availName} numberOfLines={1}>{trainer.fullName.split(' ')[0]}</Text>
                  <View style={st.availRatingRow}>
                    <Ionicons name="star" size={11} color={NEON.star} />
                    <Text style={st.availRating}>{trainer.averageRating?.toFixed(1)}</Text>
                  </View>
                  <Text style={st.availDist}>{trainer.distanceMiles?.toFixed(1)} mi</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { backgroundColor: NEON.bg, marginHorizontal: -20, marginBottom: 16 },
  loadingBox: { height: MAP_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: NEON.grayLight },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '800', color: NEON.white, letterSpacing: -0.3 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,255,106,0.1)', justifyContent: 'center', alignItems: 'center' },

  // Count badge
  countRow: { paddingHorizontal: 16, paddingBottom: 10 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,255,106,0.12)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  countText: { fontSize: 13, fontWeight: '700', color: NEON.green },

  // Map
  mapWrapper: { height: MAP_HEIGHT, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },

  // User marker
  userMarker: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  userPulse: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,255,106,0.2)' },
  userDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: NEON.green, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: NEON.bg },

  // Neon trainer markers
  neonMarkerWrap: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  neonGlowOuter: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
  neonCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  neonInitial: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  // Recenter
  recenterBtn: { position: 'absolute', right: 12, top: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(17,24,32,0.9)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: NEON.cardBorder },

  // Selected detail card
  detailCard: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: NEON.card, borderRadius: 18, padding: 14, paddingTop: 6, borderWidth: 1, borderColor: NEON.cardBorder, zIndex: 999 },
  detailDrag: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, backgroundColor: NEON.bg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailInitial: { fontSize: 18, fontWeight: '900' },
  detailInfo: { flex: 1 },
  detailName: { fontSize: 15, fontWeight: '700', color: NEON.white },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  detailRating: { fontSize: 13, fontWeight: '600', color: NEON.star },
  detailDist: { fontSize: 12, color: NEON.gray, marginLeft: 6 },
  detailPrice: { alignItems: 'flex-end' },
  detailPriceVal: { fontSize: 20, fontWeight: '800', color: NEON.white },
  detailPriceUnit: { fontSize: 11, color: NEON.gray },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: NEON.green, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  bookBtnText: { fontSize: 14, fontWeight: '700', color: NEON.bg },

  // Available Now section
  availSection: { paddingTop: 14, paddingBottom: 6, backgroundColor: NEON.bg },
  availTitle: { fontSize: 17, fontWeight: '800', color: NEON.white, paddingHorizontal: 16, marginBottom: 12 },
  availScroll: { paddingHorizontal: 12, gap: 10 },
  availCard: { width: SCREEN_W * 0.28, backgroundColor: NEON.card, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: NEON.cardBorder },
  availCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, backgroundColor: NEON.bg, justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 6 },
  availInitial: { fontSize: 18, fontWeight: '900' },
  availName: { fontSize: 13, fontWeight: '600', color: NEON.white, marginBottom: 4 },
  availRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  availRating: { fontSize: 12, fontWeight: '700', color: NEON.star },
  availDist: { fontSize: 11, color: NEON.gray },
});

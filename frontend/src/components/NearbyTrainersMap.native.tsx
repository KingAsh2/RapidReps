import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, Platform, Animated, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { TrainerAvatar } from './TrainerAvatar';
import { resolveSessionPriceCents } from '../utils/sessionPricing';

const { width: W, height: H } = Dimensions.get('window');
const MAP_H = H * 0.54;

// === NEON PALETTE ===
const N = {
  green: '#39FF14',
  greenDim: 'rgba(57,255,20,0.15)',
  orange: '#FF5F1F',
  orangeDim: 'rgba(255,95,31,0.12)',
  purple: '#B026FF',
  purpleDim: 'rgba(176,38,255,0.12)',
  bg: '#0A0E14',
  surface: 'rgba(255,255,255,0.02)',
  glass: 'rgba(10,14,20,0.82)',
  border: 'rgba(255,255,255,0.15)',
  borderSubtle: 'rgba(255,255,255,0.05)',
  white: '#FFFFFF',
  textSec: 'rgba(255,255,255,0.5)',
  star: '#FFB800',
};

const getColor = (r: number) => r >= 4.5 ? N.green : r >= 3.5 ? N.orange : N.purple;
const getDim = (r: number) => r >= 4.5 ? N.greenDim : r >= 3.5 ? N.orangeDim : N.purpleDim;

// Stealth dark map — nearly invisible roads
const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#080C12' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#080C12' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#2A3545' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#111822' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0D1117' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#141E2B' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060A10' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0A0E14' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#111822' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#344155' }] },
];

interface NearbyTrainer {
  id: string; trainerId: string; fullName: string; avatarUrl?: string;
  latitude: number; longitude: number; distanceMiles: number;
  etaMinutes: number; averageRating: number; ratePerMinuteCents: number;
  /** Trainer's chosen brand color (hex) — used for the avatar ring. */
  accentColor?: string;
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
  const [selected, setSelected] = useState<NearbyTrainer | null>(null);

  // Animations
  const radarAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const scanPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Harsh radar burst — abrupt opacity, not smooth
    Animated.loop(
      Animated.sequence([
        Animated.timing(radarAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(radarAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulse, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
        Animated.timing(scanPulse, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.spring(cardAnim, { toValue: selected ? 1 : 0, friction: 9, tension: 65, useNativeDriver: true }).start();
  }, [selected]);

  const tap = (t: NearbyTrainer) => {
    setSelected(t);
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        latitude: (userLocation.latitude + t.latitude) / 2,
        longitude: (userLocation.longitude + t.longitude) / 2,
        latitudeDelta: 0.035, longitudeDelta: 0.035,
      }, 350);
    }
  };

  const recenter = () => {
    if (mapRef.current && userLocation) mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
  };

  const initials = (name: string) => {
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const sorted = [...trainers].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));

  if (!userLocation) {
    return (
      <View style={s.root}>
        <View style={s.loadWrap}>
          <ActivityIndicator size="large" color={N.green} />
          <Text style={s.loadLabel}>ACQUIRING SIGNAL</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root} data-testid="nearby-trainers-map-container">

      {/* === HEADER — asymmetric, left-heavy === */}
      <View style={s.head}>
        <View style={s.headLeft}>
          <View style={s.headIcon}>
            <Ionicons name="radio-outline" size={16} color={N.orange} />
          </View>
          <View>
            <Text style={s.headLabel}>SCANNING AREA</Text>
            <Text style={s.headTitle}>Nearby Trainers</Text>
          </View>
        </View>
        {/* SCAN button — brutalist block */}
        <TouchableOpacity style={s.scanBtn} onPress={onRefresh} activeOpacity={0.7} data-testid="map-refresh-button">
          {refreshing ? <ActivityIndicator size="small" color={N.orange} /> : (
            <Text style={s.scanText}>SCAN</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* === MASSIVE BACKGROUND COUNT — bleeds off screen === */}
      <View style={s.bgCountWrap} pointerEvents="none">
        <Text style={s.bgCount}>{trainers.length}</Text>
      </View>

      {/* === LIVE COUNT CHIP — not centered, pushed left with offset === */}
      <View style={s.countRow}>
        <View style={s.countChip}>
          <View style={s.countDot} />
          <Text style={s.countLabel}>{trainers.length} ACTIVE NEARBY</Text>
        </View>
      </View>

      {/* === MAP === */}
      <View style={s.mapWrap}>
        <MapView
          ref={mapRef}
          style={s.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={mapStyle}
          initialRegion={{ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          showsUserLocation={false} showsMyLocationButton={false}
          onPress={() => setSelected(null)}
        >
          {/* User — harsh white square with radar burst */}
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.userWrap} data-testid="user-location-indicator">
              <Animated.View style={[s.userRadar, {
                opacity: radarAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 0] }),
                transform: [{ scale: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.2] }) }],
              }]} />
              <View style={s.userNode} />
            </View>
          </Marker>

          {/* iter106n: unified circular avatar with brand-color ring + subtle pulse */}
          {trainers.map((t, i) => {
            const ringColor = t.accentColor || N.orange;
            const isSel = selected?.id === t.id;
            return (
              <Marker key={t.id} coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                onPress={() => tap(t)} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[s.markerWrap, isSel && { transform: [{ scale: 1.25 }] }]} data-testid="trainer-marker-node">
                  <TrainerAvatar
                    uri={t.avatarUrl}
                    initials={initials(t.fullName)}
                    ringColor={ringColor}
                    size={44}
                    pulse
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Recenter — sharp rectangle sticking from right edge */}
        <TouchableOpacity style={s.recenter} onPress={recenter} data-testid="map-recenter-button" accessibilityLabel="Recenter map on my location" accessibilityRole="button">
          <Ionicons name="scan-outline" size={18} color={N.white} />
        </TouchableOpacity>

        {/* === SELECTED TRAINER POPUP — top-anchored, asymmetric === */}
        {selected && (
          <Animated.View style={[s.popup, {
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
          }]} data-testid="trainer-detail-popup-card">
            {/* Heavy bottom border in trainer's neon color */}
            <View style={[s.popupBar, { backgroundColor: getColor(selected.averageRating) }]} />
            <View style={s.popupBody}>
              <View style={s.popupLeft}>
                <TrainerAvatar
                  uri={selected.avatarUrl}
                  initials={initials(selected.fullName)}
                  ringColor={selected.accentColor || N.orange}
                  size={48}
                  pulse
                />
              </View>
              <View style={s.popupInfo}>
                <Text style={s.popupName} numberOfLines={1}>{selected.fullName}</Text>
                <View style={s.popupMeta}>
                  <Ionicons name="star" size={12} color={N.star} />
                  <Text style={s.popupRating}>{selected.averageRating?.toFixed(1)}</Text>
                  <View style={s.popupDivider} />
                  <Text style={s.popupDist}>{selected.distanceMiles?.toFixed(1)} MI</Text>
                  <View style={s.popupDivider} />
                  <Text style={s.popupEta}>{selected.etaMinutes}M ETA</Text>
                </View>
              </View>
              <View style={s.popupPrice}>
                {(() => {
                  // iter102ah: canonical 30-min outdoor rate via resolver.
                  const cents = resolveSessionPriceCents(selected as any, 'outdoor', 30);
                  if (!cents || cents <= 0) {
                    return <Text style={s.popupPriceVal}>—</Text>;
                  }
                  return <Text style={s.popupPriceVal}>${(cents / 100).toFixed(0)}</Text>;
                })()}
                <Text style={s.popupPriceUnit}>/30m</Text>
              </View>
            </View>
            <TouchableOpacity style={s.popupAction}
              onPress={() => router.push(`/trainee/trainer-detail?trainerId=${selected.trainerId}`)}
              data-testid="book-trainer-btn">
              <Text style={s.popupActionText}>VIEW PROFILE</Text>
              <Ionicons name="chevron-forward" size={14} color={N.bg} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* === AVAILABLE NOW — staggered cards, sharp edges === */}
      {sorted.length > 0 && (
        <View style={s.availWrap} data-testid="available-trainers-scroll-row">
          <View style={s.availHead}>
            <View style={s.availDot} />
            <Text style={s.availLabel}>AVAILABLE NOW</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.availScroll}>
            {sorted.map((t, i) => {
              const c = getColor(t.averageRating);
              const isOdd = i % 2 !== 0;
              return (
                <TouchableOpacity key={t.id}
                  style={[s.availCard, {
                    marginTop: isOdd ? 0 : 14, // stagger effect
                    borderLeftColor: c,
                    borderTopColor: N.border,
                  }]}
                  onPress={() => { tap(t); router.push(`/trainee/trainer-detail?trainerId=${t.trainerId}`); }}
                  data-testid={`avail-card-${i}`}
                >
                  <TrainerAvatar
                    uri={t.avatarUrl}
                    initials={initials(t.fullName)}
                    ringColor={t.accentColor || N.orange}
                    size={48}
                    pulse
                  />
                  <Text style={s.availName} numberOfLines={1}>{t.fullName.split(' ')[0]}</Text>
                  <View style={s.availRatingRow}>
                    <Ionicons name="star" size={10} color={N.star} />
                    <Text style={s.availRating}>{t.averageRating?.toFixed(1)}</Text>
                  </View>
                  <Text style={s.availDist}>{t.distanceMiles?.toFixed(1)} MI</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: N.bg, marginHorizontal: -20, marginBottom: 16 },

  // Loading
  loadWrap: { height: MAP_H, justifyContent: 'center', alignItems: 'center' },
  loadLabel: { marginTop: 14, fontSize: 11, fontWeight: '700', color: N.green, letterSpacing: 4 },

  // Head — asymmetric: more left padding, less right
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 22, paddingRight: 14, paddingTop: 16, paddingBottom: 2 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headIcon: { width: 28, height: 28, borderWidth: 1.5, borderColor: N.orange, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '45deg' }] },
  headLabel: { fontSize: 9, fontWeight: '700', color: N.orange, letterSpacing: 3, marginBottom: 1 },
  headTitle: { fontSize: 19, fontWeight: '800', color: N.white, letterSpacing: -0.5 },
  // Scan button — brutalist block, not a circle
  scanBtn: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 0, borderBottomWidth: 2, borderRightWidth: 2, borderColor: N.orange, backgroundColor: 'transparent' },
  scanText: { fontSize: 11, fontWeight: '800', color: N.orange, letterSpacing: 3 },

  // Massive background count
  bgCountWrap: { position: 'absolute', top: -8, right: -12, zIndex: 0, overflow: 'hidden', width: 160, height: 120 },
  bgCount: { fontSize: 130, fontWeight: '900', color: N.white, opacity: 0.04, letterSpacing: -8, lineHeight: 130 },

  // Count chip — pushed left, not centered
  countRow: { paddingLeft: 22, paddingRight: 14, paddingBottom: 8, paddingTop: 2 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  countDot: { width: 6, height: 6, backgroundColor: N.green, transform: [{ rotate: '45deg' }] },
  countLabel: { fontSize: 10, fontWeight: '700', color: N.textSec, letterSpacing: 2.5 },

  // Map
  mapWrap: { height: MAP_H, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },

  // User marker — white square, not circle
  userWrap: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  userRadar: { position: 'absolute', width: 44, height: 44, borderWidth: 1.5, borderColor: N.white },
  userNode: { width: 8, height: 8, backgroundColor: N.white, transform: [{ rotate: '45deg' }] },

  // Trainer markers — iter106l: circular profile-photo (was diamond geometry)
  markerWrap: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  markerPhotoRing: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    backgroundColor: N.bg, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14, elevation: 8,
  },
  markerPhotoImg: { width: '100%', height: '100%' },
  markerPhotoFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  markerPhotoInit: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },

  // Recenter — sharp tab from right edge
  recenter: { position: 'absolute', right: 0, top: '42%', width: 38, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: N.border, backgroundColor: N.glass, alignItems: 'center' },

  // Selected popup — anchored top, not bottom
  popup: { position: 'absolute', top: 12, left: 14, right: 14, backgroundColor: N.glass, zIndex: 999, overflow: 'hidden' },
  popupBar: { height: 3, width: '100%' },
  popupBody: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 10, paddingLeft: 16, paddingRight: 12 },
  popupLeft: { marginRight: 14 },
  popupAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, backgroundColor: N.bg, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  popupAvatarInit: { fontSize: 16, fontWeight: '900' },
  popupAvatarPhoto: { width: '100%', height: '100%' },
  popupInfo: { flex: 1 },
  popupName: { fontSize: 15, fontWeight: '800', color: N.white, letterSpacing: -0.3 },
  popupMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  popupRating: { fontSize: 12, fontWeight: '700', color: N.star },
  popupDivider: { width: 3, height: 3, backgroundColor: N.textSec, transform: [{ rotate: '45deg' }] },
  popupDist: { fontSize: 10, fontWeight: '700', color: N.textSec, letterSpacing: 1.5 },
  popupEta: { fontSize: 10, fontWeight: '700', color: N.textSec, letterSpacing: 1.5 },
  popupPrice: { alignItems: 'flex-end', paddingLeft: 10 },
  popupPriceVal: { fontSize: 22, fontWeight: '900', color: N.white, letterSpacing: -1 },
  popupPriceUnit: { fontSize: 10, fontWeight: '600', color: N.textSec, letterSpacing: 1 },
  popupAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: N.green, paddingVertical: 11, marginHorizontal: 16, marginBottom: 14 },
  popupActionText: { fontSize: 12, fontWeight: '800', color: N.bg, letterSpacing: 2.5 },

  // Available Now — sharp cards, staggered
  availWrap: { paddingTop: 18, paddingBottom: 8, backgroundColor: N.bg },
  availHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 22, marginBottom: 14 },
  availDot: { width: 5, height: 5, backgroundColor: N.green, transform: [{ rotate: '45deg' }] },
  availLabel: { fontSize: 11, fontWeight: '800', color: N.white, letterSpacing: 3 },
  availScroll: { paddingLeft: 22, paddingRight: 14, gap: 10 },
  // Sharp corners, left+top borders only for brutalist 3D
  availCard: {
    width: W * 0.30, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 10,
    backgroundColor: N.surface, alignItems: 'center',
    borderLeftWidth: 2, borderTopWidth: 1, borderRightWidth: 0, borderBottomWidth: 0,
    borderColor: N.borderSubtle,
  },
  availDiamond: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, backgroundColor: N.bg, justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6, overflow: 'hidden' },
  availDiamondPhoto: { width: '100%', height: '100%' },
  availDiamondFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  availInit: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5, color: '#FFFFFF' },
  availName: { fontSize: 13, fontWeight: '700', color: N.white, marginBottom: 4, letterSpacing: 0.3 },
  availRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 3 },
  availRating: { fontSize: 11, fontWeight: '700', color: N.star },
  availDist: { fontSize: 10, fontWeight: '600', color: N.textSec, letterSpacing: 1.5 },
});

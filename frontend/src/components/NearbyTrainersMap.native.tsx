import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, Animated, Modal, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MAP_DARK_STYLE } from '../theme/mapDark';
import { TrainerAvatar } from './TrainerAvatar';
import { resolveSessionPriceCents } from '../utils/sessionPricing';

const { width: W, height: H } = Dimensions.get('window');
// iter117: Home screen removed the "Top Trainers Near You" horizontal row
// that lived below the map. That freed ~150px of vertical space we now
// reinvest into a taller map (0.54 → 0.66) so more pins are visible above
// the fold and the map dominates as the primary discovery surface.
const MAP_H = H * 0.66;

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

// Dark map theme — shared across all RapidReps maps for a unified look.
// See src/theme/mapDark.ts for the palette rationale.
const mapStyle = MAP_DARK_STYLE;

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
  /** iter118q: fires when a marker is tapped so the trainee home screen can
   *  slide up the TrainerBottomSheet with this trainer pre-selected
   *  (Uber-style: one tap on the pin → instant book surface). */
  onTrainerSelect?: (trainerUserId: string) => void;
  /** iter118x: when set, tapping an avatar opens the InstantBookSheet in
   *  the parent instead of routing to the trainer's profile. */
  onInstantBook?: (trainer: NearbyTrainer) => void;
}

export default function NearbyTrainersMap({ userLocation, trainers, onRefresh, refreshing, onTrainerSelect, onInstantBook }: Props) {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const fullscreenMapRef = useRef<MapView>(null);
  const [selected, setSelected] = useState<NearbyTrainer | null>(null);
  // iter118r: inline map is a NON-INTERACTIVE preview so page scroll gestures
  // aren't captured by the map surface. All interaction happens either via
  // (a) tapping a marker → parent's bottom sheet expands with that trainer
  // pre-selected, or (b) the fullscreen button (bottom-right) which opens a
  // fully-interactive modal map.
  const [fullscreen, setFullscreen] = useState(false);

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
    // iter118x: map-avatar tap now opens the Instant Book sheet
    // (Uber-style tap-to-book). If the parent hasn't wired
    // `onInstantBook`, fall back to profile navigation so the flow still
    // works everywhere the map is embedded.
    if (onInstantBook) {
      onInstantBook(t);
      return;
    }
    router.push(`/trainee/trainer-detail?trainerId=${t.trainerId}`);
    onTrainerSelect?.(t.trainerId);
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

      {/* === HEADER — hex-badge left, pill SCAN button right === */}
      <View style={s.head}>
        <View style={s.headLeft}>
          {/* iter117: hexagonal orange-outlined badge to match the reference */}
          <View style={s.hexBadge}>
            <View style={s.hexBadgeInner}>
              <Ionicons name="radio-outline" size={18} color={N.orange} />
            </View>
          </View>
          <View>
            <Text style={s.headLabel}>SCANNING AREA</Text>
            <Text style={s.headTitle}>NEARBY TRAINERS</Text>
          </View>
        </View>
        {/* SCAN pill — outlined orange with radar icon */}
        <TouchableOpacity style={s.scanBtn} onPress={onRefresh} activeOpacity={0.7} data-testid="map-refresh-button">
          {refreshing ? <ActivityIndicator size="small" color={N.orange} /> : (
            <>
              <Text style={s.scanText}>SCAN</Text>
              <Ionicons name="wifi-outline" size={14} color={N.orange} style={{ transform: [{ rotate: '45deg' }] }} />
            </>
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
          // iter117: force Google Maps on BOTH platforms so the custom dark
          // theme (`customMapStyle`) actually renders on iOS. Apple Maps
          // ignores `customMapStyle`; the iOS Google Maps SDK is already
          // wired via app.config.js -> ios.config.googleMapsApiKey.
          provider={PROVIDER_GOOGLE}
          customMapStyle={mapStyle}
          initialRegion={{ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          showsUserLocation={false} showsMyLocationButton={false}
          // iter118r: inline preview is non-interactive on BOTH iOS and
          // Android — prevents map from swallowing the vertical page-scroll
          // gesture. Full interactivity is available in the fullscreen modal.
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
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

          {/* iter106n: unified circular avatar with brand-color ring + subtle pulse.
              iter118x: added a synchronized radar sonar ring behind each
              marker so the map feels alive on first open — the same
              radarAnim already used for the user-location burst. */}
          {trainers.map((t, i) => {
            const ringColor = t.accentColor || N.orange;
            const isSel = selected?.id === t.id;
            return (
              <Marker key={t.id} coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                onPress={() => tap(t)} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[s.markerWrap, isSel && { transform: [{ scale: 1.25 }] }]} data-testid="trainer-marker-node">
                  {/* Sonar ring — expands + fades in sync with the user's
                      radar burst. Bright brand color + generous alpha so
                      it's obvious even on the dark map style. */}
                  <Animated.View
                    pointerEvents="none"
                    style={[s.trainerSonar, {
                      borderColor: ringColor,
                      opacity: radarAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.5, 0] }),
                      transform: [{ scale: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.4] }) }],
                    }]}
                  />
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

        {/* iter118r: right-edge action button — inline map is now a static
            preview so recentering is meaningless. Repurposed as the
            fullscreen/expand entry-point that pops open a fully-interactive
            modal map (pan, zoom, rotate, pitch all re-enabled). */}
        <TouchableOpacity
          style={s.recenter}
          onPress={() => setFullscreen(true)}
          data-testid="map-fullscreen-button"
          accessibilityLabel="Open full-screen map"
          accessibilityRole="button"
        >
          <Ionicons name="expand-outline" size={18} color={N.white} />
        </TouchableOpacity>

        {/* iter118q: in-map "VIEW PROFILE" popup removed. The TrainerBottomSheet
            now serves as the single action surface (Uber-style) — one tap on
            a marker slides the sheet up with that trainer pre-selected and
            "Book Now" ready, so a competing popup would be pure friction. */}
      </View>

      {/* iter117: "AVAILABLE NOW" horizontal card strip removed per user
          request. Trainer discovery on the home screen is now solely through
          (1) map pins and (2) the swipe-up TrainerBottomSheet — the strip
          duplicated those entry points. */}

      {/* iter118r: Fullscreen interactive map modal. The inline map is a
          static preview (gestures disabled so it doesn't hijack page scroll);
          this modal is where trainees can pan / zoom / rotate / pitch the
          map freely. Marker taps here still fire the same onTrainerSelect
          callback so opening the bottom sheet from fullscreen works too. */}
      <Modal
        visible={fullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={s.fsRoot} data-testid="fullscreen-map-modal">
          {userLocation ? (
            <MapView
              ref={fullscreenMapRef}
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_GOOGLE}
              customMapStyle={mapStyle}
              initialRegion={{ ...userLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
              showsUserLocation
              showsMyLocationButton={false}
              scrollEnabled
              zoomEnabled
              rotateEnabled
              pitchEnabled
            >
              <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={s.userWrap}>
                  <View style={s.userNode} />
                </View>
              </Marker>
              {trainers.map((t) => {
                const ringColor = t.accentColor || N.orange;
                return (
                  <Marker
                    key={`fs-${t.id}`}
                    coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    onPress={() => {
                      setFullscreen(false);
                      // iter118x: same flow as the inline map — open the
                      // Instant Book sheet if the parent wired it,
                      // otherwise fall back to profile navigation.
                      if (onInstantBook) {
                        onInstantBook(t);
                        return;
                      }
                      router.push(`/trainee/trainer-detail?trainerId=${t.trainerId}`);
                    }}
                  >
                    <View style={s.markerWrap}>
                      <TrainerAvatar
                        uri={t.avatarUrl}
                        initials={initials(t.fullName)}
                        ringColor={ringColor}
                        size={48}
                        pulse
                      />
                    </View>
                  </Marker>
                );
              })}
            </MapView>
          ) : null}

          {/* Close pill — top-right */}
          <TouchableOpacity
            onPress={() => setFullscreen(false)}
            style={[s.fsClose, { top: Platform.OS === 'ios' ? 56 : 20 }]}
            data-testid="fullscreen-map-close"
            accessibilityLabel="Close full-screen map"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color={N.white} />
          </TouchableOpacity>

          {/* Recenter — bottom-right */}
          <TouchableOpacity
            onPress={() => {
              if (fullscreenMapRef.current && userLocation) {
                fullscreenMapRef.current.animateToRegion(
                  { ...userLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 },
                  500,
                );
              }
            }}
            style={s.fsRecenter}
            data-testid="fullscreen-map-recenter"
            accessibilityLabel="Recenter map on my location"
            accessibilityRole="button"
          >
            <Ionicons name="locate" size={20} color={N.white} />
          </TouchableOpacity>

          {/* Hint chip — top-left */}
          <View style={[s.fsHint, { top: Platform.OS === 'ios' ? 56 : 20 }]} pointerEvents="none">
            <Text style={s.fsHintText}>TAP A PIN TO BOOK</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: N.bg, marginBottom: 16 },

  // Loading
  loadWrap: { height: MAP_H, justifyContent: 'center', alignItems: 'center' },
  loadLabel: { marginTop: 14, fontSize: 11, fontWeight: '700', color: N.green, letterSpacing: 4 },

  // Head — asymmetric: more left padding, less right
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 20, paddingRight: 14, paddingTop: 16, paddingBottom: 2 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headIcon: { width: 28, height: 28, borderWidth: 1.5, borderColor: N.orange, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '45deg' }] },
  // iter117: hexagonal orange-outlined badge (approximated with a rotated
  // square + rounded corners) — matches the reference screenshot.
  hexBadge: {
    width: 44, height: 44, borderWidth: 1.5, borderColor: N.orange,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    transform: [{ rotate: '30deg' }],
    shadowColor: N.orange, shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  hexBadgeInner: { transform: [{ rotate: '-30deg' }] },
  headLabel: { fontSize: 10, fontWeight: '800', color: N.orange, letterSpacing: 2.5, marginBottom: 2 },
  headTitle: { fontSize: 20, fontWeight: '900', color: N.white, letterSpacing: 0.2 },
  // iter117: outlined pill SCAN button with radar icon
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: N.orange,
    borderRadius: 20,
    backgroundColor: 'rgba(255,106,0,0.08)',
    shadowColor: N.orange, shadowOpacity: 0.4, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  scanText: { fontSize: 12, fontWeight: '900', color: N.orange, letterSpacing: 1.5 },

  // Massive background count
  bgCountWrap: { position: 'absolute', top: -8, right: -12, zIndex: 0, overflow: 'hidden', width: 160, height: 120 },
  bgCount: { fontSize: 130, fontWeight: '900', color: N.white, opacity: 0.04, letterSpacing: -8, lineHeight: 130 },

  // Count chip — pushed left, not centered
  countRow: { paddingLeft: 22, paddingRight: 14, paddingBottom: 8, paddingTop: 2 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  countDot: { width: 6, height: 6, backgroundColor: N.green, transform: [{ rotate: '45deg' }] },
  countLabel: { fontSize: 10, fontWeight: '700', color: N.textSec, letterSpacing: 2.5 },

  // Map
  // iter118u: framed map surface — rounded corners + border so it reads as
  // a contained card, not an edge-to-edge bleed. `overflow: hidden` clips
  // the MapView to the border-radius on both iOS and Android.
  mapWrap: {
    height: MAP_H, position: 'relative',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: N.bg,
    // subtle depth so the frame reads as a lifted card
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  map: { ...StyleSheet.absoluteFillObject },

  // User marker — white square, not circle
  userWrap: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  userRadar: { position: 'absolute', width: 44, height: 44, borderWidth: 1.5, borderColor: N.white },
  userNode: { width: 8, height: 8, backgroundColor: N.white, transform: [{ rotate: '45deg' }] },

  // Trainer markers — iter106l: circular profile-photo (was diamond geometry)
  markerWrap: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  // iter118x: synchronized sonar ring per trainer marker — same rhythm as
  // the user's radar burst so the whole map beats together.
  trainerSonar: {
    position: 'absolute',
    width: 56, height: 56,
    borderRadius: 28,
    borderWidth: 2,
  },
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

  // iter118r: fullscreen map modal
  fsRoot: { flex: 1, backgroundColor: N.bg },
  fsClose: {
    position: 'absolute', right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: N.glass,
    borderWidth: 1, borderColor: N.border,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  fsRecenter: {
    position: 'absolute', right: 16, bottom: 40,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: N.glass,
    borderWidth: 1.5, borderColor: N.orange,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: N.orange, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  fsHint: {
    position: 'absolute', left: 16,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: N.glass,
    borderWidth: 1, borderColor: N.border,
  },
  fsHintText: { fontSize: 11, fontWeight: '800', color: N.white, letterSpacing: 2 },
});

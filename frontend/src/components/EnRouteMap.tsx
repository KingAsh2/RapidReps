/**
 * EnRouteMap — iter106g.
 *
 * Live tracking map for an active session. Replaces the old "Next Steps" link
 * list on session-detail screens with an Uber-style en-route view:
 *   • Diamond avatar markers for both trainee + trainer (matches the
 *     "Nearby Trainers" map aesthetic the user requested).
 *   • A flag marker for the meeting destination.
 *   • Live polling: pushes the current user's GPS every 10 s and fetches the
 *     other party's last position every 8 s.
 *   • Compact ETA / distance / status pill below the map.
 *   • One-tap "Open in Apple/Google Maps" handoff for turn-by-turn driving
 *     directions (no in-app re-implementation of routing).
 *
 * The component is role-aware (`trainer | trainee`) so it can be dropped onto
 * either party's session-detail screen with the same JSX.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, ActivityIndicator, Animated } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionTrackingAPI } from '../services/api';
import { startSessionBackgroundLocation, stopSessionBackgroundLocation } from '../utils/sessionBackgroundLocation';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { enqueueOffline } from '../utils/offlineQueue';
import { TrainerAvatar } from './TrainerAvatar';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Dark neon palette — mirrors NearbyTrainersMap so the two screens feel cohesive
const MAP_STYLE = [
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
];

type LatLng = { latitude: number; longitude: number };

/**
 * iter106p: Decode a Google-encoded polyline string into a list of {lat, lng}
 * points. Vendored algorithm (~25 lines) so we don't pull in another dep.
 * Spec: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
const decodePolyline = (encoded: string): LatLng[] => {
  if (!encoded) return [];
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};

type Props = {
  session: any;
  role: 'trainer' | 'trainee';
  /** Avatar URL for the OTHER party (so the marker shows their face) */
  otherAvatarUrl?: string;
  otherDisplayName?: string;
  /** Destination = meeting location coords; computed from session if absent */
  destination?: LatLng | null;
};

const EnRouteMap: React.FC<Props> = ({ session, role, otherAvatarUrl, otherDisplayName, destination }) => {
  const sessionId = session?.id;
  const { user } = useAuth();
  // iter106k: "ME" marker now shows the current user's profile photo
  // pulled from auth context (with a graceful initial fallback).
  const myAvatarUrl: string | undefined = user?.avatarUrl || user?.profilePhoto || undefined;
  const myInitial = (user?.displayName || user?.fullName || (role === 'trainer' ? 'T' : 'C')).charAt(0).toUpperCase();
  const mapRef = useRef<MapView>(null);
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const [otherLocation, setOtherLocation] = useState<LatLng | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [tracking, setTracking] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
  // iter106p: live ETA + road-following route polyline from Google Directions
  // (sent down inside each gps-update broadcast frame). When absent we fall
  // back to the straight-line polyline rendered below.
  const [otherRoutePoints, setOtherRoutePoints] = useState<LatLng[] | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const etaLastReceivedAt = useRef<number>(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 1. Ask for foreground GPS perms + capture initial fix + START BACKGROUND
  //    LOCATION updates (iter106h #1: keep tracking when app is backgrounded)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setInitializing(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyLocation(here);
        try { await sessionTrackingAPI.startEnRoute(sessionId); } catch { /* already en-route */ }
        try { await sessionTrackingAPI.gpsUpdate(sessionId, here.latitude, here.longitude, pos.coords.accuracy || 0); } catch { /* ignore */ }

        // iter106h #1: ask for ALWAYS-ON permission and start a background
        // task. If denied, the foreground polling keeps working (graceful
        // degradation — no error blocks the user).
        try {
          const token = await AsyncStorage.getItem('auth_token');
          if (token && API_URL) {
            await startSessionBackgroundLocation(sessionId, token, API_URL);
          }
        } catch { /* ignore */ }
      } catch { /* perms denied, etc. */ }
      if (!cancelled) {
        setInitializing(false);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    })();
    return () => {
      cancelled = true;
      // iter106h #1: stop background updates when the map unmounts so we
      // don't keep draining battery after the session is over.
      stopSessionBackgroundLocation().catch(() => {});
    };
  }, [sessionId]);

  // 1b. iter106h #2: WebSocket live position stream. Falls back to the
  // polling effect below if the socket can't connect.
  // iter106aw G23: exponential-backoff reconnect (1→2→4→8→16→30s cap) so
  // transient drops don't leave the map stuck on the polling fallback.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: any = null;
    let backoffMs = 1000; // starts at 1s, doubles on each failed connect, cap 30s

    const connect = async () => {
      if (cancelled) return;
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token || !API_URL) return;
        const wsBase = API_URL.replace(/^http/, 'ws');
        ws = new WebSocket(`${wsBase}/api/ws/sessions/${sessionId}/track?token=${encodeURIComponent(token)}`);
        ws.onopen = () => { backoffMs = 1000; /* reset on successful open */ };
        ws.onmessage = (evt) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type !== 'position') return;
            const otherKey = role === 'trainer' ? 'trainee' : 'trainer';
            if (msg.role === otherKey && typeof msg.latitude === 'number' && typeof msg.longitude === 'number') {
              setOtherLocation({ latitude: msg.latitude, longitude: msg.longitude });
              setTracking(true);
              if (typeof msg.routePolyline === 'string') {
                setOtherRoutePoints(msg.routePolyline ? decodePolyline(msg.routePolyline) : null);
              }
              if (typeof msg.etaSeconds === 'number') {
                setEtaSeconds(msg.etaSeconds);
                etaLastReceivedAt.current = Date.now();
              }
            }
          } catch { /* malformed frame — ignore */ }
        };
        const scheduleReconnect = () => {
          if (cancelled) return;
          reconnectTimer = setTimeout(connect, backoffMs);
          backoffMs = Math.min(backoffMs * 2, 30_000);
        };
        ws.onclose = scheduleReconnect;
        ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
      } catch {
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, backoffMs);
          backoffMs = Math.min(backoffMs * 2, 30_000);
        }
      }
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [sessionId, role]);

  const { online } = useNetwork();

  // 2. Continuous GPS push (10 s)
  //   iter106aw G25: when offline, enqueue the ping to AsyncStorage with a
  //   client_timestamp so the server can replay-protect it on reconnect.
  useEffect(() => {
    if (!myLocation) return;
    const t = setInterval(async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyLocation(here);
        const acc = pos.coords.accuracy || 0;
        const ts = new Date().toISOString();
        if (online) {
          await sessionTrackingAPI.gpsUpdate(sessionId, here.latitude, here.longitude, acc);
        } else {
          await enqueueOffline({
            url: `/api/sessions/${sessionId}/gps-update`,
            method: 'POST',
            params: {
              latitude: here.latitude,
              longitude: here.longitude,
              accuracy: acc,
              client_timestamp: ts,
            },
            requiresAuth: true,
          });
        }
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(t);
  }, [myLocation, sessionId, online]);

  // 3. Poll the other party's last known position (8 s)
  useEffect(() => {
    const fetchTrack = async () => {
      try {
        const res = await sessionTrackingAPI.getGpsTrack(sessionId);
        if (!res || !res.tracking) { setTracking(false); return; }
        setTracking(true);
        const otherKey = role === 'trainer' ? 'trainee' : 'trainer';
        const other = res[otherKey];
        if (other && typeof other.latitude === 'number') {
          setOtherLocation({ latitude: other.latitude, longitude: other.longitude });
        }
        if (typeof res.distanceMiles === 'number') setDistanceMiles(res.distanceMiles);
      } catch { /* ignore */ }
    };
    fetchTrack();
    const t = setInterval(fetchTrack, 8_000);
    return () => clearInterval(t);
  }, [sessionId, role]);

  // 4. Auto-fit camera to include all 3 points whenever any updates
  useEffect(() => {
    if (!mapRef.current) return;
    const coords: LatLng[] = [];
    if (myLocation) coords.push(myLocation);
    if (otherLocation) coords.push(otherLocation);
    if (destination) coords.push(destination);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      mapRef.current.animateToRegion({ ...coords[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
      return;
    }
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
      animated: true,
    });
  }, [myLocation, otherLocation, destination]);

  // iter106p: tick down the local etaSeconds counter every second so the
  // header chip displays a live countdown between server updates.
  const etaActive = etaSeconds !== null;
  useEffect(() => {
    if (!etaActive) return;
    const id = setInterval(() => {
      setEtaSeconds((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [etaActive]);

  const fmtEta = (secs: number | null) => {
    if (secs === null) return null;
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m} MIN`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const openTurnByTurn = () => {
    const dst = destination || otherLocation;
    if (!dst) return;
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${dst.latitude},${dst.longitude}&dirflg=d`
      : `google.navigation:q=${dst.latitude},${dst.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  if (initializing) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color="#FF6A00" />
        <Text style={s.loadingText}>Locating you…</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[s.wrap, { opacity: fadeAnim }]}>
      {/* iter106m: brutalist header — mirrors NearbyTrainersMap's
          "SCANNING AREA / Nearby Trainers" + radar icon + SCAN block. */}
      <View style={s.head}>
        <View style={s.headLeft}>
          <View style={s.headIcon}>
            <Ionicons name="navigate-outline" size={16} color={N.orange} />
          </View>
          <View>
            <Text style={s.headLabel}>EN ROUTE</Text>
            <Text style={s.headTitle}>Live Tracking</Text>
          </View>
        </View>
        {destination ? (
          <TouchableOpacity style={s.brutalBtn} onPress={openTurnByTurn} activeOpacity={0.7} data-testid="en-route-open-maps">
            <Text style={s.brutalBtnText}>DIRECTIONS</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status chip — sharp diamond dot + caps label. iter106p adds a
          live ETA pill next to the distance when Google Directions gives
          us a duration_in_traffic estimate. */}
      <View style={s.countRow}>
        <View style={s.countChip}>
          <View style={s.countDot} />
          <Text style={s.countLabel}>
            {tracking
              ? (distanceMiles !== null
                  ? `${distanceMiles.toFixed(1)} MI APART`
                  : `CONNECTING TO ${role === 'trainer' ? 'TRAINEE' : 'TRAINER'}`)
              : 'WAITING FOR MOVEMENT'}
          </Text>
        </View>
        {etaSeconds !== null && (
          <View style={[s.countChip, { marginLeft: 12 }]} data-testid="en-route-eta">
            <View style={[s.countDot, { backgroundColor: N.orange }]} />
            <Text style={[s.countLabel, { color: N.orange }]}>
              {`${fmtEta(etaSeconds)} ETA`}
            </Text>
          </View>
        )}
      </View>

      <View style={s.mapShell}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={s.map}
          customMapStyle={Platform.OS === 'android' ? MAP_STYLE : undefined}
          initialRegion={
            myLocation
              ? { ...myLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }
              : destination
              ? { ...destination, latitudeDelta: 0.04, longitudeDelta: 0.04 }
              : { latitude: 37.7749, longitude: -122.4194, latitudeDelta: 0.5, longitudeDelta: 0.5 }
          }
          showsCompass={false}
          showsMyLocationButton={false}
        >
          {destination && (
            <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }} data-testid="en-route-destination-pin">
              <View style={s.destinationPin}>
                <Ionicons name="flag" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          )}
          {myLocation && (
            <Marker coordinate={myLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <TrainerAvatar uri={myAvatarUrl} initials={myInitial} ringColor={N.orange} size={46} pulse />
            </Marker>
          )}
          {otherLocation && (
            <Marker coordinate={otherLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <TrainerAvatar
                uri={otherAvatarUrl}
                initials={(otherDisplayName?.charAt(0) || (role === 'trainer' ? 'C' : 'T')).toUpperCase()}
                ringColor={N.purple}
                size={46}
                pulse
              />
            </Marker>
          )}
          {myLocation && destination && (
            <Polyline coordinates={[myLocation, destination]} strokeColor="rgba(255,95,31,0.55)" strokeWidth={3} lineDashPattern={[6, 6]} />
          )}
          {/* iter106p: prefer the road-following polyline from Google
              Directions when present; fall back to the straight-line dotted
              segment if the backend didn't include one. */}
          {otherRoutePoints && otherRoutePoints.length > 1 ? (
            <Polyline coordinates={otherRoutePoints} strokeColor="rgba(176,38,255,0.85)" strokeWidth={4} />
          ) : (
            otherLocation && destination && (
              <Polyline coordinates={[otherLocation, destination]} strokeColor="rgba(176,38,255,0.55)" strokeWidth={3} lineDashPattern={[6, 6]} />
            )
          )}
        </MapView>
      </View>

      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: N.orange }]} />
          <Text style={s.legendText}>YOU</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: N.purple }]} />
          <Text style={s.legendText}>{role === 'trainer' ? 'CLIENT' : 'TRAINER'}</Text>
        </View>
        {destination && (
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: N.green }]} />
            <Text style={s.legendText}>MEETING SPOT</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// iter106m: shared brutalist palette — mirrors NearbyTrainersMap.native so
// the two maps feel like one cohesive design system.
const N = {
  green: '#39FF14',
  orange: '#FF5F1F',
  purple: '#B026FF',
  bg: '#0A0E14',
  white: '#FFFFFF',
  border: 'rgba(255,255,255,0.15)',
  textSec: 'rgba(255,255,255,0.5)',
};

const s = StyleSheet.create({
  // Brutalist shell — full-bleed, sharp corners, matches NearbyTrainersMap
  wrap: { marginHorizontal: -20, marginBottom: 16, backgroundColor: N.bg, overflow: 'hidden' },
  loading: {
    marginHorizontal: -20, marginBottom: 16, height: 280,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.bg, gap: 10,
  },
  loadingText: { color: N.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 4 },

  // Head — asymmetric, left-heavy (same as NearbyTrainersMap.head)
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 22, paddingRight: 14, paddingTop: 16, paddingBottom: 2 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headIcon: { width: 28, height: 28, borderWidth: 1.5, borderColor: N.orange, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '45deg' }] },
  headLabel: { fontSize: 9, fontWeight: '700', color: N.orange, letterSpacing: 3, marginBottom: 1 },
  headTitle: { fontSize: 19, fontWeight: '800', color: N.white, letterSpacing: -0.5 },
  // Brutalist block button — border on bottom + right only
  brutalBtn: { paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 2, borderRightWidth: 2, borderColor: N.orange, backgroundColor: 'transparent' },
  brutalBtnText: { fontSize: 11, fontWeight: '800', color: N.orange, letterSpacing: 3 },

  // Live count row — sharp diamond dot + caps (mirrors "1 ACTIVE NEARBY")
  countRow: { paddingLeft: 22, paddingRight: 14, paddingBottom: 10, paddingTop: 4 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  countDot: { width: 6, height: 6, backgroundColor: N.green, transform: [{ rotate: '45deg' }] },
  countLabel: { fontSize: 10, fontWeight: '700', color: N.textSec, letterSpacing: 2.5 },

  mapShell: { height: 280, backgroundColor: '#080C12' },
  map: { ...StyleSheet.absoluteFillObject },

  // iter106k: circular profile-photo markers
  photoOuter: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2.5,
    backgroundColor: N.bg,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.65, shadowRadius: 10, elevation: 6,
  },
  photoImage: { width: '100%', height: '100%', borderRadius: 28 },
  photoFallback: {
    width: '100%', height: '100%', borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  markerLabel: { color: N.white, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },

  destinationPin: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: N.green,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: N.white,
    shadowColor: N.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6,
  },

  // Legend — caps, sharp diamond dots
  legendRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 18,
    paddingHorizontal: 22, paddingVertical: 14,
    backgroundColor: N.bg,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 6, height: 6, transform: [{ rotate: '45deg' }] },
  legendText: { color: N.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 2 },
});

export default EnRouteMap;

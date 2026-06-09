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
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Linking, ActivityIndicator, Animated } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionTrackingAPI } from '../services/api';
import { startSessionBackgroundLocation, stopSessionBackgroundLocation } from '../utils/sessionBackgroundLocation';

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

type Props = {
  session: any;
  role: 'trainer' | 'trainee';
  /** Avatar URL for the OTHER party (so the marker shows their face) */
  otherAvatarUrl?: string;
  otherDisplayName?: string;
  /** Destination = meeting location coords; computed from session if absent */
  destination?: LatLng | null;
};

const DiamondMarker: React.FC<{ uri?: string; label: string; color: string }> = ({ uri, label, color }) => (
  <View style={[s.diamondOuter, { borderColor: color, shadowColor: color }] }>
    <View style={[s.diamondInner, { backgroundColor: color }]}>
      {uri ? (
        <Image source={{ uri }} style={s.markerAvatar} />
      ) : (
        <Text style={s.markerLabel}>{label}</Text>
      )}
    </View>
  </View>
);

export const EnRouteMap: React.FC<Props> = ({ session, role, otherAvatarUrl, otherDisplayName, destination }) => {
  const sessionId = session?.id;
  const mapRef = useRef<MapView>(null);
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const [otherLocation, setOtherLocation] = useState<LatLng | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [tracking, setTracking] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
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
  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token || !API_URL) return;
        // Swap http(s) → ws(s) for the WebSocket scheme.
        const wsBase = API_URL.replace(/^http/, 'ws');
        ws = new WebSocket(`${wsBase}/api/ws/sessions/${sessionId}/track?token=${encodeURIComponent(token)}`);
        ws.onmessage = (evt) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type !== 'position') return;
            const otherKey = role === 'trainer' ? 'trainee' : 'trainer';
            if (msg.role === otherKey && typeof msg.latitude === 'number' && typeof msg.longitude === 'number') {
              setOtherLocation({ latitude: msg.latitude, longitude: msg.longitude });
              setTracking(true);
            }
          } catch { /* malformed frame — ignore */ }
        };
        // We don't need to do anything else — onclose/onerror let the
        // polling effect take over naturally.
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [sessionId, role]);

  // 2. Continuous GPS push (10 s)
  useEffect(() => {
    if (!myLocation) return;
    const t = setInterval(async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyLocation(here);
        await sessionTrackingAPI.gpsUpdate(sessionId, here.latitude, here.longitude, pos.coords.accuracy || 0);
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(t);
  }, [myLocation, sessionId]);

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
      <View style={s.headerRow}>
        <View style={s.statusDot} />
        <Text style={s.headerLabel}>LIVE</Text>
        <Text style={s.headerEta}>
          {tracking
            ? (distanceMiles !== null
                ? `${distanceMiles.toFixed(1)} mi apart`
                : `Connecting to ${role === 'trainer' ? 'trainee' : 'trainer'}…`)
            : 'Tracking will start when you head out'}
        </Text>
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
              <DiamondMarker label="ME" color="#FF6A00" />
            </Marker>
          )}
          {otherLocation && (
            <Marker coordinate={otherLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <DiamondMarker
                uri={otherAvatarUrl}
                label={(otherDisplayName?.charAt(0) || (role === 'trainer' ? 'C' : 'T')).toUpperCase()}
                color="#B026FF"
              />
            </Marker>
          )}
          {/* Dotted lines from each party to destination — subtle visual cue
              of who's coming from where without implementing actual routing. */}
          {myLocation && destination && (
            <Polyline coordinates={[myLocation, destination]} strokeColor="rgba(255,106,0,0.55)" strokeWidth={3} lineDashPattern={[6, 6]} />
          )}
          {otherLocation && destination && (
            <Polyline coordinates={[otherLocation, destination]} strokeColor="rgba(176,38,255,0.55)" strokeWidth={3} lineDashPattern={[6, 6]} />
          )}
        </MapView>
      </View>

      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#FF6A00' }]} />
          <Text style={s.legendText}>You</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: '#B026FF' }]} />
          <Text style={s.legendText}>{role === 'trainer' ? 'Client' : 'Trainer'}</Text>
        </View>
        {destination && (
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#00D26A' }]} />
            <Text style={s.legendText}>Meeting spot</Text>
          </View>
        )}
      </View>

      {destination && (
        <TouchableOpacity onPress={openTurnByTurn} style={s.openMapsBtn} data-testid="en-route-open-maps">
          <Ionicons name="navigate" size={16} color="#FFFFFF" />
          <Text style={s.openMapsText}>Open turn-by-turn directions</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: { marginBottom: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0A0E14' },
  loading: {
    height: 280, borderRadius: 18, marginBottom: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0A0E14', gap: 10,
  },
  loadingText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00D26A' },
  headerLabel: { color: '#00D26A', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  headerEta: { flex: 1, color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '600', textAlign: 'right', letterSpacing: 0.3 },
  mapShell: { height: 280, backgroundColor: '#080C12' },
  map: { ...StyleSheet.absoluteFillObject },
  // diamond markers — match Nearby Trainers aesthetic
  diamondOuter: {
    width: 54, height: 54,
    transform: [{ rotate: '45deg' }],
    borderWidth: 2,
    backgroundColor: 'rgba(10,14,20,0.6)',
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6,
  },
  diamondInner: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
    overflow: 'hidden',
  },
  markerAvatar: { width: '100%', height: '100%' },
  markerLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  destinationPin: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#00D26A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#00D26A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6,
  },
  legendRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  openMapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'rgba(255,106,0,0.12)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,106,0,0.25)',
  },
  openMapsText: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
});

export default EnRouteMap;

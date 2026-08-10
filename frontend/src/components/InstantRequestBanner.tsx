/**
 * InstantRequestBanner — iter118y
 *
 * Floating "🔴 Instant request from Alex · 0.4 mi" toast that appears on
 * the trainer home the moment an `instant_book` push notification lands
 * while the app is in the foreground.
 *
 * Behavior:
 *   • Slides in from the top, plays a haptic + a subtle looping pulse.
 *   • Shows the trainee name, session type, duration, and distance
 *     (computed from the trainer's own location if available).
 *   • Big "Route to trainee →" CTA — one tap navigates to
 *     /trainer/en-route with the session id + trainee coords pre-filled.
 *   • Auto-dismisses after 60 s if the trainer ignores it (the session
 *     itself sticks around as a Pending item, so nothing is lost).
 *   • X button on the right dismisses immediately.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useNotifications } from '../contexts/NotificationContext';
import { haptic } from '../utils/haptics';

const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  red: '#FF4757',
  bg: '#141929',
  white: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.7)',
  border: 'rgba(255,255,255,0.08)',
};

type Props = {
  /** Trainer's current lat/lng — used to compute distance to the trainee's pin. */
  trainerLocation?: { latitude: number; longitude: number } | null;
};

function haversineMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export const InstantRequestBanner: React.FC<Props> = ({ trainerLocation }) => {
  const router = useRouter();
  const { latestInstantRequest, clearInstantRequest } = useNotifications();
  const translateY = useRef(new Animated.Value(-140)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [expired, setExpired] = useState(false);

  const req = latestInstantRequest;
  const active = !!req && !expired;

  useEffect(() => {
    if (!req) {
      setExpired(false);
      return;
    }
    // Slide in.
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 8,
      speed: 12,
    }).start();
    haptic.success();

    // Pulse loop for the red dot.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();

    // 60-second auto-dismiss.
    const timer = setTimeout(() => setExpired(true), 60000);
    return () => {
      loop.stop();
      clearTimeout(timer);
    };
  }, [req, translateY, pulse]);

  useEffect(() => {
    if (expired) {
      Animated.timing(translateY, { toValue: -140, duration: 220, useNativeDriver: true }).start(() => {
        clearInstantRequest();
      });
    }
  }, [expired, translateY, clearInstantRequest]);

  if (!active || !req) return null;

  const distanceMi =
    trainerLocation && typeof req.traineeLat === 'number' && typeof req.traineeLng === 'number'
      ? haversineMi(
          { lat: trainerLocation.latitude, lng: trainerLocation.longitude },
          { lat: req.traineeLat, lng: req.traineeLng },
        )
      : null;

  const modality = (req.sessionType || 'outdoor').replace('_', ' ');
  const duration = req.durationMin || 30;
  const traineeName = req.traineeName || 'A trainee';

  const dismiss = () => setExpired(true);

  const accept = () => {
    haptic.success();
    const params = new URLSearchParams({
      sessionId: req.sessionId,
      traineeName,
    });
    if (req.traineeLat !== undefined && req.traineeLat !== null) params.set('traineeLat', String(req.traineeLat));
    if (req.traineeLng !== undefined && req.traineeLng !== null) params.set('traineeLng', String(req.traineeLng));
    // Clear the banner first so the trainer doesn't see it flash on the
    // en-route screen.
    clearInstantRequest();
    router.push(`/trainer/en-route?${params.toString()}` as any);
  };

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateY }] }]}
      data-testid="instant-request-banner"
    >
      <LinearGradient
        colors={[COLORS.bg, '#0F1420']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        {/* Pulsing red dot */}
        <View style={styles.dotWrap}>
          <Animated.View
            style={[
              styles.dotHalo,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.8] }) }],
              },
            ]}
          />
          <View style={styles.dotCore} />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.eyebrow}>INSTANT REQUEST</Text>
          <Text style={styles.title} numberOfLines={1}>
            {traineeName}
            {distanceMi !== null ? ` · ${distanceMi.toFixed(1)} mi` : ''}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {modality} · {duration} min · tap to route
          </Text>
        </View>

        <TouchableOpacity onPress={accept} style={styles.cta} activeOpacity={0.85} data-testid="instant-request-accept-btn">
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity onPress={dismiss} style={styles.close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} data-testid="instant-request-dismiss-btn">
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    left: 12,
    right: 12,
    zIndex: 999,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  dotWrap: {
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  dotHalo: {
    position: 'absolute',
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.red,
  },
  dotCore: {
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.red,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.orange,
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.1,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  cta: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.orange,
    marginLeft: 8,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  close: {
    marginLeft: 6,
    padding: 4,
  },
});

export default InstantRequestBanner;

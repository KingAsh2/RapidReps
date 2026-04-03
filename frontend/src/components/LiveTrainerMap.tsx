import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TrainerLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

interface Props {
  trainerLocation?: TrainerLocation | null;
  traineeLocation?: { latitude: number; longitude: number } | null;
  trainerName?: string;
  eta?: string;
  distance?: string;
  status?: 'waiting' | 'en_route' | 'nearby' | 'arrived';
}

const COLORS = {
  orange: '#FF6A00',
  teal: '#1a2a5e',
  white: '#FFFFFF',
  navy: '#1a2a5e',
  gray: '#5a6785',
  success: '#00D26A',
};

/**
 * LiveTrainerMap - Visual map-like tracker showing trainer position relative to trainee.
 * Uses a simplified visual (no native MapView) to avoid Google Maps key issues in web preview.
 * Shows real-time position with animated trainer marker.
 */
export const LiveTrainerMap = ({
  trainerLocation,
  traineeLocation,
  trainerName = 'Trainer',
  eta,
  distance,
  status = 'en_route',
}: Props) => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const markerAnim = useRef(new Animated.Value(0)).current;
  const [prevLocation, setPrevLocation] = useState(trainerLocation);

  useEffect(() => {
    // Pulse animation for trainer marker
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (trainerLocation && prevLocation) {
      // Animate marker movement
      markerAnim.setValue(0);
      Animated.timing(markerAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
    }
    setPrevLocation(trainerLocation);
  }, [trainerLocation?.latitude, trainerLocation?.longitude]);

  // Calculate relative position (0-1) for visual placement
  const getRelativePosition = () => {
    if (!trainerLocation || !traineeLocation) return 0.8; // Default far position
    const latDiff = Math.abs(trainerLocation.latitude - traineeLocation.latitude);
    const lngDiff = Math.abs(trainerLocation.longitude - traineeLocation.longitude);
    const totalDiff = Math.sqrt(latDiff ** 2 + lngDiff ** 2);
    // Map distance to visual position (closer = closer to trainee marker)
    const normalized = Math.min(1, totalDiff / 0.05); // 0.05 degree ~= 3.5 miles
    return normalized;
  };

  const relativePos = getRelativePosition();
  const isNearby = status === 'nearby' || status === 'arrived';

  return (
    <View style={styles.container} data-testid="live-trainer-map">
      {/* Track Line */}
      <View style={styles.trackLine}>
        <View style={styles.trackBg} />
        <View style={[styles.trackFill, { width: `${(1 - relativePos) * 100}%` }]} />
      </View>

      {/* Markers */}
      <View style={styles.markerRow}>
        {/* Trainer Marker */}
        <Animated.View
          style={[
            styles.trainerMarker,
            {
              left: `${Math.max(5, Math.min(75, relativePos * 80))}%`,
              opacity: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.8, 1] }),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.trainerPulse,
              {
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [0.4, 1],
                      outputRange: [1, 1.6],
                    }),
                  },
                ],
                opacity: pulseAnim.interpolate({
                  inputRange: [0.4, 1],
                  outputRange: [0.6, 0],
                }),
              },
            ]}
          />
          <View style={styles.trainerDot}>
            <Ionicons name="fitness" size={16} color={COLORS.white} />
          </View>
          <Text style={styles.markerLabel}>{trainerName.split(' ')[0]}</Text>
        </Animated.View>

        {/* Trainee Marker (You) - always at the right */}
        <View style={styles.traineeMarker}>
          <View style={[styles.traineeDot, isNearby && styles.traineeDotNearby]}>
            <Ionicons name="person" size={16} color={COLORS.white} />
          </View>
          <Text style={styles.markerLabel}>You</Text>
        </View>
      </View>

      {/* Info Bar */}
      <View style={styles.infoBar}>
        {eta && (
          <View style={styles.infoItem}>
            <Ionicons name="time" size={14} color={COLORS.orange} />
            <Text style={styles.infoText}>ETA: {eta}</Text>
          </View>
        )}
        {distance && (
          <View style={styles.infoItem}>
            <Ionicons name="speedometer" size={14} color={COLORS.teal} />
            <Text style={styles.infoText}>{distance}</Text>
          </View>
        )}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  trackLine: {
    height: 4,
    borderRadius: 2,
    marginHorizontal: 20,
    marginBottom: 20,
    position: 'relative',
  },
  trackBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  trackFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
  },
  markerRow: {
    height: 60,
    position: 'relative',
    marginBottom: 12,
  },
  trainerMarker: {
    position: 'absolute',
    alignItems: 'center',
    top: 0,
  },
  trainerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.orange,
    top: -6,
  },
  trainerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.orange,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  traineeMarker: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
    top: 0,
  },
  traineeDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  traineeDotNearby: {
    backgroundColor: COLORS.success,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,210,106,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
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
    fontWeight: '800',
    color: COLORS.success,
    letterSpacing: 1,
  },
});

export default LiveTrainerMap;

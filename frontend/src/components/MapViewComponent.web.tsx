// MapViewComponent.web.tsx - Web fallback
import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const COLORS = {
  teal: '#1FB8B4',
  tealDark: '#0D8B88',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  orange: '#F7931E',
  gray: '#8892b0',
};

interface NearbyTrainer {
  id: string;
  trainerId: string;
  fullName: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
}

interface MapViewComponentProps {
  userLocation: { latitude: number; longitude: number } | null;
  trainers: NearbyTrainer[];
  selectedTrainerId: string | null;
  pulseAnim: Animated.Value;
  onTrainerPress: (trainer: NearbyTrainer) => void;
  onMapPress: () => void;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

// Web fallback - shows a placeholder instead of the map
const MapViewComponent = forwardRef<any, MapViewComponentProps>(
  ({ trainers }, ref) => {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.navy, COLORS.navyLight]} style={StyleSheet.absoluteFill} />
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="map-outline" size={64} color={COLORS.orange} />
          </View>
          <Text style={styles.title}>Map View</Text>
          <Text style={styles.subtitle}>Open in Expo Go to see the interactive map</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color={COLORS.teal} />
              <Text style={styles.statValue}>{trainers.length}</Text>
              <Text style={styles.statLabel}>Trainers Nearby</Text>
            </View>
          </View>
          <View style={styles.trainerList}>
            {trainers.slice(0, 3).map((trainer, index) => (
              <View key={trainer.id} style={styles.trainerItem}>
                <View style={styles.trainerAvatar}>
                  <Text style={styles.trainerInitial}>{trainer.fullName.charAt(0)}</Text>
                </View>
                <Text style={styles.trainerName}>{trainer.fullName}</Text>
              </View>
            ))}
            {trainers.length > 3 && (
              <Text style={styles.moreText}>+{trainers.length - 3} more trainers</Text>
            )}
          </View>
        </View>
      </View>
    );
  }
);

// Stub export for web - these won't actually be used
class MapView {
  animateToRegion() {}
}
const PROVIDER_GOOGLE = 'google';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 32,
    maxWidth: 360,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(247, 147, 30, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 4,
  },
  trainerList: {
    width: '100%',
    gap: 12,
  },
  trainerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderRadius: 12,
  },
  trainerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trainerInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  trainerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  moreText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default MapViewComponent;
export { MapView, PROVIDER_GOOGLE };

// MapViewComponent.native.tsx - Native platforms (iOS/Android)
import React, { forwardRef } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Platform, View, StyleSheet, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  teal: '#1FB8B4',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  success: '#00D68F',
};

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

const MapViewComponent = forwardRef<MapView, MapViewComponentProps>(
  ({ userLocation, trainers, selectedTrainerId, pulseAnim, onTrainerPress, onMapPress, initialRegion }, ref) => {
    return (
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={darkMapStyle}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={onMapPress}
      >
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userMarkerContainer}>
              <Animated.View style={[styles.userMarkerPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.userMarkerDot}>
                <View style={styles.userMarkerInner} />
              </View>
            </View>
          </Marker>
        )}

        {trainers.map((trainer) => (
          <Marker
            key={trainer.id}
            coordinate={{ latitude: trainer.latitude, longitude: trainer.longitude }}
            onPress={() => onTrainerPress(trainer)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[
              styles.trainerMarker,
              selectedTrainerId === trainer.id && styles.trainerMarkerSelected
            ]}>
              {trainer.avatarUrl ? (
                <Image source={{ uri: trainer.avatarUrl }} style={styles.trainerMarkerImage} />
              ) : (
                <View style={styles.trainerMarkerIcon}>
                  <Ionicons name="fitness" size={18} color={COLORS.white} />
                </View>
              )}
              <View style={styles.trainerMarkerArrow} />
            </View>
          </Marker>
        ))}
      </MapView>
    );
  }
);

const styles = StyleSheet.create({
  userMarkerContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(31, 184, 180, 0.25)',
  },
  userMarkerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  trainerMarker: {
    alignItems: 'center',
  },
  trainerMarkerSelected: {
    transform: [{ scale: 1.2 }],
  },
  trainerMarkerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navy,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  trainerMarkerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginTop: -2,
  },
});

export default MapViewComponent;
export { MapView, PROVIDER_GOOGLE };

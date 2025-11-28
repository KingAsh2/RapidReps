import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { trainerAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainerProfile } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

export default function TraineeHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    loadTrainers();
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Location Error', 'Unable to access location services');
    }
  };

  const loadTrainers = async () => {
    try {
      const data = await trainerAPI.searchTrainers({});
      setTrainers(data);
    } catch (error) {
      console.error('Error loading trainers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTrainers();
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={Colors.gradientTurquoise}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View>
          <Text style={styles.greeting}>Hello, {user?.fullName?.split(' ')[0] || 'there'}! 👋</Text>
          <Text style={styles.subGreeting}>Find your perfect trainer</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={() => setShowMap(!showMap)} 
            style={[styles.headerButton, showMap && styles.headerButtonActive]}
          >
            <Ionicons 
              name={showMap ? "list" : "map"} 
              size={20} 
              color={showMap ? Colors.primary : Colors.white} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by location or gym..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Main Content - Map or List */}
      {showMap ? (
        <View style={styles.mapContainer}>
          {locationPermission === 'granted' && location ? (
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              {trainers.map((trainer, index) => (
                <Marker
                  key={trainer.id}
                  coordinate={{
                    latitude: location.coords.latitude + (Math.random() - 0.5) * 0.02,
                    longitude: location.coords.longitude + (Math.random() - 0.5) * 0.02,
                  }}
                  title={`Trainer #${trainer.id.slice(0, 6)}`}
                  description={`${trainer.trainingStyles.slice(0, 2).join(', ')} • $${(trainer.ratePerMinuteCents / 100).toFixed(2)}/min`}
                  onCalloutPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.userId}`)}
                >
                  <View style={styles.markerContainer}>
                    <Ionicons name="fitness" size={20} color={Colors.white} />
                  </View>
                </Marker>
              ))}
            </MapView>
          ) : (
            <View style={styles.locationPermissionContainer}>
              <Ionicons name="location-outline" size={64} color={Colors.textLight} />
              <Text style={styles.locationPermissionText}>
                {locationPermission === 'denied' 
                  ? 'Location access denied' 
                  : 'Requesting location access...'}
              </Text>
              <Text style={styles.locationPermissionSubtext}>
                {locationPermission === 'denied'
                  ? 'Please enable location services to view trainers on the map'
                  : 'We need your location to show nearby trainers'}
              </Text>
              {locationPermission === 'denied' && (
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={requestLocationPermission}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
        >
          <View style={styles.trainersList}>
            <Text style={styles.sectionTitle}>Available Trainers</Text>
            
            {trainers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="fitness-outline" size={64} color={Colors.textLight} />
                <Text style={styles.emptyStateText}>No trainers available yet</Text>
                <Text style={styles.emptyStateSubtext}>Check back soon!</Text>
              </View>
            ) : (
              trainers.map((trainer) => (
                <View key={trainer.id} style={styles.trainerCard}>
                  <View style={styles.trainerAvatar}>
                    <Ionicons name="person" size={32} color={Colors.primary} />
                  </View>
                  
                  <View style={styles.trainerInfo}>
                    <View style={styles.trainerHeader}>
                      <Text style={styles.trainerName}>Trainer #{trainer.id.slice(0, 6)}</Text>
                      {trainer.isVerified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                          <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                      )}
                    </View>
                    
                    {trainer.bio && (
                      <Text style={styles.trainerBio} numberOfLines={2}>
                        {trainer.bio}
                      </Text>
                    )}
                    
                    <View style={styles.trainerStats}>
                      <View style={styles.stat}>
                        <Ionicons name="star" size={16} color={Colors.warning} />
                        <Text style={styles.statText}>
                          {trainer.averageRating.toFixed(1)} ({trainer.totalSessionsCompleted} sessions)
                        </Text>
                      </View>
                      <View style={styles.stat}>
                        <Ionicons name="cash-outline" size={16} color={Colors.primary} />
                        <Text style={styles.statText}>
                          ${(trainer.ratePerMinuteCents / 100).toFixed(2)}/min
                        </Text>
                      </View>
                    </View>
                    
                    {trainer.trainingStyles.length > 0 && (
                      <View style={styles.styleChips}>
                        {trainer.trainingStyles.slice(0, 3).map((style, index) => (
                          <View key={index} style={styles.styleChip}>
                            <Text style={styles.styleChipText}>{style}</Text>
                          </View>
                        ))}
                        {trainer.trainingStyles.length > 3 && (
                          <Text style={styles.moreStyles}>+{trainer.trainingStyles.length - 3}</Text>
                        )}
                      </View>
                    )}
                    
                    {trainer.primaryGym && (
                      <View style={styles.gymInfo}>
                        <Ionicons name="location" size={14} color={Colors.textLight} />
                        <Text style={styles.gymText}>{trainer.primaryGym}</Text>
                      </View>
                    )}
                    
                    <TouchableOpacity 
                      style={styles.bookButton}
                      onPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.userId}`)}
                    >
                      <Text style={styles.bookButtonText}>View Profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.white,
  },
  subGreeting: {
    fontSize: 14,
    color: Colors.white,
    marginTop: 4,
    opacity: 0.9,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.navy,
  },
  scrollView: {
    flex: 1,
  },
  trainersList: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.navy,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.navy,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 4,
  },
  trainerCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  trainerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  trainerInfo: {
    flex: 1,
  },
  trainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  trainerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.navy,
    marginRight: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
  },
  trainerBio: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 8,
  },
  trainerStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: Colors.navy,
  },
  styleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  styleChip: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  styleChipText: {
    fontSize: 12,
    color: Colors.navy,
    fontWeight: '500',
  },
  moreStyles: {
    fontSize: 12,
    color: Colors.textLight,
    alignSelf: 'center',
  },
  gymInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  gymText: {
    fontSize: 13,
    color: Colors.textLight,
  },
  bookButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

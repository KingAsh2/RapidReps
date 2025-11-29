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
  Platform,
  Modal,
  Linking,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { trainerAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainerProfile } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { AnimatedLogo } from '../../src/components/AnimatedLogo';

const { width } = Dimensions.get('window');

// Helper function to calculate distance between two points (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function TraineeHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [showVirtualDialog, setShowVirtualDialog] = useState(false);
  const [virtualTrainers, setVirtualTrainers] = useState([]);
  const [dialogAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    // Reload trainers when location is available to calculate distances
    if (userLocation) {
      loadTrainers();
    }
  }, [userLocation]);

  useEffect(() => {
    // Initial load if no location permission or location not available yet
    if (!loading && trainers.length === 0) {
      loadTrainers();
    }
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Reverse geocode to get address
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        if (addresses[0]) {
          const addr = addresses[0];
          setLocationAddress(`${addr.city || ''}, ${addr.region || ''}`);
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadTrainers = async () => {
    try {
      const data = await trainerAPI.searchTrainers({});
      
      // Calculate distances and add to trainer objects
      let trainersWithDistance = data.map((trainer: any) => {
        let distance = null;
        
        if (userLocation && trainer.latitude && trainer.longitude) {
          distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            trainer.latitude,
            trainer.longitude
          );
        }
        
        return {
          ...trainer,
          distance,
        };
      });
      
      // Sort by distance (closest first), trainers without location go to end
      trainersWithDistance.sort((a: any, b: any) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
      
      setTrainers(trainersWithDistance);
      
      // Check if no trainers available and if there are virtual trainers
      const hasLocalTrainers = trainersWithDistance.length > 0;
      const virtualTrainersAvailable = data.filter((t: any) => t.isVirtualTrainingAvailable);
      
      if (!hasLocalTrainers && virtualTrainersAvailable.length > 0) {
        setVirtualTrainers(virtualTrainersAvailable);
        // Show virtual training dialog after a short delay
        setTimeout(() => {
          setShowVirtualDialog(true);
          Animated.spring(dialogAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 6,
          }).start();
        }, 800);
      }
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
    router.replace('/');
  };

  const initiateVideoCall = async (trainer: any) => {
    // Get trainer's contact info (phone/email)
    const trainerPhone = trainer.userId; // In real app, would have phone number
    
    if (Platform.OS === 'ios') {
      // Try FaceTime first on iOS
      const facetimeUrl = `facetime://${trainerPhone}`;
      const canOpen = await Linking.canOpenURL(facetimeUrl);
      
      if (canOpen) {
        await Linking.openURL(facetimeUrl);
      } else {
        // Fallback to regular phone call
        Alert.alert('FaceTime Not Available', 'Would you like to call the trainer instead?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call', onPress: () => Linking.openURL(`tel:${trainerPhone}`) },
        ]);
      }
    } else if (Platform.OS === 'android') {
      // On Android, use Google Meet or Duo
      Alert.alert(
        'Start Video Call',
        'How would you like to connect with your trainer?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Google Meet', onPress: () => Linking.openURL('https://meet.google.com/new') },
          { text: 'Phone Call', onPress: () => Linking.openURL(`tel:${trainerPhone}`) },
        ]
      );
    }
  };

  const handleVirtualTrainingYes = () => {
    setShowVirtualDialog(false);
    // Show virtual trainers
    if (virtualTrainers.length > 0) {
      Alert.alert(
        `${virtualTrainers.length} Virtual Trainer${virtualTrainers.length > 1 ? 's' : ''} Available! 🎉`,
        'Connecting you now...',
        [
          {
            text: 'Start Video Call',
            onPress: () => initiateVideoCall(virtualTrainers[0]),
          },
          {
            text: 'View All',
            onPress: () => setTrainers(virtualTrainers),
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradientMain}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.backgroundGradient}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header with Gradient */}
      <LinearGradient
        colors={Colors.gradientTealStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <AnimatedLogo size={45} animationType="spin-bounce" />
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>Hey there, {user?.fullName?.split(' ')[0] || 'there'}! 💪</Text>
          <Text style={styles.subGreeting}>Let&apos;s get to work and find you a trainer</Text>
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

      {/* Location Info Banner */}
      {userLocation && (
        <View style={styles.locationBanner}>
          <Ionicons name="location" size={20} color={Colors.primary} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Your Location</Text>
            <Text style={styles.locationText}>
              {locationAddress || `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
            </Text>
          </View>
          <TouchableOpacity onPress={requestLocationPermission} style={styles.refreshLocationButton}>
            <Ionicons name="refresh" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {!userLocation && locationPermission !== 'granted' && (
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={20} color={Colors.warning} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationWarning}>
              {locationPermission === 'denied' 
                ? 'Location access denied. Enable in settings to see distances.' 
                : 'Getting your location...'}
            </Text>
          </View>
          {locationPermission === 'denied' && (
            <TouchableOpacity onPress={requestLocationPermission} style={styles.refreshLocationButton}>
              <Ionicons name="settings-outline" size={18} color={Colors.warning} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Content - Trainer List */}
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
                      {trainer.distance !== null && (
                        <View style={styles.stat}>
                          <Ionicons name="navigate" size={16} color={Colors.neonBlue} />
                          <Text style={styles.distanceText}>
                            {trainer.distance.toFixed(1)} mi
                          </Text>
                        </View>
                      )}
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
        </SafeAreaView>
      </LinearGradient>

      {/* Virtual Training Dialog */}
      <Modal
        visible={showVirtualDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVirtualDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.dialogContainer,
              {
                transform: [
                  {
                    scale: dialogAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: dialogAnim,
              },
            ]}
          >
            <LinearGradient
              colors={Colors.gradientMain}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dialogGradient}
            >
              {/* Animated Icon */}
              <View style={styles.dialogIconContainer}>
                <Ionicons name="videocam" size={64} color={Colors.white} />
              </View>

              {/* Title */}
              <Text style={styles.dialogTitle}>Don't Sweat Just Yet! 💪</Text>

              {/* Message */}
              <Text style={styles.dialogMessage}>
                There are Virtual Trainers available RAPIDLY! 🚀
              </Text>

              <Text style={styles.dialogSubMessage}>
                Would you like Virtual Training?
              </Text>

              {/* Buttons */}
              <View style={styles.dialogButtons}>
                <TouchableOpacity
                  style={[styles.dialogButton, styles.dialogButtonNo]}
                  onPress={() => setShowVirtualDialog(false)}
                >
                  <Text style={styles.dialogButtonTextNo}>Maybe Later</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dialogButton, styles.dialogButtonYes]}
                  onPress={handleVirtualTrainingYes}
                >
                  <Text style={styles.dialogButtonTextYes}>Yes, Let's Go! 🔥</Text>
                </TouchableOpacity>
              </View>

              {/* Close button */}
              <TouchableOpacity
                style={styles.dialogCloseButton}
                onPress={() => setShowVirtualDialog(false)}
              >
                <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  backgroundGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: {
    marginTop: 8,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subGreeting: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.navy,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
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
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
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
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: Colors.navy,
    fontWeight: '500',
  },
  locationWarning: {
    fontSize: 13,
    color: Colors.text,
  },
  refreshLocationButton: {
    padding: 8,
  },
  distanceText: {
    fontSize: 13,
    color: Colors.neonBlue,
    fontWeight: '700',
  },
  // Virtual Training Dialog Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
  },
  dialogGradient: {
    padding: 32,
    alignItems: 'center',
  },
  dialogIconContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 16,
  },
  dialogMessage: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  dialogSubMessage: {
    fontSize: 18,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.95,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dialogButtonNo: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dialogButtonYes: {
    backgroundColor: Colors.white,
  },
  dialogButtonTextNo: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  dialogButtonTextYes: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  dialogCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  // Map styles
  mapContainer: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});

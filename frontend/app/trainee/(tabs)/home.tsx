import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
  Linking,
  Animated,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { trainerAPI, traineeAPI } from '../../../src/services/api';
import { Colors } from '../../../src/utils/colors';
import { TrainerProfile } from '../../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import TrainingModeDialog from '../../../src/components/TrainingModeDialog';
import TrainerFilters from '../../../src/components/TrainerFilters';

const { width, height } = Dimensions.get('window');

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
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false); // Start with false to show UI immediately
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [showTrainingModeDialog, setShowTrainingModeDialog] = useState(false);
  const [showVirtualDialog, setShowVirtualDialog] = useState(false);
  const [virtualTrainers, setVirtualTrainers] = useState([]);
  const dialogAnim = useRef(new Animated.Value(0)).current;
  
  // Animation refs for high-energy entrance
  const heroAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const urgentBannerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(10)].map(() => new Animated.Value(0))).current;
  const ctaPulseAnim = useRef(new Animated.Value(1)).current;
  const fabPulseAnim = useRef(new Animated.Value(1)).current;
  
  // Filter & Sort States
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minRating: 0,
    gender: 'any',
    specialties: [] as string[],
  });
  const [sortBy, setSortBy] = useState('distance');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Start entrance animations immediately
  useEffect(() => {
    const startAnimations = () => {
      // Hero slide down + fade in
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Search card cascade
      setTimeout(() => {
        Animated.spring(searchAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 150);

      // Urgent banner slide in
      setTimeout(() => {
        Animated.spring(urgentBannerAnim, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }).start();
      }, 300);

      // Staggered card animations
      cardAnims.forEach((anim, index) => {
        setTimeout(() => {
          Animated.spring(anim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }, 400 + (index * 100));
      });

      // CTA pulse animation (every 6 seconds)
      const startPulse = () => {
        Animated.sequence([
          Animated.timing(ctaPulseAnim, {
            toValue: 1.05,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(ctaPulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      };
      
      const pulseInterval = setInterval(startPulse, 6000);
      
      // FAB glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(fabPulseAnim, {
            toValue: 1.08,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(fabPulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      return () => clearInterval(pulseInterval);
    };

    // Start animations immediately
    startAnimations();
  }, []);

  useEffect(() => {
    if (user) {
      requestLocationPermission();
      // Start loading trainers immediately, don't wait for location
      loadTrainers();
    }
  }, [user]);

  useEffect(() => {
    // Reload trainers when location becomes available to update distances
    if (userLocation && !loading) {
      loadTrainers();
    }
  }, [userLocation]);

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
      const searchParams: any = {};
      
      if (userLocation) {
        searchParams.latitude = userLocation.latitude;
        searchParams.longitude = userLocation.longitude;
      }
      
      searchParams.wantsVirtual = true;
      
      const data = await trainerAPI.searchTrainers(searchParams);
      
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
        
        return { ...trainer, distance };
      });
      
      setTrainers(trainersWithDistance);
      
      const hasLocalTrainers = trainersWithDistance.filter((t: any) => t.distance !== null).length > 0;
      const virtualTrainersAvailable = trainersWithDistance.filter((t: any) => t.isVirtualTrainingAvailable);
      
      // Store virtual trainers but don't auto-show dialog - let user discover via the CTA button
      if (virtualTrainersAvailable.length > 0) {
        setVirtualTrainers(virtualTrainersAvailable);
      }
    } catch (error) {
      console.error('[TraineeHome] Error loading trainers:', error);
      setTrainers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSessions = async () => {
    try {
      if (!user) return;
      const data = await traineeAPI.getSessions();
      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessions([]);
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTrainers();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const getFilteredAndSortedTrainers = () => {
    let filtered = [...trainers];

    if (filters.minRating > 0) {
      filtered = filtered.filter((t) => (t.averageRating || 0) >= filters.minRating);
    }

    if (filters.gender !== 'any' && filters.gender) {
      filtered = filtered.filter((t) => t.gender?.toLowerCase() === filters.gender);
    }

    if (filters.specialties.length > 0) {
      filtered = filtered.filter((t) => {
        const trainerStyles = t.trainingStyles || [];
        return filters.specialties.some((specialty) => trainerStyles.includes(specialty));
      });
    }

    if (sortBy === 'distance') {
      filtered.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else if (sortBy === 'price') {
      filtered.sort((a, b) => (a.ratePerMinuteCents || 99999) - (b.ratePerMinuteCents || 99999));
    }

    return filtered;
  };

  const displayedTrainers = getFilteredAndSortedTrainers();
  const pendingSessions = sessions.filter((s: any) => s.status === 'requested');

  const initiateVideoCall = async (trainer: any) => {
    const trainerPhone = trainer.userId;
    
    if (Platform.OS === 'ios') {
      const facetimeUrl = `facetime://${trainerPhone}`;
      const canOpen = await Linking.canOpenURL(facetimeUrl);
      
      if (canOpen) {
        await Linking.openURL(facetimeUrl);
      } else {
        showAlert({
          title: 'FaceTime Not Available',
          message: 'Would you like to call the trainer instead?',
          type: 'info',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call', onPress: () => Linking.openURL(`tel:${trainerPhone}`) },
          ],
        });
      }
    } else {
      showAlert({
        title: 'Start Video Call',
        message: 'How would you like to connect with your trainer?',
        type: 'info',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Google Meet', onPress: () => Linking.openURL('https://meet.google.com/new') },
          { text: 'Phone Call', onPress: () => Linking.openURL(`tel:${trainerPhone}`) },
        ],
      });
    }
  };

  const handleVirtualTrainingYes = () => {
    setShowVirtualDialog(false);
    if (virtualTrainers.length > 0) {
      // Show virtual trainers directly in the list
      setTrainers(virtualTrainers);
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#1FB8B4', '#F7931E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Getting your workout ready...</Text>
      </LinearGradient>
    );
  }

  const heroTranslateY = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 0],
  });

  const searchTranslateY = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  const urgentTranslateX = urgentBannerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, 0],
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Full Screen Gradient Background - Vibrant Teal */}
        <LinearGradient
          colors={['#1FB8B4', '#14A3A0', '#0D8B88']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fullGradient}
        />
        
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => router.push('/trainee/(tabs)/profile')} 
              style={styles.headerButton}
            >
              <Ionicons name="person-circle" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
              <Ionicons name="log-out-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
            }
          >
            {/* Hero Banner - Motivational Greeting */}
            <Animated.View
              style={[
                styles.heroBanner,
                {
                  opacity: heroAnim,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(26, 42, 94, 0.95)', 'rgba(26, 42, 94, 0.85)']}
                style={styles.heroGradient}
              >
                <View style={styles.heroGlow} />
                <Text style={styles.heroTitle}>
                  LET'S GET AFTER IT, {user?.fullName?.split(' ')[0]?.toUpperCase() || 'CHAMP'}! 💪🔥
                </Text>
                <Text style={styles.heroSubtitle}>
                  Your next workout is just one tap away
                </Text>
                {locationAddress && (
                  <View style={styles.heroLocation}>
                    <Ionicons name="location" size={16} color="#22C1C3" />
                    <Text style={styles.heroLocationText}>{locationAddress}</Text>
                  </View>
                )}
              </LinearGradient>
            </Animated.View>

            {/* Urgent CTA Banner - Need a trainer NOW */}
            <Animated.View
              style={[
                styles.urgentBannerContainer,
                {
                  opacity: urgentBannerAnim,
                  transform: [
                    { translateX: urgentTranslateX },
                    { scale: ctaPulseAnim },
                  ],
                },
              ]}
            >
              <TouchableOpacity 
                onPress={() => setShowTrainingModeDialog(true)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#FF6A00', '#FF9F1C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.urgentBanner}
                >
                  <View style={styles.urgentIconContainer}>
                    <Ionicons name="flash" size={36} color="#FFFFFF" />
                  </View>
                  <View style={styles.urgentContent}>
                    <Text style={styles.urgentTitle}>⚡ NEED A TRAINER NOW?</Text>
                    <Text style={styles.urgentSubtitle}>30-min virtual session • Just $18</Text>
                  </View>
                  <View style={styles.urgentArrow}>
                    <Ionicons name="chevron-forward-circle" size={44} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Search Card */}
            <Animated.View
              style={[
                styles.searchCard,
                {
                  opacity: searchAnim,
                  transform: [{ translateY: searchTranslateY }],
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.95)']}
                style={styles.searchCardGradient}
              >
                <View style={styles.searchInputContainer}>
                  <Ionicons name="search" size={22} color="#1a2a5e" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search trainers, gyms..."
                    placeholderTextColor="#8892b0"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                <View style={styles.filterRow}>
                  <TouchableOpacity 
                    onPress={() => setShowFilters(true)}
                    style={styles.filterPill}
                  >
                    <Ionicons name="options" size={18} color="#1a2a5e" />
                    <Text style={styles.filterPillText}>Filters</Text>
                    {(filters.minRating > 0 || filters.gender !== 'any' || filters.specialties.length > 0) && (
                      <View style={styles.filterDot} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => setShowSortMenu(!showSortMenu)}
                    style={styles.sortPill}
                  >
                    <Ionicons name="swap-vertical" size={18} color="#1a2a5e" />
                    <Text style={styles.sortPillText}>
                      {sortBy === 'distance' ? 'Distance' : sortBy === 'rating' ? 'Rating' : 'Price'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#1a2a5e" />
                  </TouchableOpacity>
                </View>
                
                {/* Sort Dropdown */}
                {showSortMenu && (
                  <View style={styles.sortDropdown}>
                    {[
                      { value: 'distance', label: 'Nearest First', icon: 'location' },
                      { value: 'rating', label: 'Top Rated', icon: 'star' },
                      { value: 'price', label: 'Best Price', icon: 'cash' },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => {
                          setSortBy(option.value);
                          setShowSortMenu(false);
                        }}
                        style={[
                          styles.sortOption,
                          sortBy === option.value && styles.sortOptionActive,
                        ]}
                      >
                        <Ionicons 
                          name={option.icon as any} 
                          size={18} 
                          color={sortBy === option.value ? '#F7931E' : '#1a2a5e'} 
                        />
                        <Text style={[
                          styles.sortOptionText,
                          sortBy === option.value && styles.sortOptionTextActive,
                        ]}>
                          {option.label}
                        </Text>
                        {sortBy === option.value && (
                          <Ionicons name="checkmark-circle" size={20} color="#F7931E" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </LinearGradient>
            </Animated.View>

            {/* Pending Requests Card */}
            {pendingSessions.length > 0 && (
              <Animated.View
                style={[
                  styles.pendingCard,
                  {
                    opacity: searchAnim,
                    transform: [{ translateY: searchTranslateY }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#FDBB2D', '#F7931E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pendingGradient}
                >
                  <View style={styles.pendingHeader}>
                    <View style={styles.pendingIconBg}>
                      <Ionicons name="hourglass" size={24} color="#F7931E" />
                    </View>
                    <View style={styles.pendingTitleContainer}>
                      <Text style={styles.pendingTitle}>PENDING REQUESTS</Text>
                      <Text style={styles.pendingCount}>{pendingSessions.length} waiting</Text>
                    </View>
                  </View>
                  {pendingSessions.slice(0, 2).map((session: any, index: number) => (
                    <View key={session.id} style={styles.pendingItem}>
                      <View style={styles.pendingItemRow}>
                        <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.pendingItemText}>
                          {new Date(session.sessionDateTimeStart).toLocaleDateString()}
                        </Text>
                        <Text style={styles.pendingItemDot}>•</Text>
                        <Text style={styles.pendingItemText}>{session.durationMinutes} min</Text>
                      </View>
                      <Text style={styles.pendingStatus}>⏳ Awaiting trainer response</Text>
                    </View>
                  ))}
                </LinearGradient>
              </Animated.View>
            )}

            {/* Available Trainers Section */}
            <View style={styles.trainersSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🏋️ AVAILABLE TRAINERS</Text>
                <Text style={styles.trainerCount}>{displayedTrainers.length} ready</Text>
              </View>
              
              {displayedTrainers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)']}
                    style={styles.emptyGradient}
                  >
                    <Ionicons name="fitness-outline" size={64} color="#22C1C3" />
                    <Text style={styles.emptyTitle}>No trainers nearby</Text>
                    <Text style={styles.emptySubtitle}>Try virtual training instead!</Text>
                    <TouchableOpacity 
                      style={styles.emptyButton}
                      onPress={() => setShowTrainingModeDialog(true)}
                    >
                      <LinearGradient
                        colors={['#22C1C3', '#1FB8B4']}
                        style={styles.emptyButtonGradient}
                      >
                        <Text style={styles.emptyButtonText}>Find Virtual Trainers</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              ) : (
                displayedTrainers.map((trainer, index) => (
                  <Animated.View
                    key={trainer.id}
                    style={[
                      styles.trainerCard,
                      {
                        opacity: cardAnims[index] || 1,
                        transform: [{
                          translateY: (cardAnims[index] || new Animated.Value(1)).interpolate({
                            inputRange: [0, 1],
                            outputRange: [40, 0],
                          }),
                        }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={['#FFFFFF', '#F8F9FA']}
                      style={styles.trainerCardGradient}
                    >
                      {/* Trainer Header */}
                      <View style={styles.trainerHeader}>
                        <View style={styles.trainerAvatarContainer}>
                          {trainer.avatarUrl ? (
                            <Image
                              source={{ uri: trainer.avatarUrl }}
                              style={styles.trainerAvatar}
                            />
                          ) : (
                            <LinearGradient
                              colors={['#22C1C3', '#1FB8B4']}
                              style={styles.trainerAvatarPlaceholder}
                            >
                              <Ionicons name="person" size={28} color="#FFFFFF" />
                            </LinearGradient>
                          )}
                          {trainer.isVerified && (
                            <View style={styles.verifiedBadge}>
                              <Ionicons name="checkmark-circle" size={18} color="#22C1C3" />
                            </View>
                          )}
                        </View>
                        
                        <View style={styles.trainerInfo}>
                          <Text style={styles.trainerName}>{trainer.fullName || 'Trainer'}</Text>
                          
                          <View style={styles.trainerStats}>
                            <View style={styles.statBadge}>
                              <Ionicons name="star" size={14} color="#FFB347" />
                              <Text style={styles.statText}>
                                {trainer.averageRating?.toFixed(1) || '5.0'}
                              </Text>
                            </View>
                            <View style={styles.statBadge}>
                              <Ionicons name="cash" size={14} color="#22C1C3" />
                              <Text style={styles.statText}>
                                ${(trainer.ratePerMinuteCents / 100).toFixed(2)}/min
                              </Text>
                            </View>
                            {trainer.distance !== null && (
                              <View style={styles.statBadge}>
                                <Ionicons name="location" size={14} color="#F7931E" />
                                <Text style={styles.statText}>
                                  {trainer.distance.toFixed(1)} mi
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Bio */}
                      {trainer.bio && (
                        <Text style={styles.trainerBio} numberOfLines={2}>
                          {trainer.bio}
                        </Text>
                      )}

                      {/* Tags */}
                      <View style={styles.tagRow}>
                        {trainer.isVirtualTrainingAvailable && (
                          <View style={styles.virtualTag}>
                            <Ionicons name="videocam" size={12} color="#FFFFFF" />
                            <Text style={styles.virtualTagText}>VIRTUAL</Text>
                          </View>
                        )}
                        {trainer.trainingStyles?.slice(0, 2).map((style: string, i: number) => (
                          <View key={i} style={styles.styleTag}>
                            <Text style={styles.styleTagText}>{style}</Text>
                          </View>
                        ))}
                        {trainer.trainingStyles?.length > 2 && (
                          <Text style={styles.moreTag}>+{trainer.trainingStyles.length - 2}</Text>
                        )}
                      </View>

                      {/* CTA Button */}
                      <TouchableOpacity 
                        style={styles.viewProfileButton}
                        onPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.userId}`)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#1FB8B4', '#22C1C3']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.viewProfileGradient}
                        >
                          <Text style={styles.viewProfileText}>VIEW PROFILE</Text>
                          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </LinearGradient>
                  </Animated.View>
                ))
              )}
            </View>

            {/* Bottom Spacer for FAB */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Floating Action Button */}
          <Animated.View
            style={[
              styles.fabContainer,
              { transform: [{ scale: fabPulseAnim }] },
            ]}
          >
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setShowTrainingModeDialog(true)}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#FF6A00', '#F7931E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabGradient}
              >
                <Ionicons name="flash" size={28} color="#FFFFFF" />
                <Text style={styles.fabText}>START TRAINING</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Training Mode Dialog */}
          <TrainingModeDialog
            visible={showTrainingModeDialog}
            onClose={() => setShowTrainingModeDialog(false)}
            onSelectInPerson={() => setShowTrainingModeDialog(false)}
            onSelectVirtual={() => {
              setShowTrainingModeDialog(false);
              router.push('/trainee/virtual-confirm');
            }}
          />
        </SafeAreaView>

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
                  transform: [{ scale: dialogAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                  opacity: dialogAnim,
                },
              ]}
            >
              <LinearGradient
                colors={['#1FB8B4', '#F7931E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dialogGradient}
              >
                <View style={styles.dialogIconContainer}>
                  <Ionicons name="videocam" size={64} color="#FFFFFF" />
                </View>
                <Text style={styles.dialogTitle}>Don't Sweat Just Yet! 💪</Text>
                <Text style={styles.dialogMessage}>Virtual Trainers available RAPIDLY! 🚀</Text>
                <Text style={styles.dialogSubMessage}>Would you like Virtual Training?</Text>
                <View style={styles.dialogButtons}>
                  <TouchableOpacity
                    style={styles.dialogButtonNo}
                    onPress={() => setShowVirtualDialog(false)}
                  >
                    <Text style={styles.dialogButtonTextNo}>Maybe Later</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dialogButtonYes}
                    onPress={handleVirtualTrainingYes}
                  >
                    <Text style={styles.dialogButtonTextYes}>Yes, Let's Go! 🔥</Text>
                  </TouchableOpacity>
                </View>
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

        {/* Trainer Filters Modal */}
        <Modal
          visible={showFilters}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowFilters(false)}
        >
          <TrainerFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClose={() => setShowFilters(false)}
          />
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1FB8B4',
  },
  fullGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  // Hero Banner
  heroBanner: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  heroGradient: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(34, 193, 195, 0.3)',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  heroLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  heroLocationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C1C3',
  },
  // Urgent Banner
  urgentBannerContainer: {
    marginBottom: 16,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  urgentIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  urgentContent: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  urgentSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  urgentArrow: {
    opacity: 0.9,
  },
  // Search Card
  searchCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  searchCardGradient: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1a2a5e',
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    flex: 1,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a2a5e',
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F7931E',
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    flex: 1,
  },
  sortPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a2a5e',
    flex: 1,
  },
  sortDropdown: {
    marginTop: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  sortOptionActive: {
    backgroundColor: 'rgba(247, 147, 30, 0.1)',
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a2a5e',
    flex: 1,
  },
  sortOptionTextActive: {
    color: '#F7931E',
  },
  // Pending Card
  pendingCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#F7931E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  pendingGradient: {
    padding: 18,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  pendingIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pendingTitleContainer: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  pendingCount: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  pendingItem: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  pendingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pendingItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pendingItemDot: {
    color: 'rgba(255,255,255,0.6)',
  },
  pendingStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  // Trainers Section
  trainersSection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  trainerCount: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  // Empty State
  emptyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyGradient: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a2a5e',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8892b0',
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Trainer Card
  trainerCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  trainerCardGradient: {
    padding: 18,
  },
  trainerHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  trainerAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  trainerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  trainerAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  trainerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  trainerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a2a5e',
    marginBottom: 6,
  },
  trainerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a2a5e',
  },
  trainerBio: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5a6a8a',
    lineHeight: 20,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  virtualTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C1C3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  virtualTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  styleTag: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  styleTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F7931E',
  },
  moreTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8892b0',
    alignSelf: 'center',
  },
  viewProfileButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  viewProfileGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    left: 20,
  },
  fab: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  // Modal
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
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  dialogMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogSubMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 28,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dialogButtonNo: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  dialogButtonYes: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  dialogButtonTextNo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dialogButtonTextYes: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1FB8B4',
  },
  dialogCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});

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
  Image,
  Dimensions,
  Platform,
  Modal,
  Linking,
  Animated,
  ImageBackground,
  FlatList,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { trainerAPI, traineeAPI } from '../../../src/services/api';
import { Colors } from '../../../src/utils/colors';
import { TrainerProfile } from '../../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { ProfilePreviewCard } from '../../../src/components/ProfilePreviewCard';
import { useNotifications } from '../../../src/contexts/NotificationContext';
import TrainingModeDialog from '../../../src/components/TrainingModeDialog';
import TrainerFilters from '../../../src/components/TrainerFilters';
import NearbyTrainersMap from '../../../src/components/NearbyTrainersMap';
import { toast } from '../../../src/utils/toast';
import { StreakBanner } from '../../../src/components/trainee-home/StreakBanner';
import { QuickBookSection } from '../../../src/components/trainee-home/QuickBookSection';
import { FavoriteAvailability } from '../../../src/components/trainee-home/FavoriteAvailability';
import { TrainerCard } from '../../../src/components/trainee-home/TrainerCard';
import { haptic } from '../../../src/utils/haptics';
import TrainerBottomSheet from '../../../src/components/TrainerBottomSheet';
import { resolveSessionPriceCents } from '../../../src/utils/sessionPricing';
import PeopleSearchBar from '../../../src/components/PeopleSearchBar';
import FloatingOrangeBg from '../../../src/components/FloatingOrangeBg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swrCache } from '../../../src/hooks/useStaleWhileRefresh';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { CoachMarkTour } from '../../../src/components/coachmarks/CoachMarkTour';

// iter102h: persist trainee's proximity preference so other screens
// (e.g. /trainee/swipe-trainers) can honor the same radius.
const PROXIMITY_STORAGE_KEY = 'trainee_proximity_miles';

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
  const { unreadCount } = useNotifications();
  const [loading, setLoading] = useState(false); // Start with false to show UI immediately
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // iter106 perf: hydrate the trainer list from the in-memory cache (set on
  // the previous mount of this screen) so re-entering Home paints content
  // instantly instead of flashing a blank scroll while the network resolves.
  const [trainers, setTrainers] = useState<any[]>(() => swrCache.get<any[]>('home:trainers') || []);
  const [sessions, setSessions] = useState<any[]>(() => swrCache.get<any[]>('home:sessions') || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [showTrainingModeDialog, setShowTrainingModeDialog] = useState(false);
  const [showVirtualDialog, setShowVirtualDialog] = useState(false);
  const [virtualTrainers, setVirtualTrainers] = useState<any[]>([]);
  const [nearbyTrainers, setNearbyTrainers] = useState<any[]>([]);
  const [mapRefreshing, setMapRefreshing] = useState(false);
  const dialogAnim = useRef(new Animated.Value(0)).current;
  // iter118v — coach-mark refs for the first-run trainee tour.
  const heroTourRef = useRef<any>(null);
  const searchTourRef = useRef<any>(null);
  const bottomSheetTourRef = useRef<any>(null);
  
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
  const [travelProximity, setTravelProximity] = useState(10);
  const [showProximityPicker, setShowProximityPicker] = useState(false);

  // iter102h: hydrate proximity from AsyncStorage on mount and persist on change
  // so the Tinder-swipe screen reads the same value the user picked here.
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(PROXIMITY_STORAGE_KEY);
        const n = v ? parseInt(v, 10) : NaN;
        if (Number.isFinite(n) && n > 0) setTravelProximity(n);
      } catch { /* ignore */ }
    })();
  }, []);
  // iter118i: proximity now lives in Trainee Settings — re-read on tab focus
  // so changes there immediately re-filter the map + Available Now sheet here.
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const v = await AsyncStorage.getItem(PROXIMITY_STORAGE_KEY);
          const n = v ? parseInt(v, 10) : NaN;
          if (Number.isFinite(n) && n > 0 && n !== travelProximity) setTravelProximity(n);
        } catch { /* ignore */ }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );
  useEffect(() => {
    AsyncStorage.setItem(PROXIMITY_STORAGE_KEY, String(travelProximity)).catch(() => {});
  }, [travelProximity]);
  const [menuVisible, setMenuVisible] = useState(false);
  // iter118u: `selectedTrainerId` removed — tapping a trainer navigates
  // straight to their profile, no intermediate selection state needed.
  const [previewUser, setPreviewUser] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [needsAddress, setNeedsAddress] = useState(false);

  // Convenience features state
  const [recentTrainers, setRecentTrainers] = useState<any[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [favoriteAvailability, setFavoriteAvailability] = useState<any[]>([]);

  // Start entrance animations immediately
  useEffect(() => {
    const startAnimations = () => {
      // Hero bounce in
      Animated.spring(heroAnim, {
        toValue: 1,
        friction: 5,
        tension: 60,
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
      loadTrainers();
      loadConvenienceData();
      // Check if trainee needs to add address
      if (!user.homeAddress && !user.address) {
        setNeedsAddress(true);
      }
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
      // iter106 perf: persist to in-memory cache so next mount of this screen
      // paints the previous list instantly (background refresh still runs).
      swrCache.set('home:trainers', trainersWithDistance);
      
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

  const loadConvenienceData = async () => {
    try {
      const [recentRes, streakRes, favRes] = await Promise.all([
        traineeAPI.getRecentTrainers().catch(() => ({ recentTrainers: [] })),
        traineeAPI.getStreak().catch(() => null),
        traineeAPI.getFavoriteAvailability().catch(() => ({ trainers: [] })),
      ]);
      setRecentTrainers(recentRes.recentTrainers || []);
      setStreak(streakRes);
      setFavoriteAvailability(favRes.trainers || []);
    } catch {
      // Non-critical — silently fail
    }
  };


  const loadSessions = async () => {
    try {
      if (!user) return;
      const data = await traineeAPI.getSessions();
      setSessions(data || []);
      // iter106 perf: cache for instant repaint on tab return.
      swrCache.set('home:sessions', data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessions([]);
    }
  };

  // Load nearby trainers for the map
  const loadNearbyTrainers = async () => {
    try {
      if (!userLocation) return;
      setMapRefreshing(true);
      const response = await traineeAPI.getNearbyTrainers(
        userLocation.latitude,
        userLocation.longitude,
        25
      );
      setNearbyTrainers(response.trainers || []);
    } catch (error) {
      console.error('Error loading nearby trainers:', error);
      setNearbyTrainers([]);
    } finally {
      setMapRefreshing(false);
    }
  };

  // Handle trainer selection from map
  const handleMapTrainerSelect = (trainer: any) => {
    console.log('Selected trainer from map:', trainer.fullName);
  };

  // Refresh map trainers
  const handleMapRefresh = () => {
    loadNearbyTrainers();
  };

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  // Load nearby trainers when location becomes available
  useEffect(() => {
    if (userLocation) {
      loadNearbyTrainers();
    }
  }, [userLocation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTrainers();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const getFilteredAndSortedTrainers = () => {
    let filtered = [...trainers];

    // Trainer Proximity filter — strictly enforced
    if (travelProximity > 0) {
      filtered = filtered.filter((t) => {
        // Strict: drop trainers without a known distance OR beyond the radius
        if (t.distance === null || t.distance === undefined) return false;
        return t.distance <= travelProximity;
      });
    }

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
      // iter102ah: sort by the canonical 30-min outdoor price (matches the
      // badge users actually see). Previously sorted by `ratePerMinuteCents`
      // which was a hidden default of $1/min for every trainer.
      filtered.sort((a, b) => {
        const ac = resolveSessionPriceCents(a, 'outdoor', 30) ?? 999999;
        const bc = resolveSessionPriceCents(b, 'outdoor', 30) ?? 999999;
        return ac - bc;
      });
    }

    return filtered;
  };

  const displayedTrainers = getFilteredAndSortedTrainers();
  const pendingSessions = sessions.filter((s: any) => s.status === 'requested');

  // Map trainers to bottom sheet format
  const bottomSheetTrainers = displayedTrainers.map((t: any) => {
    // iter102ah: bottom-sheet price uses the same resolver so it agrees with
    // the cards. `price` is the dollar value for a 30-min outdoor session
    // (the canonical "from" rate).
    const cents = resolveSessionPriceCents(t, 'outdoor', 30);
    return {
      // iter102au: pass the trainer's USER ID (not the profile doc id) so the
      // detail screen's `/trainer-profiles/{userId}` lookup actually resolves.
      // Was silently navigating with a doc id → trainer-detail showed an error
      // / blank state and the user thought taps did nothing.
      id: t.userId || t.id,
      name: t.fullName || t.name || 'Trainer',
      photo: t.avatarUrl || t.profilePhoto,
      rating: t.averageRating || 0,
      reviewCount: t.reviewCount || 0,
      distance: t.distance ?? undefined,
      eta: t.distance ? `${Math.max(1, Math.round(t.distance * 3))} min` : undefined,
      price: cents !== null && cents > 0 ? Math.round(cents / 100) : undefined,
      specialty: (t.trainingStyles || [])[0],
      isAvailable: t.isAvailable,
      // iter118p (spec #4): surface paid-placement flag from backend so the
      // bottom sheet can render the neutral "Promoted" tag.
      isBoosted: !!(t.isBoosted || t.boostActive),
    };
  });

  const handleBottomSheetBook = (trainer: any) => {
    // iter118u: SIMPLIFIED — row tap in the bottom sheet goes straight to
    // the trainer's profile, same as tapping their avatar on the map.
    const trainerId = trainer.id || trainer.userId;
    router.push(`/trainee/trainer-detail?trainerId=${trainerId}`);
  };

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
        colors={['#0A0E1A', '#141929', '#FF6A00']}
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
      {/* iter118h: swapped translucent bg-battle-ropes ImageBackground for a
          solid dark surface — the ghost RR logo watermark was competing with
          the map. Removed FloatingOrangeBg mount too so the map stays the
          hero surface (Uber principle: map is context, not decoration). */}
      <View style={[styles.container, { backgroundColor: '#0A0E1A' }]}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header with custom RAPIDREPS wordmark lockup */}
          <View style={styles.header}>
            <View style={styles.headerLogo}>
              <Image source={require('../../../assets/images/rapidreps-logo.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.logoWordmarkWhite}>RAPID</Text>
                <Text style={styles.logoWordmarkOrange}>REPS</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => { haptic.light(); setMenuVisible(!menuVisible); }}
                style={styles.headerMenuBtn}
                data-testid="trainee-hamburger-menu-btn"
              >
                <Ionicons name="menu" size={24} color="#FFFFFF" />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Dropdown Menu */}
          {menuVisible && (
            <View style={{ position: 'absolute', top: 100, right: 20, backgroundColor: '#141929', borderRadius: 16, paddingVertical: 8, width: 220, zIndex: 999, shadowColor: '#FF6A00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/notifications'); }} data-testid="trainee-menu-notifications">
                <Ionicons name="notifications" size={22} color="#FF6A00" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Notifications</Text>
                {unreadCount > 0 && <View style={{ backgroundColor: '#FF3B30', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{unreadCount}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/trainee/(tabs)/profile'); }} data-testid="trainee-menu-profile">
                <Ionicons name="person-circle" size={22} color="#8a95b0" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>My Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/trainee/(tabs)/saved'); }} data-testid="trainee-menu-saved">
                <Ionicons name="heart" size={22} color="#FF3B30" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Saved Trainers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/trainee/verify-trainer'); }} data-testid="trainee-menu-verify">
                <Ionicons name="shield-checkmark" size={22} color="#00D68F" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Verify Trainer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/trainee/safety-center'); }} data-testid="trainee-menu-safety">
                <Ionicons name="shield-half" size={22} color="#FF6A00" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Safety Center</Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 18 }} />
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); handleLogout(); }} data-testid="trainee-menu-logout">
                <Ionicons name="log-out-outline" size={22} color="#FF4757" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FF4757' }}>Log Out</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
            }
          >
            {/* iter98d (Task 11): "Add Your Address" banner removed per user request.
                Address is still editable from the Profile tab (Edit Profile flow). */}

            {/* iter117: Premium hero — muscular back photo anchored right, split-color
                LET'S GET AFTER IT headline left, subtext + outlined location pill.
                iter118p (spec #1): Hero is now tap-through. Destination is context-aware:
                  - Upcoming session today  → /trainee/session-detail
                  - Active streak (>0 days) → /trainee/user-progress
                  - Neither                 → /trainee/feed
                A subtle "Tap to see →" affordance signals interactivity. */}
            {(() => {
              const todayStr = new Date().toDateString();
              const upcomingToday = (sessions || []).find((s: any) => {
                const t = s.sessionDateTimeStart || s.startTime || s.date;
                if (!t) return false;
                const d = new Date(t);
                if (isNaN(d.getTime())) return false;
                if (d.toDateString() !== todayStr) return false;
                return d.getTime() >= Date.now() - 15 * 60 * 1000; // include just-started
              });
              const hasStreak = !!(streak && streak.currentStreak > 0);
              const heroCta = upcomingToday
                ? "Today's session →"
                : hasStreak
                ? `${streak.currentStreak}-day streak →`
                : 'See the feed →';
              const onHeroPress = () => {
                haptic.light();
                if (upcomingToday) {
                  router.push({
                    pathname: '/trainee/session-detail',
                    params: { sessionId: upcomingToday.id || upcomingToday._id },
                  });
                } else if (hasStreak) {
                  router.push('/trainee/user-progress');
                } else {
                  router.push('/trainee/feed');
                }
              };
              return (
            <Animated.View
              ref={heroTourRef}
              style={[
                styles.heroBanner,
                {
                  opacity: heroAnim,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onHeroPress}
                style={styles.heroTouchable}
                data-testid="trainee-home-hero-btn"
                accessibilityRole="button"
                accessibilityLabel={heroCta}
              >
                {/* Full-bleed hero image (muscular back, right-anchored). Uses expo-image cover. */}
                <Image
                  source={require('../../../assets/images/hero-trainer-back.png')}
                  style={styles.heroBgImage}
                  resizeMode="cover"
                />
                {/* Left→right dark→transparent gradient so the headline stays legible
                    while the photo remains clearly visible on the right */}
                <LinearGradient
                  colors={['rgba(10,14,26,0.96)', 'rgba(10,14,26,0.70)', 'rgba(10,14,26,0.15)', 'rgba(10,14,26,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  locations={[0, 0.35, 0.65, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.heroContent}>
                  {/* iter118e PIXEL-LOCK: 3-line headline exactly per screenshot —
                      LET'S GET (white) / AFTER IT, (orange) / NAME! (white)
                      iter118u: emojis removed per user feedback — reads more
                      premium and matches the trainer-hero minimalism. */}
                  <Text style={styles.heroTitleWhite}>LET&apos;S GET</Text>
                  <Text style={styles.heroTitleOrange}>AFTER IT,</Text>
                  <Text
                    style={styles.heroTitleWhite}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                  >
                    {(user?.fullName?.split(' ')[0] || 'CHAMP').toUpperCase()}!
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    Your next workout is{'\n'}just one tap away
                  </Text>
                  {locationAddress ? (
                    <View style={styles.heroLocationPill}>
                      <Ionicons name="location" size={14} color="#FF6A00" />
                      <Text style={styles.heroLocationPillText} numberOfLines={1}>
                        {locationAddress}
                      </Text>
                    </View>
                  ) : null}
                  {/* iter118p (spec #1): tap affordance so the hero doesn't
                      look purely decorative. Copy adapts to trainee state. */}
                  <View style={styles.heroTapAffordance}>
                    <Text style={styles.heroTapAffordanceText} numberOfLines={1}>
                      {heroCta}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
              );
            })()}

            {/* Urgent "Need a Trainer Now" banner removed — felt cluttered (user request) */}

            {/* === 3 PREMIUM ACTION CARDS — icon-badge top-left, title, subtitle, arrow bottom-right === */}
            <View style={styles.actionCardsRow}>
              {/* Group Workouts — Orange */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => { haptic.light(); router.push('/trainee/group-sessions'); }}
                data-testid="group-workouts-btn"
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(255,106,0,0.28)', 'rgba(255,61,0,0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionCardGrad}
                >
                  <View style={[styles.actionCardBadge, { backgroundColor: 'rgba(255,106,0,0.9)' }]}>
                    <Ionicons name="people" size={18} color="#fff" />
                  </View>
                  <Text
                    style={styles.actionCardTitle}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    allowFontScaling={false}
                  >GROUP{'\n'}WORKOUTS</Text>
                  <Text style={styles.actionCardSubtitle} numberOfLines={2}>Train together{'\n'}Get stronger</Text>
                  <View style={styles.actionCardArrow}>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Community Feed — Purple */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => { haptic.light(); router.push('/trainee/feed'); }}
                data-testid="community-feed-btn"
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(108,92,231,0.35)', 'rgba(78,52,201,0.15)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionCardGrad}
                >
                  <View style={[styles.actionCardBadge, { backgroundColor: 'rgba(108,92,231,0.9)' }]}>
                    <Ionicons name="chatbubble" size={18} color="#fff" />
                  </View>
                  <Text
                    style={styles.actionCardTitle}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    allowFontScaling={false}
                  >COMMUNITY{'\n'}FEED</Text>
                  <Text style={styles.actionCardSubtitle} numberOfLines={2}>Posts, tips &{'\n'}inspiration</Text>
                  <View style={styles.actionCardArrow}>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* My Progress — Pink/Magenta */}
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/trainee/user-progress')}
                data-testid="my-progress-btn"
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(232,67,147,0.35)', 'rgba(180,40,120,0.15)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionCardGrad}
                >
                  <View style={[styles.actionCardBadge, { backgroundColor: 'rgba(232,67,147,0.9)' }]}>
                    <Ionicons name="trending-up" size={18} color="#fff" />
                  </View>
                  <Text
                    style={styles.actionCardTitle}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    allowFontScaling={false}
                  >MY{'\n'}PROGRESS</Text>
                  <Text style={styles.actionCardSubtitle} numberOfLines={2}>Track. Improve.{'\n'}Level up.</Text>
                  <View style={styles.actionCardArrow}>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* === GLOBAL TRAINER SEARCH (by name / email / phone) === */}
            <View ref={searchTourRef}>
              <PeopleSearchBar
                placeholder="Search trainers by name, email, or phone"
                emptyHint="Find any trainer nationwide — not limited to your area"
                resultBadgeLabel="TRAINER"
                testIDPrefix="trainee-trainer-search"
                enableInvite
                inviteAudience="trainer"
                onSearch={async (q) => {
                  try {
                    const data = await trainerAPI.searchTrainers({ q });
                    return (data || []) as any[];
                  } catch {
                    return [];
                  }
                }}
                onSelectResult={(p) => {
                  const id = p.userId || p.id;
                  if (id) router.push(`/trainee/trainer-detail?trainerId=${id}`);
                }}
              />
            </View>

            {/* === CONVENIENCE FEATURES === */}

            {/* Streak Banner */}
            {streak && streak.currentStreak > 0 && (
              <StreakBanner streak={streak} onPress={() => router.push('/trainee/share-streak')} />
            )}

            {/* Quick Book — Recent Trainers */}
            {recentTrainers.length > 0 && (
              <QuickBookSection
                recentTrainers={recentTrainers}
                onTrainerPress={(id) => router.push({ pathname: '/trainee/trainer-detail', params: { trainerId: id } })}
              />
            )}

            {/* iter106n: removed "Your Trainers" section — duplicated the
                Favorites list and added unnecessary vertical space. */}

            {/* iter102an: removed the orange "Swipe to Discover Trainers"
                banner per user request — it duplicated the bottom-sheet
                discovery flow and felt out of place. */}

            {/* MAP - Trainers Near You — strictly filtered by Trainer Proximity */}
            <NearbyTrainersMap
              userLocation={userLocation}
              trainers={nearbyTrainers.filter((t: any) => {
                if (travelProximity <= 0) return true;
                if (t.distance === null || t.distance === undefined) return false;
                return t.distance <= travelProximity;
              })}
              onRefresh={handleMapRefresh}
              refreshing={mapRefreshing}
            />

            {/* Available Trainers Header */}

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
                <TouchableOpacity 
                  activeOpacity={0.9}
                  onPress={() => router.push('/trainee/(tabs)/sessions')}
                >
                  <LinearGradient
                    colors={['#FDBB2D', '#F7931E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.pendingGradient}
                  >
                    <View style={styles.pendingHeader}>
                      <View style={styles.pendingIconBg}>
                        <Ionicons name="hourglass" size={22} color="#F7931E" />
                      </View>
                      <View style={styles.pendingTitleContainer}>
                        <Text style={styles.pendingTitle}>PENDING REQUESTS</Text>
                        <Text style={styles.pendingCount}>{pendingSessions.length} waiting for response</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
                    </View>
                    {pendingSessions.slice(0, 2).map((session: any, index: number) => (
                      <TouchableOpacity
                        key={session.id}
                        style={styles.pendingItem}
                        onPress={() => router.push(`/trainee/session-detail?sessionId=${session.id}`)}
                        data-testid={`pending-session-${session.id}`}
                      >
                        <View style={styles.pendingItemRow}>
                          <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.9)" />
                          <Text style={styles.pendingItemText}>
                            {new Date(session.sessionDateTimeStart).toLocaleDateString()}
                          </Text>
                          <Text style={styles.pendingItemDot}>•</Text>
                          <Text style={styles.pendingItemText}>{session.durationMinutes} min</Text>
                        </View>
                        <Text style={styles.pendingStatus}>Tap for details</Text>
                      </TouchableOpacity>
                    ))}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Available Trainers Section — iter118h: standalone Trainer Proximity
                dropdown removed. The distance filter now lives INSIDE the
                Uber-style TrainerBottomSheet (one screen, one tap principle). */}
            <View style={styles.trainersSection}>

              {/* iter117: "TOP TRAINERS NEAR YOU" horizontal ScrollView removed
                  per user request — it duplicated the trainer entry-points
                  already available via (1) the NearbyTrainersMap pins and
                  (2) the swipe-up TrainerBottomSheet. Keeping a single
                  discovery path reduces vertical noise and reclaims map
                  real-estate above the fold. */}

              {/* iter96b: "NEW TRAINERS" banner removed per user request. */}
              {/* iter102g: "ALL AVAILABLE TRAINERS" list removed.
                  Trainees discover available trainers via:
                    1. NearbyTrainersMap above (tap a pin → trainer profile)
                    2. "Swipe to Discover Trainers" CTA → /trainee/swipe-trainers
                  This eliminates the redundant feed and keeps discovery map-first. */}
            </View>

            {/* Bottom Spacer for FAB */}
            <View style={{ height: 100 }} />

            {/* iter118f: Safety Section removed from home — moved into the
                hamburger menu per user request for a cleaner home surface. */}

            <View style={{ height: 30 }} />
          </ScrollView>

          {/* Start Training button removed from floating position per design */}

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

        {/* Uber-like Trainer Bottom Sheet — iter118h persistent instant-book surface.
            iter118i: proximity chip moved OUT of the sheet into the trainee Profile tab
            (Settings section) — home stays focused on decision + action only. */}
        {bottomSheetTrainers.length > 0 && (
          <View ref={bottomSheetTourRef} collapsable={false}>
            <TrainerBottomSheet
              trainers={bottomSheetTrainers}
              onTrainerPress={handleBottomSheetBook}
              isVisible={bottomSheetTrainers.length > 0}
            />
          </View>
        )}

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
                colors={['#1a2a5e', '#F7931E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dialogGradient}
              >
                <View style={styles.dialogIconContainer}>
                  <Ionicons name="videocam" size={64} color="#FFFFFF" />
                </View>
                <Text style={styles.dialogTitle}>Don&apos;t Sweat Just Yet</Text>
                <Text style={styles.dialogMessage}>Virtual Trainers available RAPIDLY</Text>
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
                    <Text style={styles.dialogButtonTextYes}>Yes, Let&apos;s Go</Text>
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

        {/* Proximity Picker Modal */}
        <Modal visible={showProximityPicker} transparent animationType="slide">
          <TouchableOpacity
            style={styles.proximityModalOverlay}
            activeOpacity={1}
            onPress={() => setShowProximityPicker(false)}
          >
            <View style={styles.proximityPickerContainer}>
              <View style={styles.proximityPickerHeader}>
                <Text style={styles.proximityPickerTitle}>Travel Proximity</Text>
                <TouchableOpacity onPress={() => setShowProximityPicker(false)}>
                  <Ionicons name="close-circle" size={26} color="#5a6785" />
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
                <Text style={{ fontSize: 48, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 }} data-testid="proximity-value">
                  {travelProximity}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#5a6785', textAlign: 'center', marginBottom: 24 }}>
                  {travelProximity === 1 ? 'mile' : 'miles'}
                </Text>
                <Slider
                  style={{ width: '100%', height: 44 }}
                  minimumValue={1}
                  maximumValue={30}
                  step={1}
                  value={travelProximity}
                  onValueChange={(val: number) => setTravelProximity(val)}
                  minimumTrackTintColor="#FF6A00"
                  maximumTrackTintColor="#E8ECF0"
                  thumbTintColor="#FF6A00"
                  data-testid="proximity-slider"
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ fontSize: 13, color: '#5a6785', fontWeight: '600' }}>1 mi</Text>
                  <Text style={{ fontSize: 13, color: '#5a6785', fontWeight: '600' }}>30 mi</Text>
                </View>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: '#0A0E1A', borderRadius: 14, paddingVertical: 16, marginHorizontal: 20, marginBottom: 20, alignItems: 'center' }}
                onPress={() => setShowProximityPicker(false)}
                data-testid="proximity-done-btn"
              >
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Profile Preview Card */}
        <ProfilePreviewCard
          visible={showPreview}
          user={previewUser}
          onClose={() => setShowPreview(false)}
          onViewProfile={() => {
            setShowPreview(false);
            const id = previewUser?.userId || previewUser?.id;
            if (id) {
              router.push(`/trainee/trainer-detail?trainerId=${id}`);
            }
          }}
        />

        {/* iter118v — First-run coach-mark tour. Fires once per install.
            Waits until nearby trainers have loaded so the bottom-sheet
            target has a chance to lay out; skips gracefully if it hasn't. */}
        <CoachMarkTour
          tourId="trainee-home-v1"
          enabled={!showVirtualDialog && !showPreview && !showProximityPicker}
          startDelayMs={1400}
          steps={[
            {
              targetRef: heroTourRef,
              title: "Your daily launchpad",
              body: "Tap here anytime to jump to what's next — today's session, your streak, or the feed.",
              icon: 'rocket-outline',
            },
            {
              targetRef: searchTourRef,
              title: "Search any trainer, anywhere",
              body: "Look up trainers nationwide by name, email, or phone. Perfect for finding your out-of-town coach.",
              icon: 'search-outline',
            },
            {
              targetRef: bottomSheetTourRef,
              title: "Book in two taps",
              body: "Live trainers near you appear here. Tap one, pick a time, and you're set. Uber-fast bookings.",
              icon: 'flash-outline',
              cta: "Let's train",
            },
          ]}
        />
      </View>
    </>
  );
}


// Convenience feature styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  heroBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
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
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notifBadge: {
    position: 'absolute' as const,
    top: -2,
    right: -2,
    backgroundColor: Colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLogo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // iter117: bold condensed RAPID/REPS wordmark lockup
  logoWordmarkWhite: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  logoWordmarkOrange: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FF6A00',
    letterSpacing: 1,
    fontStyle: 'italic',
    textShadowColor: 'rgba(255,106,0,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  headerMenuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,106,0,0.5)',
    backgroundColor: 'rgba(10,14,26,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative' as const,
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  // Hero Banner - Premium photo-anchored redesign (iter117)
  heroBanner: {
    marginBottom: 20,
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 340,
    backgroundColor: '#0A0E1A',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.35)',
  },
  heroBgImage: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '78%',
    height: '100%',
  },
  heroFireGlow: {
    position: 'absolute',
    right: '38%',
    top: '50%',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,106,0,0.25)',
  },
  heroContent: {
    paddingVertical: 28,
    paddingHorizontal: 22,
    justifyContent: 'center',
    minHeight: 340,
    maxWidth: '62%',
  },
  heroTitleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginBottom: 10,
    maxWidth: '85%',
  },
  heroTitleWhite: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    lineHeight: 34,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroTitleOrange: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FF6A00',
    letterSpacing: 0.3,
    lineHeight: 34,
    fontStyle: 'italic',
    textShadowColor: 'rgba(255,106,0,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 16,
    maxWidth: '100%',
  },
  heroLocationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.4)',
    backgroundColor: 'rgba(10,14,26,0.6)',
    maxWidth: '75%',
  },
  heroLocationPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  // iter118p (spec #1): full-hero touch target + tap affordance chip.
  heroTouchable: {
    flex: 1,
    minHeight: 340,
    borderRadius: 22,
    overflow: 'hidden',
  },
  heroTapAffordance: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,106,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.55)',
  },
  heroTapAffordanceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFB673',
    letterSpacing: 0.6,
  },
  // Legacy hero styles kept for any orphan references
  heroGradient: { paddingVertical: 22, paddingHorizontal: 20 },
  heroGlow: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,106,0,0.12)' },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLocationText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

  // 3 Premium Action Cards (iter117)
  actionCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  actionCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 180,
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionCardGrad: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 180,
  },
  actionCardBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    lineHeight: 16,
    marginBottom: 6,
    flexShrink: 1,
  },
  actionCardSubtitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 13,
    flex: 1,
    flexShrink: 1,
  },
  actionCardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  // Legacy feature-action styles kept for any orphan references
  featureActionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  featureAction: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  featureActionGrad: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 6 },
  featureActionText: { fontSize: 13, fontWeight: '700', color: '#fff', textAlign: 'center', lineHeight: 14 },
  urgentBannerContainer: {
    marginBottom: 14,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  urgentIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  // Map Banner - Polished with shadow and spacing
  mapBannerContainer: {
    marginBottom: 14,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  mapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  mapIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(31, 184, 180, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapBannerContent: {
    flex: 1,
  },
  mapBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  mapBannerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  // Search Card - Polished with border
  searchCard: {
    marginBottom: 18,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  searchCardGradient: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(20, 25, 41, 0.15)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
    alignItems: 'center',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    flex: 1,
  },
  sortDropdown: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sortOptionActive: {
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  sortOptionTextActive: {
    color: '#FFFFFF',
  },
  // Pending Card - Polished with border and more padding
  pendingCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#F7931E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.15)',
  },
  pendingGradient: {
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  pendingIconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#141929',
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
  // Trainers Section - Improved spacing
  trainersSection: {
    marginTop: 12,
  },
  // Proximity Dropdown
  proximityContainer: {
    marginBottom: 14,
    zIndex: 100,
  },
  proximityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  proximityLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    flex: 1,
  },
  proximityValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: 'rgba(247,147,30,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  proximityDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  proximityDropdownText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2a3a6e',
  },
  proximityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  proximityPickerContainer: {
    backgroundColor: '#141929',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 400,
  },
  proximityPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  proximityPickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proximityPickerList: {
    maxHeight: 350,
  },
  proximityPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  proximityPickerItemSelected: {
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
  },
  proximityPickerItemText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  proximityPickerItemTextSelected: {
    fontWeight: '700',
    color: '#FF6A00',
  },
  proximityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  proximityOptionActive: {
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
  },
  proximityOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  proximityOptionTextActive: {
    color: '#FF6A00',
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5a6785',
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
  // Trainer Card - Polished with consistent border radius
  trainerCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
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
    backgroundColor: '#141929',
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  trainerBio: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
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
    backgroundColor: '#141929',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  virtualTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  styleTag: {
    backgroundColor: 'rgba(255,106,0,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.12)',
  },
  styleTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  moreTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5a6785',
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
    bottom: 32,
    right: 20,
    left: 20,
    marginTop: 16,
  },
  fab: {
    borderRadius: 20,
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
    backgroundColor: '#141929',
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
    color: '#FFFFFF',
  },
  dialogCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  // Nearby Trainers Section
  nearbySection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#141929',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nearbySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  nearbySectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nearbySectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 214, 143, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D68F',
  },
  liveTextSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00D68F',
  },
  nearbySectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trainerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  trainerCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearbyTrainersScroll: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
  },
  nearbyTrainerCard: {
    width: 130,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginRight: 12,
  },
  nearbyTrainerAvatar: {
    position: 'relative',
    marginBottom: 10,
  },
  nearbyAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#1a2a5e',
  },
  nearbyAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a2a5e',
  },
  nearbyAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00D68F',
    borderWidth: 2,
    borderColor: 'rgba(20, 25, 41, 0.95)',
  },
  nearbyTrainerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  nearbyTrainerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nearbyRating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFB347',
    marginLeft: 3,
  },
  nearbyDistance: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  nearbyPriceTag: {
    backgroundColor: 'rgba(255, 106, 0, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  nearbyPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noTrainersNearby: {
    alignItems: 'center',
    padding: 24,
  },
  noTrainersText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  noTrainersSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  safetySection: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: -70,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  safetySectionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    backgroundColor: '#141929',
  },
  safetySectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,106,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetySectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  safetySectionSub: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
});

// iter98d (Task 6): Swipe-Discover CTA styles
const swipeCtaStyles = StyleSheet.create({
  cta: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 0.2 },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1, fontWeight: '500' },
});

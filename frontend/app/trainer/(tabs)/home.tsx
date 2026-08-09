import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Image,
  ImageBackground,
  Animated,
  Dimensions,
  AppState,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../src/contexts/AuthContext';
import { trainerAPI } from '../../../src/services/api';
import api from '../../../src/services/api';
import TierCelebrationSheet from '../../../src/components/TierCelebrationSheet';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { Session, SessionStatus } from '../../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import { useAlert } from '../../../src/contexts/AlertContext';
import { useNotifications } from '../../../src/contexts/NotificationContext';
import { toast } from '../../../src/utils/toast';
import { haptic } from '../../../src/utils/haptics';
import PeopleSearchBar from '../../../src/components/PeopleSearchBar';
import { DS } from '../../../src/theme/designSystem';
import FloatingOrangeBg from '../../../src/components/FloatingOrangeBg';
import { swrCache } from '../../../src/hooks/useStaleWhileRefresh';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

// Brand colors — iter95d: sourced from unified DS tokens
const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  orange: DS.colors.orange,
  orangeHot: DS.colors.orangeDeep,
  orangeLight: DS.colors.orangeGlow,
  orangeGlow: DS.colors.orangeEmber,
  yellow: '#FDBB2D',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: DS.colors.textPrimary,
  offWhite: '#FAFBFC',
  gray: DS.colors.textSecondary,
  grayLight: DS.colors.borderStrong,
  success: DS.colors.success,
  successDark: '#00A844',
  error: DS.colors.error,
};

// Location update interval in ms (30 seconds)
const LOCATION_UPDATE_INTERVAL = 30000;

// Background image
const heroBackground = require('../../../assets/images/bg-battle-ropes.jpg');

export default function TrainerHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { unreadCount } = useNotifications();
  // iter106b: hydrate trainer dashboard from in-memory cache so re-entering
  // the Home tab paints instantly instead of showing the "Loading your
  // dashboard…" full-screen spinner on every navigation back.
  const _cachedSessions = swrCache.get<Session[]>('trainer:dashboard:sessions');
  const _cachedEarnings = swrCache.get<any>('trainer:dashboard:earnings');
  const _cachedProfile = swrCache.get<any>('trainer:dashboard:profile');
  const _hasCache = !!(_cachedSessions || _cachedEarnings || _cachedProfile);
  const [loading, setLoading] = useState(!_hasCache);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(_cachedSessions || []);
  const [earnings, setEarnings] = useState<any>(_cachedEarnings || null);
  const [isAvailable, setIsAvailable] = useState(_cachedProfile?.isAvailable ?? false);
  const [nearbyTrainees, setNearbyTrainees] = useState<any[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [trainerProfile, setTrainerProfile] = useState<any>(_cachedProfile || null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  // Stripe payout banner — replaces legacy Zelle setup gate
  const [needsPayoutSetup, setNeedsPayoutSetup] = useState(false);
  // Tier celebration (iter95c) — one-shot on first launch after admin assigns tier
  const [tierCelebration, setTierCelebration] = useState<null | { tier: string; tierLabel: string; takeHomePct: number }>(null);
  // One-time post-approval celebratory modal — fires when canGoLive becomes true and never been shown
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const APPROVAL_SEEN_KEY = '@rapidreps_trainer_approval_modal_seen';
  // iter118b: Trainer home redesign — tier/reviews for stat cards + earnings period picker
  const [onboardingStatus, setOnboardingStatus] = useState<any>(null);
  const [earningsPeriod, setEarningsPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [periodMenuVisible, setPeriodMenuVisible] = useState(false);

  // Location tracking interval ref
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animation refs
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statusCardAnim = useRef(new Animated.Value(0)).current;
  const earningsAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(10)].map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Poll for new session requests periodically
  useEffect(() => {
    // Poll every 15 seconds for new requests when trainer is available
    const pollInterval = setInterval(() => {
      if (isAvailable) {
        trainerAPI.getSessions().then((newSessions) => {
          // Check for new requests
          const currentRequests = sessions.filter(s => s.status === 'requested');
          const newRequests = newSessions.filter((s: any) => s.status === 'requested');
          
          // If there are more requests than before, show a notification
          if (newRequests.length > currentRequests.length) {
            toast.info(`New session request received!`);
            haptic.notification('success');
          }
          
          setSessions(newSessions);
        }).catch(() => {});
      }
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [isAvailable, sessions]);

  useEffect(() => {
    loadData();
    checkLocationPermission();
    // Check trainer approval state — one-time celebratory modal if just approved
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(APPROVAL_SEEN_KEY);
        if (seen === '1') return;
        const status = await trainerAPI.getVerificationStatus();
        if (status?.canGoLive) {
          setShowApprovalModal(true);
        }
      } catch { /* silent */ }
    })();
    
    // Cleanup on unmount
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && isAvailable) {
        // Stop location updates when app goes to background (Option A - foreground only)
        if (locationIntervalRef.current) {
          clearInterval(locationIntervalRef.current);
          locationIntervalRef.current = null;
        }
      } else if (nextAppState === 'active') {
        // Refresh data when app comes back to foreground
        loadData();
        
        // Resume location updates if available
        if (isAvailable) {
          startLocationTracking();
        }
      }
    });

    return () => {
      try { subscription?.remove(); } catch (e) { /* cleanup */ }
    };
  }, [isAvailable]);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    return status === 'granted';
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  const updateLocationOnServer = async (lat: number, lng: number) => {
    try {
      await trainerAPI.updateLocation(lat, lng);
      setCurrentLocation({ latitude: lat, longitude: lng });
    } catch (error) {
      console.error('Error updating location on server:', error);
    }
  };

  const startLocationTracking = async () => {
    // Get initial location
    const location = await getCurrentLocation();
    if (location) {
      await updateLocationOnServer(location.latitude, location.longitude);
    }

    // Clear any existing interval
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }

    // Start periodic updates
    locationIntervalRef.current = setInterval(async () => {
      const newLocation = await getCurrentLocation();
      if (newLocation) {
        await updateLocationOnServer(newLocation.latitude, newLocation.longitude);
      }
    }, LOCATION_UPDATE_INTERVAL);
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  // Start animations when loading completes
  useEffect(() => {
    if (!loading) {
      // Hero animation
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Status card
      setTimeout(() => {
        Animated.spring(statusCardAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 150);

      // Earnings card
      setTimeout(() => {
        Animated.spring(earningsAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 300);

      // Staggered cards
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

      // Pulse animation for status — dramatic pulsing glow
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.85,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [loading]);

  const loadData = async () => {
    try {
      const [sessionsData, earningsData, traineesData, profileData, locationStatus, onboardData] = await Promise.all([
        trainerAPI.getSessions(),
        trainerAPI.getEarnings(),
        trainerAPI.getNearbyTrainees(),
        trainerAPI.getMyProfile().catch(() => null),
        trainerAPI.getLocationStatus().catch(() => null),
        trainerAPI.getOnboardingStatus().catch(() => null),
      ]);
      setSessions(sessionsData);
      setEarnings(earningsData);
      setNearbyTrainees(traineesData.trainees || []);
      setOnboardingStatus(onboardData);
      // iter106b: persist to cache so next mount of this screen paints
      // instantly. Reads pick up `_cachedSessions` / `_cachedEarnings` above.
      swrCache.set('trainer:dashboard:sessions', sessionsData);
      swrCache.set('trainer:dashboard:earnings', earningsData);

      if (profileData) {
        setTrainerProfile(profileData);
        swrCache.set('trainer:dashboard:profile', profileData);
        const available = profileData.isAvailable ?? false;
        setIsAvailable(available);
        
        // If trainer was already available, resume location tracking
        if (available && locationPermission) {
          startLocationTracking();
        }
      }
      
      if (locationStatus) {
        if (locationStatus.latitude && locationStatus.longitude) {
          setCurrentLocation({
            latitude: locationStatus.latitude,
            longitude: locationStatus.longitude,
          });
        }
      }
      
      // Stripe payout banner — show until trainer-side payout is configured
      // (legacy Zelle endpoint stays available for back-compat; we just gate the banner on it for now)
      try {
        const zelleInfo = await trainerAPI.getZelleInfo();
        setNeedsPayoutSetup(!zelleInfo.hasZelleInfo);
      } catch { setNeedsPayoutSetup(true); }

      // Tier celebration — fire-and-forget; show once if admin recently assigned a tier.
      try {
        const { data: cel } = await api.get('/trainer/tier-celebration');
        if (cel?.shouldShow) {
          setTierCelebration({
            tier: cel.tier,
            tierLabel: cel.tierLabel,
            takeHomePct: cel.takeHomePct,
          });
        }
      } catch { /* non-blocking */ }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleAvailability = async (value: boolean) => {
    setAvailabilityLoading(true);
    try {
      // If turning ON availability, need location permission
      if (value) {
        let hasPermission = locationPermission;
        
        if (!hasPermission) {
          hasPermission = await requestLocationPermission();
        }
        
        if (!hasPermission) {
          showAlert({
            type: 'warning',
            title: 'Location Required',
            message: 'To go online and be visible to clients, please enable location access.',
          });
          setAvailabilityLoading(false);
          return;
        }
        
        // Get current location
        const location = await getCurrentLocation();
        if (!location) {
          showAlert({
            type: 'error',
            title: 'Location Error',
            message: 'Could not get your location. Please try again.',
          });
          setAvailabilityLoading(false);
          return;
        }
        
        // Update availability with location
        await trainerAPI.updateAvailability(true, location.latitude, location.longitude);
        setIsAvailable(true);
        setCurrentLocation(location);
        
        // Start location tracking
        startLocationTracking();
      } else {
        // Turning OFF availability
        await trainerAPI.updateAvailability(false);
        setIsAvailable(false);
        
        // Stop location tracking
        stopLocationTracking();
      }
    } catch (error: any) {
      console.error('Error toggling availability:', error);
      const apiMsg = error?.response?.data?.detail;
      showAlert({
        type: 'error',
        title: 'Location Required',
        message: apiMsg || 'Could not update your availability. Please try again.',
      });
      // iter102e: never leave the UI in an "Available" state if the server
      // rejected the toggle — keep it visibly OFF until live GPS is granted.
      setIsAvailable(false);
      stopLocationTracking();
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleAccept = async (sessionId: string) => {
    try {
      await trainerAPI.acceptSession(sessionId);
      loadData();
    } catch (error) {
      console.error('Error accepting session:', error);
    }
  };

  const handleDecline = async (sessionId: string) => {
    showAlert({
      title: 'Decline Session Request?',
      message: 'Are you sure you want to decline this session request? The trainee will be notified.',
      type: 'warning',
      buttons: [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await trainerAPI.declineSession(sessionId);
              loadData();
              showAlert({
                title: 'Session Declined',
                message: 'The session request has been declined.',
                type: 'info',
              });
            } catch (error) {
              console.error('Error declining session:', error);
              showAlert({
                title: 'Error',
                message: 'Could not decline the session. Please try again.',
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const pendingSessions = sessions.filter(s => s.status === SessionStatus.REQUESTED);
  const upcomingSessions = sessions.filter(s => s.status === SessionStatus.CONFIRMED);

  const heroTranslateY = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 0],
  });

  const statusTranslateY = statusCardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  const earningsTranslateY = earningsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.orangeHot, COLORS.orange, COLORS.orangeLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </LinearGradient>
    );
  }

  return (
    <>
      {/* Tier celebration sheet — fires once when admin assigns the trainer a tier */}
      {tierCelebration && (
        <TierCelebrationSheet
          visible
          tier={tierCelebration.tier}
          tierLabel={tierCelebration.tierLabel}
          takeHomePct={tierCelebration.takeHomePct}
          onClose={() => setTierCelebration(null)}
        />
      )}
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground 
        source={heroBackground} 
        style={styles.container}
        resizeMode="cover"
      >
        {/* Premium dark overlay */}
        <LinearGradient
          colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FloatingOrangeBg />
          {/* iter118b: Header — RAPIDREPS wordmark lockup (barbell logo + condensed text) with bell + hamburger on the right */}
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
                onPress={() => { haptic.light(); router.push('/notifications'); }}
                style={styles.headerBellBtn}
                data-testid="trainer-notifications-bell-btn"
              >
                <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => { haptic.light(); setMenuVisible(!menuVisible); }} 
                style={styles.headerMenuBtn}
                data-testid="hamburger-menu-btn"
              >
                <Ionicons name="menu" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dropdown Menu */}
          {menuVisible && (
            <View style={{ position: 'absolute', top: 100, right: 20, backgroundColor: '#141929', borderRadius: 16, paddingVertical: 8, width: 220, zIndex: 999, shadowColor: '#FF6A00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/notifications'); }} data-testid="menu-notifications">
                <Ionicons name="notifications" size={22} color="#FF6A00" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Notifications</Text>
                {unreadCount > 0 && <View style={{ backgroundColor: COLORS.error, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{unreadCount}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/messages'); }} data-testid="menu-messages">
                <Ionicons name="chatbubbles" size={22} color="#8a95b0" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Messages</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/trainer/achievements'); }} data-testid="menu-achievements">
                <Ionicons name="trophy" size={22} color={COLORS.yellow} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Achievements</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); router.push('/trainer/badge'); }} data-testid="menu-badge">
                <Ionicons name="shield-checkmark" size={22} color="#00D68F" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>My Badge</Text>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 18 }} />
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 14 }} onPress={() => { setMenuVisible(false); handleLogout(); }} data-testid="menu-logout">
                <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.error }}>Log Out</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />
            }
          >
            {/* iter96b: Stripe Payouts Setup Banner removed per user request.
                Onboarding to Stripe is now reachable via Earnings tab. */}

            {/* iter118b: Trainer home redesign matching the user's mock.
                Section 1 — HERO: right-anchored photo, orange "WELCOME BACK,",
                huge "LET'S TRAIN, [NAME]!" split-color headline. */}
            <Animated.View
              style={[
                styles.heroBanner,
                {
                  opacity: heroAnim,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
            >
              <Image
                source={require('../../../assets/images/hero-trainer-back.png')}
                style={styles.heroBgImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(10,14,26,0.96)', 'rgba(10,14,26,0.70)', 'rgba(10,14,26,0.15)', 'rgba(10,14,26,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                locations={[0, 0.35, 0.65, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.heroContent}>
                <Text style={styles.heroEyebrow}>WELCOME BACK,</Text>
                <Text style={styles.heroTitleWhite}>LET&apos;S TRAIN,</Text>
                <Text
                  style={styles.heroTitleOrange}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >{(user?.fullName?.split(' ')[0] || 'TRAINER').toUpperCase()}!</Text>
                <Text style={styles.heroSubtitle}>Your training empire awaits 💪🔥</Text>
              </View>
            </Animated.View>

            {/* Section 2 — ONLINE & AVAILABLE toggle card */}
            <Animated.View
              style={[
                styles.onlineCard,
                {
                  opacity: statusCardAnim,
                  transform: [{ translateY: statusTranslateY }],
                },
              ]}
            >
              <View style={[styles.onlineDot, { backgroundColor: isAvailable ? COLORS.success : '#8a95b0' }]} />
              <View style={styles.onlineContent}>
                <Text style={[styles.onlineTitle, { color: isAvailable ? COLORS.success : COLORS.white }]}>
                  {isAvailable ? 'ONLINE & AVAILABLE' : 'OFFLINE'}
                </Text>
                <Text style={styles.onlineSubtitle}>
                  {isAvailable ? 'Trainees can find and book you' : 'Toggle on to accept new clients'}
                </Text>
              </View>
              {availabilityLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Switch
                  value={isAvailable}
                  onValueChange={handleToggleAvailability}
                  trackColor={{ false: 'rgba(255,255,255,0.18)', true: COLORS.success }}
                  thumbColor={'#FFFFFF'}
                  ios_backgroundColor="rgba(255,255,255,0.18)"
                  data-testid="availability-toggle"
                />
              )}
            </Animated.View>

            {/* Section 3 — 4 stat cards row */}
            <View style={styles.statCardsRow}>
              {(() => {
                const today = new Date();
                const isSameDay = (d: Date) => d.toDateString() === today.toDateString();
                const todaysSessions = sessions.filter((s) => {
                  try { return isSameDay(new Date(s.sessionDateTimeStart)); } catch { return false; }
                });
                const nextToday = todaysSessions
                  .filter((s: any) => s.status === 'confirmed' || s.status === 'in_progress')
                  .sort((a: any, b: any) => new Date(a.sessionDateTimeStart).getTime() - new Date(b.sessionDateTimeStart).getTime())[0];
                const nextLabel = nextToday
                  ? `Next: ${new Date((nextToday as any).sessionDateTimeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : todaysSessions.length > 0 ? `${todaysSessions.length} today` : 'No sessions today';
                const rating = onboardingStatus?.averageRating ?? trainerProfile?.averageRating ?? 0;
                const reviews = onboardingStatus?.totalReviews ?? 0;
                const tier = (onboardingStatus?.trainerTier || 'Rising').toString();
                const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
                const tierPct: Record<string, string> = { Elite: 'Top 10%', Pro: 'Top 25%', Rising: 'Growing', Newbie: 'Just starting' };
                return (
                  <>
                    <TouchableOpacity
                      style={styles.statCard}
                      onPress={() => router.push('/trainer/(tabs)/sessions')}
                      activeOpacity={0.85}
                      data-testid="stat-todays-sessions"
                    >
                      <View style={[styles.statBadge, { borderColor: 'rgba(255,106,0,0.5)' }]}>
                        <Ionicons name="calendar" size={16} color={COLORS.orange} />
                      </View>
                      <Text style={styles.statLabel}>TODAY&apos;S SESSIONS</Text>
                      <Text style={styles.statValue}>{todaysSessions.length}</Text>
                      <Text style={styles.statSub} numberOfLines={1}>{nextLabel}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.statCard}
                      onPress={() => router.push('/trainer/discover-trainees')}
                      activeOpacity={0.85}
                      data-testid="stat-nearby-trainees"
                    >
                      <View style={[styles.statBadge, { borderColor: 'rgba(108,92,231,0.6)' }]}>
                        <Ionicons name="location" size={16} color={'#6C5CE7'} />
                      </View>
                      <Text style={styles.statLabel}>NEARBY TRAINEES</Text>
                      <Text style={styles.statValue}>{nearbyTrainees.length}</Text>
                      <Text style={styles.statSub}>Within 5 miles</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.statCard}
                      onPress={() => router.push('/trainer/(tabs)/profile')}
                      activeOpacity={0.85}
                      data-testid="stat-rating"
                    >
                      <View style={[styles.statBadge, { borderColor: 'rgba(59,130,246,0.6)' }]}>
                        <Ionicons name="star" size={16} color={'#3B82F6'} />
                      </View>
                      <Text style={styles.statLabel}>RATING</Text>
                      <View style={styles.ratingRow}>
                        <Text style={styles.statValue}>{rating > 0 ? rating.toFixed(1) : '—'}</Text>
                        {rating > 0 && <Ionicons name="star" size={16} color={COLORS.yellow} style={{ marginLeft: 4, marginBottom: 4 }} />}
                      </View>
                      <Text style={styles.statSub} numberOfLines={1}>({reviews} review{reviews === 1 ? '' : 's'})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.statCard}
                      onPress={() => router.push('/trainer/achievements')}
                      activeOpacity={0.85}
                      data-testid="stat-level"
                    >
                      <View style={[styles.statBadge, { borderColor: 'rgba(232,67,147,0.6)' }]}>
                        <Ionicons name="trending-up" size={16} color={'#E84393'} />
                      </View>
                      <Text style={styles.statLabel}>LEVEL</Text>
                      <Text style={[styles.statValue, { color: '#E84393', fontSize: 20 }]} numberOfLines={1}>{tierLabel}</Text>
                      <Text style={styles.statSub} numberOfLines={1}>{tierPct[tierLabel] || 'Growing'}</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>

            {/* Section 4 — Total Earnings card with sparkline + period tabs */}
            {earnings && (
              <Animated.View
                style={[
                  styles.earningsCardV2,
                  {
                    opacity: earningsAnim,
                    transform: [{ translateY: earningsTranslateY }],
                  },
                ]}
              >
                <View style={styles.earningsHeaderV2}>
                  <View style={styles.earningsHeaderLeft}>
                    <View style={styles.earningsWalletBadge}>
                      <Ionicons name="wallet" size={18} color={COLORS.orange} />
                    </View>
                    <Text style={styles.earningsLabelV2}>TOTAL EARNINGS</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.periodPill}
                    onPress={() => setPeriodMenuVisible(!periodMenuVisible)}
                    data-testid="earnings-period-btn"
                    activeOpacity={0.8}
                  >
                    <Text style={styles.periodPillText}>
                      {earningsPeriod === 'week' ? 'This Week' : earningsPeriod === 'month' ? 'This Month' : 'All Time'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
                {periodMenuVisible && (
                  <View style={styles.periodMenu}>
                    {(['week', 'month', 'all'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={styles.periodMenuItem}
                        onPress={() => { setEarningsPeriod(p); setPeriodMenuVisible(false); }}
                        data-testid={`earnings-period-${p}`}
                      >
                        <Text style={styles.periodMenuText}>
                          {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={styles.earningsAmountV2}>
                  ${(((earningsPeriod === 'week' ? earnings.weekEarningsCents : earningsPeriod === 'month' ? earnings.monthEarningsCents : earnings.totalEarningsCents) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                {/* Sparkline trend chart */}
                {(() => {
                  const breakdown = (earnings.weeklyBreakdown || []) as any[];
                  const series = breakdown.length > 0
                    ? breakdown.slice(-12).map((w: any) => (w.earnings || 0) / 100)
                    : [1, 1.4, 2.1, 1.8, 2.6, 3.2, 3.0, 3.9, 4.4, 5.1, 6.3, 7.2];
                  const chartW = width - 40 - 32; // screen padding + card padding
                  const chartH = 70;
                  const maxV = Math.max(...series, 1);
                  const minV = Math.min(...series);
                  const range = Math.max(maxV - minV, 1);
                  const pts = series.map((v, i) => {
                    const x = (i / Math.max(series.length - 1, 1)) * chartW;
                    const y = chartH - ((v - minV) / range) * (chartH - 8) - 4;
                    return { x, y };
                  });
                  // Build smooth cubic path
                  let d = `M ${pts[0].x} ${pts[0].y}`;
                  for (let i = 1; i < pts.length; i++) {
                    const prev = pts[i - 1];
                    const cur = pts[i];
                    const cx = (prev.x + cur.x) / 2;
                    d += ` Q ${cx} ${prev.y} ${cx} ${(prev.y + cur.y) / 2} T ${cur.x} ${cur.y}`;
                  }
                  const last = pts[pts.length - 1];
                  return (
                    <Svg width={chartW} height={chartH} style={{ marginTop: 8, marginBottom: 4 }}>
                      <Defs>
                        <SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0" stopColor="#FF6A00" stopOpacity="0.35" />
                          <Stop offset="1" stopColor="#FF6A00" stopOpacity="1" />
                        </SvgLinearGradient>
                      </Defs>
                      <Path d={d} stroke="url(#lineGrad)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={last.x} cy={last.y} r={4.5} fill="#FF6A00" />
                    </Svg>
                  );
                })()}
                {/* Bottom 3-column breakdown */}
                <View style={styles.earningsBreakdownV2}>
                  {(() => {
                    const wPct = earnings.lastWeekEarningsCents > 0
                      ? Math.round(((earnings.weekEarningsCents - earnings.lastWeekEarningsCents) / earnings.lastWeekEarningsCents) * 100)
                      : null;
                    const mPct = earnings.lastMonthEarningsCents > 0
                      ? Math.round(((earnings.monthEarningsCents - earnings.lastMonthEarningsCents) / earnings.lastMonthEarningsCents) * 100)
                      : null;
                    const pctText = (pct: number | null, label: string) => {
                      if (pct === null) return <Text style={styles.earnPctNeutral}>{label}</Text>;
                      const up = pct >= 0;
                      return (
                        <View style={styles.earnPctRow}>
                          <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={up ? COLORS.success : COLORS.error} />
                          <Text style={[styles.earnPctText, { color: up ? COLORS.success : COLORS.error }]}>{Math.abs(pct)}%</Text>
                          <Text style={styles.earnPctSub}> {label}</Text>
                        </View>
                      );
                    };
                    return (
                      <>
                        <View style={styles.earnCol}>
                          <Text style={styles.earnColLabel}>THIS WEEK</Text>
                          <Text style={styles.earnColValue}>${(earnings.weekEarningsCents / 100).toFixed(2)}</Text>
                          {pctText(wPct, 'vs last week')}
                        </View>
                        <View style={styles.earnCol}>
                          <Text style={styles.earnColLabel}>THIS MONTH</Text>
                          <Text style={styles.earnColValue}>${(earnings.monthEarningsCents / 100).toFixed(2)}</Text>
                          {pctText(mPct, 'vs last month')}
                        </View>
                        <View style={styles.earnCol}>
                          <Text style={styles.earnColLabel}>ALL TIME</Text>
                          <Text style={styles.earnColValue}>${(earnings.totalEarningsCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                          <Text style={styles.earnPctNeutral}>Total Earnings</Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              </Animated.View>
            )}

            {/* Section 5 — Visible to nearby trainees banner (only when online with location) */}
            {isAvailable && (
              <TouchableOpacity
                style={styles.visibleBanner}
                activeOpacity={0.9}
                onPress={() => router.push('/trainer/edit-profile')}
                data-testid="visible-banner"
              >
                <View style={styles.visibleIcon}>
                  <Ionicons name="radio" size={18} color={COLORS.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visibleTitle}>Visible to nearby trainees</Text>
                  <Text style={styles.visibleSub} numberOfLines={2}>
                    You are visible in {trainerProfile?.locationAddress || 'your area'} and surrounding areas
                  </Text>
                </View>
                <View style={styles.manageBtn} data-testid="visible-banner-manage-btn">
                  <Text style={styles.manageBtnText}>Manage</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Section 6 — 2x2 grid of primary actions */}
            <View style={styles.actionGridRow}>
              <TouchableOpacity
                style={styles.actionTile}
                onPress={() => router.push('/trainer/edit-profile')}
                activeOpacity={0.85}
                data-testid="action-edit-profile"
              >
                <View style={[styles.actionTileIcon, { backgroundColor: 'rgba(255,106,0,0.15)' }]}>
                  <Ionicons name="person" size={26} color={COLORS.orange} />
                </View>
                <Text style={styles.actionTileTitle}>Edit Profile</Text>
                <Text style={styles.actionTileSub}>Update your info</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionTile}
                onPress={() => router.push('/trainer/verification')}
                activeOpacity={0.85}
                data-testid="action-verification"
              >
                <View style={[styles.actionTileIcon, { backgroundColor: 'rgba(108,92,231,0.18)' }]}>
                  <Ionicons name="shield-checkmark" size={26} color={'#A29BFE'} />
                  {(trainerProfile?.isVerified === true || (trainerProfile as any)?.verificationStatus === 'verified') && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.actionTileTitle}>Verification</Text>
                <Text style={styles.actionTileSub}>
                  {(trainerProfile?.isVerified === true || (trainerProfile as any)?.verificationStatus === 'verified') ? 'Verified Trainer' : 'Get verified'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionGridRow}>
              {(trainerProfile?.isVerified === true || (trainerProfile as any)?.verificationStatus === 'verified') ? (
                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => router.push('/trainer/set-rates')}
                  activeOpacity={0.85}
                  data-testid="action-set-rates"
                >
                  <View style={[styles.actionTileIcon, { backgroundColor: 'rgba(59,130,246,0.18)' }]}>
                    <Ionicons name="cash" size={26} color={'#3B82F6'} />
                  </View>
                  <Text style={styles.actionTileTitle}>Set Rates</Text>
                  <Text style={styles.actionTileSub}>Manage pricing</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => router.push('/trainer/verification')}
                  activeOpacity={0.85}
                  data-testid="action-set-rates-locked"
                >
                  <View style={[styles.actionTileIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons name="lock-closed" size={24} color={'rgba(255,255,255,0.5)'} />
                  </View>
                  <Text style={[styles.actionTileTitle, { color: 'rgba(255,255,255,0.6)' }]}>Set Rates</Text>
                  <Text style={styles.actionTileSub}>Verify first</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionTile}
                onPress={() => router.push('/trainer/(tabs)/profile')}
                activeOpacity={0.85}
                data-testid="action-settings"
              >
                <View style={[styles.actionTileIcon, { backgroundColor: 'rgba(255,71,87,0.18)' }]}>
                  <Ionicons name="settings" size={26} color={'#FF4757'} />
                </View>
                <Text style={styles.actionTileTitle}>Settings</Text>
                <Text style={styles.actionTileSub}>App preferences</Text>
              </TouchableOpacity>
            </View>

            {/* === GLOBAL TRAINEE SEARCH (by name / email / phone) === */}
            <PeopleSearchBar
              placeholder="Search trainees by name, email, or phone"
              emptyHint="Reach any trainee nationwide — not limited to nearby"
              resultBadgeLabel="TRAINEE"
              testIDPrefix="trainer-trainee-search"
              enableInvite
              inviteAudience="trainee"
              onSearch={async (q) => {
                try {
                  const data = await trainerAPI.searchTrainees(q);
                  return (data?.trainees || []) as any[];
                } catch {
                  return [];
                }
              }}
              onSelectResult={(p) => {
                const id = p.userId || p.id;
                if (id) router.push(`/trainer/trainee-profile?traineeId=${id}`);
              }}
            />

            {/* Pending Requests Section */}
            {pendingSessions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>⚡ PENDING REQUESTS</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{pendingSessions.length}</Text>
                  </View>
                </View>
                {pendingSessions.map((session, index) => (
                  <Animated.View
                    key={session.id}
                    style={[
                      styles.sessionCard,
                      {
                        opacity: cardAnims[index] || 1,
                        transform: [{
                          translateY: (cardAnims[index] || new Animated.Value(1)).interpolate({
                            inputRange: [0, 1],
                            outputRange: [30, 0],
                          }),
                        }],
                      },
                    ]}
                  >
                    <TouchableOpacity 
                      activeOpacity={0.9}
                      onPress={() => router.push({
                        pathname: '/trainer/trainee-profile',
                        params: {
                          sessionId: session.id,
                          traineeId: session.traineeId,
                          traineeName: session.traineeName || 'Trainee',
                          traineePhoto: session.traineePhoto || '',
                          sessionDetails: JSON.stringify(session),
                        }
                      })}
                    >
                      <LinearGradient
                        colors={['#141929', '#1A2035']}
                        style={styles.sessionCardGradient}
                      >
                        <View style={styles.sessionHeader}>
                          <View style={styles.traineeRow}>
                            {/* iter106ar completion: unified avatar disc for
                                the session-card trainee thumbnail. */}
                            <UserAvatar
                              size={40}
                              style={styles.traineeAvatar as any}
                              user={{
                                avatarUrl: session.traineePhoto,
                                fullName: session.traineeName,
                              }}
                            />
                            <View style={styles.traineeInfo}>
                              <Text style={styles.traineeName}>{session.traineeName || 'New Client'}</Text>
                              <Text style={styles.sessionDateTime}>
                                {/* iter106f: prefer trainee's literal display strings — eliminates
                                    the timezone-drift bug where a trainer device in a different TZ
                                    rendered the UTC timestamp as a wrong wall-clock time. Falls
                                    back to UTC→local rendering for legacy sessions without strings. */}
                                {session.traineeLocalDate || new Date(session.sessionDateTimeStart).toLocaleDateString()} • {session.traineeLocalTime || new Date(session.sessionDateTimeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>PENDING</Text>
                          </View>
                        </View>

                        <View style={styles.sessionStats}>
                          <View style={styles.sessionStat}>
                            <Ionicons name="time" size={16} color={COLORS.gray} />
                            <Text style={styles.sessionStatText}>{session.durationMinutes} min</Text>
                          </View>
                          <View style={styles.sessionStat}>
                            <Ionicons name="location" size={16} color={COLORS.gray} />
                            {/* iter102an: outdoor + in-home both surface as "In-Person" — they're the
                                same offer from the trainer's perspective. Virtual stays distinct. */}
                            <Text style={styles.sessionStatText}>
                              {session.locationType === 'virtual' ? 'Virtual' : 'In-Person'}
                            </Text>
                          </View>
                          <View style={styles.sessionStat}>
                            <Ionicons name="cash" size={16} color={'#FF6A00'} />
                            {/* iter102an: show the GROSS session price the trainee paid (not the
                                80% take-home), so the trainer's card matches what the trainee saw
                                at checkout and what admin sees. The earnings line below clarifies. */}
                            <Text style={[styles.sessionStatText, { color: '#FFFFFF', fontWeight: '700' }]}>
                              ${(((session.baseSessionPriceCents ?? session.sessionGrossCents ?? (session.trainerEarningsCents / 0.80)) || 0) / 100).toFixed(2)}
                            </Text>
                          </View>
                        </View>
                        {/* iter106f: surface the meeting address so the trainer can decide
                            whether the location works for them BEFORE accepting. Pre-iter106f
                            the trainer card showed modality + duration + price but not WHERE,
                            forcing them to tap into the detail screen just to see "Central Park"
                            vs an unknown sketchy address. Hidden for virtual sessions where the
                            address is "Virtual" by definition. */}
                        {session.locationType !== 'virtual' && session.locationNameOrAddress ? (
                          <View style={styles.locationLine} data-testid="pending-card-location">
                            <Ionicons name="pin" size={14} color={'#FF6A00'} />
                            <Text style={styles.locationLineText} numberOfLines={2}>
                              {session.locationNameOrAddress}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={styles.earningsHint}>
                          You earn ${(session.trainerEarningsCents / 100).toFixed(2)} after platform fees
                        </Text>

                        <View style={styles.tapHint}>
                          <Ionicons name="eye-outline" size={14} color={COLORS.orange} />
                          <Text style={styles.tapHintText}>Tap to view client profile</Text>
                        </View>

                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleAccept(session.id);
                            }}
                          >
                            <LinearGradient
                              colors={[COLORS.success, COLORS.successDark]}
                              style={styles.acceptButtonGradient}
                            >
                              <Ionicons name="checkmark" size={20} color={COLORS.white} />
                              <Text style={styles.acceptButtonText}>Accept</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDecline(session.id);
                            }}
                          >
                            <Text style={styles.declineButtonText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Upcoming Sessions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📅 UPCOMING SESSIONS</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{upcomingSessions.length}</Text>
                </View>
              </View>
              {upcomingSessions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <LinearGradient
                    colors={['#141929', '#1A2035']}
                    style={styles.emptyGradient}
                  >
                    <Ionicons name="calendar-outline" size={48} color={COLORS.orange} />
                    <Text style={styles.emptyTitle}>No sessions yet</Text>
                    <Text style={styles.emptySubtitle}>Accept requests to fill your calendar</Text>
                  </LinearGradient>
                </View>
              ) : (
                upcomingSessions.map((session, index) => (
                  <View key={session.id} style={styles.upcomingCard}>
                    <LinearGradient
                      colors={['#141929', '#1A2035']}
                      style={styles.upcomingGradient}
                    >
                      <View style={styles.upcomingHeader}>
                        <View>
                          <Text style={styles.upcomingDate}>
                            {/* iter106f: use trainee's literal display string when present. */}
                            {session.traineeLocalDate || new Date(session.sessionDateTimeStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </Text>
                          <Text style={styles.upcomingTime}>
                            {session.traineeLocalTime || new Date(session.sessionDateTimeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <View style={styles.confirmedBadge}>
                          <Text style={styles.confirmedBadgeText}>CONFIRMED</Text>
                        </View>
                      </View>
                      <View style={styles.sessionStats}>
                        <View style={styles.sessionStat}>
                          <Ionicons name="time" size={16} color={COLORS.gray} />
                          <Text style={styles.sessionStatText}>{session.durationMinutes} min</Text>
                        </View>
                        <View style={styles.sessionStat}>
                          <Ionicons name="location" size={16} color={COLORS.gray} />
                          <Text style={styles.sessionStatText}>{session.locationType}</Text>
                        </View>
                        <View style={styles.sessionStat}>
                          <Ionicons name="cash" size={16} color={'#FF6A00'} />
                          <Text style={[styles.sessionStatText, { color: '#FFFFFF', fontWeight: '700' }]}>
                            ${(session.trainerEarningsCents / 100).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                ))
              )}
            </View>

            {/* iter102q: NEARBY TRAINEES section removed per user request — trainers
                should focus on their own bookings/availability, not see trainees as a list. */}

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>

      {/* One-time Trainer Approval Celebration Modal */}
      <Modal
        visible={showApprovalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApprovalModal(false)}
        data-testid="trainer-approval-modal"
      >
        <View style={approvalModalStyles.overlay}>
          <LinearGradient
            colors={['#0A0E1A', '#141929', '#1f0e00']}
            style={approvalModalStyles.card}
          >
            <View style={approvalModalStyles.glowRing}>
              <LinearGradient colors={['#FF6A00', '#FFD700']} style={approvalModalStyles.iconCircle}>
                <Ionicons name="checkmark" size={40} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={approvalModalStyles.confetti}>🎉  🎊  ✨</Text>
            <Text style={approvalModalStyles.title}>Congratulations!</Text>
            <Text style={approvalModalStyles.subtitle}>Your profile has been approved!</Text>
            <Text style={approvalModalStyles.body}>Clients can now book you for training.</Text>
            <View style={approvalModalStyles.brandRow}>
              <Ionicons name="flash" size={16} color="#FF6A00" />
              <Text style={approvalModalStyles.brand}>Welcome to Rapid Reps</Text>
              <Ionicons name="flash" size={16} color="#FF6A00" />
            </View>
            <TouchableOpacity
              onPress={async () => {
                try { await AsyncStorage.setItem(APPROVAL_SEEN_KEY, '1'); } catch { /* ignore */ }
                setShowApprovalModal(false);
              }}
              style={approvalModalStyles.btn}
              data-testid="approval-modal-dismiss-btn"
            >
              <LinearGradient colors={['#FF6A00', '#FF9F1C']} style={approvalModalStyles.btnGradient}>
                <Text style={approvalModalStyles.btnText}>Let&apos;s Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
  },
  safeArea: {
    flex: 1,
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
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
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
    color: COLORS.white,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
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
    backgroundColor: '#FF4757',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  // Hero
  heroBanner: {
    marginBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 220,
    backgroundColor: '#0A0E1A',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.18)',
  },
  heroBgImage: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '72%',
    height: '100%',
  },
  heroContent: {
    paddingVertical: 22,
    paddingHorizontal: 20,
    justifyContent: 'center',
    minHeight: 220,
    maxWidth: '68%',
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FF6A00',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  heroTitleWhite: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroTitleOrange: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF6A00',
    letterSpacing: 0.3,
    lineHeight: 32,
    textShadowColor: 'rgba(255,106,0,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 17,
  },
  // Legacy hero styles kept for orphan references
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
    backgroundColor: 'rgba(255, 106, 0, 0.12)',
  },
  heroAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  heroAvatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  // iter118b — RAPIDREPS wordmark lockup
  logoWordmarkWhite: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  logoWordmarkOrange: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FF6A00',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  headerMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerBellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  // ONLINE & AVAILABLE toggle card
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#0A0E1A',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.35)',
    marginBottom: 16,
    gap: 12,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  onlineContent: {
    flex: 1,
  },
  onlineTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  onlineSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  // 4 stat cards row
  statCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    minHeight: 128,
  },
  statBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 26,
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  statSub: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  // Total Earnings V2
  earningsCardV2: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  earningsHeaderV2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  earningsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  earningsWalletBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,106,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsLabelV2: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  periodMenu: {
    position: 'absolute',
    right: 18,
    top: 46,
    backgroundColor: '#141929',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
    paddingVertical: 4,
    minWidth: 120,
  },
  periodMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  periodMenuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  earningsAmountV2: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  earningsBreakdownV2: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  earnCol: {
    flex: 1,
  },
  earnColLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  earnColValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  earnPctRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earnPctText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 2,
  },
  earnPctSub: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  earnPctNeutral: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  // Visible banner
  visibleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.5)',
    backgroundColor: 'rgba(0,214,143,0.06)',
    marginBottom: 16,
  },
  visibleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,214,143,0.15)',
  },
  visibleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  visibleSub: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 15,
  },
  manageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,214,143,0.6)',
    backgroundColor: 'transparent',
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00D68F',
  },
  // 2x2 action grid tiles
  actionGridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionTile: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 110,
    justifyContent: 'space-between',
  },
  actionTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative' as const,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00D68F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0A0E1A',
  },
  actionTileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  actionTileSub: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  // Legacy heroSubtitle
  heroSubtitleLegacy: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  // Status Card
  statusCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  statusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  statusIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  statusSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  // Earnings
  earningsCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  earningsGradient: {
    padding: 20,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#141929',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  earningsAmount: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 16,
  },
  earningsBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsStat: {
    flex: 1,
  },
  earningsStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  earningsStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  earningsDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },
  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  quickActionGradient: {
    padding: 14,
    alignItems: 'center',
  },
  quickActionIcon: {
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
    flex: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  // Session Card
  sessionCard: {
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  sessionCardGradient: {
    padding: 18,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  traineeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  traineeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  traineeAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  traineeInfo: {
    flex: 1,
  },
  traineeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  sessionDateTime: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  pendingBadge: {
    backgroundColor: COLORS.orangeHot,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  pendingBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  sessionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionStatText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  earningsHint: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 10,
    marginLeft: 2,
  },
  // iter106f: meeting location row on pending request cards
  locationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: 'rgba(255,106,0,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.18)',
  },
  locationLineText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
    borderRadius: 8,
    marginBottom: 14,
  },
  tapHintText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.error,
  },
  // Upcoming
  upcomingCard: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  upcomingGradient: {
    padding: 16,
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  upcomingDate: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  upcomingTime: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  confirmedBadge: {
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  confirmedBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  // Empty State
  emptyCard: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyGradient: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  // Trainee Card
  traineeCard: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  traineeCardGradient: {
    padding: 14,
  },
  traineeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  traineeCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  traineeCardAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  traineeCardInfo: {
    flex: 1,
  },
  traineeCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  traineeCardGoal: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Trainee Thumbnail Grid
  traineeThumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
  },
  traineeThumbnail: {
    width: (width - 40 - 30) / 4,
    alignItems: 'center',
    backgroundColor: 'rgba(20, 25, 41, 0.95)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  traineeThumbnailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 6,
  },
  traineeThumbnailAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  traineeThumbnailName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 2,
  },
  traineeThumbnailDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  traineeThumbnailDistanceText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});

const approvalModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: 28, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,106,0,0.35)', shadowColor: '#FF6A00', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12 },
  glowRing: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.12)', borderWidth: 2, borderColor: 'rgba(255,215,0,0.4)', marginBottom: 12 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  confetti: { fontSize: 22, letterSpacing: 6, marginVertical: 8 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginTop: 6 },
  subtitle: { fontSize: 17, fontWeight: '700', color: '#FFD700', textAlign: 'center', marginTop: 8 },
  body: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 4 },
  brand: { fontSize: 14, fontWeight: '800', color: '#FF6A00', letterSpacing: 1, textTransform: 'uppercase' },
  btn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 22 },
  btnGradient: { paddingVertical: 16, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
});


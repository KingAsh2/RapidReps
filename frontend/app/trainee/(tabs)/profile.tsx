import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  TextInput,
  Switch,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { useSoundEffects } from '../../../src/contexts/SoundContext';
import { traineeAPI, streaksAPI } from '../../../src/services/api';
import * as ImagePicker from 'expo-image-picker';
import { toast } from '../../../src/utils/toast';
import { SocialLinksDisplay } from '../../../src/components/ProfileSections';
import InstagramSection from '../../../src/components/InstagramSection';
import { PersonalityTagBadge, PersonalityTagSelector } from '../../../src/components/PersonalityTagBadge';
// iter98d (Task 5): mount vibe player so users hear their own music on their profile
import { TrainerVibePlayer } from '../../../src/components/TrainerVibePlayer';
import { stopAllAudio } from '../../../src/utils/audioCoordinator';
// iter98e: tap-to-edit display name component
import EditableName from '../../../src/components/EditableName';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { StreakRing } from '../../../src/components/StreakRing';
import FloatingOrangeBg from '../../../src/components/FloatingOrangeBg';
import { AccentColorPicker } from '../../../src/components/AccentColorPicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const { width } = Dimensions.get('window');

// Background image
import RapidBg from '../../../src/components/RapidBg';
const backgroundImage = require('../../../assets/images/bg-box-jumps.jpg');

// Brand colors - UNIFIED DESIGN SYSTEM
import { DS } from '../../../src/theme/designSystem';

// iter95c — Aligned with the unified DS tokens.
// Local COLORS map retained for backward-compat but populated from DS.colors
// so the screen automatically inherits any future theme refresh.
const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  tealDark: '#0D8B88',
  orange: DS.colors.orange,
  orangeHot: DS.colors.orangeDeep,
  orangeLight: DS.colors.orangeGlow,
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: DS.colors.textPrimary,
  offWhite: '#FAFBFC',
  gray: DS.colors.textSecondary,
  grayLight: DS.colors.borderStrong,
  error: DS.colors.error,
  // Glass card colors
  cardBg: 'rgba(255,255,255,0.12)',
  cardBorder: 'rgba(255,255,255,0.2)',
};

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export default function TraineeProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, logout, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const { soundEnabled, setSoundEnabled, playTap } = useSoundEffects();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Auto-trigger edit mode when coming from address banner
  useEffect(() => {
    if (params?.editAddress === 'true') {
      setIsEditing(true);
    }
  }, [params?.editAddress]);

  // Animation refs
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(6)].map(() => new Animated.Value(0))).current;

  const [formData, setFormData] = useState({
    profilePhoto: '',
    fitnessGoals: '',
    experienceLevel: '',
    currentFitnessLevel: '',
    preferredTrainingStyles: [] as string[],
    injuriesOrLimitations: '',
    homeGymOrZipCode: '',
    homeAddress: '',
    homeStreet: '',
    homeCity: '',
    homeState: '',
    homeZipCode: '',
    prefersInPerson: true,
    prefersVirtual: true,
    budgetMinPerMinuteCents: 50,
    budgetMaxPerMinuteCents: 200,
  });

  const [streakData, setStreakData] = useState<any>(null);
  const streakPulseAnim = useRef(new Animated.Value(1)).current;
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    loadProfile();
    loadStreaks();
  }, []);

  // iter98d (Task 5 hardening): tab screens don't unmount on tab-switch,
  // so use useFocusEffect to stop audio when the user blurs this tab.
  useFocusEffect(
    React.useCallback(() => {
      return () => { try { stopAllAudio(); } catch { /* no-op */ } };
    }, [])
  );

  useEffect(() => {
    if (!loading) {
      // Header animation
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Staggered cards
      cardAnims.forEach((anim, index) => {
        setTimeout(() => {
          Animated.spring(anim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }, 150 + (index * 100));
      });
    }
  }, [loading]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profileData = await traineeAPI.getMyProfile();
      setProfile(profileData);
      
      setFormData({
        profilePhoto: profileData.profilePhoto || '',
        fitnessGoals: profileData.fitnessGoals || '',
        experienceLevel: profileData.experienceLevel || '',
        currentFitnessLevel: profileData.currentFitnessLevel || '',
        preferredTrainingStyles: profileData.preferredTrainingStyles || [],
        injuriesOrLimitations: profileData.injuriesOrLimitations || '',
        homeGymOrZipCode: profileData.homeGymOrZipCode || '',
        homeAddress: profileData.homeAddress || '',
        homeStreet: profileData.homeStreet || '',
        homeCity: profileData.homeCity || '',
        homeState: profileData.homeState || '',
        prefersInPerson: profileData.prefersInPerson ?? true,
        prefersVirtual: profileData.prefersVirtual ?? true,
        budgetMinPerMinuteCents: profileData.budgetMinPerMinuteCents || 50,
        budgetMaxPerMinuteCents: profileData.budgetMaxPerMinuteCents || 200,
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStreaks = async () => {
    try {
      const data = await streaksAPI.getMyStreaks();
      setStreakData(data);
      // Start fire pulse animation if streak is active
      if (data.currentStreak >= 2) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(streakPulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
            Animated.timing(streakPulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        ).start();
      }
    } catch (e) {
      console.error('Error loading streaks:', e);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      showAlert({
        title: 'Permission Required',
        message: 'Camera roll permission is required to change your photo!',
        type: 'warning',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      // iter105 perf: compress + resize before base64 upload.
      try {
        const { optimizeImage } = await import('../../../src/utils/imageOptimizer');
        const FileSystem = await import('expo-file-system');
        const optimizedUri = await optimizeImage(result.assets[0].uri, 'avatar');
        const b64 = await FileSystem.readAsStringAsync(optimizedUri, { encoding: FileSystem.EncodingType.Base64 });
        setFormData({ ...formData, profilePhoto: `data:image/jpeg;base64,${b64}` });
      } catch {
        setFormData({ ...formData, profilePhoto: result.assets[0].uri });
      }
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileData = {
        ...formData,
        userId: user?.id || profile?.userId
      };
      await traineeAPI.updateProfile(profileData);
      setIsEditing(false);
      // iter102: refresh auth user so bottom-tab avatar reflects new photo immediately
      try { await refreshUser?.(); } catch {}
      loadProfile();
    } catch (error: any) {
      showAlert({
        title: 'Update Failed',
        message: error.response?.data?.detail || 'Failed to update profile',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    showAlert({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
            // iter98d (Task 2): go straight to sign-in, not Welcome splash
            router.replace('/auth/login');
          },
        },
      ],
    });
  };

  const handleDeleteAccount = async () => {
    showAlert({
      title: 'Delete Account',
      message: 'This will permanently delete your account and all data. This cannot be undone.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              const { authAPI } = await import('../../../src/services/api');
              await authAPI.deleteMe();
              logout();
              router.replace('/auth/login');
            } catch (error: any) {
              showAlert({
                title: 'Error',
                message: error?.response?.data?.detail || 'Unable to delete account.',
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const handleSelectPersonalityTag = async (tag: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.put(`${API_URL}/api/trainee-profiles/${user?.id}/personality-tag`,
        { personalityTag: tag || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile({ ...profile, personalityTag: tag || null });
      setShowTagSelector(false);
      toast.success(tag ? `Vibe set to ${tag}` : 'Personality tag removed');
    } catch (e) {
      console.error('Tag update error:', e);
      toast.error('Failed to update personality tag');
    }
  };

  const handleSelectAccentColor = async (color: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.put(`${API_URL}/api/trainee-profiles/${user?.id}/accent-color`,
        { accentColor: color },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile({ ...profile, accentColor: color });
      setShowColorPicker(false);
      try { await refreshUser?.(); } catch { /* non-blocking */ }
      toast.success('Brand color updated');
    } catch (e) {
      console.error('Color update error:', e);
      toast.error('Failed to update brand color');
    }
  };

  // iter102aj: persist brightness slider (does not close the picker).
  const handleAccentIntensityCommit = async (intensity: number) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.put(`${API_URL}/api/trainee-profiles/${user?.id}/accent-color`,
        { accentColor: profile?.accentColor ?? null, accentIntensity: intensity },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile({ ...profile, accentIntensity: intensity });
      try { await refreshUser?.(); } catch { /* non-blocking */ }
    } catch (e) {
      console.error('Intensity update error:', e);
      toast.error('Failed to update brightness');
    }
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  if (loading) {
    return (
      <RapidBg variant="trainee-profile" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </RapidBg>
    );
  }

  return (
    <RapidBg
      variant="trainee-profile"
      style={styles.container}
      noScrim
    >
      {/* Orange overlay for consistency */}
      <LinearGradient
        colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* iter97c (#2): subtle floating ember ambience throughout interior screens */}
      <FloatingOrangeBg density={6} intensity={0.35} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Header */}
            <Animated.View
              style={[
                styles.profileHeader,
                {
                  opacity: headerAnim,
                  transform: [{ translateY: headerTranslateY }],
                },
              ]}
            >
              <TouchableOpacity onPress={isEditing ? pickImage : undefined} disabled={!isEditing} activeOpacity={isEditing ? 0.7 : 1} style={styles.avatarContainer} data-testid="trainee-avatar-tap">
                {/* iter98e: accent-color halo + ring on own avatar.
                    iter102aa: glow toned down (22→12, 0.55→0.32, border 2.5→2). */}
                <View style={{
                  shadowColor: profile?.accentColor || '#FF6A00',
                  shadowOpacity: 0.32,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 6,
                  borderRadius: 70,
                  padding: 3,
                  borderWidth: 2,
                  borderColor: profile?.accentColor || '#FF6A00',
                }}>
                  {/* iter105 polish: streak ring around the avatar — invisible
                      until earned. Pulls from /api/streaks/me already loaded
                      into streakData below. */}
                  <StreakRing
                    size={116}
                    strokeWidth={4}
                    currentStreak={streakData?.currentStreak || 0}
                    nextMilestone={streakData?.nextMilestone || 4}
                  >
                    <UserAvatar
                      user={{
                        avatarUrl: formData.profilePhoto,
                        fullName: user?.fullName,
                        email: user?.email,
                      }}
                      size={110}
                    />
                  </StreakRing>
                </View>
                {isEditing && (
                  <View style={styles.editBadge}>
                    <Ionicons name="camera" size={16} color={COLORS.white} />
                  </View>
                )}
              </TouchableOpacity>

              {/* iter98e: tap-to-edit display name (free-form, audit-logged) */}
              <View style={{ marginTop: 14, marginBottom: 4, alignItems: 'center' }}>
                <EditableName
                  value={user?.fullName || 'Athlete'}
                  accent={profile?.accentColor || '#FF6A00'}
                  nameStyle={styles.userName}
                  testIdPrefix="trainee-name"
                />
              </View>
              <Text style={styles.userEmail}>{user?.email}</Text>

              {/* iter97b: status row to match trainer profile hierarchy */}
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.statusText}>Active</Text>
              </View>

              {/* Personality Tag Display */}
              {profile?.personalityTag && (
                <View style={{ marginTop: 10 }}>
                  <PersonalityTagBadge tag={profile.personalityTag} onPress={() => setShowTagSelector(true)} />
                </View>
              )}

              {/* iter97b: Share Profile button — mirrors trainer profile CTA */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const { Share } = await import('react-native');
                    await Share.share({
                      message: `Check out my training profile on RapidReps! ${user?.fullName || ''}`,
                    });
                  } catch { /* user cancelled */ }
                }}
                style={styles.shareProfileBtn}
                data-testid="trainee-share-profile-btn"
              >
                <Ionicons name="share-social" size={18} color={COLORS.white} />
                <Text style={styles.shareProfileBtnText}>Share Profile</Text>
              </TouchableOpacity>

              {/* iter106s: Edit Profile button — moved up here to match the
                  trainer profile alignment (sits directly under Share Profile,
                  same orange full-width pill). The bottom-of-screen "Edit
                  Profile" button has been removed; "Save Changes" still
                  appears at the bottom while the user is actively editing. */}
              {!isEditing && (
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  style={[styles.shareProfileBtn, { marginTop: 10 }]}
                  data-testid="edit-profile-btn"
                >
                  <Ionicons name="pencil" size={18} color={COLORS.white} />
                  <Text style={styles.shareProfileBtnText}>Edit Profile</Text>
                </TouchableOpacity>
              )}

              {/* iter106ak: "Preview as visitor" — lands the trainee on the
                  exact public-facing screen a trainer would see (rich profile
                  with vibe music, gallery, fitness goals, etc.). Closest
                  thing to a "how do others see me?" sanity check. */}
              {!isEditing && user?.id && (
                <TouchableOpacity
                  onPress={() => {
                    // iter106av: forward user accent so the global preview
                    // banner tints correctly (falls back to orange if absent).
                    const acc = user?.accentColor ? `&previewAccent=${encodeURIComponent(user.accentColor)}` : '';
                    router.push(`/trainer/trainee-profile?traineeId=${user.id}&preview=1${acc}` as any);
                  }}
                  style={[styles.shareProfileBtn, { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }]}
                  data-testid="preview-profile-btn"
                >
                  <Ionicons name="eye" size={18} color={COLORS.white} />
                  <Text style={styles.shareProfileBtnText}>Preview as Visitor</Text>
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Stats Card */}
            <Animated.View
              style={[
                styles.statsCard,
                {
                  opacity: cardAnims[0],
                  transform: [{
                    translateY: cardAnims[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                },
              ]}
            >
              <LinearGradient
                colors={[COLORS.orange, COLORS.orangeLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statsGradient}
              >
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{profile?.experienceLevel || 'N/A'}</Text>
                  <Text style={styles.statLabel}>Experience</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formData.preferredTrainingStyles.length}</Text>
                  <Text style={styles.statLabel}>Styles</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formData.prefersVirtual ? '✓' : '✗'}</Text>
                  <Text style={styles.statLabel}>Virtual</Text>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Streak Card */}
            {streakData && (
              <Animated.View
                style={[
                  styles.streakCard,
                  {
                    opacity: cardAnims[0],
                    transform: [{
                      translateY: cardAnims[0].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    }],
                  },
                ]}
              >
                <LinearGradient
                  colors={
                    streakData.currentStreak >= 4
                      ? ['#FF6A00', '#FF9F1C']
                      : streakData.currentStreak >= 2
                        ? ['#FFB300', '#FFC107']
                        : ['#0A0E1A', '#141929']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.streakGradient}
                >
                  <View style={styles.streakRow}>
                    <Animated.View style={{ transform: [{ scale: streakPulseAnim }] }}>
                      <View style={styles.streakFireBg}>
                        <Ionicons
                          name="flame"
                          size={30}
                          color={streakData.currentStreak >= 2 ? '#FF6A00' : COLORS.gray}
                        />
                      </View>
                    </Animated.View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.streakTitle}>
                        {streakData.currentStreak > 0
                          ? `${streakData.currentStreak} Week Streak!`
                          : 'Start Your Streak!'}
                      </Text>
                      <Text style={styles.streakSub}>
                        {streakData.consistencyPoints} pts | Best: {streakData.longestStreak}wk | {streakData.totalMinutes}min trained
                      </Text>
                    </View>
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakBadgeText}>
                        {streakData.streakLevel === 'legend' ? 'LEGEND' :
                         streakData.streakLevel === 'blazing' ? 'BLAZING' :
                         streakData.streakLevel === 'fire' ? 'ON FIRE' :
                         streakData.streakLevel === 'warming' ? 'WARMING UP' : 'GET STARTED'}
                      </Text>
                    </View>
                  </View>
                  {streakData.currentStreak > 0 && streakData.nextMilestone > streakData.currentStreak && (
                    <View style={styles.streakProgress}>
                      <View style={styles.streakProgressBg}>
                        <View style={[styles.streakProgressFill, { width: `${Math.min(100, (streakData.currentStreak / streakData.nextMilestone) * 100)}%` }]} />
                      </View>
                      <Text style={styles.streakProgressText}>
                        {streakData.nextMilestone - streakData.currentStreak} weeks to next milestone
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </Animated.View>
            )}

            {/* Fitness Goals Card */}
            <Animated.View
              style={[
                styles.sectionCard,
                {
                  opacity: cardAnims[1],
                  transform: [{
                    translateY: cardAnims[1].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.sectionGradient}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trophy" size={22} color={COLORS.orange} />
                  <Text style={styles.sectionTitle}>Fitness Goals</Text>
                </View>
                {isEditing ? (
                  <TextInput
                    style={styles.textArea}
                    value={formData.fitnessGoals}
                    onChangeText={(text) => setFormData({ ...formData, fitnessGoals: text })}
                    placeholder="What are you working towards?"
                    placeholderTextColor={COLORS.gray}
                    multiline
                    numberOfLines={3}
                  />
                ) : (
                  <Text style={styles.sectionContent}>
                    {formData.fitnessGoals || 'No goals set yet'}
                  </Text>
                )}
              </View>
            </Animated.View>

            {/* Home Address Card (for At Home sessions) */}
            <Animated.View
              style={[
                styles.sectionCard,
                {
                  opacity: cardAnims[2],
                  transform: [{
                    translateY: cardAnims[2].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.sectionGradient}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="home" size={22} color={COLORS.orange} />
                  <Text style={styles.sectionTitle}>Home Address</Text>
                </View>
                <Text style={styles.addressHint}>Required for At Home training sessions</Text>
                {isEditing ? (
                  <View>
                    <TextInput
                      style={[styles.textArea, { minHeight: 44, marginBottom: 10 }]}
                      value={formData.homeStreet}
                      onChangeText={(text) => setFormData({ ...formData, homeStreet: text, homeAddress: `${text}, ${formData.homeCity}, ${formData.homeState} ${formData.homeZipCode}`.trim() })}
                      placeholder="Street Address"
                      placeholderTextColor={COLORS.gray}
                      data-testid="home-street-input"
                    />
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                      <TextInput
                        style={[styles.textArea, { minHeight: 44, flex: 2 }]}
                        value={formData.homeCity}
                        onChangeText={(text) => setFormData({ ...formData, homeCity: text, homeAddress: `${formData.homeStreet}, ${text}, ${formData.homeState} ${formData.homeZipCode}`.trim() })}
                        placeholder="City"
                        placeholderTextColor={COLORS.gray}
                        data-testid="home-city-input"
                      />
                      <TextInput
                        style={[styles.textArea, { minHeight: 44, flex: 1 }]}
                        value={formData.homeZipCode}
                        onChangeText={(text) => setFormData({ ...formData, homeZipCode: text, homeAddress: `${formData.homeStreet}, ${formData.homeCity}, ${formData.homeState} ${text}`.trim() })}
                        placeholder="Zip Code"
                        placeholderTextColor={COLORS.gray}
                        keyboardType="numeric"
                        maxLength={10}
                        data-testid="home-zip-input"
                      />
                    </View>
                    <View style={styles.statePickerContainer}>
                      <Text style={styles.statePickerLabel}>State</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stateScroll}>
                        {US_STATES.map((st) => (
                          <TouchableOpacity
                            key={st}
                            style={[
                              styles.stateChip,
                              formData.homeState === st && styles.stateChipSelected,
                            ]}
                            onPress={() => setFormData({ ...formData, homeState: st, homeAddress: `${formData.homeStreet}, ${formData.homeCity}, ${st} ${formData.homeZipCode}`.trim() })}
                          >
                            <Text style={[
                              styles.stateChipText,
                              formData.homeState === st && styles.stateChipTextSelected,
                            ]}>{st}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.sectionContent}>
                    {(formData.homeStreet || formData.homeCity || formData.homeState || formData.homeZipCode) 
                      ? `${formData.homeStreet}${formData.homeCity ? ', ' + formData.homeCity : ''}${formData.homeState ? ', ' + formData.homeState : ''}${formData.homeZipCode ? ' ' + formData.homeZipCode : ''}`
                      : 'No address set — required for At Home sessions'}
                  </Text>
                )}
              </View>
            </Animated.View>

            {/* Training Preferences Card */}
            <Animated.View
              style={[
                styles.sectionCard,
                {
                  opacity: cardAnims[2],
                  transform: [{
                    translateY: cardAnims[2].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.sectionGradient}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="settings" size={22} color={'#FF6A00'} />
                  <Text style={styles.sectionTitle}>Training Preferences</Text>
                </View>
                <View style={styles.preferenceRow}>
                  <Text style={styles.preferenceLabel}>In-Person Training</Text>
                  <Switch
                    value={formData.prefersInPerson}
                    onValueChange={(value) => {
                      setFormData({ ...formData, prefersInPerson: value });
                      setIsEditing(true);
                    }}
                    trackColor={{ false: COLORS.grayLight, true: '#FF6A00' }}
                    thumbColor={COLORS.white}
                  />
                </View>
                <View style={styles.preferenceRow}>
                  <Text style={styles.preferenceLabel}>Virtual Training</Text>
                  <Switch
                    value={formData.prefersVirtual}
                    onValueChange={(value) => {
                      setFormData({ ...formData, prefersVirtual: value });
                      setIsEditing(true);
                    }}
                    trackColor={{ false: COLORS.grayLight, true: '#FF6A00' }}
                    thumbColor={COLORS.white}
                  />
                </View>
              </View>
            </Animated.View>

            {/* Quick Actions */}
            <Animated.View
              style={[
                styles.actionsCard,
                {
                  opacity: cardAnims[3],
                  transform: [{
                    translateY: cardAnims[3].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.actionsGradient}>
                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/trainee/share-streak')}
                  data-testid="share-streak-link"
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(255, 106, 0, 0.2)' }]}>
                    <Ionicons name="share-social" size={22} color="#FF6A00" />
                  </View>
                  <Text style={styles.actionText}>Share My Streak</Text>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/trainee/achievements')}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(253, 187, 45, 0.2)' }]}>
                    <Ionicons name="trophy" size={22} color="#FDBB2D" />
                  </View>
                  <Text style={styles.actionText}>Achievements</Text>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/trainee/leaderboard')}
                  data-testid="leaderboard-link"
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(255, 127, 0, 0.2)' }]}>
                    <Ionicons name="podium" size={22} color="#FF7F00" />
                  </View>
                  <Text style={styles.actionText}>Leaderboard</Text>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/trainee/saved-trainers')}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(31, 184, 180, 0.2)' }]}>
                    <Ionicons name="heart" size={22} color={'#FF6A00'} />
                  </View>
                  <Text style={styles.actionText}>Saved Trainers</Text>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/referral')}
                  data-testid="referral-link"
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(255, 106, 0, 0.2)' }]}>
                    <Ionicons name="gift" size={22} color="#FF6A00" />
                  </View>
                  <Text style={styles.actionText}>Refer & Earn $5</Text>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/change-password')}
                  data-testid="change-password-link"
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(31, 184, 180, 0.2)' }]}>
                    <Ionicons name="lock-closed" size={22} color={'#FF6A00'} />
                  </View>
                  <Text style={styles.actionText}>Change Password</Text>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/legal/terms')}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(136, 146, 176, 0.2)' }]}>
                    <Ionicons name="document-text" size={22} color={COLORS.gray} />
                  </View>
                  <Text style={styles.actionText}>Terms & Privacy</Text>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Save Changes Button — shown only while actively editing.
                iter106s: the unstyled "Edit Profile" button that used to sit
                here was a visual duplicate of the new orange one near the
                avatar (matches the trainer profile alignment); removed. */}
            {isEditing && (
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
                data-testid="save-profile-btn"
              >
                <LinearGradient
                  colors={['#FF6A00', '#FF3D00']}
                  style={styles.saveButtonGradient}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color={COLORS.white} />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Sound Effects Toggle */}
            <View style={styles.soundToggleCard}>
              <View style={styles.soundToggleRow}>
                <View style={styles.soundToggleIcon}>
                  <Ionicons name={soundEnabled ? 'volume-high' : 'volume-mute'} size={20} color={'#FFFFFF'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.soundToggleLabel}>Sound Effects</Text>
                  <Text style={styles.soundToggleSub}>Play tap sounds on buttons</Text>
                </View>
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#ccc', true: '#FF6A00' }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>

            {/* Instagram — own view: link / curate / refresh / unlink */}
            <View style={{ paddingHorizontal: 16 }}>
              <InstagramSection />
            </View>

            {/* Gallery (editable) */}
            <View style={{ paddingHorizontal: 16 }}>
              {/* iter106ay: "Set Your Vibe" personality-tag CTA removed per user
                  feedback — replaced by the music anthem CTA below. */}

              {/* iter98d (Task 5): mount the vibe player so user hears
                  their own music when visiting their own profile.
                  Auto-stops on unmount (leaving the screen). */}
              {profile?.vibeTrackTitle && (profile?.vibePreviewUrl || profile?.vibeTrackId) ? (
                <View style={{ marginBottom: 14 }} data-testid="own-vibe-player">
                  <TrainerVibePlayer vibe={profile as any} autoPlay={true} />
                </View>
              ) : null}

              {/* Trainee Vibe CTA — iter118e: only render when the user has NOT set an anthem.
                  When set, the TrainerVibePlayer above already surfaces the track,
                  so the CTA becomes a duplicate. */}
              {!profile?.vibeTrackTitle && (
                <TouchableOpacity
                  onPress={() => router.push('/trainee/vibe-setup')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,106,0,0.08)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,106,0,0.15)' }}
                  data-testid="trainee-vibe-setup-btn"
                  accessibilityLabel="Set your profile anthem"
                  accessibilityRole="button"
                >
                  <LinearGradient colors={['#FF6A00', '#FF3D00']} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="musical-notes" size={22} color="#FFF" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>Set Your Anthem</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>Pick the song that hypes you up</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
              )}

              {/* Highlight Reel Upload CTA */}
              <TouchableOpacity
                onPress={() => router.push('/trainee/highlight-upload')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                data-testid="trainee-highlight-upload-btn"
                accessibilityLabel="Upload your highlight reel"
                accessibilityRole="button"
              >
                <LinearGradient colors={['#1A2035', '#141929']} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,106,0,0.2)' }}>
                  <Ionicons name="film" size={22} color="#FF6A00" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>Highlight Reel</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>Show off your progress with photos & clips</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>

              {/* Accent Color CTA */}
              <TouchableOpacity
                onPress={() => setShowColorPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: `${profile?.accentColor || '#FF6A00'}10`, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: `${profile?.accentColor || '#FF6A00'}20` }}
                data-testid="trainee-accent-color-btn"
                accessibilityLabel="Pick your brand color"
                accessibilityRole="button"
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: profile?.accentColor || '#FF6A00', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="color-palette" size={22} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Oswald_700Bold', color: '#FFF', letterSpacing: 0.5 }}>BRAND COLOR</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
                    Tints your profile hero and accents
                  </Text>
                </View>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: profile?.accentColor || '#FF6A00', borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' }} />
              </TouchableOpacity>

              {/* Gallery removed per product decision (iter84) — Highlight Reel is the single media surface */}
              {/* iter102ac: SocialLinksDisplay removed per product request — social links paused. */}
            </View>

            {/* iter97 (#11): Message Admin */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={async () => {
                try {
                  const token = await AsyncStorage.getItem('auth_token');
                  const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/messages/admin-contact`;
                  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const data = await res.json();
                  router.push(`/messages/chat?conversationId=${data.conversationId}&userId=${data.admin.id}&userName=${encodeURIComponent(data.admin.fullName || 'RapidReps Admin')}` as any);
                } catch (e: any) {
                  toast.error('Could not reach admin', 'Try again later');
                }
              }}
              data-testid="message-admin-btn"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.white} />
              <Text style={styles.logoutButtonText}>Message Admin</Text>
            </TouchableOpacity>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>

            {/* Delete Account */}
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Personality Tag Selector Modal */}
      <PersonalityTagSelector
        visible={showTagSelector}
        onClose={() => setShowTagSelector(false)}
        onSelect={handleSelectPersonalityTag}
        currentTag={profile?.personalityTag}
      />

      {/* Accent Color Picker Modal */}
      <AccentColorPicker
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        onSelect={handleSelectAccentColor}
        currentColor={profile?.accentColor}
        currentIntensity={profile?.accentIntensity}
        onIntensityCommit={handleAccentIntensityCommit}
      />
    </RapidBg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
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
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Profile Header
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#0A0E1A',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userName: {
    fontSize: 28,
    fontFamily: 'Oswald_700Bold',
    color: COLORS.white,
    marginBottom: 4,
    letterSpacing: 1,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  // iter97b: parity with trainer profile hierarchy
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  shareProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 22, marginTop: 14,
  },
  shareProfileBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  // Stats Card
  statsCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  statsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Oswald_700Bold',
    color: COLORS.white,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Oswald_600SemiBold',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  // Section Card - Glass Style
  sectionCard: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionGradient: {
    padding: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Oswald_700Bold',
    color: COLORS.white,
    letterSpacing: 1,
  },
  sectionContent: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },
  addressHint: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  // Actions Card - Glass Style
  actionsCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionsGradient: {
    padding: 6,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
    numberOfLines: 1,
  },
  // Buttons
  saveButton: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  editButton: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    marginBottom: 16,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#CC0000',
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  soundToggleCard: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  soundToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  soundToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(31, 184, 180, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soundToggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  soundToggleSub: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  // Streak Card
  streakCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  streakGradient: {
    padding: 18,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakFireBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakTitle: {
    fontSize: 18,
    fontFamily: 'Oswald_700Bold',
    color: COLORS.white,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  streakSub: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  streakBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  streakBadgeText: {
    fontSize: 11,
    fontFamily: 'Oswald_700Bold',
    color: COLORS.white,
    letterSpacing: 1,
  },
  streakProgress: {
    marginTop: 12,
  },
  streakProgressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  streakProgressFill: {
    height: '100%',
    backgroundColor: '#141929',
    borderRadius: 3,
  },
  streakProgressText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  statePickerContainer: {
    marginTop: 4,
  },
  statePickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  stateScroll: {
    flexDirection: 'row',
  },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stateChipSelected: {
    backgroundColor: '#FF6A00',
    borderColor: '#FF6A00',
  },
  stateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  stateChipTextSelected: {
    color: COLORS.white,
  },
});

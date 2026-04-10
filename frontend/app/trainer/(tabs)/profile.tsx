import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';
import { useAuth } from '../../../src/contexts/AuthContext';
import { streaksAPI } from '../../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { toast } from '../../../src/utils/toast';
import { ProfileGallery, SocialLinksDisplay } from '../../../src/components/ProfileSections';
import { PersonalityTagBadge, PersonalityTagSelector } from '../../../src/components/PersonalityTagBadge';
import { AccentColorPicker } from '../../../src/components/AccentColorPicker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  orange: '#FF7F00',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
  error: '#FF4757',
};

const backgroundImage = require('../../../assets/images/bg-spin-class.png');

export default function TrainerProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streakData, setStreakData] = useState<any>(null);
  const streakPulseAnim = useRef(new Animated.Value(1)).current;
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const heroScaleAnim = useRef(new Animated.Value(0.95)).current;
  const heroOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfile();
    loadStreaks();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.spring(heroScaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.timing(heroOpacityAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [loading]);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userRes = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userId = userRes.data.id;
      const profileRes = await axios.get(`${API_URL}/api/trainer-profiles/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(profileRes.data);
    } catch (err) {
      console.error('Load profile error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStreaks = async () => {
    try {
      const data = await streaksAPI.getMyStreaks();
      setStreakData(data);
      if (data.currentStreak >= 2) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(streakPulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
            Animated.timing(streakPulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        ).start();
      }
    } catch (e) { console.error('Streaks error:', e); }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleShareProfile = async () => {
    try {
      const profileLink = `rapidreps://trainer/${user?.id}`;
      await Share.share({
        message: `Check out ${user?.fullName || 'this trainer'} on RapidReps! Book a session today.\n\nOpen in app: ${profileLink}\n\nDownload RapidReps: https://rapidreps.com/download`,
        title: `${user?.fullName || 'Trainer'} on RapidReps`,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handleSelectPersonalityTag = async (tag: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.put(`${API_URL}/api/trainer-profiles/${user?.id}/personality-tag`, 
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
      await axios.put(`${API_URL}/api/trainer-profiles/${user?.id}/accent-color`,
        { accentColor: color },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile({ ...profile, accentColor: color });
      setShowColorPicker(false);
      toast.success('Brand color updated');
    } catch (e) {
      console.error('Color update error:', e);
      toast.error('Failed to update brand color');
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} data-testid="trainer-profile-logout">
            <Ionicons name="log-out-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile(); }} tintColor={COLORS.white} />}
        >
          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator size="large" color={'#FF6A00'} /></View>
          ) : (
            <>
              {/* Avatar + Name */}
              <Animated.View style={[styles.avatarSection, { opacity: heroOpacityAnim, transform: [{ scale: heroScaleAnim }] }]}>
                <View style={styles.avatarContainer}>
                  {profile?.avatarUrl ? (
                    <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={40} color={COLORS.gray} />
                    </View>
                  )}
                  <View style={[styles.verifiedBadge, { backgroundColor: profile?.isVerified ? COLORS.success : COLORS.gray }]}>
                    <Ionicons name={profile?.isVerified ? 'checkmark' : 'time'} size={14} color={COLORS.white} />
                  </View>
                </View>
                <Text style={styles.name}>{user?.fullName || 'Trainer'}</Text>
                <Text style={styles.email}>{user?.email || ''}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: profile?.isAvailable ? COLORS.success : COLORS.error }]} />
                  <Text style={styles.statusText}>{profile?.isAvailable ? 'Available' : 'Unavailable'}</Text>
                </View>

                {/* Personality Tag Display */}
                {profile?.personalityTag && (
                  <View style={{ marginTop: 12 }}>
                    <PersonalityTagBadge tag={profile.personalityTag} onPress={() => setShowTagSelector(true)} />
                  </View>
                )}

                {/* Share Profile Button */}
                <TouchableOpacity onPress={handleShareProfile} style={styles.shareProfileBtn} data-testid="share-profile-btn">
                  <Ionicons name="share-social" size={18} color={COLORS.white} />
                  <Text style={styles.shareProfileBtnText}>Share Profile</Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{profile?.totalSessionsCompleted || 0}</Text>
                  <Text style={styles.statLabel}>Sessions</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{profile?.averageRating?.toFixed(1) || '0.0'}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{profile?.totalReviews || 0}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </View>
              </View>

              {/* Streak Card */}
              {streakData && (
                <View style={styles.streakCard}>
                  <LinearGradient
                    colors={
                      streakData.currentStreak >= 4
                        ? ['#FF6A00', '#FF9F1C']
                        : streakData.currentStreak >= 2
                          ? ['#FFB300', '#FFC107']
                          : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.streakGradient}
                  >
                    <View style={styles.streakRow}>
                      <Animated.View style={{ transform: [{ scale: streakPulseAnim }] }}>
                        <View style={styles.streakFireBg}>
                          <Ionicons name="flame" size={26} color={streakData.currentStreak >= 2 ? '#FF6A00' : COLORS.gray} />
                        </View>
                      </Animated.View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.streakTitle}>
                          {streakData.currentStreak > 0 ? `${streakData.currentStreak} Week Streak` : 'Build Your Streak'}
                        </Text>
                        <Text style={styles.streakSub}>
                          {streakData.consistencyPoints} pts | {streakData.totalSessions} sessions | {streakData.totalMinutes}min
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              )}

              {/* Quick Links */}
              <Text style={styles.sectionTitle}>Quick Actions</Text>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/trainer/verification')} data-testid="go-verification">
                <Ionicons name="shield-checkmark" size={20} color={'#FF6A00'} />
                <Text style={styles.menuItemText}>Verification Status</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/trainer/boosts')} data-testid="go-boosts">
                <Ionicons name="rocket" size={20} color={COLORS.orange} />
                <Text style={styles.menuItemText}>Visibility Boosts</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/trainee/leaderboard')} data-testid="go-leaderboard">
                <Ionicons name="podium" size={20} color="#FFD700" />
                <Text style={styles.menuItemText}>Leaderboard</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/referral')} data-testid="go-referral">
                <Ionicons name="gift" size={20} color="#FF6A00" />
                <Text style={styles.menuItemText}>Refer & Earn $5</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/change-password')} data-testid="go-change-password">
                <Ionicons name="lock-closed" size={20} color={'#FF6A00'} />
                <Text style={styles.menuItemText}>Change Password</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/legal/terms')} data-testid="go-terms-privacy">
                <Ionicons name="document-text" size={20} color={COLORS.gray} />
                <Text style={styles.menuItemText}>Terms & Privacy</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </TouchableOpacity>

              {/* Bio */}
              {profile?.bio && (
                <View style={styles.bioCard}>
                  <Text style={styles.bioTitle}>About Me</Text>
                  <Text style={styles.bioText}>{profile.bio}</Text>
                </View>
              )}

              {/* Specializations */}
              {profile?.specializations?.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={styles.sectionTitle}>Specializations</Text>
                  <View style={styles.tagRow}>
                    {profile.specializations.map((s: string, i: number) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Gallery (editable) */}
          <View style={{ paddingHorizontal: 16 }}>
            <ProfileGallery
              gallery={profile?.gallery || []}
              editable
              onGalleryUpdated={(newGallery) => setProfile({ ...profile, gallery: newGallery })}
            />
            <SocialLinksDisplay socialLinks={profile?.socialLinks || {}} />

            {/* Trainer Vibe CTA */}
            <TouchableOpacity
              onPress={() => router.push('/trainer/vibe-setup')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,106,0,0.08)', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,106,0,0.15)' }}
              data-testid="trainer-vibe-setup-btn"
            >
              <LinearGradient colors={['#FF6A00', '#FF3D00']} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="musical-notes" size={22} color="#FFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>
                  {profile?.vibeTrackTitle ? 'Your Vibe' : 'Set Your Vibe'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
                  {profile?.vibeTrackTitle ? `${profile.vibeTrackTitle} - ${profile.vibeArtistName}` : 'Choose a profile anthem'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            {/* Highlight Reel Upload CTA */}
            <TouchableOpacity
              onPress={() => router.push('/trainer/highlight-upload')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
              data-testid="trainer-highlight-upload-btn"
            >
              <LinearGradient colors={['#1A2035', '#141929']} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,106,0,0.2)' }}>
                <Ionicons name="film" size={22} color="#FF6A00" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>Highlight Reel</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>Upload video clips to showcase your style</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            {/* Personality Tag CTA */}
            <TouchableOpacity
              onPress={() => setShowTagSelector(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(108,92,231,0.08)', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(108,92,231,0.15)' }}
              data-testid="trainer-personality-tag-btn"
            >
              <LinearGradient colors={['#6C5CE7', '#A29BFE']} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="sparkles" size={22} color="#FFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: 'Oswald_700Bold', color: '#FFF', letterSpacing: 0.5 }}>
                  {profile?.personalityTag || 'SET YOUR VIBE'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
                  {profile?.personalityTag ? 'Tap to change your personality tag' : 'Choose a tag that defines your energy'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            {/* Accent Color CTA */}
            <TouchableOpacity
              onPress={() => setShowColorPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: `${profile?.accentColor || '#FF6A00'}10`, borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: `${profile?.accentColor || '#FF6A00'}20` }}
              data-testid="trainer-accent-color-btn"
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: profile?.accentColor || '#FF6A00', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="color-palette" size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: 'Oswald_700Bold', color: '#FFF', letterSpacing: 0.5 }}>BRAND COLOR</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
                  Tints your card glow, hero, and accents
                </Text>
              </View>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: profile?.accentColor || '#FF6A00', borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' }} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
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
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontFamily: 'Oswald_700Bold', color: COLORS.white, letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  logoutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  content: { flex: 1, paddingHorizontal: 16 },
  loadingBox: { paddingTop: 60, alignItems: 'center' },

  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: COLORS.white },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: COLORS.white },
  verifiedBadge: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  name: { fontSize: 24, fontFamily: 'Oswald_700Bold', color: COLORS.white, marginTop: 12, letterSpacing: 1 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  shareProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6A00',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 14,
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shareProfileBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statValue: { fontSize: 26, fontFamily: 'Oswald_700Bold', color: COLORS.white, letterSpacing: 0.5 },
  statLabel: { fontSize: 11, fontFamily: 'Oswald_600SemiBold', color: 'rgba(255,255,255,0.6)', marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' },

  sectionTitle: { fontSize: 16, fontFamily: 'Oswald_700Bold', color: COLORS.white, marginBottom: 12, letterSpacing: 1 },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.white },

  bioCard: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  bioTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginBottom: 8 },
  bioText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },

  tagSection: { marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontSize: 13, fontWeight: '600', color: COLORS.white },
  // Streak styles
  streakCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 20, shadowColor: '#FF6A00', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  streakGradient: { padding: 16 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakFireBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  streakTitle: { fontSize: 18, fontFamily: 'Oswald_700Bold', color: COLORS.white, letterSpacing: 0.5 },
  streakSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
});

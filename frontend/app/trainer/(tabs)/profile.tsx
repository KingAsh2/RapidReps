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

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  orange: '#FF7F00',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
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

  useEffect(() => {
    loadProfile();
    loadStreaks();
  }, []);

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
      await Share.share({
        message: `Check out ${user?.fullName || 'this trainer'} on RapidReps! Book a session today. https://rapidreps.com/trainer/${user?.id}`,
        title: `${user?.fullName || 'Trainer'} on RapidReps`,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(26, 42, 94, 0.96)', 'rgba(26, 42, 94, 0.92)']} style={StyleSheet.absoluteFill} />

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile(); }} tintColor={COLORS.teal} />}
        >
          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator size="large" color={COLORS.teal} /></View>
          ) : (
            <>
              {/* Avatar + Name */}
              <View style={styles.avatarSection}>
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

                {/* Share Profile Button */}
                <TouchableOpacity onPress={handleShareProfile} style={styles.shareProfileBtn} data-testid="share-profile-btn">
                  <Ionicons name="share-social" size={18} color={COLORS.white} />
                  <Text style={styles.shareProfileBtnText}>Share Profile</Text>
                </TouchableOpacity>
              </View>

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
                <Ionicons name="shield-checkmark" size={20} color={COLORS.teal} />
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
                <Ionicons name="lock-closed" size={20} color={COLORS.teal} />
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
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 16 },
  loadingBox: { paddingTop: 60, alignItems: 'center' },

  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.teal },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  verifiedBadge: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.navy },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 12 },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  shareProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  shareProfileBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', color: COLORS.white },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginBottom: 12 },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 8 },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.white },

  bioCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginTop: 12 },
  bioTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginBottom: 8 },
  bioText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },

  tagSection: { marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: `${COLORS.teal}20`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '600', color: COLORS.teal },
  // Streak styles
  streakCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 20, shadowColor: '#FF6A00', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  streakGradient: { padding: 16 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakFireBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  streakTitle: { fontSize: 17, fontWeight: '900', color: COLORS.white },
  streakSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
});

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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/contexts/AuthContext';
import { streaksAPI } from '../../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  orange: '#FF7F00',
  teal: '#1FB8B4',
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

  const handleLogout = async () => {
    await logout();
    router.replace('/');
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
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.white },
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
});

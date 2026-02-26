import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const COLORS = {
  orange: '#FF7F00',
  teal: '#1FB8B4',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  success: '#00C853',
  warning: '#FFB300',
};

const backgroundImage = require('../../../assets/images/bg-box-jumps.png');

export default function TrainerProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/trainer-profiles/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
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

  const MenuItem = ({ icon, title, subtitle, onPress, color = COLORS.navy }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
    </TouchableOpacity>
  );

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(247, 147, 30, 0.92)', 'rgba(255, 127, 0, 0.88)']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: profile?.profilePhoto || 'https://via.placeholder.com/100' }}
                style={styles.avatar}
              />
              {profile?.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                </View>
              )}
            </View>
            <Text style={styles.profileName}>{user?.fullName || 'Trainer'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            
            {profile?.isVerified ? (
              <View style={styles.statusBadge}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
                <Text style={[styles.statusText, { color: COLORS.success }]}>Verified Trainer</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.statusBadge, { backgroundColor: COLORS.warning + '20' }]}
                onPress={() => router.push('/trainer/verification')}
              >
                <Ionicons name="alert-circle" size={16} color={COLORS.warning} />
                <Text style={[styles.statusText, { color: COLORS.warning }]}>Complete Verification</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            <MenuItem
              icon="person"
              title="Edit Profile"
              subtitle="Update your info and photos"
              onPress={() => router.push('/trainer/edit-profile')}
              color={COLORS.teal}
            />
            <MenuItem
              icon="shield-checkmark"
              title="Verification"
              subtitle={profile?.isVerified ? 'Completed' : 'Complete your verification'}
              onPress={() => router.push('/trainer/verification')}
              color={profile?.isVerified ? COLORS.success : COLORS.warning}
            />
            <MenuItem
              icon="trophy"
              title="Achievements"
              subtitle="View your badges and stats"
              onPress={() => router.push('/trainer/achievements')}
              color={COLORS.orange}
            />
            <MenuItem
              icon="settings"
              title="Settings"
              subtitle="Notifications, privacy"
              onPress={() => {}}
              color={COLORS.navy}
            />
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={22} color={COLORS.white} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
  },
  content: { flex: 1, paddingHorizontal: 16 },
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: COLORS.orange,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.navy,
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success + '20',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuSection: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  menuSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,82,82,0.9)',
    paddingVertical: 16,
    borderRadius: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});

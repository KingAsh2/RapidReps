import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  error: '#FF5252',
};

const backgroundImage = require('../../assets/images/bg-gym-weights.png');

interface DashboardStats {
  totalUsers: number;
  totalTrainers: number;
  totalTrainees: number;
  totalSessions: number;
  completedSessions: number;
  totalRevenueDollars: number;
  platformRevenueDollars: number;
  trainerPayoutsDollars: number;
  activeMemberships: number;
  activeBoosts: number;
  pendingVerifications: number;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/dashboard`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
      setError('');
    } catch (err: any) {
      console.error('Admin dashboard error:', err);
      setError(err?.response?.data?.detail || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color,
    onPress 
  }: { 
    title: string; 
    value: string | number; 
    icon: string;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity 
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  const AdminAction = ({ 
    title, 
    subtitle,
    icon, 
    color,
    onPress 
  }: { 
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={28} color={COLORS.white} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.orange} />
        <Text style={styles.loadingText}>Loading Admin Dashboard...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(26, 42, 94, 0.95)', 'rgba(26, 42, 94, 0.9)']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <TouchableOpacity onPress={loadDashboard} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadDashboard} />
          }
        >
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : stats ? (
            <>
              {/* Revenue Section */}
              <Text style={styles.sectionTitle}>💰 Revenue Overview</Text>
              <View style={styles.statsGrid}>
                <StatCard
                  title="Total Revenue"
                  value={`$${stats.totalRevenueDollars.toFixed(2)}`}
                  icon="cash"
                  color={COLORS.success}
                />
                <StatCard
                  title="Platform Revenue"
                  value={`$${stats.platformRevenueDollars.toFixed(2)}`}
                  icon="business"
                  color={COLORS.orange}
                />
                <StatCard
                  title="Trainer Payouts"
                  value={`$${stats.trainerPayoutsDollars.toFixed(2)}`}
                  icon="wallet"
                  color={COLORS.teal}
                />
                <StatCard
                  title="Active Memberships"
                  value={stats.activeMemberships}
                  icon="card"
                  color={COLORS.warning}
                />
              </View>

              {/* Users Section */}
              <Text style={styles.sectionTitle}>👥 Users</Text>
              <View style={styles.statsGrid}>
                <StatCard
                  title="Total Users"
                  value={stats.totalUsers}
                  icon="people"
                  color={COLORS.navy}
                  onPress={() => router.push('/admin/users')}
                />
                <StatCard
                  title="Trainers"
                  value={stats.totalTrainers}
                  icon="barbell"
                  color={COLORS.orange}
                  onPress={() => router.push('/admin/users?role=trainer')}
                />
                <StatCard
                  title="Trainees"
                  value={stats.totalTrainees}
                  icon="person"
                  color={COLORS.teal}
                  onPress={() => router.push('/admin/users?role=trainee')}
                />
                <StatCard
                  title="Pending Verifications"
                  value={stats.pendingVerifications}
                  icon="shield-checkmark"
                  color={stats.pendingVerifications > 0 ? COLORS.warning : COLORS.success}
                  onPress={() => router.push('/admin/verifications')}
                />
              </View>

              {/* Sessions Section */}
              <Text style={styles.sectionTitle}>📅 Sessions</Text>
              <View style={styles.statsGrid}>
                <StatCard
                  title="Total Sessions"
                  value={stats.totalSessions}
                  icon="calendar"
                  color={COLORS.navy}
                  onPress={() => router.push('/admin/sessions')}
                />
                <StatCard
                  title="Completed"
                  value={stats.completedSessions}
                  icon="checkmark-circle"
                  color={COLORS.success}
                />
                <StatCard
                  title="Active Boosts"
                  value={stats.activeBoosts}
                  icon="rocket"
                  color={COLORS.orange}
                />
              </View>

              {/* Quick Actions */}
              <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
              <View style={styles.actionsContainer}>
                <AdminAction
                  title="Manage Users"
                  subtitle="View, edit, and manage all users"
                  icon="people"
                  color={COLORS.teal}
                  onPress={() => router.push('/admin/users')}
                />
                <AdminAction
                  title="Pending Verifications"
                  subtitle={`${stats.pendingVerifications} trainers awaiting approval`}
                  icon="shield-checkmark"
                  color={COLORS.warning}
                  onPress={() => router.push('/admin/verifications')}
                />
                <AdminAction
                  title="View Transactions"
                  subtitle="Payment history and payouts"
                  icon="receipt"
                  color={COLORS.success}
                  onPress={() => router.push('/admin/transactions')}
                />
                <AdminAction
                  title="Session Management"
                  subtitle="View all training sessions"
                  icon="calendar"
                  color={COLORS.orange}
                  onPress={() => router.push('/admin/sessions')}
                />
              </View>
            </>
          ) : null}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginTop: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 24,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    gap: 12,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.navy,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 2,
  },
  actionsContainer: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  actionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
    marginTop: 2,
  },
});

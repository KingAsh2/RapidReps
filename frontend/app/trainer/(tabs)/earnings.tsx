import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
} from 'react-native';
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
};

const backgroundImage = require('../../../assets/images/bg-gym-weights.png');

export default function TrainerEarningsScreen() {
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    pendingPayout: 0,
    completedSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      // For now using placeholder data
      setEarnings({
        totalEarnings: 0,
        pendingPayout: 0,
        completedSessions: 0,
      });
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(26, 42, 94, 0.95)', 'rgba(26, 42, 94, 0.9)']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Earnings</Text>
          <Text style={styles.headerSubtitle}>Track your income</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Earnings Overview */}
          <View style={styles.statsContainer}>
            <StatCard
              title="Total Earnings"
              value={`$${earnings.totalEarnings.toFixed(2)}`}
              icon="cash"
              color={COLORS.success}
            />
            <StatCard
              title="Pending Payout"
              value={`$${earnings.pendingPayout.toFixed(2)}`}
              icon="time"
              color={COLORS.orange}
            />
            <StatCard
              title="Sessions Completed"
              value={earnings.completedSessions}
              icon="checkmark-circle"
              color={COLORS.teal}
            />
          </View>

          {/* Revenue Split Info */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={COLORS.teal} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Revenue Split</Text>
              <Text style={styles.infoText}>You keep 75% of every session. RapidReps takes 25% as a platform fee.</Text>
            </View>
          </View>

          {/* Payout Info */}
          <View style={styles.payoutCard}>
            <Text style={styles.payoutTitle}>💰 Payout Methods</Text>
            <Text style={styles.payoutText}>Payouts are processed via:</Text>
            <View style={styles.payoutMethods}>
              <View style={styles.payoutMethod}>
                <Ionicons name="card" size={20} color={COLORS.navy} />
                <Text style={styles.payoutMethodText}>Stripe</Text>
              </View>
              <View style={styles.payoutMethod}>
                <Ionicons name="cash" size={20} color={COLORS.navy} />
                <Text style={styles.payoutMethodText}>Cash App</Text>
              </View>
              <View style={styles.payoutMethod}>
                <Ionicons name="phone-portrait" size={20} color={COLORS.navy} />
                <Text style={styles.payoutMethodText}>Zelle</Text>
              </View>
            </View>
          </View>
          
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
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  content: { flex: 1, paddingHorizontal: 16 },
  statsContainer: { gap: 12, marginBottom: 20 },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderLeftWidth: 4,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.navy,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(31, 184, 180, 0.15)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  infoContent: { flex: 1 },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    lineHeight: 20,
  },
  payoutCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
  },
  payoutTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 8,
  },
  payoutText: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 16,
  },
  payoutMethods: {
    flexDirection: 'row',
    gap: 16,
  },
  payoutMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(26,42,94,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  payoutMethodText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
  },
});

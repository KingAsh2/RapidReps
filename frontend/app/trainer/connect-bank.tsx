import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { trainerAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';

const backgroundImage = require('../../assets/images/bg-gym-weights.png');

const COLORS = {
  orange: '#FF7F00',
  teal: '#1FB8B4',
  tealDark: '#18908D',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  success: '#00C853',
  error: '#FF4757',
};

export default function ConnectBankScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<{ connected: boolean; onboarded: boolean }>({
    connected: false,
    onboarded: false,
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await trainerAPI.connectStatus();
      setStatus(res);
      if (res.onboarded) {
        toast.success('Bank account already connected!');
      }
    } catch {
      // Not connected yet
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await trainerAPI.connectOnboard();
      if (res.alreadyOnboarded) {
        toast.success(res.message || 'Already connected!');
        setStatus({ connected: true, onboarded: true });
      } else if (res.url) {
        await Linking.openURL(res.url);
        // Poll for status after user returns
        setTimeout(checkStatus, 3000);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start bank setup');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDashboard = async () => {
    try {
      const res = await trainerAPI.connectDashboard();
      if (res.url) {
        await Linking.openURL(res.url);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to open dashboard');
    }
  };

  if (checking) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(26, 42, 94, 0.96)', 'rgba(26, 42, 94, 0.92)']} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.checkingText}>Checking bank status...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(26, 42, 94, 0.96)', 'rgba(26, 42, 94, 0.92)']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="connect-bank-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bank Account</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={status.onboarded ? [COLORS.success, '#00A844'] : [COLORS.teal, COLORS.tealDark]}
              style={styles.iconGradient}
            >
              <Ionicons
                name={status.onboarded ? 'checkmark-circle' : 'wallet'}
                size={48}
                color={COLORS.white}
              />
            </LinearGradient>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {status.onboarded ? 'Bank Account Connected' : 'Connect Your Bank Account'}
          </Text>
          <Text style={styles.subtitle}>
            {status.onboarded
              ? 'Your bank account is linked and ready to receive payouts. You can manage your account through the Stripe dashboard.'
              : 'Link your bank account to receive payouts for completed training sessions. This is required before you can start accepting sessions.'}
          </Text>

          {/* Info Cards */}
          {!status.onboarded && (
            <View style={styles.infoCards}>
              <View style={styles.infoCard}>
                <Ionicons name="shield-checkmark" size={22} color={COLORS.teal} />
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardTitle}>Secure & Private</Text>
                  <Text style={styles.infoCardText}>Powered by Stripe. Your banking details are never stored on our servers.</Text>
                </View>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="cash" size={22} color={COLORS.success} />
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardTitle}>Get Paid Fast</Text>
                  <Text style={styles.infoCardText}>Payouts are processed by RapidReps admin. Minimum payout: $35.</Text>
                </View>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="card" size={22} color={COLORS.orange} />
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardTitle}>You Keep 80%</Text>
                  <Text style={styles.infoCardText}>Earn 80% of every session. RapidReps takes 20% as a platform fee.</Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          {status.onboarded ? (
            <View style={styles.buttonGroup}>
              <TouchableOpacity onPress={handleViewDashboard} style={styles.primaryBtn} data-testid="view-stripe-dashboard-btn">
                <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.btnGradient}>
                  <Ionicons name="open-outline" size={20} color={COLORS.white} />
                  <Text style={styles.btnText}>View Stripe Dashboard</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={styles.secondaryBtn} data-testid="done-btn">
                <Text style={styles.secondaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleConnect}
              disabled={loading}
              style={styles.primaryBtn}
              data-testid="connect-bank-btn"
            >
              <LinearGradient colors={[COLORS.success, '#00A844']} style={styles.btnGradient}>
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="link" size={20} color={COLORS.white} />
                    <Text style={styles.btnText}>Connect Bank Account</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Refresh status link */}
          {!status.onboarded && status.connected && (
            <TouchableOpacity onPress={checkStatus} style={styles.refreshLink} data-testid="refresh-status-btn">
              <Ionicons name="refresh" size={16} color={COLORS.teal} />
              <Text style={styles.refreshText}>Refresh Status</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  checkingText: { color: COLORS.gray, fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center', paddingTop: 30 },
  iconContainer: { marginBottom: 24 },
  iconGradient: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.white, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 10 },
  infoCards: { width: '100%', gap: 12, marginBottom: 30 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    alignItems: 'flex-start',
  },
  infoCardContent: { flex: 1 },
  infoCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginBottom: 3 },
  infoCardText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  buttonGroup: { width: '100%', gap: 12 },
  primaryBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  btnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  secondaryBtn: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  refreshLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingVertical: 8 },
  refreshText: { fontSize: 14, fontWeight: '600', color: COLORS.teal },
});

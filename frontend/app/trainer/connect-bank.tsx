import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { trainerAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const backgroundImage = require('../../assets/images/bg-swimming.png');

const COLORS = {
  orange: '#FF7F00',
  teal: '#1a2a5e',
  tealDark: '#18908D',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  success: '#00C853',
  error: '#FF4757',
  zellePurple: '#6D1ED4',
};

export default function ConnectBankScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [zelleEmail, setZelleEmail] = useState('');
  const [zellePhone, setZellePhone] = useState('');
  const [hasInfo, setHasInfo] = useState(false);

  useEffect(() => {
    loadZelleInfo();
  }, []);

  const loadZelleInfo = async () => {
    setChecking(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await axios.get(`${API_URL}/api/trainer/zelle-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setZelleEmail(res.data.zelleEmail || '');
      setZellePhone(res.data.zellePhone || '');
      setHasInfo(res.data.hasZelleInfo || false);
    } catch {
      // Not set up yet
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (!zelleEmail && !zellePhone) {
      toast.error('Please enter your Zelle email or phone number');
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/api/trainer/zelle-info`,
        { zelleEmail, zellePhone },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      setHasInfo(true);
      toast.success('Zelle info saved!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save Zelle info');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.teal} />
          <Text style={styles.checkingText}>Loading Zelle info...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="connect-bank-back-btn">
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Zelle Setup</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={hasInfo ? [COLORS.success, '#00A844'] : [COLORS.zellePurple, '#8B3FF5']}
                style={styles.iconGradient}
              >
                <Ionicons
                  name={hasInfo ? 'checkmark-circle' : 'cash'}
                  size={48}
                  color={COLORS.white}
                />
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={styles.title}>
              {hasInfo ? 'Zelle Account Connected' : 'Set Up Zelle Payments'}
            </Text>
            <Text style={styles.subtitle}>
              {hasInfo
                ? 'Your Zelle info is saved. RapidReps admin will send payouts directly to your Zelle account.'
                : 'Enter your Zelle email or phone number to receive payouts for completed training sessions.'}
            </Text>

            {/* Form */}
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Zelle Email</Text>
                <TextInput
                  style={styles.input}
                  value={zelleEmail}
                  onChangeText={setZelleEmail}
                  placeholder="your@email.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  data-testid="zelle-email-input"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Zelle Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={zellePhone}
                  onChangeText={setZellePhone}
                  placeholder="(555) 555-5555"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  data-testid="zelle-phone-input"
                />
              </View>
            </View>

            {/* Info Cards */}
            <View style={styles.infoCards}>
              <View style={styles.infoCard}>
                <Ionicons name="shield-checkmark" size={22} color={COLORS.zellePurple} />
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardTitle}>Direct Payments</Text>
                  <Text style={styles.infoCardText}>Admin sends payouts directly to your Zelle account. No intermediaries.</Text>
                </View>
              </View>
              <View style={styles.infoCard}>
                <Ionicons name="cash" size={22} color={COLORS.success} />
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoCardTitle}>You Keep 80%</Text>
                  <Text style={styles.infoCardText}>Earn 80% of every session. Minimum payout: $35.</Text>
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              style={styles.primaryBtn}
              data-testid="save-zelle-btn"
            >
              <LinearGradient colors={[COLORS.zellePurple, '#8B3FF5']} style={styles.btnGradient}>
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name={hasInfo ? 'refresh' : 'save'} size={20} color={COLORS.white} />
                    <Text style={styles.btnText}>{hasInfo ? 'Update Zelle Info' : 'Save Zelle Info'}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {hasInfo && (
              <TouchableOpacity onPress={() => router.back()} style={styles.secondaryBtn} data-testid="done-btn">
                <Text style={styles.secondaryBtnText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  checkingText: { color: '#5a6785', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center', paddingTop: 20 },
  iconContainer: { marginBottom: 20 },
  iconGradient: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.white, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 10 },
  formCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 20, gap: 16, marginBottom: 20 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  input: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoCards: { width: '100%', gap: 10, marginBottom: 24 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoCardContent: { flex: 1 },
  infoCardTitle: { fontSize: 13, fontWeight: '700', color: COLORS.white, marginBottom: 2 },
  infoCardText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },
  primaryBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
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
});

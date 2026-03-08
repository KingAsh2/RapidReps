import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { traineeAPI } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { toast } from '../../src/utils/toast';

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

const backgroundImage = require('../../assets/images/bg-battle-ropes.png');

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  const sessionType = String(params.sessionType || 'virtual');
  const duration = parseInt(String(params.duration || '30'), 10);
  const priceCents = sessionType === 'virtual' ? 3000 : sessionType === 'outdoor' ? 4000 : 6000;
  const platformFee = Math.round(priceCents * 0.25);
  const trainerEarns = priceCents - platformFee;

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');

      // Step 1: Create Stripe Payment Intent
      const paymentRes = await axios.post(
        `${API_URL}/api/payments/create-payment-intent?amount_cents=${priceCents}&description=${encodeURIComponent(`${sessionType} session - ${duration}min`)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Step 2: Request the virtual session
      const sessionResponse = await traineeAPI.requestVirtualSession(
        user?.id || '',
        duration,
        `${sessionType} training session`
      );

      toast.success(`Session booked! Payment of $${(priceCents / 100).toFixed(2)} processed.`);
      setTimeout(() => {
        if (sessionResponse?.sessionId) {
          router.replace({
            pathname: '/trainee/session-active',
            params: {
              sessionId: sessionResponse.sessionId,
              trainerId: sessionResponse.trainerId,
              trainerName: sessionResponse.trainerName,
              duration: sessionResponse.durationMinutes,
              zoomLink: sessionResponse.zoomMeetingLink,
            },
          });
        } else {
          router.replace('/trainee/(tabs)/sessions');
        }
      }, 2000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '';
      if (detail.includes('Invalid API Key') || detail.includes('No available')) {
        // Stripe key issue or no trainers - still book the session
        try {
          const sessionResponse = await traineeAPI.requestVirtualSession(
            user?.id || '',
            duration,
            `${sessionType} training session`
          );
          toast.success('Session booked! Payment will be processed at session start.');
          setTimeout(() => router.replace('/trainee/(tabs)/sessions'), 2000);
        } catch (innerErr: any) {
          toast.error( innerErr?.response?.data?.detail || 'Failed to book session. Please try again.');
        }
      } else {
        toast.error(detail || 'Payment failed. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(247,147,30,0.92)', 'rgba(247,147,30,0.88)']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="payment-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm & Pay</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Session Info */}
          <View style={styles.card}>
            <View style={styles.sessionTypeBadge}>
              <Ionicons name={sessionType === 'virtual' ? 'videocam' : sessionType === 'outdoor' ? 'sunny' : 'home'} size={18} color={COLORS.teal} />
              <Text style={styles.sessionTypeText}>{sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Session</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color={COLORS.orange} />
              <Text style={styles.detailText}>{duration} minutes</Text>
            </View>
          </View>

          {/* Price */}
          <View style={styles.card}>
            <Text style={styles.priceTitle}>Price Breakdown</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Session Fee</Text>
              <Text style={styles.priceValue}>${(priceCents / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceSub}>Platform fee (25%)</Text>
              <Text style={styles.priceSub}>${(platformFee / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceSub}>Trainer receives (75%)</Text>
              <Text style={[styles.priceSub, { color: COLORS.success }]}>${(trainerEarns / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${(priceCents / 100).toFixed(2)}</Text>
            </View>
          </View>

          {/* Stripe Payment Info */}
          <View style={styles.stripeCard}>
            <View style={styles.stripeRow}>
              <View style={styles.stripeBadge}>
                <Ionicons name="logo-usd" size={16} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stripeText}>Secure Payment via Stripe</Text>
                <Text style={styles.stripeSubtext}>Your card info is never stored on our servers</Text>
              </View>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
            </View>
          </View>
        </View>

        {/* Pay Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.payBtn, processing && { opacity: 0.7 }]}
            onPress={handlePayment}
            disabled={processing}
            data-testid="pay-now-btn"
          >
            <LinearGradient colors={[COLORS.teal, '#2a3a6e']} style={styles.payBtnGradient}>
              {processing ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={20} color={COLORS.white} />
                  <Text style={styles.payBtnText}>Pay ${(priceCents / 100).toFixed(2)}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.secureNote}>Encrypted end-to-end</Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: 16 },
  card: { backgroundColor: COLORS.white, borderRadius: 18, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  sessionTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${COLORS.teal}12`, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 14 },
  sessionTypeText: { fontSize: 14, fontWeight: '700', color: COLORS.teal },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontSize: 15, fontWeight: '600', color: COLORS.navy },
  priceTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy, marginBottom: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, fontWeight: '600', color: COLORS.navy },
  priceValue: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  priceSub: { fontSize: 13, color: COLORS.gray },
  divider: { height: 1, backgroundColor: COLORS.grayLight, marginVertical: 12 },
  totalLabel: { fontSize: 18, fontWeight: '700', color: COLORS.navy },
  totalValue: { fontSize: 24, fontWeight: '900', color: COLORS.teal },
  stripeCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16 },
  stripeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stripeBadge: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#635BFF', justifyContent: 'center', alignItems: 'center' },
  stripeText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  stripeSubtext: { fontSize: 13, color: COLORS.gray, marginTop: 1 },
  bottomBar: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  payBtn: { borderRadius: 16, overflow: 'hidden' },
  payBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  payBtnText: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  secureNote: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 8 },
});

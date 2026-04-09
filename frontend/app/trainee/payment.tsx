import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Clipboard,
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
  zellePurple: '#6D1ED4',
};

const backgroundImage = require('../../assets/images/bg-battle-ropes.png');

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [zelleInfo, setZelleInfo] = useState({ zelleEmail: '', zellePhone: '' });
  const [paymentSent, setPaymentSent] = useState(false);

  const sessionType = String(params.sessionType || 'virtual');
  const sessionId = String(params.sessionId || '');
  const duration = parseInt(String(params.duration || '30'), 10);
  const priceCents = sessionType === 'virtual' ? 3000 : sessionType === 'outdoor' ? 4000 : 6000;
  const platformFee = Math.round(priceCents * 0.25);
  const trainerEarns = priceCents - platformFee;

  useEffect(() => {
    loadZelleInfo();
  }, []);

  const loadZelleInfo = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/zelle`);
      setZelleInfo(res.data);
    } catch {
      // Use defaults
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    toast.success(`${label} copied!`);
  };

  const handleMarkPaymentSent = async () => {
    if (!sessionId) {
      toast.error('No session ID found');
      return;
    }
    setProcessing(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/api/payments/zelle/mark-sent`,
        { sessionId, senderName: user?.fullName || '' },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      setPaymentSent(true);
      toast.success('Payment marked as sent! Admin will verify shortly.');
      setTimeout(() => router.replace('/trainee/(tabs)/sessions'), 3000);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to mark payment');
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
          <Text style={styles.headerTitle}>Pay via Zelle</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
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

          {/* Zelle Payment Instructions */}
          <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: COLORS.zellePurple }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.zellePurple, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="send" size={20} color={COLORS.white} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>Send via Zelle</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Open your banking app & send to:</Text>
              </View>
            </View>

            {zelleInfo.zelleEmail ? (
              <TouchableOpacity
                style={styles.zelleInfoRow}
                onPress={() => copyToClipboard(zelleInfo.zelleEmail, 'Email')}
                data-testid="copy-zelle-email"
              >
                <Ionicons name="mail" size={18} color={COLORS.zellePurple} />
                <Text style={styles.zelleInfoText}>{zelleInfo.zelleEmail}</Text>
                <Ionicons name="copy" size={16} color={COLORS.gray} />
              </TouchableOpacity>
            ) : null}

            {zelleInfo.zellePhone ? (
              <TouchableOpacity
                style={styles.zelleInfoRow}
                onPress={() => copyToClipboard(zelleInfo.zellePhone, 'Phone')}
                data-testid="copy-zelle-phone"
              >
                <Ionicons name="call" size={18} color={COLORS.zellePurple} />
                <Text style={styles.zelleInfoText}>{zelleInfo.zellePhone}</Text>
                <Ionicons name="copy" size={16} color={COLORS.gray} />
              </TouchableOpacity>
            ) : null}

            <View style={{ backgroundColor: `${COLORS.zellePurple}10`, borderRadius: 10, padding: 12, marginTop: 12 }}>
              <Text style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '600' }}>
                Amount: ${(priceCents / 100).toFixed(2)}
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                Include your name in the Zelle memo for faster verification.
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Action */}
        <View style={styles.bottomBar}>
          {paymentSent ? (
            <View style={[styles.sentBanner, { backgroundColor: COLORS.success }]}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
              <Text style={styles.payBtnText}>Payment Marked as Sent!</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.payBtn, processing && { opacity: 0.7 }]}
              onPress={handleMarkPaymentSent}
              disabled={processing}
              data-testid="mark-payment-sent-btn"
            >
              <LinearGradient colors={[COLORS.zellePurple, '#8B3FF5']} style={styles.payBtnGradient}>
                {processing ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                    <Text style={styles.payBtnText}>I've Sent the Payment</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
          <Text style={styles.secureNote}>Admin will verify your Zelle payment</Text>
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
  card: { backgroundColor: '#141929', borderRadius: 18, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  priceTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  priceValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  priceSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 12 },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  totalValue: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  zelleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8F4FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  zelleInfoText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  bottomBar: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  payBtn: { borderRadius: 16, overflow: 'hidden' },
  payBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  payBtnText: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  sentBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16, gap: 10 },
  secureNote: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8 },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { useNotifications } from '../../src/contexts/NotificationContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Stripe native SDK removed - payments handled via backend payment intent

const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
  error: '#FF4757',
};

const backgroundImage = require('../../assets/images/bg-battle-ropes.png');

export default function ConfirmBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refreshPendingSessionCount } = useNotifications();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'review' | 'processing' | 'success'>('review');

  const trainerName = String(params.trainerName || 'Your Trainer');
  const trainerId = String(params.trainerId || '');
  const date = String(params.date || 'Today');
  const time = String(params.time || '10:00 AM');
  const duration = String(params.duration || '60');
  const sessionType = String(params.sessionType || 'outdoor');

  const getMinPrice = (type: string): number => {
    switch (type) {
      case 'virtual': return 3000;
      case 'outdoor': return 4000;
      case 'in_home': return 6000;
      case 'trainee_home': return 6000;
      default: return 4000;
    }
  };

  const getSessionLabel = (type: string): string => {
    switch (type) {
      case 'virtual': return 'Virtual Session';
      case 'outdoor': return 'Outdoor Session';
      case 'in_home': return "Trainer's Gym";
      case 'trainee_home': return "Trainee's Home";
      default: return 'Training Session';
    }
  };

  const [showBookingModal, setShowBookingModal] = useState(false);

  const sessionPriceCents = Number(params.priceCents) || getMinPrice(sessionType);
  const serviceFeeCents = 200; // $2.00 flat service fee
  const trainerEarnings = Math.round(sessionPriceCents * 0.80);
  const platformFeeCents = sessionPriceCents - trainerEarnings;
  const totalCents = sessionPriceCents + serviceFeeCents;

  const handleConfirmPayment = async () => {
    haptic.medium();
    setIsProcessing(true);
    setPaymentStep('processing');

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      // Resolve trainee id from /auth/me (so we don't depend on a stale stored user object)
      const meRes = await axios.get(`${API_URL}/api/auth/me`, { headers });
      const traineeId = meRes.data?.id;
      if (!traineeId) {
        throw new Error('Could not resolve your account. Please sign in again.');
      }

      // Map sessionType -> locationType expected by backend
      const locationType =
        sessionType === 'virtual' ? 'virtual'
        : sessionType === 'in_home' ? 'home'
        : sessionType === 'trainee_home' ? 'home'
        : 'outdoor';

      // Build sessionDateTimeStart from params: date is a friendly label, so use ISO if provided, else default to +1 day
      const isoParam = String(params.sessionDateTimeStartIso || '');
      let sessionDateTimeStart: string;
      if (isoParam) {
        sessionDateTimeStart = isoParam;
      } else {
        const dt = new Date();
        dt.setDate(dt.getDate() + 1);
        dt.setHours(10, 0, 0, 0);
        sessionDateTimeStart = dt.toISOString();
      }

      // Actually create the session — status=REQUESTED on backend (shows under My Sessions → Pending)
      await axios.post(
        `${API_URL}/api/sessions`,
        {
          traineeId,
          trainerId,
          sessionDateTimeStart,
          durationMinutes: Number(duration) || 60,
          sessionType,
          locationType,
          locationNameOrAddress: String(params.locationNameOrAddress || (sessionType === 'virtual' ? 'Virtual' : 'TBD')),
        },
        { headers }
      );

      setPaymentStep('success');
      setShowBookingModal(true);
      // Refresh the pending session count so the tab badge updates immediately.
      refreshPendingSessionCount().catch(() => {});
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Booking failed. Please try again.';
      setPaymentStep('review');
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <><ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(10, 14, 26, 0.95)', 'rgba(17, 24, 39, 0.92)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="booking-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Session Details Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.sessionTypeBadge}>
                <Ionicons
                  name={sessionType === 'virtual' ? 'videocam' : sessionType === 'outdoor' ? 'sunny' : 'home'}
                  size={18}
                  color={'#FF6A00'}
                />
                <Text style={styles.sessionTypeText}>{getSessionLabel(sessionType)}</Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Ionicons name="person" size={18} color={COLORS.orange} />
                <View>
                  <Text style={styles.detailLabel}>Trainer</Text>
                  <Text style={styles.detailValue}>{trainerName}</Text>
                </View>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="calendar" size={18} color={COLORS.orange} />
                <View>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{date}</Text>
                </View>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="time" size={18} color={COLORS.orange} />
                <View>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>{time}</Text>
                </View>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="hourglass" size={18} color={COLORS.orange} />
                <View>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{duration} min</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Price Breakdown */}
          <View style={styles.card}>
            <Text style={styles.priceTitle}>Price Breakdown</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Session Fee</Text>
              <Text style={styles.priceValue}>${(sessionPriceCents / 100).toFixed(2)}</Text>
            </View>
            {/* Price split hidden from trainee per design */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service Fee</Text>
              <Text style={styles.priceValue}>${(serviceFeeCents / 100).toFixed(2)}</Text>
            </View>

            <View style={styles.priceDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>You Pay</Text>
              <Text style={styles.totalValue}>${(totalCents / 100).toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment Method - Zelle */}
          <View style={styles.card}>
            <View style={styles.paymentHeader}>
              <Ionicons name="cash" size={20} color={'#FFFFFF'} />
              <Text style={styles.paymentTitle}>Payment via Zelle</Text>
            </View>
            <View style={styles.stripeRow}>
              <View style={[styles.stripeBadge, { backgroundColor: '#6D1ED4' }]}>
                <Ionicons name="send" size={16} color={COLORS.white} />
              </View>
              <View style={styles.stripeInfo}>
                <Text style={styles.stripeText}>Pay via Zelle</Text>
                <Text style={styles.stripeSubtext}>Send payment after booking confirmation</Text>
              </View>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
            </View>
          </View>

          {/* Policies */}
          <View style={styles.policyCard}>
            <View style={styles.policyRow}>
              <Ionicons name="time-outline" size={16} color={'#FF6A00'} />
              <Text style={styles.policyText}>Free cancellation up to 24 hours before session</Text>
            </View>
            <View style={styles.policyRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={'#FF6A00'} />
              <Text style={styles.policyText}>All trainers are background-checked and verified</Text>
            </View>
            <View style={styles.policyRow}>
              <Ionicons name="lock-closed-outline" size={16} color={'#FF6A00'} />
              <Text style={styles.policyText}>Zelle payments are sent directly to RapidReps</Text>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.confirmBtn, isProcessing && styles.confirmBtnDisabled]}
            onPress={handleConfirmPayment}
            disabled={isProcessing}
            data-testid="confirm-pay-btn"
          >
            <LinearGradient colors={['#FF6A00', '#FF9F1C']} style={styles.confirmBtnGradient}>
              {isProcessing ? (
                <>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.confirmBtnText}>Processing...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                  <Text style={styles.confirmBtnText}>Confirm Booking - ${(totalCents / 100).toFixed(2)}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.secureNote}>Pay via Zelle after confirmation</Text>
        </View>
      </SafeAreaView>
    </ImageBackground>

      {/* Booking Success Modal */}
      <Modal visible={showBookingModal} transparent animationType="fade" data-testid="booking-success-modal">
        <View style={bookingModalStyles.overlay}>
          <View style={bookingModalStyles.content}>
            <View style={bookingModalStyles.iconCircle}>
              <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
            </View>
            <Text style={bookingModalStyles.title}>Training Request Sent!</Text>
            <Text style={bookingModalStyles.subtitle}>
              Your training request has been sent to {trainerName}.{'\n\n'}
              You can find this session in My Sessions → Pending.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowBookingModal(false);
                router.replace({ pathname: '/trainee/(tabs)/sessions', params: { tab: 'pending' } });
              }}
              style={bookingModalStyles.btn}
              data-testid="booking-modal-view-sessions-btn"
            >
              <LinearGradient colors={['#FF6A00', '#FF9F1C']} style={bookingModalStyles.btnGradient}>
                <Text style={bookingModalStyles.btnText}>View My Pending Sessions</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowBookingModal(false);
                router.replace('/trainee/(tabs)/home');
              }}
              style={bookingModalStyles.secondaryBtn}
            >
              <Text style={bookingModalStyles.secondaryText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const bookingModalW = Dimensions.get('window').width - 48;
const bookingModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  content: { width: bookingModalW, backgroundColor: '#141929', borderRadius: 24, padding: 32, alignItems: 'center' },
  iconCircle: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  btnGradient: { paddingVertical: 16, alignItems: 'center' },
  btnText: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  secondaryBtn: { paddingVertical: 12 },
  secondaryText: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  content: { flex: 1, paddingHorizontal: 16 },

  card: { backgroundColor: '#141929', borderRadius: 18, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  cardHeader: { marginBottom: 16 },
  sessionTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,106,0,0.07)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignSelf: 'flex-start' },
  sessionTypeText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  detailGrid: { gap: 14 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  detailValue: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  priceTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  priceValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  priceSublabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  priceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  totalValue: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },

  paymentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  paymentTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  stripeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 },
  stripeBadge: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#635BFF', justifyContent: 'center', alignItems: 'center' },
  stripeInfo: { flex: 1 },
  stripeText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  stripeSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 1 },

  policyCard: { backgroundColor: 'rgba(20, 25, 41, 0.92)', borderRadius: 14, padding: 16, gap: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyText: { fontSize: 13, color: 'rgba(255,255,255,0.92)', flex: 1, fontWeight: '500' },

  bottomBar: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  confirmBtn: { borderRadius: 16, overflow: 'hidden' },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  confirmBtnText: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  secureNote: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8 },
});

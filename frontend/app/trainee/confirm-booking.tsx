import React, { useState, useEffect } from 'react';
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
import { DS } from '../../src/theme/designSystem';
import { UserAvatar } from '../../src/components/UserAvatar';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Stripe native SDK removed - payments handled via backend payment intent

const COLORS = {
  orange: DS.colors.orange,
  orangeLight: DS.colors.orangeGlow,
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: DS.colors.textPrimary,
  gray: DS.colors.textSecondary,
  grayLight: '#F5F6F8',
  success: DS.colors.success,
  error: DS.colors.error,
};

const backgroundImage = require('../../assets/images/bg-battle-ropes.jpg');

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

  // iter118p (spec #5): fetch trainer profile so the summary card can show
  // photo + name + rating prominently at the top — leaves no ambiguity about
  // WHO the trainee is about to pay before hitting confirm.
  const [trainerProfile, setTrainerProfile] = useState<any>(null);
  useEffect(() => {
    if (!trainerId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const res = await axios.get(
          `${API_URL}/api/trainer-profiles/${trainerId}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!cancelled) setTrainerProfile(res.data);
      } catch { /* silent — fall back to trainerName-only */ }
    })();
    return () => { cancelled = true; };
  }, [trainerId]);

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
      case 'outdoor': return 'In-Person Session';
      case 'in_home': return "Trainer's Gym";
      case 'trainee_home': return "Trainee's Home";
      default: return 'Training Session';
    }
  };

  const [showBookingModal, setShowBookingModal] = useState(false);

  const sessionPriceCents = Number(params.priceCents) || getMinPrice(sessionType);
  // iter96b (#23): flat $2.99 service fee — applied ON TOP of trainer's rate
  const serviceFeeCents = 299;
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
          {/* iter118p (spec #5): Trainer identity ABOVE the price breakdown so
              the last screen before payment makes WHO you're paying
              unambiguous. Photo + name + optional rating render prominently. */}
          <View style={[styles.card, styles.trainerHeaderCard]}>
            <UserAvatar
              size={64}
              user={{
                fullName: trainerProfile?.fullName || trainerName,
                profilePhoto: trainerProfile?.profilePhoto,
                profilePhotoUrl: trainerProfile?.profilePhotoUrl,
                avatarUrl: trainerProfile?.avatarUrl,
              }}
              style={{ borderWidth: 2, borderColor: 'rgba(255,106,0,0.6)', borderRadius: 32 } as any}
            />
            <View style={styles.trainerHeaderMeta}>
              <Text style={styles.trainerHeaderLabel}>YOU&apos;RE BOOKING</Text>
              <Text style={styles.trainerHeaderName} numberOfLines={1}>
                {trainerProfile?.fullName || trainerName}
              </Text>
              {trainerProfile?.averageRating != null && trainerProfile.averageRating > 0 ? (
                <View style={styles.trainerHeaderRatingRow}>
                  <Ionicons name="star" size={13} color="#FFD700" />
                  <Text style={styles.trainerHeaderRatingText}>
                    {Number(trainerProfile.averageRating).toFixed(1)}
                    {trainerProfile?.totalSessions ? ` · ${trainerProfile.totalSessions} sessions` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

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

          {/* Payment Method - Stripe */}
          <View style={styles.card}>
            <View style={styles.paymentHeader}>
              <Ionicons name="card" size={20} color={'#FFFFFF'} />
              <Text style={styles.paymentTitle}>Payment via Stripe</Text>
            </View>
            <View style={styles.stripeRow}>
              <View style={[styles.stripeBadge, { backgroundColor: '#635BFF' }]}>
                <Ionicons name="card" size={16} color={COLORS.white} />
              </View>
              <View style={styles.stripeInfo}>
                <Text style={styles.stripeText}>Pay securely with Stripe</Text>
                <Text style={styles.stripeSubtext}>You won't be charged until you and the trainer agree on time & location.</Text>
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
              <Text style={styles.policyText}>Stripe-secured payments — protected end-to-end</Text>
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
          <Text style={styles.secureNote}>Stripe checkout opens after both parties agree on time & location</Text>
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
  // iter118p (spec #5): prominent trainer identity header above price.
  trainerHeaderCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: 'rgba(255,106,0,0.25)' },
  trainerHeaderMeta: { flex: 1, minWidth: 0 },
  trainerHeaderLabel: { fontSize: 11, fontWeight: '800', color: '#FF9F1C', letterSpacing: 1.2, marginBottom: 4 },
  trainerHeaderName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  trainerHeaderRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  trainerHeaderRatingText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
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

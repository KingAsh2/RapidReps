/**
 * Trainee Payment screen (iter95) — Stripe-only, tier-aware, negotiation-gated.
 *
 * Flow:
 *  1. Reads /api/sessions/{id}/negotiation/timeline to confirm paymentReady = true
 *  2. Fetches /api/pricing/quote with session's tier/modality/duration/base
 *  3. Surfaces ONLY customer_total to the trainee
 *  4. On confirm → /api/payments/create-payment-intent → Stripe Checkout
 *
 * Zelle has been fully removed. Trainees can only pay via Stripe.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import RapidBg from '../../src/components/RapidBg';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { formatCents } from '../../src/utils/pricing';
import { formatApiError } from '../../src/utils/formatApiError';

// iter106o: real Stripe PaymentSheet (card + Apple Pay + Google Pay).
// Native-only — on web the hook returns no-ops so we gracefully fall back
// to the legacy intent-only flow. Resolved ONCE at module load so the
// hook below is always called in the same order on every render.
let _resolvedUseStripe: null | (() => { initPaymentSheet?: (opts: any) => Promise<{ error?: { message: string } }>; presentPaymentSheet?: () => Promise<{ error?: { message: string; code?: string } }>; }) = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _resolvedUseStripe = require('@stripe/stripe-react-native').useStripe;
  } catch {
    _resolvedUseStripe = null;
  }
}
const useStripeSheet = () => (_resolvedUseStripe ? _resolvedUseStripe() : ({} as { initPaymentSheet?: any; presentPaymentSheet?: any }));

const C = {
  bg: '#06080F',
  bgCard: '#0E121C',
  border: 'rgba(255,255,255,0.08)',
  orange: '#FF7A00',
  orangeGlow: '#FF9B2F',
  text: '#FFFFFF',
  textMuted: '#7C8295',
  textSec: '#C6CBD9',
  error: '#EF4444',
};

export default function PaymentScreen() {
  const router = useRouter();
  const { sessionId, autoPay } = useLocalSearchParams<{ sessionId: string; autoPay?: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useStripeSheet();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [agreedTime, setAgreedTime] = useState<string | null>(null);
  const [agreedLocation, setAgreedLocation] = useState<any>(null);
  const [pricing, setPricing] = useState<any>(null);
  // iter106ai: track whether we've already auto-triggered to avoid loops
  // when load() re-runs.
  const autoPayFired = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      toast.error('No session ID');
      router.back();
      return;
    }
    load();
  }, [sessionId]);

  const load = async () => {
    try {
      // 1) Check negotiation status
      const tl = await api.get(`/sessions/${sessionId}/negotiation/timeline`);
      setPaymentReady(!!tl.data.paymentReady);
      setAgreedTime(tl.data.agreedTime || null);
      setAgreedLocation(tl.data.agreedLocation || null);

      // 2) Load session for pricing.
      // iter118aa: field-name reconciliation — the session doc written by
      // POST /sessions uses `finalSessionPriceCents` / `platformFeeCents`
      // / `durationMinutes` / `sessionType`, NOT the older
      // `totalCents` / `baseCents` / `tier` / `modality` names the
      // payment screen used to look for. When neither shape matched,
      // pricing stayed null → the Pay button rendered "$0.00" and
      // tapping fired the misleading "Payment unlocks after both parties
      // agree" toast even though the parties WERE agreed.
      const sess = await api.get(`/sessions/${sessionId}`);
      const s = sess.data;

      // Preferred path: legacy tier-based quote when we have the full old shape.
      if (s.tier && s.modality && s.durationMin && s.baseCents != null) {
        const q = await api.get(
          `/pricing/quote?tier=${s.tier}&modality=${s.modality}&duration=${s.durationMin}&base_cents=${s.baseCents}`,
        );
        setPricing(q.data);
      } else {
        // New/canonical path: read directly from the session doc.
        const totalCents =
          s.finalSessionPriceCents ??
          s.totalChargedCents ??
          s.totalCents ??
          s.customerTotalCents ??
          0;
        const baseCents = s.baseSessionPriceCents ?? s.baseCents ?? totalCents;
        const serviceFeeCents = s.platformFeeCents ?? 0;
        const duration = s.durationMinutes ?? s.durationMin ?? 60;
        const modality = s.sessionType ?? s.modality ?? 'outdoor';
        setPricing({
          customer_total_cents: totalCents,
          base_price_cents: baseCents,
          service_fee_cents: serviceFeeCents,
          tier_label: s.tier || 'Session',
          duration_min: duration,
          modality,
        });
      }
    } catch (e: any) {
      toast.error(formatApiError(e, 'Failed to load payment details'));
    } finally {
      setLoading(false);
    }
  };

  // iter106ai: auto-open the Stripe sheet when we got here via the
  // "Locked in! Tap to pay" notification (autoPay=1). One tap from
  // notification → native pay sheet. We only fire once, and only when
  // every precondition is satisfied (payment unlocked + pricing loaded +
  // not already processing).
  useEffect(() => {
    if (
      autoPay === '1' &&
      !autoPayFired.current &&
      !loading &&
      paymentReady &&
      pricing &&
      !processing
    ) {
      autoPayFired.current = true;
      handlePay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPay, loading, paymentReady, pricing]);

  const handlePay = async () => {
    // iter118aa: give the trainee an accurate reason, not the generic
    // "unlocks after agreement" toast that fires even when the parties
    // have agreed but pricing didn't resolve.
    if (!paymentReady) {
      toast.error('Payment unlocks after the trainer accepts your proposal.');
      return;
    }
    if (!pricing || !pricing.customer_total_cents) {
      toast.error('Session price is unavailable — please refresh, or contact support if this persists.');
      return;
    }
    haptic.medium();
    setProcessing(true);
    try {
      // 1. Server creates a PaymentIntent.
      const { data } = await api.post(
        `/payments/create-payment-intent?amount_cents=${pricing.customer_total_cents}&session_id=${sessionId}&description=RapidReps Session`,
      );

      // Corporate full-subsidy shortcut: no Stripe gateway needed.
      if (data.fullySubsidized || !data.clientSecret) {
        haptic.success();
        await api.post('/payments/sessions/confirm', { sessionId, paymentIntentId: data.paymentIntentId });
        Alert.alert('Booked!', `Fully covered by ${data.companyName || 'your employer'}.`, [
          { text: 'OK', onPress: () => router.replace(`/trainee/session-detail?sessionId=${sessionId}`) },
        ]);
        return;
      }

      // 2. Open native PaymentSheet (card + Apple Pay + Google Pay).
      if (!initPaymentSheet || !presentPaymentSheet) {
        // Web fallback — Stripe.js path not yet implemented.
        toast.error('Card payments on web are coming soon — please use the mobile app.');
        return;
      }
      const initRes = await initPaymentSheet({
        paymentIntentClientSecret: data.clientSecret,
        merchantDisplayName: 'RapidReps',
        style: 'alwaysDark',
        applePay: { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: true, currencyCode: 'USD' },
        returnURL: 'rapidreps://stripe-redirect',
        allowsDelayedPaymentMethods: false,
      });
      if (initRes?.error) {
        throw new Error(initRes.error.message || 'Could not initialize payment.');
      }
      const presentRes = await presentPaymentSheet();
      if (presentRes?.error) {
        // User cancelled = not an error worth shouting about
        if (presentRes.error.code === 'Canceled') {
          setProcessing(false);
          return;
        }
        throw new Error(presentRes.error.message || 'Payment failed.');
      }

      // 3. Tell our backend to verify with Stripe and mark the session paid.
      await api.post('/payments/sessions/confirm', { sessionId, paymentIntentId: data.paymentIntentId });
      haptic.success();
      Alert.alert('Payment confirmed', 'Your session is locked in. See you there!', [
        { text: 'OK', onPress: () => router.replace(`/trainee/session-detail?sessionId=${sessionId}`) },
      ]);
    } catch (e: any) {
      haptic.error();
      toast.error(formatApiError(e, 'Payment failed'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={s.loader}><ActivityIndicator size="large" color={C.orange} /></SafeAreaView>;
  }

  return (
    <RapidBg variant="trainee-payment" style={{ flex: 1 }}>
    <SafeAreaView style={s.container}>
      <LinearGradient colors={['rgba(10,14,26,0.85)', 'rgba(20,25,41,0.82)']} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="payment-back">
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Confirm & Pay</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll}>
        {!paymentReady && (
          <View style={s.warnCard}>
            <Ionicons name="time-outline" size={26} color={C.orangeGlow} />
            <Text style={s.warnText}>
              Both parties must agree on time {agreedLocation ? '' : 'and location '}before payment.
            </Text>
          </View>
        )}

        {pricing && (
          <View style={s.priceCard}>
            <Text style={s.eyebrow}>{pricing.tier_label?.toUpperCase?.()} · {pricing.duration_min} MIN · {pricing.modality === 'virtual' ? 'VIRTUAL' : 'IN-PERSON'}</Text>
            <Text style={s.totalLabel}>You Pay</Text>
            <Text style={s.totalValue}>{formatCents(pricing.customer_total_cents)}</Text>
            {pricing.service_fee_cents > 0 && (
              <Text style={s.breakdown}>
                {formatCents(pricing.base_price_cents)} session + {formatCents(pricing.service_fee_cents)} service fee
              </Text>
            )}
          </View>
        )}

        {agreedTime && (
          <View style={s.agreedCard}>
            <Text style={s.agreedLabel}>AGREED SESSION</Text>
            <View style={s.agreedRow}>
              <Ionicons name="calendar" size={18} color={C.orangeGlow} />
              <Text style={s.agreedValue}>{new Date(agreedTime).toLocaleString()}</Text>
            </View>
            {agreedLocation?.address && (
              <View style={s.agreedRow}>
                <Ionicons name="location" size={18} color={C.orangeGlow} />
                <Text style={s.agreedValue}>{agreedLocation.address}</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[s.payBtn, (!paymentReady || processing) && { opacity: 0.5 }]}
          onPress={handlePay}
          disabled={!paymentReady || processing}
          data-testid="confirm-pay-btn"
        >
          <LinearGradient colors={['#FF6A00', '#FF9B2F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.payBtnGrad}>
            {processing ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Ionicons name="card" size={20} color="#FFF" />
                <Text style={s.payBtnText}>
                  {paymentReady ? `Pay ${formatCents(pricing?.customer_total_cents || 0)}` : 'Awaiting Agreement'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Secure payments by Stripe. You won&apos;t be charged until the trainer accepts the agreed session details.
        </Text>
      </ScrollView>
    </SafeAreaView>
    </RapidBg>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loader: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 60 },
  warnCard: { backgroundColor: 'rgba(255,155,47,0.10)', borderColor: 'rgba(255,155,47,0.4)', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18, flexDirection: 'row', gap: 12, alignItems: 'center' },
  warnText: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
  priceCard: { backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 22, marginBottom: 16, alignItems: 'center' },
  eyebrow: { color: C.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  totalLabel: { color: C.textSec, fontSize: 14, fontWeight: '700', marginTop: 18 },
  totalValue: { color: C.text, fontSize: 52, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  breakdown: { color: C.textMuted, fontSize: 12, fontWeight: '500', marginTop: 8 },
  agreedCard: { backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 18, marginBottom: 18 },
  agreedLabel: { color: C.orangeGlow, fontSize: 11, fontWeight: '900', letterSpacing: 1.8, marginBottom: 10 },
  agreedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  agreedValue: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1 },
  payBtn: { borderRadius: 28, overflow: 'hidden', marginTop: 8 },
  payBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  disclaimer: { color: C.textMuted, fontSize: 12, fontWeight: '500', textAlign: 'center', marginTop: 20, lineHeight: 18, paddingHorizontal: 12 },
});

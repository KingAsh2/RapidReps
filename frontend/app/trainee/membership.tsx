import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import { toast } from '../../src/utils/toast';

let useStripeHook: any = null;
if (Platform.OS !== 'web') {
  try {
    const stripeMod = require('@stripe/stripe-react-native');
    useStripeHook = stripeMod.useStripe;
  } catch {}
}

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  orange: '#FF7F00',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  grayLight: '#F5F6F8',
  success: '#00C853',
  warning: '#FFB300',
  gold: '#FFD700',
};

const backgroundImage = require('../../assets/images/bg-spin-class.png');

const BENEFITS = [
  { icon: 'pricetag', text: 'Discounted session rates', color: COLORS.success },
  { icon: 'flash', text: '1 free profile Boost per month', color: COLORS.orange },
  { icon: 'headset', text: 'Priority customer support', color: COLORS.teal },
  { icon: 'star', text: 'Early access to elite trainers', color: COLORS.gold },
  { icon: 'ribbon', text: 'Exclusive member badge', color: '#9C27B0' },
];

export default function MembershipScreen() {
  const router = useRouter();
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  // Native Stripe hooks
  const stripe = useStripeHook ? useStripeHook() : null;

  useEffect(() => {
    checkMembership();
  }, []);

  const checkMembership = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await axios.get(`${API_URL}/api/memberships/my-membership`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMembership(res.data);
    } catch (err) {
      console.error('Error checking membership:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      
      // Step 1: Create payment intent + pending membership on backend
      const res = await axios.post(
        `${API_URL}/api/memberships/subscribe`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const { membershipId, paymentIntentId, clientSecret } = res.data;

      // Step 2: Present Stripe PaymentSheet on native, auto-confirm on web
      if (stripe && clientSecret && Platform.OS !== 'web') {
        const { error: initError } = await stripe.initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'RapidReps',
          style: 'alwaysDark',
        });
        if (initError) {
          toast.error(initError.message);
          return;
        }
        const { error: presentError } = await stripe.presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== 'Canceled') {
            toast.error(presentError.message);
          }
          return; // User cancelled or payment failed — don't confirm
        }
      }

      // Step 3: Confirm the payment on our backend
      await axios.post(
        `${API_URL}/api/memberships/${membershipId}/confirm-payment`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Welcome to RapidReps Pro! Your membership is now active.');
      checkMembership();
    } catch (err: any) {
      toast.error( err?.response?.data?.detail || 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(26, 42, 94, 0.95)', 'rgba(26, 42, 94, 0.9)']} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={COLORS.teal} /></View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(26, 42, 94, 0.95)', 'rgba(26, 42, 94, 0.9)']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="membership-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Membership</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <LinearGradient colors={['#FFD700', '#FFA000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Ionicons name="diamond" size={28} color={COLORS.gold} />
            </View>
            <Text style={styles.heroTitle}>RapidReps Pro</Text>
            <Text style={styles.heroSubtitle}>Unlock premium fitness features</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>$19.99</Text>
              <Text style={styles.priceFrequency}>/month</Text>
            </View>
          </LinearGradient>

          {/* Active Membership Badge */}
          {membership?.hasMembership && (
            <View style={styles.activeCard} data-testid="membership-active">
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>Active Member</Text>
                <Text style={styles.activeSubtitle}>
                  Next billing: {new Date(membership.membership?.nextBillingDate).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}

          {/* Benefits */}
          <Text style={styles.sectionTitle}>What You Get</Text>
          {BENEFITS.map((b, idx) => (
            <View key={idx} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: `${b.color}20` }]}>
                <Ionicons name={b.icon as any} size={20} color={b.color} />
              </View>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}

          {/* Comparison */}
          <View style={styles.compareCard}>
            <Text style={styles.compareTitle}>Free vs Pro</Text>
            <View style={styles.compareRow}>
              <Text style={styles.compareLabel}>Session booking</Text>
              <Ionicons name="checkmark" size={18} color={COLORS.success} />
              <Ionicons name="checkmark" size={18} color={COLORS.success} />
            </View>
            <View style={styles.compareRow}>
              <Text style={styles.compareLabel}>Discounted rates</Text>
              <Ionicons name="close" size={18} color={COLORS.gray} />
              <Ionicons name="checkmark" size={18} color={COLORS.success} />
            </View>
            <View style={styles.compareRow}>
              <Text style={styles.compareLabel}>Free monthly boost</Text>
              <Ionicons name="close" size={18} color={COLORS.gray} />
              <Ionicons name="checkmark" size={18} color={COLORS.success} />
            </View>
            <View style={styles.compareRow}>
              <Text style={styles.compareLabel}>Priority support</Text>
              <Ionicons name="close" size={18} color={COLORS.gray} />
              <Ionicons name="checkmark" size={18} color={COLORS.success} />
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* CTA */}
        {!membership?.hasMembership && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.subscribeBtn}
              onPress={handleSubscribe}
              disabled={subscribing}
              data-testid="subscribe-btn"
            >
              <LinearGradient colors={[COLORS.gold, '#FFA000']} style={styles.subscribeBtnGradient}>
                {subscribing ? (
                  <ActivityIndicator size="small" color={COLORS.navy} />
                ) : (
                  <>
                    <Ionicons name="diamond" size={20} color={COLORS.navy} />
                    <Text style={styles.subscribeBtnText}>Subscribe for $19.99/month</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.cancelNote}>Cancel anytime. No commitment.</Text>
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  content: { flex: 1, paddingHorizontal: 16 },

  heroCard: { borderRadius: 22, padding: 28, alignItems: 'center', marginBottom: 20 },
  heroBadge: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: COLORS.navy },
  heroSubtitle: { fontSize: 14, color: 'rgba(26,42,94,0.7)', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  priceAmount: { fontSize: 42, fontWeight: '900', color: COLORS.navy },
  priceFrequency: { fontSize: 16, fontWeight: '600', color: 'rgba(26,42,94,0.6)', marginLeft: 4 },

  activeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: `${COLORS.success}15`, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: `${COLORS.success}30` },
  activeTitle: { fontSize: 16, fontWeight: '700', color: COLORS.success },
  activeSubtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white, marginBottom: 14 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  benefitIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  benefitText: { fontSize: 15, fontWeight: '600', color: COLORS.white, flex: 1 },

  compareCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, marginTop: 12 },
  compareTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginBottom: 14 },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  compareLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', flex: 1 },

  bottomBar: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  subscribeBtn: { borderRadius: 16, overflow: 'hidden' },
  subscribeBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  subscribeBtnText: { fontSize: 17, fontWeight: '800', color: COLORS.navy },
  cancelNote: { fontSize: 12, color: COLORS.gray, textAlign: 'center', marginTop: 8 },
});

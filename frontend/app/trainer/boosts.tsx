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
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';

// Stripe native SDK removed - payments handled via backend payment intent
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  orange: '#FF7F00',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
};

const backgroundImage = require('../../assets/images/bg-box-jumps.png');

type BoostType = 'daily' | 'weekly' | 'monthly';

const BOOST_OPTIONS: { id: BoostType; label: string; price: number; duration: string; icon: string; popular?: boolean }[] = [
  { id: 'daily', label: 'Day Boost', price: 4.99, duration: '24 hours', icon: 'flash' },
  { id: 'weekly', label: 'Week Boost', price: 14.99, duration: '7 days', icon: 'trending-up', popular: true },
  { id: 'monthly', label: 'Month Boost', price: 29.99, duration: '30 days', icon: 'rocket' },
];

export default function BoostsScreen() {
  const router = useRouter();
  const [selectedBoost, setSelectedBoost] = useState<BoostType>('weekly');
  const [purchasing, setPurchasing] = useState(false);
  const [activeBoosts, setActiveBoosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBoosts();
  }, []);

  const loadBoosts = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await axios.get(`${API_URL}/api/boosts/my-boosts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveBoosts(res.data.boosts || []);
    } catch (err) {
      // Endpoint may not exist yet, that's OK
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const option = BOOST_OPTIONS.find(o => o.id === selectedBoost);
      
      // Step 1: Create payment intent + pending boost on backend
      const res = await axios.post(
        `${API_URL}/api/boosts/purchase?boost_type=${selectedBoost}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const { boostId, isFreeBoost, paymentIntentId, clientSecret } = res.data;
      
      if (isFreeBoost) {
        toast.success(`Your membership free boost is now active for ${option?.duration}.`);
        loadBoosts();
        return;
      }

      // Note: Native Stripe SDK removed due to Apple Pay entitlement issues
      // Payment intent created - proceed to confirm boost
      // Future: Implement Stripe Checkout redirect for payments
      await axios.post(
        `${API_URL}/api/boosts/${boostId}/confirm-payment`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`${option?.label} boost activated for ${option?.duration}!`);
      loadBoosts();
    } catch (err: any) {
      toast.error( err?.response?.data?.detail || 'Failed to purchase boost');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(255, 127, 0, 0.94)', 'rgba(255, 127, 0, 0.88)']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="boosts-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Visibility Boosts</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.heroCard}>
            <Ionicons name="rocket" size={40} color={COLORS.orange} />
            <Text style={styles.heroTitle}>Get More Clients</Text>
            <Text style={styles.heroSubtitle}>
              Boost your profile to the top of search results and get noticed by more trainees in your area.
            </Text>
          </View>

          {/* Active Boost */}
          {activeBoosts.filter(b => b.isActive).length > 0 && (
            <View style={styles.activeBanner} data-testid="active-boost-banner">
              <Ionicons name="flash" size={20} color={COLORS.orange} />
              <Text style={styles.activeBannerText}>You have an active boost!</Text>
            </View>
          )}

          {/* Boost Options */}
          <Text style={styles.sectionTitle}>Choose Your Boost</Text>
          {BOOST_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.boostCard, selectedBoost === option.id && styles.boostCardSelected]}
              onPress={() => setSelectedBoost(option.id)}
              data-testid={`boost-option-${option.id}`}
            >
              {option.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}
              <View style={styles.boostRow}>
                <View style={[styles.boostIconBg, selectedBoost === option.id && { backgroundColor: `${COLORS.orange}20` }]}>
                  <Ionicons name={option.icon as any} size={24} color={selectedBoost === option.id ? COLORS.orange : COLORS.gray} />
                </View>
                <View style={styles.boostInfo}>
                  <Text style={[styles.boostLabel, selectedBoost === option.id && { color: '#FFFFFF' }]}>{option.label}</Text>
                  <Text style={styles.boostDuration}>{option.duration} of visibility</Text>
                </View>
                <View style={styles.boostPriceBox}>
                  <Text style={[styles.boostPrice, selectedBoost === option.id && { color: '#FFFFFF' }]}>${option.price}</Text>
                </View>
              </View>
              {selectedBoost === option.id && (
                <View style={styles.selectedIndicator}>
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.orange} />
                </View>
              )}
            </TouchableOpacity>
          ))}

          {/* Benefits */}
          <Text style={styles.sectionTitle}>Boost Benefits</Text>
          <View style={styles.benefitsCard}>
            {[
              { icon: 'search', text: 'Appear at the top of trainee searches' },
              { icon: 'eye', text: 'Get 5x more profile views' },
              { icon: 'notifications', text: 'Highlighted profile badge' },
              { icon: 'trending-up', text: 'Priority in nearby trainer results' },
            ].map((b, idx) => (
              <View key={idx} style={styles.benefitRow}>
                <Ionicons name={b.icon as any} size={18} color={'#FF6A00'} />
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          {/* Revenue note */}
          <View style={styles.noteCard}>
            <Ionicons name="information-circle" size={18} color={'#FF6A00'} />
            <Text style={styles.noteText}>
              100% of boost revenue goes to the platform to maintain and improve services for all trainers.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* CTA */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.purchaseBtn}
            onPress={handlePurchase}
            disabled={purchasing}
            data-testid="purchase-boost-btn"
          >
            <LinearGradient colors={['#FF6A00', '#FF9F1C']} style={styles.purchaseBtnGradient}>
              {purchasing ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="flash" size={20} color={COLORS.white} />
                  <Text style={styles.purchaseBtnText}>
                    Boost Now - ${BOOST_OPTIONS.find(o => o.id === selectedBoost)?.price}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  content: { flex: 1, paddingHorizontal: 16 },

  heroCard: { backgroundColor: '#141929', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginTop: 12 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${COLORS.orange}15`, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: `${COLORS.orange}30` },
  activeBannerText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white, marginBottom: 12, marginTop: 8 },

  boostCard: { backgroundColor: '#141929', borderRadius: 16, padding: 18, marginBottom: 10, borderWidth: 2, borderColor: 'transparent', position: 'relative', overflow: 'hidden' },
  boostCardSelected: { borderColor: COLORS.orange },
  popularBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.orange, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 10 },
  popularText: { fontSize: 13, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  boostRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  boostIconBg: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  boostInfo: { flex: 1 },
  boostLabel: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  boostDuration: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  boostPriceBox: {},
  boostPrice: { fontSize: 20, fontWeight: '900', color: 'rgba(255,255,255,0.5)' },
  selectedIndicator: { position: 'absolute', top: 14, left: 14 },

  benefitsCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, gap: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { fontSize: 14, color: COLORS.white, flex: 1 },

  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: `${'#FF6A00'}15`, borderRadius: 12, padding: 14, marginTop: 12 },
  noteText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1, lineHeight: 18 },

  bottomBar: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  purchaseBtn: { borderRadius: 16, overflow: 'hidden' },
  purchaseBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  purchaseBtnText: { fontSize: 17, fontWeight: '800', color: COLORS.white },
});

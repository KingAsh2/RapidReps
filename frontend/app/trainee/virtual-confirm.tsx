import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type ScreenPhase = 'searching' | 'matched' | 'error';

export default function VirtualConfirmScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [phase, setPhase] = useState<ScreenPhase>('searching');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [trainerDetails, setTrainerDetails] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation for searching phase
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // Dot animation
    Animated.loop(
      Animated.timing(dotAnim, { toValue: 3, duration: 1500, useNativeDriver: false }),
    ).start();

    createRequest();
  }, []);

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('accessToken');
    return { Authorization: `Bearer ${token}` };
  };

  const createRequest = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.post(`${API_URL}/api/virtual/request`, {}, { headers });
      const data = res.data;
      setRequestId(data.requestId);

      if (data.status === 'matched') {
        // Already matched from a previous request
        await fetchRequestStatus(data.requestId);
      } else {
        // Start polling for match
        pollForMatch(data.requestId);
      }
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err?.response?.data?.detail || 'Failed to create request');
    }
  };

  const pollForMatch = (reqId: string) => {
    const interval = setInterval(async () => {
      try {
        const headers = await getAuthHeader();
        const res = await axios.get(`${API_URL}/api/virtual/request/${reqId}`, { headers });
        if (res.data.status === 'matched') {
          clearInterval(interval);
          setTrainerDetails(res.data.trainerDetails);
          setPhase('matched');
          Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        } else if (res.data.status === 'cancelled') {
          clearInterval(interval);
          router.back();
        }
      } catch {
        // Continue polling
      }
    }, 3000);

    // Timeout after 3 minutes
    setTimeout(() => {
      clearInterval(interval);
    }, 180000);
  };

  const fetchRequestStatus = async (reqId: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/api/virtual/request/${reqId}`, { headers });
      if (res.data.status === 'matched' && res.data.trainerDetails) {
        setTrainerDetails(res.data.trainerDetails);
        setPhase('matched');
        Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }
    } catch {
      // ignore
    }
  };

  const handleAcceptTrainer = async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/api/virtual/trainee-confirm/${requestId}`, {}, { headers });
      // Navigate to payment screen with trainer info
      router.push({
        pathname: '/trainee/payment',
        params: {
          trainerId: trainerDetails?.trainerId || '',
          sessionType: 'virtual',
          priceCents: String(trainerDetails?.virtualRateCents || 3000),
        },
      });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleFindAnother = async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/api/virtual/find-another/${requestId}`, {}, { headers });
      setPhase('searching');
      setTrainerDetails(null);
      fadeIn.setValue(0);
      pollForMatch(requestId);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (requestId) {
      try {
        const headers = await getAuthHeader();
        await axios.post(`${API_URL}/api/virtual/cancel/${requestId}`, {}, { headers });
      } catch {
        // ignore
      }
    }
    router.back();
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  const tierLabel = (tier: string) =>
    tier === 'elite' ? 'Elite' : tier === 'pro' ? 'Pro' : 'Rising Star';
  const tierColor = (tier: string) =>
    tier === 'elite' ? Colors.orange : tier === 'pro' ? Colors.teal : Colors.gray;

  // Searching dots text
  const dots = dotAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['.', '..', '...', '...'],
  });

  // --- SEARCHING PHASE ---
  if (phase === 'searching') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={[Colors.navy, '#1a2a5e']} style={StyleSheet.absoluteFillObject} />

        <View style={s.header}>
          <Pressable onPress={handleCancel} style={s.backBtn} data-testid="virtual-cancel-btn">
            <Ionicons name="close" size={24} color={Colors.white} />
          </Pressable>
        </View>

        <View style={s.centerContent}>
          <Animated.View style={[s.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient colors={[Colors.teal, '#0D8B88']} style={s.pulseInner}>
              <Ionicons name="videocam" size={48} color={Colors.white} />
            </LinearGradient>
          </Animated.View>

          <Text style={s.searchTitle}>Finding Your Trainer</Text>
          <Text style={s.searchSub}>Notifying available virtual trainers...</Text>

          <View style={s.searchDots}>
            <ActivityIndicator size="small" color={Colors.teal} />
            <Text style={s.searchDotsText}>This usually takes 1-3 minutes</Text>
          </View>

          <View style={s.featureList}>
            <View style={s.featureRow}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
              <Text style={s.featureText}>No charge if no trainer available</Text>
            </View>
            <View style={s.featureRow}>
              <Ionicons name="people" size={18} color={Colors.teal} />
              <Text style={s.featureText}>Matching with certified trainers</Text>
            </View>
            <View style={s.featureRow}>
              <Ionicons name="flash" size={18} color={Colors.orange} />
              <Text style={s.featureText}>First available trainer wins</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- ERROR PHASE ---
  if (phase === 'error') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <LinearGradient colors={[Colors.navy, '#1a2a5e']} style={StyleSheet.absoluteFillObject} />
        <View style={s.centerContent}>
          <Ionicons name="warning" size={60} color={Colors.error} />
          <Text style={s.searchTitle}>Something Went Wrong</Text>
          <Text style={s.searchSub}>{errorMsg}</Text>
          <Pressable onPress={() => router.back()} style={s.retryBtn} data-testid="virtual-error-back-btn">
            <Text style={s.retryBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- MATCHED PHASE ---
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={[Colors.navy, '#1a2a5e']} style={StyleSheet.absoluteFillObject} />

      <View style={s.header}>
        <Pressable onPress={handleCancel} style={s.backBtn} data-testid="virtual-matched-back-btn">
          <Ionicons name="close" size={24} color={Colors.white} />
        </Pressable>
        <Text style={s.headerTitle}>Trainer Found!</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.ScrollView style={{ flex: 1, opacity: fadeIn }} contentContainerStyle={s.matchContent}>
        {/* Trainer Photo */}
        <View style={s.trainerPhotoWrap}>
          {trainerDetails?.profilePhoto ? (
            <Image source={{ uri: trainerDetails.profilePhoto }} style={s.trainerPhoto} />
          ) : (
            <LinearGradient colors={[Colors.teal, Colors.orange]} style={s.trainerPhoto}>
              <Ionicons name="person" size={50} color={Colors.white} />
            </LinearGradient>
          )}
          <View style={s.matchBadge}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
          </View>
        </View>

        {/* Trainer Name + Badge */}
        <Text style={s.trainerName}>{trainerDetails?.fullName || 'Your Trainer'}</Text>
        <View style={s.badgeRow}>
          <View style={[s.tierBadge, { backgroundColor: `${tierColor(trainerDetails?.tier || 'basic')}20` }]}>
            <Ionicons name="ribbon" size={14} color={tierColor(trainerDetails?.tier || 'basic')} />
            <Text style={[s.tierText, { color: tierColor(trainerDetails?.tier || 'basic') }]}>
              {tierLabel(trainerDetails?.tier || 'basic')}
            </Text>
          </View>
          {trainerDetails?.averageRating > 0 && (
            <View style={s.ratingBadge}>
              <Ionicons name="star" size={14} color="#FFB300" />
              <Text style={s.ratingText}>{trainerDetails.averageRating}</Text>
              <Text style={s.reviewCount}>({trainerDetails.totalReviews})</Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {trainerDetails?.bio ? (
          <View style={s.bioCard}>
            <Text style={s.bioText}>{trainerDetails.bio}</Text>
          </View>
        ) : null}

        {/* Session Price Card */}
        <View style={s.priceCard}>
          <View style={s.priceRow}>
            <Text style={s.priceLabel}>Virtual Session</Text>
            <Text style={s.priceValue}>{formatPrice(trainerDetails?.virtualRateCents || 3000)}</Text>
          </View>
          <Text style={s.priceSub}>30-minute live video training</Text>
        </View>

        {/* Action Buttons */}
        <Pressable
          onPress={handleAcceptTrainer}
          disabled={loading}
          style={s.acceptBtn}
          data-testid="virtual-accept-trainer-btn"
        >
          <LinearGradient colors={[Colors.teal, '#0D8B88']} style={s.acceptBtnGrad}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
                <Text style={s.acceptBtnText}>Accept Trainer</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={handleFindAnother}
          disabled={loading}
          style={s.findAnotherBtn}
          data-testid="virtual-find-another-btn"
        >
          <Ionicons name="refresh" size={18} color={Colors.white} />
          <Text style={s.findAnotherText}>Find Another Trainer</Text>
        </Pressable>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  // Searching
  pulseCircle: {
    marginBottom: 32,
  },
  pulseInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  searchTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  searchSub: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  searchDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 40,
  },
  searchDotsText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  featureList: { gap: 14, width: '100%' },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  // Matched
  matchContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  trainerPhotoWrap: {
    marginBottom: 16,
    marginTop: 12,
  },
  trainerPhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.teal,
  },
  matchBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.navy,
    borderRadius: 16,
    padding: 2,
  },
  trainerName: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tierText: { fontSize: 12, fontWeight: '800' },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,179,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: { fontSize: 13, fontWeight: '800', color: '#FFB300' },
  reviewCount: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  bioCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    marginBottom: 20,
  },
  bioText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
  priceCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceLabel: { fontSize: 15, fontWeight: '700', color: Colors.white },
  priceValue: { fontSize: 28, fontWeight: '900', color: Colors.teal },
  priceSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  // Buttons
  acceptBtn: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: Colors.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  acceptBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  acceptBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  findAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    width: '100%',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  findAnotherText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  retryBtn: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    backgroundColor: Colors.teal,
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
  },
});

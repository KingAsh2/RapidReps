import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
  Image,
  ScrollView,
  Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type ScreenPhase = 'searching' | 'matched' | 'no_match' | 'error';

export default function VirtualConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionType = (params.sessionType as string) || 'virtual';
  const { user } = useAuth();
  const [phase, setPhase] = useState<ScreenPhase>('searching');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [trainerDetails, setTrainerDetails] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [trainersNotified, setTrainersNotified] = useState(0);

  // Animations
  const radarAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Play boxing-bell sound on trainer match
  const playBoxingBell = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/boxing-bell.wav'),
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      // Sound playback is non-critical
    }
  };

  useEffect(() => {
    // Radar spin
    Animated.loop(
      Animated.timing(radarAnim, { toValue: 1, duration: 2500, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Ripple rings
    const startRipple = (anim: Animated.Value, delay: number) => {
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        ).start();
      }, delay);
    };
    startRipple(ring1, 0);
    startRipple(ring2, 700);
    startRipple(ring3, 1400);

    // Timer
    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);

    createRequest();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('accessToken');
    return { Authorization: `Bearer ${token}` };
  };

  const createRequest = async () => {
    try {
      const headers = await getAuthHeader();
      const endpoint = sessionType === 'in_person' ? '/api/instant/request' : '/api/virtual/request';
      const res = await axios.post(`${API_URL}${endpoint}`, {}, { headers });
      const data = res.data;
      setRequestId(data.requestId);
      setTrainersNotified(data.trainersNotified || 0);

      if (data.fallback === 'no_trainers_nearby') {
        setPhase('no_match');
        return;
      }

      if (data.status === 'matched') {
        await fetchRequestStatus(data.requestId);
      } else {
        pollForMatch(data.requestId);
      }
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(err?.response?.data?.detail || 'Failed to create request');
    }
  };

  const pollForMatch = (reqId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const headers = await getAuthHeader();
        const res = await axios.get(`${API_URL}/api/virtual/request/${reqId}`, { headers });
        if (res.data.status === 'matched') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          setTrainerDetails(res.data.trainerDetails);
          setPhase('matched');
          Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        } else if (res.data.status === 'cancelled') {
          if (pollRef.current) clearInterval(pollRef.current);
          router.back();
        }
      } catch { /* continue */ }
    }, 3000);

    // Timeout after 3 minutes
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase(prev => prev === 'searching' ? 'no_match' : prev);
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
    } catch { /* ignore */ }
  };

  const handleAcceptTrainer = async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/api/virtual/trainee-confirm/${requestId}`, {}, { headers });
      router.push({
        pathname: '/trainee/payment',
        params: {
          trainerId: trainerDetails?.trainerId || '',
          sessionType,
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
      setElapsedSec(0);
      fadeIn.setValue(0);
      timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
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
      } catch { /* ignore */ }
    }
    router.back();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const tierLabel = (tier: string) => tier === 'elite' ? 'Elite' : tier === 'pro' ? 'Pro' : 'Rising Star';
  const tierColor = (tier: string) => tier === 'elite' ? Colors.orange : tier === 'pro' ? Colors.teal : '#888';

  const isVirtual = sessionType === 'virtual';
  const sessionLabel = isVirtual ? 'Virtual Live' : 'In-Person';

  // Ripple ring style
  const makeRingStyle = (anim: Animated.Value, size: number) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: Colors.teal,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
  });

  // --- SEARCHING ---
  if (phase === 'searching') {
    const radarRotate = radarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <LinearGradient colors={['#0a1128', '#1a2a5e']} style={StyleSheet.absoluteFillObject} />

        <View style={st.header}>
          <Pressable onPress={handleCancel} style={st.backBtn} data-testid="virtual-cancel-btn">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text style={st.headerTitle}>{sessionLabel} Session</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={st.centerContent} showsVerticalScrollIndicator={false}>
          {/* Radar */}
          <View style={st.radarWrap}>
            <Animated.View style={makeRingStyle(ring1, 100)} />
            <Animated.View style={makeRingStyle(ring2, 100)} />
            <Animated.View style={makeRingStyle(ring3, 100)} />
            <Animated.View style={[st.radarCircle, { transform: [{ rotate: radarRotate }] }]}>
              <LinearGradient colors={[Colors.teal, '#0D8B88']} style={st.radarInner}>
                <Ionicons name={isVirtual ? 'videocam' : 'location'} size={40} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </View>

          <Text style={st.searchTitle}>Finding Your Trainer</Text>
          <Text style={st.searchSub}>Searching for available {sessionLabel.toLowerCase()} trainers{!isVirtual ? ' nearby' : ''}...</Text>

          {/* Timer + Stats */}
          <View style={st.timerRow}>
            <View style={st.timerBox}>
              <Text style={st.timerValue}>{formatTime(elapsedSec)}</Text>
              <Text style={st.timerLabel}>Elapsed</Text>
            </View>
            <View style={st.timerDivider} />
            <View style={st.timerBox}>
              <Text style={st.timerValue}>{trainersNotified}</Text>
              <Text style={st.timerLabel}>Notified</Text>
            </View>
            <View style={st.timerDivider} />
            <View style={st.timerBox}>
              <Text style={st.timerValue}>~2 min</Text>
              <Text style={st.timerLabel}>Est. Wait</Text>
            </View>
          </View>

          {/* Features */}
          <View style={st.featureList}>
            <View style={st.featureRow}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
              <Text style={st.featureText}>No charge if no trainer available</Text>
            </View>
            <View style={st.featureRow}>
              <Ionicons name="flash" size={18} color={Colors.orange} />
              <Text style={st.featureText}>Wave-based matching — best trainers first</Text>
            </View>
            <View style={st.featureRow}>
              <Ionicons name="trophy" size={18} color="#FFB300" />
              <Text style={st.featureText}>Scored by ETA, rating & availability</Text>
            </View>
          </View>

          {/* Cancel */}
          <Pressable onPress={handleCancel} style={st.cancelBtn} data-testid="virtual-cancel-bottom-btn">
            <Text style={st.cancelText}>Cancel Search</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- NO MATCH / FALLBACK ---
  if (phase === 'no_match') {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <LinearGradient colors={['#0a1128', '#1a2a5e']} style={StyleSheet.absoluteFillObject} />
        <View style={st.header}>
          <Pressable onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text style={st.headerTitle}>No Trainers Found</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={st.centerContent}>
          <Ionicons name="search-outline" size={64} color={Colors.gray} />
          <Text style={st.searchTitle}>No Trainers Available</Text>
          <Text style={st.searchSub}>
            {!isVirtual
              ? 'No in-person trainers are nearby right now.'
              : 'No virtual trainers are available right now.'}
          </Text>
          <View style={{ gap: 12, width: '100%', marginTop: 24 }}>
            {!isVirtual && (
              <Pressable
                onPress={() => {
                  if (requestId) handleCancel();
                  router.replace({ pathname: '/trainee/virtual-confirm', params: { sessionType: 'virtual' } });
                }}
                style={st.fallbackBtn}
                data-testid="fallback-virtual-btn"
              >
                <LinearGradient colors={[Colors.teal, '#0D8B88']} style={st.fallbackBtnGrad}>
                  <Ionicons name="videocam" size={20} color="#fff" />
                  <Text style={st.fallbackBtnText}>Try Virtual Session Instead</Text>
                </LinearGradient>
              </Pressable>
            )}
            <Pressable onPress={() => router.back()} style={st.cancelBtn} data-testid="fallback-schedule-btn">
              <Text style={st.cancelText}>Schedule for Later</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- ERROR ---
  if (phase === 'error') {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <LinearGradient colors={['#0a1128', '#1a2a5e']} style={StyleSheet.absoluteFillObject} />
        <View style={st.header}>
          <Pressable onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text style={st.headerTitle}>Error</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[st.centerContent, { justifyContent: 'center' }]}>
          <Ionicons name="warning" size={60} color={Colors.error} />
          <Text style={st.searchTitle}>Something Went Wrong</Text>
          <Text style={st.searchSub}>{errorMsg}</Text>
          <Pressable onPress={() => router.back()} style={[st.cancelBtn, { marginTop: 24 }]}>
            <Text style={st.cancelText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // --- MATCHED ---
  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <LinearGradient colors={['#0a1128', '#1a2a5e']} style={StyleSheet.absoluteFillObject} />

      <View style={st.header}>
        <Pressable onPress={handleCancel} style={st.backBtn} data-testid="virtual-matched-back-btn">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={st.headerTitle}>Trainer Found!</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.ScrollView style={{ flex: 1, opacity: fadeIn }} contentContainerStyle={st.matchContent} showsVerticalScrollIndicator={false}>
        {/* Photo */}
        <View style={st.trainerPhotoWrap}>
          {trainerDetails?.profilePhoto ? (
            <Image source={{ uri: trainerDetails.profilePhoto }} style={st.trainerPhoto} />
          ) : (
            <LinearGradient colors={[Colors.teal, Colors.orange]} style={st.trainerPhoto}>
              <Ionicons name="person" size={50} color="#fff" />
            </LinearGradient>
          )}
          <View style={st.matchBadge}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
          </View>
        </View>

        <Text style={st.trainerName}>{trainerDetails?.fullName || 'Your Trainer'}</Text>

        <View style={st.badgeRow}>
          <View style={[st.tierBadge, { backgroundColor: `${tierColor(trainerDetails?.tier || 'basic')}25` }]}>
            <Ionicons name="ribbon" size={14} color={tierColor(trainerDetails?.tier || 'basic')} />
            <Text style={[st.tierText, { color: tierColor(trainerDetails?.tier || 'basic') }]}>
              {tierLabel(trainerDetails?.tier || 'basic')}
            </Text>
          </View>
          {trainerDetails?.averageRating > 0 && (
            <View style={st.ratingBadge}>
              <Ionicons name="star" size={14} color="#FFB300" />
              <Text style={st.ratingText}>{trainerDetails.averageRating}</Text>
              <Text style={st.reviewCount}>({trainerDetails.totalReviews})</Text>
            </View>
          )}
        </View>

        {trainerDetails?.bio ? (
          <View style={st.bioCard}>
            <Text style={st.bioText}>{trainerDetails.bio}</Text>
          </View>
        ) : null}

        <View style={st.priceCard}>
          <View style={st.priceRow}>
            <Text style={st.priceLabel}>{sessionLabel} Session</Text>
            <Text style={st.priceValue}>{formatPrice(trainerDetails?.virtualRateCents || 3000)}</Text>
          </View>
          <Text style={st.priceSub}>30-minute live {isVirtual ? 'video' : 'in-person'} training</Text>
        </View>

        <Pressable onPress={handleAcceptTrainer} disabled={loading} style={st.acceptBtn} data-testid="virtual-accept-trainer-btn">
          <LinearGradient colors={[Colors.teal, '#0D8B88']} style={st.acceptBtnGrad}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={st.acceptBtnText}>Accept Trainer</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable onPress={handleFindAnother} disabled={loading} style={st.findAnotherBtn} data-testid="virtual-find-another-btn">
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={st.findAnotherText}>Find Another Trainer</Text>
        </Pressable>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  centerContent: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 40, paddingTop: 20 },
  // Radar
  radarWrap: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  radarCircle: {},
  radarInner: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 10 },
  searchTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8 },
  searchSub: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  // Timer
  timerRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12, width: '100%', marginBottom: 28 },
  timerBox: { flex: 1, alignItems: 'center' },
  timerValue: { fontSize: 18, fontWeight: '900', color: '#fff' },
  timerLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  timerDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  // Features
  featureList: { gap: 10, width: '100%', marginBottom: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18 },
  featureText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  // Cancel
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', width: '100%', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // Fallback
  fallbackBtn: { borderRadius: 28, overflow: 'hidden' },
  fallbackBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  fallbackBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  // Match
  matchContent: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  trainerPhotoWrap: { marginBottom: 16, marginTop: 12 },
  trainerPhoto: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: Colors.teal },
  matchBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0a1128', borderRadius: 16, padding: 2 },
  trainerName: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tierText: { fontSize: 12, fontWeight: '800' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,179,0,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  ratingText: { fontSize: 13, fontWeight: '800', color: '#FFB300' },
  reviewCount: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  bioCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, width: '100%', marginBottom: 20 },
  bioText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)', lineHeight: 22 },
  priceCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 20, width: '100%', marginBottom: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  priceLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  priceValue: { fontSize: 28, fontWeight: '900', color: Colors.teal },
  priceSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  acceptBtn: { width: '100%', borderRadius: 28, overflow: 'hidden', marginBottom: 14, shadowColor: Colors.teal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  acceptBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  acceptBtnText: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  findAnotherBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, width: '100%', borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  findAnotherText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

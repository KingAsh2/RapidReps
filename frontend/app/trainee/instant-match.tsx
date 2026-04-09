import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Modal, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { instantMatchAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { haptic } from '../../src/utils/haptics';

const backgroundImage = require('../../assets/images/bg-jump-rope.jpg');
const { width } = Dimensions.get('window');
const COLORS = { orange: '#FF6A00', orangeLight: '#FF9F1C', teal: '#1a2a5e', navy: '#1a2a5e', white: '#FFFFFF', gray: '#5a6785', success: '#00D26A', error: '#FF4757' };

export default function InstantMatchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [status, setStatus] = useState<'locating' | 'searching' | 'matched' | 'expired' | 'error'>('locating');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [message, setMessage] = useState('Getting your location...');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startMatch();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startMatch = async () => {
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') { setStatus('error'); setMessage('Location permission required'); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setStatus('searching');
      setMessage('Finding nearby trainers...');

      const res = await instantMatchAPI.start(loc.coords.latitude, loc.coords.longitude, 'outdoor', 30);
      if (res.matchId) {
        setMatchId(res.matchId);
        setTotalCandidates(res.totalCandidates);
        startPolling(res.matchId);
      } else {
        setStatus('expired');
        setMessage(res.detail || 'No trainers available nearby');
      }
    } catch (e: any) {
      setStatus('expired');
      setMessage(e?.response?.data?.detail || 'No trainers available. Try again later.');
    }
  };

  const startPolling = (id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await instantMatchAPI.getStatus(id);
        setCandidateIndex(res.currentCandidateIndex || 0);
        if (res.status === 'matched') {
          if (pollRef.current) clearInterval(pollRef.current);
          haptic.success();
          setStatus('matched');
          setSessionId(res.sessionId);
          setMessage('Trainer found!');
        } else if (res.status === 'expired' || res.status === 'cancelled') {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus('expired');
          setMessage('No trainers available right now. Try again.');
        }
      } catch (e) { console.error('Poll error', e); }
    }, 2000);
  };

  const handleCancel = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (matchId) { try { await instantMatchAPI.cancel(matchId); } catch (e) {} }
    router.back();
  };

  const handleGoToSession = () => {
    if (sessionId) router.replace({ pathname: '/trainee/(tabs)/sessions' });
  };

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <LinearGradient colors={['rgba(255, 127, 0, 0.92)', 'rgba(255, 106, 0, 0.88)']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backBtn} data-testid="instant-match-back">
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Instant Workout</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Animated search indicator */}
        <View style={styles.searchCircleWrap}>
          {status === 'searching' ? (
            <Animated.View style={[styles.outerRing, { transform: [{ scale: pulseAnim }] }]}>
              <Animated.View style={[styles.innerRing, { transform: [{ rotate: spin }] }]}>
                <View style={styles.searchIcon}>
                  <Ionicons name="fitness" size={48} color={COLORS.white} />
                </View>
              </Animated.View>
            </Animated.View>
          ) : status === 'matched' ? (
            <View style={[styles.outerRing, { borderColor: COLORS.success }]}>
              <View style={[styles.searchIcon, { backgroundColor: COLORS.success }]}>
                <Ionicons name="checkmark" size={56} color={COLORS.white} />
              </View>
            </View>
          ) : status === 'expired' ? (
            <View style={[styles.outerRing, { borderColor: COLORS.error }]}>
              <View style={[styles.searchIcon, { backgroundColor: COLORS.error }]}>
                <Ionicons name="close" size={56} color={COLORS.white} />
              </View>
            </View>
          ) : (
            <Animated.View style={[styles.outerRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.searchIcon}>
                <Ionicons name="locate" size={48} color={COLORS.white} />
              </View>
            </Animated.View>
          )}
        </View>

        <Text style={styles.statusText}>{message}</Text>

        {status === 'searching' && totalCandidates > 0 && (
          <Text style={styles.subText}>Checking trainer {candidateIndex + 1} of {totalCandidates}...</Text>
        )}

        {status === 'matched' && (
          <TouchableOpacity onPress={handleGoToSession} style={styles.goBtn} data-testid="go-to-session-btn">
            <LinearGradient colors={[COLORS.navy, '#2a3a6e']} style={styles.goBtnGrad}>
              <Text style={styles.goBtnText}>Go to Session</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {status === 'expired' && (
          <TouchableOpacity onPress={() => { setStatus('locating'); startMatch(); }} style={styles.retryBtn} data-testid="retry-match-btn">
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}

        {status === 'searching' && (
          <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} data-testid="cancel-match-btn">
            <Text style={styles.cancelText}>Cancel Search</Text>
          </TouchableOpacity>
        )}
      </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  searchCircleWrap: { marginBottom: 32 },
  outerRing: { width: 180, height: 180, borderRadius: 90, borderWidth: 3, borderColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,207,193,0.05)' },
  innerRing: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: 'rgba(0,207,193,0.3)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  searchIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24 },
  goBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 16 },
  goBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  goBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  retryBtn: { marginTop: 16, borderWidth: 1, borderColor: COLORS.teal, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  retryText: { fontSize: 16, fontWeight: '600', color: COLORS.teal },
  cancelBtn: { marginTop: 24, paddingVertical: 12 },
  cancelText: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
});

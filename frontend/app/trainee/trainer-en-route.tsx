import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { sessionTrackingAPI, chatAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';

const { width } = Dimensions.get('window');

const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  teal: '#00CFC1',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  gray: '#8892b0',
  success: '#00D26A',
  error: '#FF4757',
};

type TrainerStatus = 'waiting' | 'en_route' | 'nearby' | 'arrived';

export default function TrainerEnRouteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();

  const sessionId = params.sessionId as string;
  const trainerName = params.trainerName as string;
  const trainerId = params.trainerId as string;
  const sessionType = params.sessionType as string;

  const [status, setStatus] = useState<TrainerStatus>('waiting');
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [eta, setEta] = useState<string>('Waiting for trainer...');
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<string>('');

  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    startDotAnimation();
    startPolling();
    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
  }, []);

  const startDotAnimation = () => {
    const animate = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        ])
      );
    animate(dotAnim1, 0).start();
    animate(dotAnim2, 200).start();
    animate(dotAnim3, 400).start();
  };

  const startPolling = () => {
    const poll = async () => {
      try {
        const data = await sessionTrackingAPI.getGpsTrack(sessionId);
        setSessionStatus(data.sessionStatus || '');

        if (!data.tracking) {
          setStatus('waiting');
          return;
        }

        if (data.sessionStatus === 'in_progress') {
          setStatus('arrived');
          setEta('Session started');
          if (pollInterval.current) clearInterval(pollInterval.current);
          return;
        }

        if (data.distanceMiles != null) {
          const dist = data.distanceMiles;
          setDistanceMiles(dist);
          const etaMins = Math.max(1, Math.round(dist * 3));
          setEta(`${etaMins} min away`);

          // Animate progress (0=far, 1=arrived)
          const progressVal = Math.min(1, Math.max(0, 1 - (dist / 5))); // 5 miles = 0%, 0 = 100%
          Animated.timing(progressAnim, { toValue: progressVal, duration: 500, useNativeDriver: false }).start();

          if (dist < 0.05) {
            setStatus('arrived');
            setEta('Trainer has arrived!');
          } else if (dist < 0.3) {
            setStatus('nearby');
            setEta('Almost here!');
          } else {
            setStatus('en_route');
          }
        } else if (data.trainer) {
          setStatus('en_route');
          setEta('On the way');
        }

        if (data.trainer?.timestamp) {
          const d = new Date(data.trainer.timestamp);
          setLastUpdate(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    };

    poll();
    pollInterval.current = setInterval(poll, 5000);
  };

  const handleMessage = () => {
    router.push({
      pathname: '/messages/chat',
      params: { userId: trainerId, userName: trainerName },
    });
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'waiting': return { icon: 'hourglass', label: 'Waiting', color: COLORS.gray, bg: 'rgba(136,146,176,0.15)' };
      case 'en_route': return { icon: 'car-sport', label: 'On The Way', color: COLORS.teal, bg: 'rgba(0,207,193,0.15)' };
      case 'nearby': return { icon: 'location', label: 'Nearby', color: COLORS.orangeLight, bg: 'rgba(255,159,28,0.15)' };
      case 'arrived': return { icon: 'checkmark-circle', label: 'Arrived', color: COLORS.success, bg: 'rgba(0,210,106,0.15)' };
    }
  };

  const statusConfig = getStatusConfig();

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[COLORS.navy, '#0f1d42']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="trainee-tracking-back-btn">
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trainer Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Ionicons name={statusConfig.icon as any} size={20} color={statusConfig.color} />
          <Text style={[styles.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>

        {/* Visual Tracker */}
        <View style={styles.trackerCard}>
          {/* Trainer avatar */}
          <View style={styles.trackerRow}>
            <View style={[styles.avatarCircle, { backgroundColor: COLORS.teal }]}>
              <Ionicons name="fitness" size={28} color={COLORS.white} />
            </View>
            <View style={styles.trackerInfo}>
              <Text style={styles.trainerNameText}>{trainerName || 'Your Trainer'}</Text>
              <Text style={styles.etaText}>{eta}</Text>
            </View>
          </View>

          {/* Progress Track */}
          <View style={styles.progressTrack}>
            <View style={styles.progressBg}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>Started</Text>
              <View style={styles.dotRow}>
                <Animated.View style={[styles.trackDot, { opacity: dotAnim1 }]} />
                <Animated.View style={[styles.trackDot, { opacity: dotAnim2 }]} />
                <Animated.View style={[styles.trackDot, { opacity: dotAnim3 }]} />
              </View>
              <Text style={styles.progressLabel}>You</Text>
            </View>
          </View>

          {/* Distance */}
          {distanceMiles != null && (
            <View style={styles.distanceRow}>
              <Ionicons name="navigate" size={16} color={COLORS.teal} />
              <Text style={styles.distanceText}>{distanceMiles.toFixed(1)} miles away</Text>
            </View>
          )}

          {lastUpdate ? (
            <Text style={styles.lastUpdateText}>Last updated: {lastUpdate}</Text>
          ) : null}
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>While you wait</Text>
          <View style={styles.tipRow}>
            <Ionicons name="water" size={18} color={COLORS.teal} />
            <Text style={styles.tipText}>Stay hydrated</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="body" size={18} color={COLORS.teal} />
            <Text style={styles.tipText}>Do some light stretches</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="musical-notes" size={18} color={COLORS.teal} />
            <Text style={styles.tipText}>Queue up your workout playlist</Text>
          </View>
        </View>

        {/* Message Button */}
        <TouchableOpacity onPress={handleMessage} style={styles.messageBtn} data-testid="message-trainer-btn">
          <Ionicons name="chatbubble" size={20} color={COLORS.white} />
          <Text style={styles.messageBtnText}>Message {trainerName || 'Trainer'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: 20 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 20 },
  statusLabel: { fontSize: 14, fontWeight: '700', marginLeft: 8, letterSpacing: 0.5 },
  trackerCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, marginBottom: 16 },
  trackerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  trackerInfo: { marginLeft: 16, flex: 1 },
  trainerNameText: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  etaText: { fontSize: 15, color: COLORS.teal, fontWeight: '600', marginTop: 2 },
  progressTrack: { marginBottom: 16 },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.teal, borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  progressLabel: { fontSize: 11, color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5 },
  dotRow: { flexDirection: 'row', gap: 6 },
  trackDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.teal },
  distanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  distanceText: { fontSize: 14, color: COLORS.white, marginLeft: 8, fontWeight: '600' },
  lastUpdateText: { fontSize: 11, color: COLORS.gray },
  tipsCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 16 },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  tipRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  tipText: { fontSize: 14, color: COLORS.gray, marginLeft: 12 },
  messageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.teal, borderRadius: 14, paddingVertical: 16 },
  messageBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginLeft: 10 },
});

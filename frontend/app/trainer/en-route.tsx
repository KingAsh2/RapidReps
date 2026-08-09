import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { sessionTrackingAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';
import { SessionTimeline, SessionTimelineStatus } from '../../src/components/SessionTimeline';
import { QuickActions } from '../../src/components/QuickActions';
// iter117: mount the real EnRouteMap so the trainer sees a live road-following
// route polyline + a Google-Directions-based ETA instead of the previous
// haversine × 3 straight-line estimate that was wildly inaccurate in cities.
import EnRouteMap from '../../src/components/EnRouteMap';

const { width } = Dimensions.get('window');

const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  teal: '#1a2a5e',
  tealLight: '#22E8DF',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  gray: '#5a6785',
  success: '#00D26A',
  error: '#FF4757',
};

type EnRouteStep = 'starting' | 'navigating' | 'arriving' | 'arrived';

export default function TrainerEnRouteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();

  const sessionId = params.sessionId as string;
  const traineeName = params.traineeName as string;
  const traineeAddress = params.traineeAddress as string;
  const traineeLat = params.traineeLat as string;
  const traineeLng = params.traineeLng as string;
  const sessionType = params.sessionType as string;

  const [step, setStep] = useState<EnRouteStep>('starting');
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [eta, setEta] = useState<string>('Calculating...');
  const [isSharing, setIsSharing] = useState(false);
  const [showArrivedModal, setShowArrivedModal] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);

  const gpsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    startGpsSharing();
    startPulse();

    return () => {
      if (gpsInterval.current) clearInterval(gpsInterval.current);
    };
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  };

  const startGpsSharing = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ title: 'Permission Required', message: 'Location access is needed to navigate to the trainee.', type: 'error' });
        return;
      }

      setIsSharing(true);
      setStep('navigating');

      // Start periodic GPS updates
      const sendUpdate = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          const res = await sessionTrackingAPI.gpsUpdate(
            sessionId,
            loc.coords.latitude,
            loc.coords.longitude,
            loc.coords.accuracy || 0
          );

          if (res.alerts?.length) {
            setAlerts(res.alerts.map((a: any) => a.message));
          }

          // Estimate distance if we have trainee coordinates
          if (traineeLat && traineeLng) {
            const dist = getDistance(
              loc.coords.latitude, loc.coords.longitude,
              parseFloat(traineeLat), parseFloat(traineeLng)
            );
            setDistanceMiles(dist);
            const etaMins = Math.max(1, Math.round(dist * 3)); // rough 20mph avg
            setEta(`${etaMins} min`);

            if (dist < 0.1) {
              setStep('arriving');
            }
          }
        } catch (e) {
          console.error('GPS update error:', e);
        }
      };

      sendUpdate();
      gpsInterval.current = setInterval(sendUpdate, 5000);
    } catch (e) {
      console.error('GPS start error:', e);
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const openNavigation = () => {
    let url: string;
    if (traineeLat && traineeLng) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${traineeLat},${traineeLng}&travelmode=driving`;
    } else if (traineeAddress) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(traineeAddress)}&travelmode=driving`;
    } else {
      showAlert({ title: 'No Address', message: 'Trainee location is not available yet.', type: 'info' });
      return;
    }
    Linking.openURL(url);
  };

  const handleArrived = async () => {
    if (gpsInterval.current) clearInterval(gpsInterval.current);
    setIsSharing(false);
    setStep('arrived');
    setShowArrivedModal(true);
  };

  const handleStartSession = async () => {
    setShowArrivedModal(false);
    try {
      await sessionTrackingAPI.startSession(sessionId);
      router.replace({
        pathname: '/trainer/start-session',
        params: { sessionId, clientName: traineeName, sessionType },
      });
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.response?.data?.detail || 'Could not start session', type: 'error' });
    }
  };

  const handleMessageTrainee = () => {
    router.push({
      pathname: '/messages/chat',
      params: { userId: params.traineeId, userName: traineeName },
    });
  };

  const getStepInfo = () => {
    switch (step) {
      case 'starting': return { icon: 'location', text: 'Preparing route...', color: 'rgba(255,255,255,0.5)' };
      case 'navigating': return { icon: 'navigate', text: 'En Route', color: '#FFFFFF' };
      case 'arriving': return { icon: 'flag', text: 'Almost There!', color: '#FF8533' };
      case 'arrived': return { icon: 'checkmark-circle', text: 'Arrived', color: COLORS.success };
    }
  };

  const stepInfo = getStepInfo();

  // Map trainer en-route step to SessionTimeline status
  const getTimelineStatus = (): SessionTimelineStatus => {
    switch (step) {
      case 'starting': return 'confirmed';
      case 'navigating': return 'en_route';
      case 'arriving': return 'en_route';
      case 'arrived': return 'arrived';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="en-route-back-btn">
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>En Route</Text>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Status Pulse */}
        <View style={styles.statusContainer}>
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }], borderColor: stepInfo.color }]}>
            <View style={[styles.statusIconCircle, { backgroundColor: stepInfo.color }]}>
              <Ionicons name={stepInfo.icon as any} size={48} color={COLORS.white} />
            </View>
          </Animated.View>
          <Text style={[styles.statusText, { color: stepInfo.color }]}>{stepInfo.text}</Text>
          {isSharing && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>GPS SHARING</Text>
            </View>
          )}
        </View>

        {/* Live map — real Google-Directions polyline from trainer to
            trainee, WS-driven ETA. Replaces the previous haversine ×3
            estimate with actual driving data. */}
        <EnRouteMap
          session={{
            id: sessionId,
            traineeLatitude: traineeLat ? parseFloat(traineeLat) : undefined,
            traineeLongitude: traineeLng ? parseFloat(traineeLng) : undefined,
            traineeName,
          }}
          role="trainer"
          otherDisplayName={traineeName}
          destination={
            traineeLat && traineeLng
              ? { latitude: parseFloat(traineeLat), longitude: parseFloat(traineeLng) }
              : null
          }
        />

        {/* Session Timeline */}
        <View style={styles.infoCard}>
          <SessionTimeline
            currentStatus={getTimelineStatus()}
            eta={step === 'navigating' || step === 'arriving' ? eta : undefined}
          />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>Heading to</Text>
          <Text style={styles.cardValue}>{traineeName || 'Trainee'}</Text>
          {traineeAddress && <Text style={styles.cardAddress}>{traineeAddress}</Text>}
        </View>

        {/* Alerts */}
        {alerts.length > 0 && (
          <View style={styles.alertCard}>
            {alerts.map((a, i) => (
              <View key={i} style={styles.alertRow}>
                <Ionicons name="warning" size={16} color={COLORS.orangeLight} />
                <Text style={styles.alertText}>{a}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity onPress={openNavigation} style={styles.navButton} data-testid="open-navigation-btn">
          <LinearGradient colors={['#0A0E1A', '#141929']} style={styles.navButtonGradient}>
            <Ionicons name="navigate" size={24} color={COLORS.white} />
            <Text style={styles.navButtonText}>Reopen Turn-by-Turn</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Actions */}
        <QuickActions
          sessionId={sessionId}
          otherPartyName={traineeName || 'Trainee'}
          otherPartyId={params.traineeId as string}
          role="trainer"
          showCancel={false}
        />

        <TouchableOpacity
          onPress={handleArrived}
          style={[styles.arrivedBtn, step === 'arrived' && styles.arrivedBtnDone, { marginTop: 12, alignSelf: 'stretch' }]}
          disabled={step === 'arrived'}
          data-testid="arrived-btn"
        >
          <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
          <Text style={styles.arrivedBtnText}>
            {step === 'arrived' ? 'Arrived' : "I've Arrived"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Arrived Modal */}
      <Modal visible={showArrivedModal} transparent animationType="fade" data-testid="arrived-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
            </View>
            <Text style={styles.modalTitle}>You've Arrived!</Text>
            <Text style={styles.modalSubtitle}>
              {traineeName} has been notified. Ready to start the session?
            </Text>
            <TouchableOpacity onPress={handleStartSession} style={styles.modalPrimaryBtn} data-testid="start-session-from-modal-btn">
              <LinearGradient colors={[COLORS.orange, COLORS.orangeLight]} style={styles.modalBtnGradient}>
                <Text style={styles.modalBtnText}>Start Session</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowArrivedModal(false)} style={styles.modalSecondaryBtn}>
              <Text style={styles.modalSecondaryText}>Wait a moment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: 20 },
  statusContainer: { alignItems: 'center', marginTop: 20, marginBottom: 24 },
  pulseCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  statusIconCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 22, fontWeight: '800', marginTop: 16, letterSpacing: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(0,207,193,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A0E1A', marginRight: 6 },
  liveText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },
  infoCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  cardValue: { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 4 },
  cardAddress: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginTop: 4 },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  alertCard: { backgroundColor: 'rgba(255,159,28,0.12)', borderRadius: 12, padding: 12, marginBottom: 16 },
  alertRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  alertText: { fontSize: 13, color: '#FF8533', marginLeft: 8, flex: 1 },
  navButton: { marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
  navButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  navButtonText: { fontSize: 17, fontWeight: '700', color: COLORS.white, marginLeft: 10 },
  actionRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(0,207,193,0.3)' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginLeft: 8 },
  arrivedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.orange, borderRadius: 14, paddingVertical: 14 },
  arrivedBtnDone: { backgroundColor: COLORS.success },
  arrivedBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white, marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width - 48, backgroundColor: '#141929', borderRadius: 24, padding: 32, alignItems: 'center' },
  modalIconCircle: { marginBottom: 16 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  modalSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalPrimaryBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  modalBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  modalBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  modalSecondaryBtn: { paddingVertical: 12 },
  modalSecondaryText: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
});

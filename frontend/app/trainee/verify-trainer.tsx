import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform,
  ImageBackground, Image, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { safetyCheckAPI } from '../../src/services/api';
import { Colors as COLORS } from '../../src/utils/colors';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_SIZE = SCREEN_WIDTH * 0.7;

export default function VerifyTrainer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // Animate scan line
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || verifying) return;
    setScanned(true);
    setVerifying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await safetyCheckAPI.verify(data);
      setResult(response);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Animate success
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Verification failed. Please try again.';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
    } finally {
      setVerifying(false);
    }
  };

  const handleRetry = () => {
    setScanned(false);
    setError(null);
    setResult(null);
    scaleAnim.setValue(0);
  };

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_SIZE - 4],
  });

  // Permission not granted
  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['rgba(20, 25, 41, 0.96)', 'rgba(20, 25, 41, 0.92)']} style={StyleSheet.absoluteFill} />
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={COLORS.orange} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            To verify your trainer, we need access to your camera to scan their badge QR code.
          </Text>
          <TouchableOpacity
            style={styles.permissionBtn}
            onPress={requestPermission}
            data-testid="verify-camera-permission-btn"
          >
            <Text style={styles.permissionBtnText}>Allow Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Success Screen
  if (result) {
    return (
      <View style={[styles.container, { backgroundColor: '#141929' }]}>
        <View style={styles.resultHeader}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.05)' }]}
            onPress={() => router.back()}
            data-testid="verify-success-back-btn"
          >
            <Ionicons name="close" size={22} color={'#FFFFFF'} />
          </TouchableOpacity>
        </View>
        <Animated.View style={[styles.successContent, { opacity: fadeIn, transform: [{ scale: scaleAnim }] }]}>
          {/* Green Check Animation */}
          <View style={styles.successIconWrapper}>
            <LinearGradient colors={['#00C853', '#00E676']} style={styles.successIconBg}>
              <Ionicons name="checkmark" size={48} color={COLORS.white} />
            </LinearGradient>
          </View>

          <Text style={styles.successHeadline} data-testid="verify-success-headline">
            Rapid Reps Safety Check Complete
          </Text>

          {/* Trainer Card */}
          <View style={styles.trainerCard}>
            {result.trainerPhoto ? (
              <Image source={{ uri: result.trainerPhoto }} style={styles.trainerCardPhoto} />
            ) : (
              <View style={[styles.trainerCardPhoto, styles.trainerCardPhotoPlaceholder]}>
                <Ionicons name="person" size={28} color={'#FFFFFF'} />
              </View>
            )}
            <Text style={styles.trainerCardName}>{result.trainerName}</Text>
            <View style={styles.trainerCardRating}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.trainerCardRatingText}>{(result.trainerRating || 0).toFixed(1)}</Text>
            </View>

            <View style={styles.trainerBadges}>
              {result.isVerified && (
                <View style={styles.tBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.tBadgeText}>Rapid Reps Verified</Text>
                </View>
              )}
              {result.isBackgroundChecked && (
                <View style={styles.tBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.tBadgeText}>Background Checked</Text>
                </View>
              )}
              <View style={styles.tBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.tBadgeText}>Assigned to Your Session</Text>
              </View>
            </View>
          </View>

          {/* Session Details */}
          <View style={styles.sessionDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Session Type</Text>
              <Text style={styles.detailValue}>
                {result.sessionType === 'in_home' ? 'At Home' : 'In Person'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{result.durationMinutes} Minutes</Text>
            </View>
            <View style={styles.readyRow}>
              <View style={[styles.readyDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.readyText}>Session Ready to Begin</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                router.replace({
                  pathname: '/trainee/session-active',
                  params: { sessionId: result.sessionId }
                });
              }}
              data-testid="verify-start-session-btn"
            >
              <LinearGradient colors={[COLORS.orange, '#E65C00']} style={styles.startBtnGradient}>
                <Ionicons name="play-circle" size={22} color={COLORS.white} />
                <Text style={styles.startBtnText}>Start Session Timer</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity style={styles.secondaryBtn} data-testid="verify-share-btn">
                <Ionicons name="share-outline" size={18} color={'#FFFFFF'} />
                <Text style={styles.secondaryBtnText}>Share My Session</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.push('/trainee/report-issue')}
                data-testid="verify-report-btn"
              >
                <Ionicons name="flag-outline" size={18} color={COLORS.error} />
                <Text style={[styles.secondaryBtnText, { color: COLORS.error }]}>Report Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  // Error Screen
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: '#141929' }]}>
        <View style={styles.resultHeader}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.05)' }]}
            onPress={() => router.back()}
            data-testid="verify-error-back-btn"
          >
            <Ionicons name="close" size={22} color={'#FFFFFF'} />
          </TouchableOpacity>
        </View>
        <Animated.View style={[styles.errorContent, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.errorIconWrapper}>
            <View style={styles.errorIconBg}>
              <Ionicons name="warning" size={48} color={COLORS.white} />
            </View>
          </View>
          <Text style={styles.errorTitle} data-testid="verify-error-title">
            Trainer Verification Failed
          </Text>
          <Text style={styles.errorMessage}>{error}</Text>

          <View style={styles.errorReasons}>
            <Text style={styles.errorReasonTitle}>Possible reasons:</Text>
            <Text style={styles.errorReason}>- Trainer not assigned to this booking</Text>
            <Text style={styles.errorReason}>- QR code expired</Text>
            <Text style={styles.errorReason}>- Session outside allowed window</Text>
          </View>

          <View style={styles.errorActions}>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={handleRetry}
              data-testid="verify-retry-btn"
            >
              <Ionicons name="refresh" size={18} color={COLORS.white} />
              <Text style={styles.retryBtnText}>Retry Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.supportBtn}
              onPress={() => router.push('/trainee/report-issue')}
              data-testid="verify-support-btn"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={'#FFFFFF'} />
              <Text style={styles.supportBtnText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  }

  // Scanner View
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.scanOverlay}>
        {/* Header */}
        <View style={styles.scanHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            data-testid="verify-scanner-back-btn"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.scanTitle}>Verify Trainer</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Scan Area */}
        <View style={styles.scanAreaWrapper}>
          <View style={styles.scanArea}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Scan line */}
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
            />
          </View>
        </View>

        {/* Bottom */}
        <View style={styles.scanBottom}>
          <View style={styles.scanBadge}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.orange} />
            <Text style={styles.scanBadgeText}>Rapid Reps Safety Check</Text>
          </View>
          <Text style={styles.scanInstructions}>
            Point your camera at your trainer's badge QR code
          </Text>
          {verifying && (
            <View style={styles.verifyingRow}>
              <Text style={styles.verifyingText}>Verifying trainer...</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // Permission
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 16 },
  permissionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  permissionText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
  permissionBtn: {
    backgroundColor: COLORS.orange, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginTop: 8,
  },
  permissionBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  backLink: { marginTop: 12 },
  backLinkText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

  // Scanner
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  scanHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  scanTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  scanAreaWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanArea: {
    width: SCAN_SIZE, height: SCAN_SIZE, position: 'relative',
  },
  corner: {
    position: 'absolute', width: 30, height: 30,
    borderColor: COLORS.orange, borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanLine: {
    position: 'absolute', left: 4, right: 4, height: 2,
    backgroundColor: COLORS.orange, borderRadius: 1,
  },
  scanBottom: { alignItems: 'center', paddingBottom: 60, gap: 12 },
  scanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  scanBadgeText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  scanInstructions: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  verifyingRow: { marginTop: 4 },
  verifyingText: { fontSize: 14, fontWeight: '700', color: '#FF6A00' },

  // Result Header
  resultHeader: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: 8,
  },

  // Success
  successContent: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 20 },
  successIconWrapper: { marginBottom: 20 },
  successIconBg: {
    width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00C853', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  successHeadline: {
    fontSize: 22, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 24,
  },

  // Trainer Card
  trainerCard: {
    alignItems: 'center', backgroundColor: '#FAFBFC', borderRadius: 20,
    padding: 20, width: '100%', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  trainerCardPhoto: { width: 64, height: 64, borderRadius: 32, marginBottom: 8, borderWidth: 2, borderColor: COLORS.orange },
  trainerCardPhotoPlaceholder: { backgroundColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center' },
  trainerCardName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  trainerCardRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  trainerCardRatingText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  trainerBadges: { gap: 6, marginTop: 12, alignItems: 'center' },
  tBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
  },
  tBadgeText: { fontSize: 12, fontWeight: '600', color: '#2E7D32' },

  // Session Details
  sessionDetails: {
    width: '100%', backgroundColor: '#FAFBFC', borderRadius: 16,
    padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
  },
  detailLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  readyDot: { width: 10, height: 10, borderRadius: 5 },
  readyText: { fontSize: 14, fontWeight: '700', color: COLORS.success },

  // Action Buttons
  actionButtons: { width: '100%', gap: 12 },
  startBtn: { borderRadius: 16, overflow: 'hidden' },
  startBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  secondaryRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F0F2F5', paddingVertical: 14, borderRadius: 14,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Error
  errorContent: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  errorIconWrapper: { marginBottom: 20 },
  errorIconBg: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.error,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.error, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  errorTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  errorMessage: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  errorReasons: {
    width: '100%', backgroundColor: '#FFF3F0', borderRadius: 16, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)',
  },
  errorReasonTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  errorReason: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 22 },
  errorActions: { width: '100%', gap: 12 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.orange, paddingVertical: 16, borderRadius: 16,
  },
  retryBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F0F2F5', paddingVertical: 14, borderRadius: 14,
  },
  supportBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

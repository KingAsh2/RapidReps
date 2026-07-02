import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator,
  Animated, ScrollView, ImageBackground, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { safetyCheckAPI } from '../../src/services/api';
// iter106as: unified avatar disc for the badge-share screen.
import { UserAvatar } from '../../src/components/UserAvatar';
import { Colors as COLORS } from '../../src/utils/colors';
import * as Haptics from 'expo-haptics';

const backgroundImage = require('../../assets/images/bg-gym-blue.png');

export default function TrainerBadge() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [badgeData, setBadgeData] = useState<any>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [noSession, setNoSession] = useState(false);

  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const refreshSpin = useRef(new Animated.Value(0)).current;

  // Glow animation for badge
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const loadBadge = useCallback(async () => {
    try {
      setLoading(true);
      const data = await safetyCheckAPI.getActiveSession();
      if (!data.hasActiveSession) {
        setNoSession(true);
        setLoading(false);
        return;
      }
      setBadgeData(data);
      setNoSession(false);
      // Auto-generate token
      await generateToken(data.session.sessionId);
    } catch (err) {
      console.error('Badge load error:', err);
      setNoSession(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBadge(); }, [loadBadge]);

  const generateToken = async (sessionId: string) => {
    try {
      setRefreshing(true);
      Animated.timing(refreshSpin, { toValue: 1, duration: 600, useNativeDriver: true }).start(() => {
        refreshSpin.setValue(0);
      });
      const result = await safetyCheckAPI.generateToken(sessionId);
      setQrToken(result.token);
      setTokenExpiry(new Date(result.expiresAt));
      setCountdown(5 * 60); // 5 minutes
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Token generation error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Token expired - auto refresh
          if (badgeData?.session?.sessionId) {
            generateToken(badgeData.session.sessionId);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown, badgeData]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  const spinRotate = refreshSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (loading) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(20, 25, 41, 0.96)', 'rgba(20, 25, 41, 0.92)']} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.orange} />
          <Text style={styles.loadingText}>Loading badge...</Text>
        </View>
      </ImageBackground>
    );
  }

  if (noSession) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(20, 25, 41, 0.96)', 'rgba(20, 25, 41, 0.92)']} style={StyleSheet.absoluteFill} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            data-testid="badge-back-btn"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Badge</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="shield-outline" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyTitle}>No Active Session</Text>
          <Text style={styles.emptySubtitle}>
            Your digital trainer badge will appear here when you have an upcoming in-person or at-home session.
          </Text>
        </View>
      </ImageBackground>
    );
  }

  const session = badgeData?.session;
  const verificationStatus = session?.verificationStatus || 'pending_verification';
  const isVerified = verificationStatus === 'verified';

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(20, 25, 41, 0.96)', 'rgba(20, 25, 41, 0.92)']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          data-testid="badge-back-btn"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Badge</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.badgeCard, { opacity: fadeIn }]}>
          {/* Badge Glow */}
          <Animated.View style={[styles.badgeGlow, { opacity: glowOpacity }]} />

          {/* Badge Header - Deep Navy */}
          <LinearGradient
            colors={['#1a2a5e', '#0f1a3e']}
            style={styles.badgeHeader}
          >
            <View style={styles.badgeHeaderContent}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.badgeLogo}
                resizeMode="contain"
              />
              <View style={styles.badgeHeaderText}>
                <Text style={styles.badgeBrand}>RAPID REPS</Text>
                <Text style={styles.badgeTitle}>VERIFIED TRAINER</Text>
              </View>
              <View style={styles.badgeShield}>
                <Ionicons name="shield-checkmark" size={28} color={COLORS.orange} />
              </View>
            </View>
          </LinearGradient>

          {/* Trainer Profile Section */}
          <View style={styles.profileSection}>
            <Animated.View style={[styles.profilePhotoWrapper, { transform: [{ scale: pulseAnim }] }]}>
              {/* iter106as: unified avatar disc for the shareable badge. */}
              <UserAvatar
                size={100}
                style={styles.profilePhoto as any}
                user={{
                  avatarUrl: badgeData?.trainerPhoto,
                  fullName: badgeData?.trainerName,
                }}
              />
              <View style={styles.verifiedDot}>
                <Ionicons name="checkmark" size={12} color={COLORS.white} />
              </View>
            </Animated.View>

            <Text style={styles.trainerName} data-testid="badge-trainer-name">
              {badgeData?.trainerName || 'Trainer'}
            </Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>
                {(badgeData?.trainerRating || 0).toFixed(1)} Rating
              </Text>
            </View>

            {/* Verification Badges */}
            <View style={styles.verificationBadges}>
              {badgeData?.isBackgroundChecked && (
                <View style={styles.verBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.verBadgeText}>Background Checked</Text>
                </View>
              )}
              {badgeData?.isCertified && (
                <View style={styles.verBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.verBadgeText}>Certified Trainer</Text>
                </View>
              )}
              {badgeData?.isVerified && (
                <View style={styles.verBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.verBadgeText}>Rapid Reps Verified</Text>
                </View>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Session Status Card */}
          <View style={styles.sessionCard}>
            <Text style={styles.sessionCardTitle}>Session Details</Text>
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>Client</Text>
              <Text style={styles.sessionValue} data-testid="badge-client-name">
                {session?.traineeName || 'Client'}
              </Text>
            </View>
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>Session Type</Text>
              <Text style={styles.sessionValue}>
                {session?.sessionType === 'in_home' ? 'At Home' : 'In Person'}
              </Text>
            </View>
            <View style={styles.sessionRow}>
              <Text style={styles.sessionLabel}>Duration</Text>
              <Text style={styles.sessionValue}>{session?.durationMinutes || 60} Minutes</Text>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isVerified ? COLORS.success : COLORS.orange }]} />
              <Text style={[styles.statusLabel, { color: isVerified ? COLORS.success : COLORS.orange }]}>
                {isVerified ? 'Verified - Session Active' : 'Ready for Verification'}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* QR Code Section */}
          {!isVerified && (
            <View style={styles.qrSection}>
              <Text style={styles.qrTitle}>Scan to Verify Trainer</Text>

              <Animated.View style={[styles.qrWrapper, { transform: [{ scale: pulseAnim }] }]}>
                {qrToken ? (
                  <View style={styles.qrCodeContainer}>
                    <QRCode
                      value={qrToken}
                      size={180}
                      color={'#FFFFFF'}
                      backgroundColor={COLORS.white}
                    />
                  </View>
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <ActivityIndicator size="large" color={COLORS.orange} />
                  </View>
                )}
              </Animated.View>

              {/* Countdown */}
              {countdown > 0 && (
                <View style={styles.countdownRow}>
                  <Ionicons name="time-outline" size={14} color={countdown < 60 ? COLORS.error : COLORS.gray} />
                  <Text style={[styles.countdownText, countdown < 60 && { color: COLORS.error }]}>
                    Expires in {formatCountdown(countdown)}
                  </Text>
                </View>
              )}

              <Text style={styles.qrSubtext}>
                Code refreshes automatically for your safety.
              </Text>

              {/* Refresh Button */}
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => session?.sessionId && generateToken(session.sessionId)}
                disabled={refreshing}
                data-testid="badge-refresh-btn"
                accessibilityLabel="Refresh QR code"
              >
                <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                  <Ionicons name="refresh" size={18} color={COLORS.white} />
                </Animated.View>
                <Text style={styles.refreshBtnText}>
                  {refreshing ? 'Refreshing...' : 'Refresh Code'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Verified State */}
          {isVerified && (
            <View style={styles.verifiedSection}>
              <View style={styles.verifiedIcon}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
              </View>
              <Text style={styles.verifiedTitle}>Session Verified</Text>
              <Text style={styles.verifiedSubtext}>Timer is running. Focus on your client!</Text>
            </View>
          )}

          {/* Badge Footer */}
          <View style={styles.badgeFooter}>
            <Ionicons name="lock-closed" size={14} color={COLORS.orange} />
            <Text style={styles.footerText}>Rapid Reps Safety Check Enabled</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingBottom: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Badge Card
  badgeCard: {
    backgroundColor: '#141929', borderRadius: 24, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
    borderWidth: 2, borderColor: 'rgba(255,127,0,0.3)',
  },
  badgeGlow: {
    ...StyleSheet.absoluteFillObject, borderRadius: 24,
    borderWidth: 3, borderColor: COLORS.orange,
  },

  // Badge Header
  badgeHeader: { paddingVertical: 20, paddingHorizontal: 20 },
  badgeHeaderContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badgeLogo: { width: 36, height: 36, borderRadius: 8 },
  badgeHeaderText: { flex: 1 },
  badgeBrand: { fontSize: 11, fontWeight: '900', color: '#FF6A00', letterSpacing: 3 },
  badgeTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white, marginTop: 2, letterSpacing: 1 },
  badgeShield: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,127,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Profile Section
  profileSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  profilePhotoWrapper: { position: 'relative', marginBottom: 12 },
  profilePhoto: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: COLORS.orange },
  profilePhotoPlaceholder: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#F0F2F5',
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.orange,
  },
  verifiedDot: {
    position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  trainerName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },

  // Verification Badges
  verificationBadges: { gap: 6, marginTop: 16, alignItems: 'center' },
  verBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  verBadgeText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },

  // Divider
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20 },

  // Session Card
  sessionCard: { padding: 20 },
  sessionCardTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 12, letterSpacing: 0.5 },
  sessionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  sessionLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  sessionValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 14, fontWeight: '700' },

  // QR Section
  qrSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  qrTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 16, letterSpacing: 0.5 },
  qrWrapper: { marginBottom: 12 },
  qrCodeContainer: {
    padding: 16, backgroundColor: '#141929', borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.orange,
    shadowColor: COLORS.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  qrPlaceholder: {
    width: 212, height: 212, borderRadius: 16, backgroundColor: '#F0F2F5',
    justifyContent: 'center', alignItems: 'center',
  },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  countdownText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  qrSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 16 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.orange, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14,
  },
  refreshBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // Verified State
  verifiedSection: { alignItems: 'center', paddingVertical: 24 },
  verifiedIcon: { marginBottom: 8 },
  verifiedTitle: { fontSize: 20, fontWeight: '800', color: COLORS.success },
  verifiedSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  // Footer
  badgeFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, backgroundColor: '#141929', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Empty State
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  emptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
});

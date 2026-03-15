import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { traineeAPI } from '../../src/services/api';
import { SessionStatus } from '../../src/types';

const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  success: '#00D68F',
  warning: '#FFAA00',
  error: '#FF4757',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
};

export default function SessionDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const sessions = await traineeAPI.getSessions();
      const found = sessions.find((s: any) => s.id === sessionId);
      setSession(found);
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: SessionStatus) => {
    switch (status) {
      case SessionStatus.PENDING:
        return { color: COLORS.warning, text: 'Pending', icon: 'time' };
      case SessionStatus.CONFIRMED:
        return { color: COLORS.success, text: 'Confirmed', icon: 'checkmark-circle' };
      case SessionStatus.IN_PROGRESS:
        return { color: COLORS.orange, text: 'In Progress', icon: 'play-circle' };
      case SessionStatus.COMPLETED:
        return { color: COLORS.teal, text: 'Completed', icon: 'checkmark-done' };
      case SessionStatus.CANCELLED:
        return { color: COLORS.error, text: 'Cancelled', icon: 'close-circle' };
      default:
        return { color: COLORS.gray, text: status, icon: 'help-circle' };
    }
  };

  const handleMessage = () => {
    if (session?.trainerId) {
      router.push(`/messages/chat?userId=${session.trainerId}&userName=${session.trainerName || 'Trainer'}`);
    }
  };

  const handleCall = () => {
    if (session?.trainerPhone) {
      Linking.openURL(`tel:${session.trainerPhone}`);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={[COLORS.navy, COLORS.tealLight]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading session...</Text>
      </LinearGradient>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.navy, COLORS.tealLight]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Session Not Found</Text>
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const statusConfig = getStatusConfig(session.status);
  const sessionDate = new Date(session.sessionDateTimeStart);

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.navy, COLORS.tealLight]} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SESSION DETAILS</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Status Card */}
          <View style={styles.card}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
              <Ionicons name={statusConfig.icon as any} size={18} color={COLORS.white} />
              <Text style={styles.statusText}>{statusConfig.text}</Text>
            </View>
          </View>

          {/* Trainer Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trainer</Text>
            <View style={styles.trainerRow}>
              {session.trainerPhoto ? (
                <Image source={{ uri: session.trainerPhoto }} style={styles.trainerPhoto} />
              ) : (
                <View style={styles.trainerPhotoPlaceholder}>
                  <Ionicons name="person" size={24} color={COLORS.gray} />
                </View>
              )}
              <View style={styles.trainerInfo}>
                <Text style={styles.trainerName}>{session.trainerName || 'Trainer'}</Text>
                <Text style={styles.trainerSpecialty}>{session.trainerSpecialty || 'Personal Trainer'}</Text>
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
                <Ionicons name="chatbubble" size={20} color={COLORS.teal} />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
                <Ionicons name="call" size={20} color={COLORS.teal} />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Date & Time</Text>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={COLORS.orange} />
              <Text style={styles.infoText}>
                {sessionDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color={COLORS.orange} />
              <Text style={styles.infoText}>
                {sessionDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="hourglass" size={20} color={COLORS.orange} />
              <Text style={styles.infoText}>{session.durationMinutes} minutes</Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location</Text>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={COLORS.orange} />
              <Text style={styles.infoText}>{session.locationType || 'Not specified'}</Text>
            </View>
            {session.address && (
              <View style={styles.infoRow}>
                <Ionicons name="navigate" size={20} color={COLORS.gray} />
                <Text style={styles.infoTextSub}>{session.address}</Text>
              </View>
            )}
          </View>

          {/* Payment */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Total</Text>
              <Text style={styles.priceValue}>
                ${((session.finalSessionPriceCents || session.priceCents || 0) / 100).toFixed(2)}
              </Text>
            </View>
            {session.discountAmountCents > 0 && (
              <View style={styles.discountRow}>
                <Ionicons name="pricetag" size={16} color={COLORS.success} />
                <Text style={styles.discountText}>
                  You saved ${(session.discountAmountCents / 100).toFixed(2)}!
                </Text>
              </View>
            )}
          </View>

          {/* Safety PIN */}
          {session.safetyPin && session.status !== SessionStatus.COMPLETED && session.status !== SessionStatus.CANCELLED && (
            <LinearGradient colors={[COLORS.orangeHot, COLORS.orange]} style={styles.safetyPinCard}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.white} />
              <View style={styles.safetyPinContent}>
                <Text style={styles.safetyPinLabel}>Your Safety PIN</Text>
                <View style={styles.safetyPinDigits}>
                  {String(session.safetyPin).split('').map((digit: string, i: number) => (
                    <View key={i} style={styles.safetyPinDigit}>
                      <Text style={styles.safetyPinDigitText}>{digit}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.safetyPinNote}>Share with trainer to start session</Text>
              </View>
            </LinearGradient>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 6,
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  trainerPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  trainerPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trainerInfo: { flex: 1 },
  trainerName: { fontSize: 18, fontWeight: '700', color: COLORS.navy },
  trainerSpecialty: { fontSize: 14, color: COLORS.gray, marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.grayLight,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.teal },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoText: { fontSize: 16, fontWeight: '600', color: COLORS.navy, flex: 1 },
  infoTextSub: { fontSize: 14, color: COLORS.gray, flex: 1 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: { fontSize: 16, fontWeight: '500', color: COLORS.gray },
  priceValue: { fontSize: 24, fontWeight: '800', color: COLORS.navy },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  discountText: { fontSize: 14, fontWeight: '600', color: COLORS.success },
  safetyPinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    gap: 16,
  },
  safetyPinContent: { flex: 1 },
  safetyPinLabel: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  safetyPinDigits: { flexDirection: 'row', marginVertical: 8, gap: 6 },
  safetyPinDigit: {
    width: 36,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetyPinDigitText: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  safetyPinNote: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
});

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
  TextInput,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RapidBg from '../../src/components/RapidBg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { traineeAPI, sessionsAPI } from '../../src/services/api';
import { SessionStatus } from '../../src/types';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { SessionTimeline, SessionTimelineStatus } from '../../src/components/SessionTimeline';
// iter106as fix: missing import that iteration_115 flagged as CRITICAL.
import { UserAvatar } from '../../src/components/UserAvatar';
import NegotiationPanel from '../../src/components/NegotiationPanel';
import { ScreenHeader } from '../../src/components/ScreenShell';
import EnRouteMap from '../../src/components/EnRouteMap';

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

// iter118p (spec #3): trainer-lateness / no-show banner.
// Conditions for render:
//   • session status ∈ {confirmed, en_route, in_progress}
//   • trainer has NOT checked in yet (trainerGpsConfirmed !== true)
//   • sessionDateTimeStart is at least 15 min in the past
// Copy shifts from "hasn't checked in" (15-30 min) to "hasn't arrived at all"
// (30+ min) to match the escalation described in the product spec.
function TraineeNoShowBanner({ session, onResolved }: { session: any; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!session || !session.id) return null;
  const status = session.status;
  const eligibleStatus =
    status === SessionStatus.CONFIRMED || status === 'en_route' || status === 'in_progress';
  if (!eligibleStatus) return null;
  if (session.trainerGpsConfirmed) return null;
  if (session.trainerCheckedInAt) return null;

  const startIso = session.sessionDateTimeStart;
  if (!startIso) return null;
  const startMs = new Date(startIso).getTime();
  if (isNaN(startMs)) return null;
  const minutesLate = (Date.now() - startMs) / 60000;
  if (minutesLate < 15) return null;

  const escalated = minutesLate >= 30;

  const handleAction = async (action: 'wait' | 'refund') => {
    if (busy) return;
    setBusy(true);
    haptic.medium();
    try {
      await sessionsAPI.traineeNoShowAction(String(session.id), action);
      toast.success(
        action === 'wait'
          ? "We'll keep checking — hang tight."
          : 'Session cancelled — full refund is on the way.',
      );
      onResolved();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Could not update — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={noShowStyles.card} data-testid="trainee-no-show-banner">
      <View style={noShowStyles.header}>
        <Ionicons name="alert-circle" size={22} color="#FFAA00" />
        <Text style={noShowStyles.title}>
          {escalated ? "Your trainer hasn't arrived" : "Your trainer hasn't checked in"}
        </Text>
      </View>
      <Text style={noShowStyles.body}>
        {escalated
          ? "It's been 30+ minutes past your session time. You're eligible for a full refund."
          : "It's past your session start time. What would you like to do?"}
      </Text>
      <View style={noShowStyles.row}>
        <TouchableOpacity
          style={[noShowStyles.btn, noShowStyles.btnSecondary]}
          disabled={busy}
          onPress={() => handleAction('wait')}
          data-testid="no-show-wait-btn"
        >
          <Text style={noShowStyles.btnSecondaryText}>Wait</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[noShowStyles.btn, noShowStyles.btnPrimary]}
          disabled={busy}
          onPress={() => handleAction('refund')}
          data-testid="no-show-refund-btn"
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={noShowStyles.btnPrimaryText}>Cancel &amp; Refund</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const noShowStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,170,0,0.10)',
    borderColor: 'rgba(255,170,0,0.55)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  body: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnSecondaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnPrimary: { backgroundColor: '#FF4757' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});

export default function SessionDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [counterProposal, setCounterProposal] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleAgreeLocation = async () => {
    setSubmitting(true);
    try {
      await sessionsAPI.agreeToLocation(session.id, true);
      haptic.success();
      toast.success('Location confirmed!');
      loadSession();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to confirm location');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProposeCounter = async () => {
    if (!counterProposal.trim()) {
      toast.error('Please enter a location');
      return;
    }
    setSubmitting(true);
    try {
      await sessionsAPI.agreeToLocation(session.id, false, counterProposal.trim());
      haptic.success();
      toast.success('Counter-proposal sent!');
      setShowLocationModal(false);
      setCounterProposal('');
      loadSession();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to send proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmArrival = async () => {
    setSubmitting(true);
    try {
      const result = await sessionsAPI.confirmArrival(session.id, 'trainee');
      haptic.success();
      toast.success(result.message);
      if (result.bothArrived) {
        toast.info('Both arrived! Session can begin.');
      }
      loadSession();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to confirm arrival');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusConfig = (status: SessionStatus) => {
    switch (status) {
      case SessionStatus.PENDING:
        return { color: COLORS.warning, text: 'Pending', icon: 'time' };
      case SessionStatus.CONFIRMED:
        return { color: COLORS.success, text: 'Confirmed', icon: 'checkmark-circle' };
      case SessionStatus.IN_PROGRESS:
        return { color: '#FF6A00', text: 'In Progress', icon: 'play-circle' };
      case SessionStatus.COMPLETED:
        return { color: '#FFFFFF', text: 'Completed', icon: 'checkmark-done' };
      case SessionStatus.CANCELLED:
        return { color: COLORS.error, text: 'Cancelled', icon: 'close-circle' };
      default:
        return { color: 'rgba(255,255,255,0.5)', text: status, icon: 'help-circle' };
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
      <RapidBg variant="trainee-session-detail" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading session...</Text>
      </RapidBg>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <RapidBg variant="trainee-session-detail" style={StyleSheet.absoluteFill} />
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

  // Map session status to timeline status
  const getTimelineStatus = (): SessionTimelineStatus => {
    const s = session.status;
    if (s === 'requested' || s === 'pending') return 'requested';
    if (s === 'confirmed') return 'confirmed';
    if (s === 'en_route') return 'en_route';
    if (s === 'arrived') return 'arrived';
    if (s === 'in_progress') return 'in_progress';
    if (s === 'completed') return 'completed';
    if (s === 'cancelled' || s === 'declined') return 'cancelled';
    return 'requested';
  };

  return (
    <View style={styles.container}>
      <RapidBg variant="trainee-session-detail" style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* iter102n Wave 3: unified ScreenHeader */}
        <ScreenHeader
          title="Session Details"
          onBack={() => router.back()}
          testID="trainee-session-detail-header"
        />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Status Card with Timeline */}
          <View style={styles.card}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
              <Ionicons name={statusConfig.icon as any} size={18} color={COLORS.white} />
              <Text style={styles.statusText}>{statusConfig.text}</Text>
            </View>
            {session.status !== 'cancelled' && session.status !== 'declined' && (
              <View style={{ marginTop: 16 }} data-testid="session-timeline">
                <SessionTimeline currentStatus={getTimelineStatus()} compact />
              </View>
            )}
          </View>

          {/* iter118p (spec #3): No-show banner. Rendered when the session
              start time is ≥15 min in the past, the trainer hasn't checked
              in via GPS, and the session isn't already completed / cancelled.
              Offers the trainee two clear actions — Wait, or Cancel & Refund.
              After 30 min a full-refund treatment is applied server-side. */}
          <TraineeNoShowBanner session={session} onResolved={loadSession} />

          {/* Negotiation Panel — gate payment behind mutual agreement */}
          {session.id && session.status !== 'completed' && session.status !== 'cancelled' && session.status !== 'declined' && (
            <NegotiationPanel
              sessionId={String(session.id)}
              currentUserRole="trainee"
              isVirtual={session.sessionType === 'virtual' || session.modality === 'virtual'}
              onAgreed={loadSession}
            />
          )}

          {/* iter104a: One-tap "Book Again" CTA for completed sessions.
              Pre-fills the trainer-detail booking card with the same modality,
              duration, and location the trainee already used — cutting repeat
              bookings from 7 taps to 2 and lifting LTV on power users. */}
          {session.status === 'completed' && (
            <TouchableOpacity
              style={styles.bookAgainCta}
              onPress={() => {
                haptic.medium();
                const params: Record<string, string> = { trainerId: String(session.trainerId), repeat: '1' };
                if (session.durationMinutes) params.dur = String(session.durationMinutes);
                if (session.sessionType) params.type = String(session.sessionType);
                if (session.locationNameOrAddress) params.loc = String(session.locationNameOrAddress);
                router.push({ pathname: '/trainee/trainer-detail', params });
              }}
              data-testid="book-again-cta"
            >
              <LinearGradient
                colors={['#FF6A00', '#F7931E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bookAgainGradient}
              >
                <Ionicons name="refresh" size={20} color={COLORS.white} />
                <Text style={styles.bookAgainText}>BOOK AGAIN WITH {(session.trainerName || 'TRAINER').split(' ')[0].toUpperCase()}</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Trainer Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trainer</Text>
            <TouchableOpacity
              style={styles.trainerRow}
              onPress={() => session.trainerId && router.push(`/trainee/trainer-detail?trainerId=${session.trainerId}`)}
              data-testid="session-trainer-profile-link"
            >
              {/* iter106as: unified avatar disc for the trainer thumbnail
                  on the session-detail screen. */}
              <UserAvatar
                size={64}
                style={styles.trainerPhoto as any}
                user={{
                  avatarUrl: session.trainerPhoto,
                  fullName: session.trainerName,
                }}
              />
              <View style={styles.trainerInfo}>
                <Text style={styles.trainerName}>{session.trainerName || 'Trainer'}</Text>
                <Text style={styles.trainerSpecialty}>{session.trainerSpecialty || 'Personal Trainer'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </TouchableOpacity>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
                <Ionicons name="chatbubble" size={20} color={'#FF6A00'} />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
                <Ionicons name="call" size={20} color={'#FF6A00'} />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#F8F4FF' }]}
                onPress={() => router.push(`/trainee/receipt?sessionId=${sessionId}`)}
                data-testid="view-receipt-btn"
              >
                <Ionicons name="receipt" size={20} color="#6D1ED4" />
                <Text style={[styles.actionButtonText, { color: '#6D1ED4' }]}>Receipt</Text>
              </TouchableOpacity>
              {(session.paymentStatus === 'paid' || session.paymentStatus === 'succeeded') && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#FFF1F0' }]}
                  onPress={() => router.push(`/dispute/open?sessionId=${sessionId}`)}
                  data-testid="report-issue-btn"
                >
                  <Ionicons name="alert-circle" size={20} color={'#FF4757'} />
                  <Text style={[styles.actionButtonText, { color: '#FF4757' }]}>Report issue</Text>
                </TouchableOpacity>
              )}
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

          {/* iter102aq: Payment CTA — only shown when the trainer has accepted
              (paymentReady=true) AND payment hasn't been made yet. This is the
              new flow: no charge happens until the trainer locks in time +
              location, then the trainee taps to confirm and pay. */}
          {session.paymentReady && session.paymentStatus !== 'succeeded' && session.paymentStatus !== 'paid' && (
            <View style={[styles.card, { borderColor: COLORS.orange, borderWidth: 1.5, backgroundColor: 'rgba(255,106,0,0.08)' }]}>
              <Text style={[styles.cardTitle, { color: COLORS.orange }]}>Trainer accepted — confirm to lock in</Text>
              <Text style={[styles.infoTextSub, { marginBottom: 12 }]}>
                Your trainer agreed on the time, date and location. Pay now to confirm the session.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.orange,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                }}
                onPress={() => router.push({
                  pathname: '/trainee/confirm-booking',
                  params: {
                    sessionId: String(session.id),
                    trainerName: session.trainerName || 'Trainer',
                    trainerId: session.trainerId,
                    date: sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    time: sessionDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    duration: String(session.durationMinutes),
                    sessionType: session.sessionType || session.locationType || 'outdoor',
                    priceCents: String(session.baseSessionPriceCents || session.finalSessionPriceCents || 0),
                    sessionDateTimeStartIso: session.sessionDateTimeStart,
                    locationNameOrAddress: session.locationNameOrAddress || '',
                    payNow: '1',
                  },
                })}
                data-testid="confirm-and-pay-btn"
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>
                  CONFIRM & PAY
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* iter102ap: Trainee-side Join Video Call card for virtual sessions. */}
          {(session.sessionType === 'virtual' || session.modality === 'virtual') && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Join Video Call</Text>
              {session.videoCallLink ? (
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => Linking.openURL(session.videoCallLink).catch(() => {})}
                  data-testid="join-video-call-btn"
                >
                  <Ionicons name="videocam" size={20} color={COLORS.orange} />
                  <Text style={[styles.infoText, { flex: 1 }]} numberOfLines={2}>{session.videoCallLink}</Text>
                  <Ionicons name="open-outline" size={22} color={COLORS.orange} />
                </TouchableOpacity>
              ) : (
                <Text style={[styles.infoTextSub, { color: '#FFB300', fontStyle: 'italic' }]}>
                  Your trainer hasn&apos;t added a video call link yet. Message them to share it.
                </Text>
              )}
            </View>
          )}

          {/* Location */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location</Text>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={COLORS.orange} />
              <Text style={styles.infoText}>{session.locationType || 'Not specified'}</Text>
            </View>
            {(session.locationNameOrAddress || session.address) && (
              <View style={styles.infoRow}>
                <Ionicons name="navigate" size={20} color={COLORS.gray} />
                <Text style={styles.infoTextSub}>{session.locationNameOrAddress || session.address}</Text>
              </View>
            )}
            
            {/* Trainer's Location Proposal */}
            {session.outdoorLocationTrainerProposal && !session.outdoorLocationAgreed && session.sessionType === 'outdoor' && (
              <View style={styles.proposalCard}>
                <View style={styles.proposalHeader}>
                  <Ionicons name="location" size={18} color={COLORS.orange} />
                  <Text style={styles.proposalTitle}>Trainer Proposed Location</Text>
                </View>
                <Text style={styles.proposalLocation}>{session.outdoorLocationTrainerProposal}</Text>
                <View style={styles.proposalButtons}>
                  <TouchableOpacity
                    style={[styles.proposalBtn, styles.proposalBtnAccept]}
                    onPress={handleAgreeLocation}
                    disabled={submitting}
                    data-testid="accept-location-btn"
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color={COLORS.white} />
                        <Text style={styles.proposalBtnText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.proposalBtn, styles.proposalBtnCounter]}
                    onPress={() => setShowLocationModal(true)}
                    disabled={submitting}
                    data-testid="counter-location-btn"
                  >
                    <Ionicons name="create" size={18} color={'#FF6A00'} />
                    <Text style={[styles.proposalBtnText, { color: '#FFFFFF' }]}>Suggest Different</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Location Agreed Badge */}
            {session.outdoorLocationAgreed && (
              <View style={styles.agreedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                <Text style={styles.agreedText}>Location Confirmed</Text>
              </View>
            )}
          </View>

          {/* iter106g: live en-route map — both parties tracked toward each
              other. Shows once payment is confirmed and through the active
              session. Mirrors the trainer-side experience for symmetry. */}
          {(session.status === SessionStatus.CONFIRMED || session.status === 'en_route' || session.status === 'in_progress') && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Live Tracking</Text>
              <EnRouteMap
                session={session}
                role="trainee"
                otherAvatarUrl={session.trainerAvatarUrl || session.trainerProfilePhoto}
                otherDisplayName={session.trainerName}
                destination={null}
              />
            </View>
          )}

          {/* Arrival Confirmation */}
          {(session.status === SessionStatus.CONFIRMED || session.status === 'en_route') && !session.traineeArrivedConfirmed && (
            <TouchableOpacity
              style={styles.arrivalCard}
              onPress={handleConfirmArrival}
              disabled={submitting}
              data-testid="confirm-arrival-btn"
            >
              <LinearGradient colors={['#0A0E1A', '#141929']} style={styles.arrivalGradient}>
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="location" size={24} color={COLORS.white} />
                    <View style={styles.arrivalContent}>
                      <Text style={styles.arrivalTitle}>Tap When You Arrive</Text>
                      <Text style={styles.arrivalSubtitle}>Let your trainer know you are here</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={COLORS.white} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {/* Arrival Status */}
          {session.traineeArrivedConfirmed && (
            <View style={styles.arrivalStatus}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.arrivalStatusText}>You have confirmed arrival</Text>
              {session.trainerArrivedConfirmed ? (
                <View style={styles.bothArrivedBadge}>
                  <Ionicons name="people" size={16} color={COLORS.white} />
                  <Text style={styles.bothArrivedText}>Both Ready!</Text>
                </View>
              ) : (
                <Text style={styles.waitingText}>Waiting for trainer...</Text>
              )}
            </View>
          )}

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

      {/* Counter-Proposal Modal */}
      <Modal visible={showLocationModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Suggest a Different Location</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)} data-testid="close-location-modal">
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Enter your preferred meeting spot:</Text>
            <TextInput
              style={styles.locationInput}
              placeholder="e.g., Central Park near 72nd St entrance"
              placeholderTextColor={COLORS.gray}
              value={counterProposal}
              onChangeText={setCounterProposal}
              multiline
              data-testid="counter-proposal-input"
            />
            <TouchableOpacity
              style={[styles.modalBtn, !counterProposal.trim() && styles.modalBtnDisabled]}
              onPress={handleProposeCounter}
              disabled={submitting || !counterProposal.trim()}
              data-testid="submit-counter-proposal-btn"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.modalBtnText}>Send Proposal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  // iter104a: BOOK AGAIN cta for completed sessions
  bookAgainCta: {
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  bookAgainGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
  },
  bookAgainText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trainerInfo: { flex: 1 },
  trainerName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  trainerSpecialty: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  infoTextSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', flex: 1 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: { fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  priceValue: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
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
  // Location proposal styles
  proposalCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  proposalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6A00',
  },
  proposalLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  proposalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  proposalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  proposalBtnAccept: {
    backgroundColor: COLORS.success,
  },
  proposalBtnCounter: {
    backgroundColor: '#141929',
    borderWidth: 1,
    borderColor: '#FF6A00',
  },
  proposalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  agreedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 214, 143, 0.1)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  agreedText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  // Arrival confirmation styles
  arrivalCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  arrivalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  arrivalContent: {
    flex: 1,
  },
  arrivalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  arrivalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  arrivalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  arrivalStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  waitingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
  },
  bothArrivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bothArrivedText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#141929',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  locationInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalBtn: {
    backgroundColor: '#0A0E1A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});

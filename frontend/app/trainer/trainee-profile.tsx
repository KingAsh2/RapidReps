/**
 * Trainer's view of a Trainee Profile — iter98d full redesign.
 * - Dark navy theme + FloatingOrangeBg (no more bland orange screen)
 * - Full media: UserAvatar with accent-color ring, vibe music auto-play,
 *   highlight reel, social links, instagram. Auto-stops music on unmount.
 * - Preserves all original session-request logic (accept/decline, propose
 *   location, confirm arrival) at the bottom.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { trainerAPI, safetyAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { SocialLinksDisplay } from '../../src/components/ProfileSections';
import InstagramSection from '../../src/components/InstagramSection';
import { UserAvatar } from '../../src/components/UserAvatar';
import { TrainerVibePlayer } from '../../src/components/TrainerVibePlayer';
import { HighlightReel } from '../../src/components/HighlightReel';
import FloatingOrangeBg from '../../src/components/FloatingOrangeBg';
import { stopAllAudio } from '../../src/utils/audioCoordinator';

export default function TraineeProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();

  const sessionId = params.sessionId as string;
  // iter106w: accept both `traineeId` and `userId` param names. Earlier code
  // paths used `userId` (e.g. the "find a client" search) which silently
  // skipped the profile fetch — that's why the trainer-side view looked
  // stripped down ("just initials + session details"). Accepting both keeps
  // every entry point loading the rich profile data.
  const traineeId = (params.traineeId || params.userId) as string;
  const traineeName = params.traineeName as string;
  const traineePhoto = params.traineePhoto as string;
  const sessionDetails = params.sessionDetails as string;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [proposedLocation, setProposedLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [traineeData, setTraineeData] = useState<any>(null);
  const [highlights, setHighlights] = useState<any[]>([]);

  // Parse session details from params
  useEffect(() => {
    if (sessionDetails) {
      try { setSession(JSON.parse(sessionDetails)); }
      catch (e) { console.error('parse session:', e); }
    }
  }, [sessionDetails]);

  // Fetch trainee profile + highlights
  useEffect(() => {
    if (!traineeId) return;
    const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/trainee-profiles/${traineeId}`);
        if (res.ok) setTraineeData(await res.json());
      } catch (e) { console.error('load trainee profile:', e); }
      try {
        const h = await fetch(`${API_URL}/api/trainee-profiles/${traineeId}/highlights`);
        if (h.ok) {
          const j = await h.json();
          setHighlights(j?.highlights || j || []);
        }
      } catch { /* highlights optional */ }
    })();
  }, [traineeId]);

  // iter98d: stop any audio when leaving the profile (Task 5)
  const stopAudioOnLeave = useRef(false);
  useEffect(() => {
    stopAudioOnLeave.current = true;
    return () => {
      // Guarantee music stops when leaving this profile
      try { stopAllAudio(); } catch { /* no-op */ }
    };
  }, []);

  const reloadSession = async () => {
    try {
      const sessions = await trainerAPI.getSessions();
      const found = sessions.find((s: any) => s.id === sessionId);
      if (found) setSession(found);
    } catch (e) { console.error('reload session:', e); }
  };

  // ---------------- Safety / actions ----------------
  const handleReportTrainee = () => {
    showAlert({
      title: 'Report',
      message: 'Report this trainee for spam, harassment, or inappropriate content?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: async () => {
          try { await safetyAPI.reportUser({ reportedUserId: traineeId, reason: 'Reported from trainee profile', contentType: 'profile' }); }
          catch (e: any) { showAlert({ title: 'Error', message: e?.message || 'Unable to submit report.', type: 'error' }); }
        } },
      ],
    });
  };

  const handleBlockTrainee = () => {
    showAlert({
      title: 'Block Trainee',
      message: 'Blocking hides this trainee from your results and prevents future interactions.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: async () => {
          try { await safetyAPI.blockUser(traineeId); router.back(); }
          catch (e: any) { showAlert({ title: 'Error', message: e?.message || 'Unable to block user.', type: 'error' }); }
        } },
      ],
    });
  };

  const handleProposeLocation = async () => {
    if (!proposedLocation.trim()) { toast.error('Please enter a location'); return; }
    setSubmitting(true);
    try {
      await trainerAPI.proposeLocation(session.id, proposedLocation.trim());
      haptic.success();
      toast.success('Location proposal sent!');
      setShowLocationModal(false);
      setProposedLocation('');
      reloadSession();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed to send proposal'); }
    finally { setSubmitting(false); }
  };

  const handleConfirmArrival = async () => {
    setSubmitting(true);
    try {
      const r = await trainerAPI.confirmArrival(session.id);
      haptic.success();
      toast.success(r.message);
      reloadSession();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Failed to confirm arrival'); }
    finally { setSubmitting(false); }
  };

  const handleAccept = () => {
    showAlert({
      title: 'Accept Session Request',
      message: 'Are you sure you want to accept this session?',
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: async () => {
          setLoading(true);
          try {
            await trainerAPI.acceptSession(sessionId);
            showAlert({
              title: 'Session Accepted!', message: 'The trainee has been notified and will process payment.', type: 'success',
              buttons: [{ text: 'OK', onPress: () => router.back() }],
            });
          } catch { showAlert({ title: 'Accept Failed', message: 'Failed to accept session.', type: 'error' }); }
          finally { setLoading(false); }
        } },
      ],
    });
  };

  const handleDeny = () => {
    showAlert({
      title: 'Decline Session Request',
      message: 'Are you sure you want to decline this session?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            await trainerAPI.declineSession(sessionId);
            showAlert({ title: 'Session Declined', message: 'The trainee has been notified.', type: 'info',
              buttons: [{ text: 'OK', onPress: () => router.back() }] });
          } catch { showAlert({ title: 'Decline Failed', message: 'Failed to decline session.', type: 'error' }); }
          finally { setLoading(false); }
        } },
      ],
    });
  };

  const handleNavigate = () => {
    const address = session?.traineeHomeAddress || session?.locationNameOrAddress || '';
    router.push({
      pathname: '/trainer/en-route',
      params: {
        sessionId, traineeName, traineeId,
        traineeAddress: address,
        traineeLat: session?.traineeLatitude?.toString() || '',
        traineeLng: session?.traineeLongitude?.toString() || '',
        sessionType: session?.sessionType || 'outdoor',
      },
    });
  };

  const handleMessage = async () => {
    try {
      const { chatAPI } = await import('../../src/services/api');
      const result = await chatAPI.getOrCreateConversation(traineeId || '');
      router.push(`/messages/chat?conversationId=${result.conversationId}&userId=${traineeId}&userName=${traineeName}`);
    } catch (e) { console.error('open chat:', e); }
  };

  const handleCall = () => {
    const phone = session?.traineePhone || params.traineePhone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else showAlert({ title: 'Contact Unavailable', message: 'Contact info shared after session is confirmed.', type: 'info' });
  };

  // ---------------- Derived display values ----------------
  const accent = traineeData?.accentColor || traineeData?.accentColorAuto || '#FF6A00';
  const fullName = traineeData?.fullName || traineeName || 'Trainee';
  const avatarUrl = traineeData?.profilePhoto || traineeData?.avatarUrl || traineePhoto;
  const introVideoUrl = traineeData?.introVideoUrl;
  const personalityTag = traineeData?.personalityTag;

  return (
    <View style={styles.root}>
      <FloatingOrangeBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} data-testid="back-btn">
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{fullName.split(' ')[0]}'s Profile</Text>
          <TouchableOpacity onPress={handleReportTrainee} style={styles.iconBtn} data-testid="more-btn">
            <Ionicons name="flag-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          {/* Hero card */}
          <View style={[styles.heroCard, { borderColor: `${accent}40` }]}>
            <LinearGradient
              colors={[`${accent}22`, 'rgba(20,25,41,0.0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.avatarRing, { borderColor: accent }]}>
              <UserAvatar
                user={{ avatarUrl, fullName, profilePhoto: avatarUrl }}
                size={120}
              />
            </View>
            <Text style={styles.heroName}>{fullName}</Text>
            {personalityTag ? (
              <View style={[styles.tagPill, { backgroundColor: `${accent}25`, borderColor: accent }]}>
                <Ionicons name="sparkles" size={12} color={accent} />
                <Text style={[styles.tagPillText, { color: accent }]}>{personalityTag}</Text>
              </View>
            ) : null}
            {/* iter106w: bio sits in the hero — same placement as
                trainee-side trainer-detail. Trainee writes this in their
                profile setup; surfaced here so trainers can read their
                client's intro at a glance before accepting a session. */}
            {traineeData?.bio ? (
              <Text style={styles.bioText} numberOfLines={6}>{traineeData.bio}</Text>
            ) : null}
            {session?.traineeGoals ? (
              <View style={styles.goalsRow}>
                <Ionicons name="flag" size={14} color={accent} />
                <Text style={styles.goalsText} numberOfLines={3}>{session.traineeGoals}</Text>
              </View>
            ) : null}
            {introVideoUrl ? (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.open(introVideoUrl, '_blank');
                  } else {
                    setShowVideoModal(true);
                  }
                }}
                style={[styles.introVideoBtn, { backgroundColor: accent }]}
                data-testid="play-intro-video"
              >
                <Ionicons name="play" size={16} color="#FFFFFF" />
                <Text style={styles.introVideoText}>Watch Intro Video</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* iter102an: Vibe music — check the ACTUAL fields the player reads
              (vibeTrackTitle / vibePreviewUrl), not legacy `profileMusicUrl`
              names that no longer exist on the trainee response. */}
          {traineeData?.vibeTrackTitle || traineeData?.vibePreviewUrl ? (
            <View style={styles.sectionCard}>
              <TrainerVibePlayer vibe={traineeData as any} autoPlay={true} />
            </View>
          ) : null}

          {/* Highlight reel */}
          {highlights && highlights.length > 0 ? (
            <View style={styles.sectionCard}>
              <HighlightReel highlights={highlights as any} trainerName={fullName} />
            </View>
          ) : null}

          {/* iter106y: Client Info card — always renders, even for trainees
              with empty profiles. Surfaces useful at-a-glance context for
              the trainer (member since, prior sessions with you, verified
              email, etc.) so the screen never feels visually empty just
              because the client hasn't filled in vibe/bio/anthem yet. */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Client Info</Text>
            <Row
              icon="person-circle-outline"
              text={traineeData?.createdAt
                ? `Member since ${new Date(traineeData.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
                : 'New to RapidReps'}
            />
            <Row
              icon="fitness-outline"
              text={typeof traineeData?.sessionsWithYou === 'number'
                ? `${traineeData.sessionsWithYou} previous ${traineeData.sessionsWithYou === 1 ? 'session' : 'sessions'} with you`
                : 'First session with you'}
            />
            {traineeData?.emailVerified ? (
              <Row icon="shield-checkmark-outline" text="Verified account" />
            ) : null}
            {traineeData?.phoneVerified ? (
              <Row icon="call-outline" text="Phone verified" />
            ) : null}
            {!traineeData?.bio && !personalityTag ? (
              <View style={styles.emptyHint}>
                <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyHintText}>
                  This client hasn&apos;t finished setting up their profile yet — chat with them to learn more about their goals.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Session details */}
          {session ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Session Details</Text>
              <Row icon="calendar-outline" text={new Date(session.sessionDateTimeStart).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
              <Row icon="time-outline" text={new Date(session.sessionDateTimeStart).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} />
              <Row icon="hourglass-outline" text={`${session.durationMinutes} minutes`} />
              <Row icon="location-outline" text={session.locationType || 'In-Person'} />
              <Row icon="cash-outline" text={`$${((session.finalSessionPriceCents || 0) / 100).toFixed(2)}`} />
              {session.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <Text style={styles.notesText}>{session.notes}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Quick actions */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <ActionRow icon="chatbubble-ellipses" color="#5EC8FF" label={`Message ${fullName.split(' ')[0]}`} onPress={handleMessage} testId="action-message" />
            <ActionRow icon="navigate" color={accent} label="Navigate to Trainee" onPress={handleNavigate} testId="action-navigate" />
            <ActionRow icon="call" color="#00D68F" label="Call Trainee" onPress={handleCall} testId="action-call" last />
          </View>

          {/* Location management */}
          {session && session.sessionType === 'outdoor' && (session.status === 'confirmed' || session.status === 'en_route') ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Meeting Location</Text>
              <Row icon="location" text={session.locationNameOrAddress || session.outdoorLocationTrainerProposal || 'Not set'} />
              {session.outdoorLocationAgreed ? (
                <View style={[styles.statusPill, { backgroundColor: 'rgba(0,214,143,0.12)' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#00D68F" />
                  <Text style={[styles.statusPillText, { color: '#00D68F' }]}>Location Confirmed</Text>
                </View>
              ) : session.outdoorLocationTrainerProposal ? (
                <View style={[styles.statusPill, { backgroundColor: 'rgba(255,179,0,0.12)' }]}>
                  <Ionicons name="time" size={16} color="#FFB300" />
                  <Text style={[styles.statusPillText, { color: '#FFB300' }]}>Waiting for trainee to confirm</Text>
                </View>
              ) : null}
              <TouchableOpacity style={[styles.proposeBtn, { backgroundColor: accent }]} onPress={() => setShowLocationModal(true)} data-testid="propose-location-btn">
                <Ionicons name="create" size={18} color="#FFF" />
                <Text style={styles.proposeBtnText}>{session.outdoorLocationTrainerProposal ? 'Change Location' : 'Propose Meeting Spot'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Arrival CTA */}
          {session && (session.status === 'confirmed' || session.status === 'en_route') && !session.trainerArrivedConfirmed ? (
            <TouchableOpacity style={styles.arrivalCard} onPress={handleConfirmArrival} disabled={submitting} data-testid="confirm-arrival-btn">
              <LinearGradient colors={[accent, '#FF3D00']} style={styles.arrivalGrad}>
                {submitting ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <>
                    <Ionicons name="location" size={22} color="#FFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.arrivalTitle}>I Have Arrived</Text>
                      <Text style={styles.arrivalSub}>Tap to notify the trainee</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#FFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : null}

          {session?.trainerArrivedConfirmed ? (
            <View style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <Ionicons name="checkmark-circle" size={18} color="#00D68F" />
              <Text style={[styles.statusPillText, { color: '#00D68F' }]}>You have confirmed arrival</Text>
              {session.traineeArrivedConfirmed ? (
                <View style={styles.bothReady}>
                  <Ionicons name="people" size={14} color="#FFF" />
                  <Text style={styles.bothReadyText}>Both Ready!</Text>
                </View>
              ) : <Text style={styles.waiting}>Waiting for trainee…</Text>}
            </View>
          ) : null}

          {/* iter106w: Connect — restored SocialLinksDisplay so the trainer
              sees Instagram/TikTok/Twitter links the trainee filled in,
              same as the trainee sees on the trainer profile. */}
          {(traineeData?.socialLinks || traineeData?.instagramHandle) ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Connect</Text>
              {traineeData?.socialLinks ? (
                <SocialLinksDisplay socialLinks={traineeData.socialLinks} />
              ) : null}
              <InstagramSection targetUserId={traineeId} />
            </View>
          ) : null}

          {/* Safety footer */}
          <TouchableOpacity style={styles.dangerRow} onPress={handleBlockTrainee} data-testid="block-trainee-btn">
            <Ionicons name="ban-outline" size={16} color="#FF6B6B" />
            <Text style={styles.dangerText}>Block this trainee</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom Accept/Decline */}
        {session?.status === 'requested' ? (
          <View style={styles.bottomActions}>
            <TouchableOpacity onPress={handleDeny} disabled={loading} style={[styles.bottomBtn, styles.denyBtn]} data-testid="decline-session-btn">
              <Ionicons name="close-circle" size={22} color="#FFF" />
              <Text style={styles.bottomBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAccept} disabled={loading} style={styles.bottomBtn} data-testid="accept-session-btn">
              <LinearGradient colors={['#FF6A00', '#FF3D00']} style={styles.acceptGrad}>
                <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                <Text style={styles.bottomBtnText}>{loading ? 'Accepting...' : 'Accept'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Location proposal modal */}
        <Modal visible={showLocationModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>Propose Meeting Location</Text>
                <TouchableOpacity onPress={() => setShowLocationModal(false)} data-testid="close-location-modal">
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalHint}>Enter the address or description of where you will meet:</Text>
              <TextInput
                style={styles.locationInput}
                placeholder="e.g., Central Park near 72nd St entrance"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={proposedLocation}
                onChangeText={setProposedLocation}
                multiline
                data-testid="location-proposal-input"
              />
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: accent, opacity: proposedLocation.trim() ? 1 : 0.5 }]}
                onPress={handleProposeLocation}
                disabled={submitting || !proposedLocation.trim()}
                data-testid="submit-location-proposal-btn"
              >
                {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.modalBtnText}>Send to Trainee</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Intro video modal (native) */}
        <Modal visible={showVideoModal} animationType="fade" transparent onRequestClose={() => setShowVideoModal(false)}>
          <View style={styles.videoOverlay}>
            <TouchableOpacity style={styles.videoClose} onPress={() => setShowVideoModal(false)} data-testid="close-video-modal">
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            {introVideoUrl ? (
              <Video
                source={{ uri: introVideoUrl }}
                style={styles.videoPlayer}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
              />
            ) : null}
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// ---------- Small subcomponents ----------
const Row = ({ icon, text }: { icon: any; text: string }) => (
  <View style={styles.row}>
    <Ionicons name={icon} size={18} color="rgba(255,255,255,0.65)" />
    <Text style={styles.rowText}>{text}</Text>
  </View>
);

const ActionRow = ({ icon, color, label, onPress, testId, last }: any) => (
  <TouchableOpacity style={[styles.actionRow, last && { borderBottomWidth: 0 }]} onPress={onPress} data-testid={testId}>
    <View style={[styles.actionIcon, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.35)" />
  </TouchableOpacity>
);

// ---------- Styles ----------
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0E1A' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  scroll: { flex: 1, paddingHorizontal: 16 },

  // Hero
  heroCard: {
    backgroundColor: 'rgba(20,25,41,0.85)',
    borderRadius: 22, padding: 22, marginTop: 8, marginBottom: 14,
    borderWidth: 1, alignItems: 'center', overflow: 'hidden',
  },
  avatarRing: {
    width: 132, height: 132, borderRadius: 66,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  heroName: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  tagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, marginTop: 10,
  },
  tagPillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  // iter106w: bio in the hero card (parity with trainee-side trainer-detail).
  bioText: {
    marginTop: 14,
    paddingHorizontal: 4,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '500',
    textAlign: 'center',
  },
  // iter106y: friendly hint when a client hasn't filled in their profile yet
  emptyHint: {
    marginTop: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  goalsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  goalsText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  introVideoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginTop: 14,
  },
  introVideoText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },

  // Sections
  sectionCard: {
    backgroundColor: 'rgba(20,25,41,0.85)',
    borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 12, letterSpacing: 0.3 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', flex: 1 },

  notesBox: { marginTop: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10 },
  notesLabel: { fontSize: 11, fontWeight: '800', color: '#FF6A00', textTransform: 'uppercase', marginBottom: 4 },
  notesText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },

  // Action rows
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  actionIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    alignSelf: 'flex-start', marginTop: 10,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  proposeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  proposeBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  arrivalCard: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  arrivalGrad: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  arrivalTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  arrivalSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  bothReady: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#00D68F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  bothReadyText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  waiting: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },

  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, justifyContent: 'center' },
  dangerText: { fontSize: 12, fontWeight: '600', color: '#FF6B6B' },

  // Bottom Accept/Decline
  bottomActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, padding: 16,
    backgroundColor: 'rgba(10,14,26,0.97)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bottomBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  denyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 16, backgroundColor: '#1F2436',
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.4)',
  },
  acceptGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  bottomBtnText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.4 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#141929', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  modalHint: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 },
  locationInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#FFFFFF', minHeight: 80, textAlignVertical: 'top',
    marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  videoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  videoClose: { position: 'absolute', top: 48, right: 16, zIndex: 10, padding: 8 },
  videoPlayer: { width: '100%', height: '70%' },
});

/**
 * Trainer Session Detail screen (iter95) — counterpart to trainee/session-detail.tsx.
 *
 * Lets the trainer view a single session, respond to negotiation proposals
 * (Propose / Counter / Accept / Reject) via the shared NegotiationPanel,
 * see the agreed time/location once both parties confirm, and jump into
 * messaging / GPS check-in once payment lands.
 *
 * Uses the unified designSystem (DS) tokens for consistent visual styling.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Linking, RefreshControl, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RapidBg from '../../src/components/RapidBg';
import { ScreenHeader } from '../../src/components/ScreenShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionsAPI, chatAPI } from '../../src/services/api';
import NegotiationPanel from '../../src/components/NegotiationPanel';
import { DS } from '../../src/theme/designSystem';
import { formatCents } from '../../src/utils/pricing';
import { toast } from '../../src/utils/toast';
import { formatApiError } from '../../src/utils/formatApiError';
import EnRouteMap from '../../src/components/EnRouteMap';

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  requested: { label: 'Requested', color: DS.colors.warning, icon: 'time' },
  pending: { label: 'Pending', color: DS.colors.warning, icon: 'time' },
  confirmed: { label: 'Confirmed', color: DS.colors.success, icon: 'checkmark-circle' },
  in_progress: { label: 'In Progress', color: DS.colors.orange, icon: 'play-circle' },
  completed: { label: 'Completed', color: DS.colors.textPrimary, icon: 'checkmark-done' },
  cancelled: { label: 'Cancelled', color: DS.colors.error, icon: 'close-circle' },
  declined: { label: 'Declined', color: DS.colors.error, icon: 'close-circle' },
};

export default function TrainerSessionDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await sessionsAPI.getSession(String(sessionId));
      setSession(data);
    } catch (e: any) {
      toast.error(formatApiError(e, 'Failed to load session'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <SafeAreaView style={s.loaderWrap}>
        <ActivityIndicator size="large" color={DS.colors.orange} />
      </SafeAreaView>
    );
  }
  if (!session) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <RapidBg variant="trainer-session-detail" style={StyleSheet.absoluteFillObject} />
        <ScreenHeader
          title="Session Not Found"
          onBack={() => router.back()}
          testID="trainer-session-detail-header"
        />
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[session.status] || STATUS_META.requested;
  const start = session.sessionDateTimeStart ? new Date(session.sessionDateTimeStart) : null;
  const isVirtual = session.sessionType === 'virtual' || session.modality === 'virtual';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <RapidBg variant="trainer-session-detail" style={StyleSheet.absoluteFillObject} />
      <ScreenHeader
        title="Session Details"
        onBack={() => router.back()}
        testID="trainer-session-detail-header"
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.colors.orange} />}
      >
        {/* Status pill */}
        <View style={s.card}>
          <View style={[s.statusBadge, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={16} color="#FFF" />
            <Text style={s.statusBadgeText}>{meta.label}</Text>
          </View>
          <Text style={s.cardTitle}>Trainee</Text>
          <TouchableOpacity
            style={s.row}
            onPress={() => session.traineeId && router.push({ pathname: '/trainer/trainee-profile', params: { traineeId: session.traineeId, sessionId: String(session.id) } })}
            data-testid="open-trainee-profile"
            activeOpacity={0.85}
          >
            {session.traineePhoto ? (
              <Image source={{ uri: session.traineePhoto }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Ionicons name="person" size={22} color={DS.colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.h3}>{session.traineeName || 'Trainee'}</Text>
              <Text style={s.caption}>Tap to view full profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={DS.colors.textMuted} />
          </TouchableOpacity>
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={async () => {
                if (!session.traineeId) {
                  toast.error("Couldn't open chat", 'No trainee on this session');
                  return;
                }
                try {
                  // iter106ah: use getOrCreateConversation so the chat screen
                  // receives the conversationId it needs to load message
                  // history. Before this the URL only passed `userId=` and
                  // chat.tsx silently skipped `loadMessages` (no history,
                  // empty bubble area) since `conversationId` was missing.
                  const res = await chatAPI.getOrCreateConversation(String(session.traineeId));
                  router.push(
                    `/messages/chat?conversationId=${res.conversationId}&userId=${session.traineeId}&userName=${encodeURIComponent(session.traineeName || 'Trainee')}`,
                  );
                } catch (e: any) {
                  toast.error(formatApiError(e, "Couldn't open chat"));
                }
              }}
              data-testid="message-trainee"
            >
              <Ionicons name="chatbubble" size={18} color={DS.colors.orange} />
              <Text style={s.actionBtnText}>Message</Text>
            </TouchableOpacity>
            {/* iter106ah: always show the Call button. If the trainee never
                saved a phone number we toast a clear reason instead of just
                hiding the action (which looked like a UI bug). */}
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => {
                if (session.traineePhone) {
                  const tel = String(session.traineePhone).replace(/[^0-9+]/g, '');
                  Linking.openURL(`tel:${tel}`).catch(() =>
                    toast.error('Could not start call', 'Your device blocked the dial intent.'),
                  );
                } else {
                  toast.error(
                    'No phone number on file',
                    'The trainee has not added a phone number to their profile yet.',
                  );
                }
              }}
              data-testid="call-trainee"
            >
              <Ionicons name="call" size={18} color={DS.colors.orange} />
              <Text style={s.actionBtnText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Negotiation Panel */}
        {session.id && session.status !== 'completed' && session.status !== 'cancelled' && session.status !== 'declined' && (
          <NegotiationPanel
            sessionId={String(session.id)}
            currentUserRole="trainer"
            isVirtual={isVirtual}
            onAgreed={load}
          />
        )}

        {/* iter102ap: Virtual session — "Join Video Call" card. */}
        {isVirtual && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Join Video Call</Text>
            {session.videoCallLink ? (
              <TouchableOpacity
                style={s.metaRow}
                onPress={() => Linking.openURL(session.videoCallLink).catch(() => {})}
                data-testid="join-video-call-btn"
              >
                <Ionicons name="videocam" size={18} color={DS.colors.orange} />
                <Text style={[s.metaText, { flex: 1 }]} numberOfLines={2}>{session.videoCallLink}</Text>
                <Ionicons name="open-outline" size={22} color={DS.colors.orangeGlow} />
              </TouchableOpacity>
            ) : (
              <Text style={[s.metaText, { color: '#FFB300', fontStyle: 'italic' }]}>
                You haven&apos;t added a video call link yet. Go to Edit Profile → Virtual Training to paste a Zoom / Meet / FaceTime link.
              </Text>
            )}
          </View>
        )}

        {/* iter102ao: Meeting Location — was completely missing, so trainers
            had no idea where to go for outdoor bookings. Pulls the negotiated
            location first, falls back to the trainee's original address. Tap
            opens native Maps directions. */}
        {!isVirtual && (() => {
          const negotiated = session.outdoorLocationAgreed
            ? (session.outdoorLocationTrainerProposal || session.outdoorLocationTraineeProposal)
            : null;
          const address = negotiated
            || session.locationNameOrAddress
            || session.outdoorLocationTrainerProposal
            || session.outdoorLocationTraineeProposal
            || '';
          const hasAddress = address && address.trim() && address !== 'TBD' && address !== 'Outdoor Location';
          return (
            <View style={s.card}>
              <Text style={s.cardTitle}>Meeting Location</Text>
              {hasAddress ? (
                <TouchableOpacity
                  style={s.metaRow}
                  onPress={() => {
                    const q = encodeURIComponent(address);
                    const url = Platform.OS === 'ios'
                      ? `http://maps.apple.com/?q=${q}`
                      : `geo:0,0?q=${q}`;
                    Linking.openURL(url).catch(() => {});
                  }}
                  data-testid="open-maps-directions"
                >
                  <Ionicons name="location" size={18} color={DS.colors.orange} />
                  <Text style={[s.metaText, { flex: 1 }]} numberOfLines={2}>{address}</Text>
                  <Ionicons name="navigate-circle" size={22} color={DS.colors.orangeGlow} />
                </TouchableOpacity>
              ) : (
                <Text style={[s.metaText, { color: '#FFB300', fontStyle: 'italic' }]}>
                  No meeting location set yet. Use the negotiation panel above to propose one.
                </Text>
              )}
            </View>
          );
        })()}

        {/* Date & Time — iter106ah: render the trainee's exact wall-clock
            choice when available (`traineeLocalDate` + `traineeLocalTime`,
            persisted on the session doc). The trainer's device may live in a
            different timezone than the trainee, and re-parsing the UTC ISO
            via `.toLocaleString()` would shift the displayed hour. Falling
            back to the device-local render only when those fields are
            missing on an older session. */}
        {(session.traineeLocalDate || session.traineeLocalTime || start) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Scheduled</Text>
            <View style={s.metaRow}>
              <Ionicons name="calendar" size={18} color={DS.colors.orange} />
              <Text style={s.metaText}>
                {session.traineeLocalDate ||
                  (start ? start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '')}
              </Text>
            </View>
            <View style={s.metaRow}>
              <Ionicons name="time" size={18} color={DS.colors.orange} />
              <Text style={s.metaText}>
                {session.traineeLocalTime ||
                  (start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                {session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}
              </Text>
            </View>
            {/* If we rendered the trainee's wall-clock, leave a tiny note so
                the trainer knows this is the trainee's local time, not their
                own device's. */}
            {(session.traineeLocalDate || session.traineeLocalTime) && (
              <Text style={[s.caption, { marginTop: 6 }]}>Trainee&apos;s local time</Text>
            )}
          </View>
        )}

        {/* Earnings preview */}
        {(session.trainerEarningsCents || session.finalSessionPriceCents) > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Earnings</Text>
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Your Take-Home</Text>
              <Text style={s.priceValue}>{formatCents(session.trainerEarningsCents || 0)}</Text>
            </View>
            <View style={s.priceRowSub}>
              <Text style={s.priceLabelSub}>Session Price</Text>
              <Text style={s.priceValueSub}>{formatCents(session.finalSessionPriceCents || 0)}</Text>
            </View>
          </View>
        )}

        {/* iter106g: live en-route map replaces the old "Next Steps" link
            list. Once payment is confirmed, both parties see each other on a
            single map en route to the meeting spot. The legacy /en-route,
            /gps-checkin, and /start-session screens are still reachable from
            inside the map (the "Open directions" button + Start Session in
            the Quick Actions card below the map).
            iter106j: also keep the map visible during en_route / in_progress
            so the trainer doesn't lose live tracking once they tap "I'm on
            my way" (matches the trainee side which already covered all 3). */}
        {(session.status === 'confirmed' || session.status === 'en_route' || session.status === 'in_progress') && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Live Tracking</Text>
            <EnRouteMap
              session={session}
              role="trainer"
              otherAvatarUrl={session.traineeAvatarUrl || session.traineeProfilePhoto}
              otherDisplayName={session.traineeName}
              destination={
                typeof session.traineeLatitude === 'number' && typeof session.traineeLongitude === 'number'
                  ? { latitude: session.traineeLatitude, longitude: session.traineeLongitude }
                  : null
              }
            />
            <TouchableOpacity
              style={[s.linkRow, { marginTop: 4 }]}
              onPress={() => router.push(`/trainer/start-session?sessionId=${session.id}`)}
              data-testid="open-start-session"
            >
              <Ionicons name="play" size={18} color={DS.colors.success} />
              <Text style={s.linkText}>Start Session</Text>
              <Ionicons name="chevron-forward" size={18} color={DS.colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.bg },
  loaderWrap: { flex: 1, backgroundColor: DS.colors.bg, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.spacing.lg, paddingVertical: DS.spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...DS.text.label, letterSpacing: 2.4, fontSize: 12, color: DS.colors.textPrimary },
  scroll: { padding: DS.spacing.lg, paddingBottom: DS.spacing['4xl'] },
  card: { ...DS.card.base, marginBottom: DS.spacing.md },
  cardTitle: { ...DS.text.label, marginBottom: DS.spacing.sm, color: DS.colors.orangeGlow },
  h3: { ...DS.text.h3 },
  caption: { ...DS.text.caption, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start', marginBottom: DS.spacing.md },
  statusBadgeText: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: DS.spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: DS.colors.bgRaised2 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', gap: DS.spacing.sm, marginTop: DS.spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: DS.colors.orangeSoft, borderWidth: 1, borderColor: DS.colors.orangeRing },
  actionBtnText: { color: DS.colors.textPrimary, fontWeight: '800', fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  metaText: { ...DS.text.bodyStrong, flex: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  priceLabel: { ...DS.text.caption, color: DS.colors.textSecondary, fontSize: 14 },
  priceValue: { fontSize: 28, fontWeight: '900', color: DS.colors.success, letterSpacing: -0.5 },
  priceRowSub: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  priceLabelSub: { ...DS.text.caption },
  priceValueSub: { color: DS.colors.textPrimary, fontWeight: '700', fontSize: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: DS.colors.border },
  linkText: { ...DS.text.bodyStrong, flex: 1 },
});

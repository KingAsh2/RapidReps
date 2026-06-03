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
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Linking, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionsAPI } from '../../src/services/api';
import NegotiationPanel from '../../src/components/NegotiationPanel';
import { DS } from '../../src/theme/designSystem';
import { formatCents } from '../../src/utils/pricing';
import { toast } from '../../src/utils/toast';
import { formatApiError } from '../../src/utils/formatApiError';

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
      <SafeAreaView style={s.container}>
        <LinearGradient colors={['#0A0E1A', '#141929']} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="trainer-session-back">
            <Ionicons name="chevron-back" size={22} color={DS.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Session Not Found</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[session.status] || STATUS_META.requested;
  const start = session.sessionDateTimeStart ? new Date(session.sessionDateTimeStart) : null;
  const isVirtual = session.sessionType === 'virtual' || session.modality === 'virtual';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={['#0A0E1A', '#141929']} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="trainer-session-back">
          <Ionicons name="chevron-back" size={22} color={DS.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>SESSION</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

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
          <View style={s.row}>
            {session.traineePhoto ? (
              <Image source={{ uri: session.traineePhoto }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Ionicons name="person" size={22} color={DS.colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.h3}>{session.traineeName || 'Trainee'}</Text>
              <Text style={s.caption}>{isVirtual ? 'Virtual Session' : (session.locationType || 'In-Person').replace('_', ' ')}</Text>
            </View>
          </View>
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => session.traineeId && router.push(`/messages/chat?userId=${session.traineeId}&userName=${session.traineeName || 'Trainee'}`)}
              data-testid="message-trainee"
            >
              <Ionicons name="chatbubble" size={18} color={DS.colors.orange} />
              <Text style={s.actionBtnText}>Message</Text>
            </TouchableOpacity>
            {session.traineePhone && (
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => Linking.openURL(`tel:${session.traineePhone}`)}
                data-testid="call-trainee"
              >
                <Ionicons name="call" size={18} color={DS.colors.orange} />
                <Text style={s.actionBtnText}>Call</Text>
              </TouchableOpacity>
            )}
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

        {/* Date & Time */}
        {start && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Scheduled</Text>
            <View style={s.metaRow}>
              <Ionicons name="calendar" size={18} color={DS.colors.orange} />
              <Text style={s.metaText}>
                {start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View style={s.metaRow}>
              <Ionicons name="time" size={18} color={DS.colors.orange} />
              <Text style={s.metaText}>
                {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}
              </Text>
            </View>
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

        {/* Quick links once payment lands */}
        {session.status === 'confirmed' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Next Steps</Text>
            <TouchableOpacity
              style={s.linkRow}
              onPress={() => router.push(`/trainer/en-route?sessionId=${session.id}`)}
              data-testid="open-en-route"
            >
              <Ionicons name="navigate" size={18} color={DS.colors.orangeGlow} />
              <Text style={s.linkText}>I'm on my way</Text>
              <Ionicons name="chevron-forward" size={18} color={DS.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.linkRow}
              onPress={() => router.push(`/trainer/gps-checkin?sessionId=${session.id}`)}
              data-testid="open-gps-checkin"
            >
              <Ionicons name="location" size={18} color={DS.colors.orangeGlow} />
              <Text style={s.linkText}>GPS Check-In</Text>
              <Ionicons name="chevron-forward" size={18} color={DS.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.linkRow}
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

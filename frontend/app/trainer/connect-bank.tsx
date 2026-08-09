/**
 * Trainer Payouts (iter118q) — Stripe Connect Express
 *
 * Payouts to trainers now flow through Stripe Connect Express:
 *   trainee pays → 100% lands on RapidReps' platform Stripe account →
 *   session completed + trainee confirms end → T+24 h backend worker
 *   creates a Stripe Transfer → trainer's Stripe balance → trainer's bank
 *   via Stripe's automatic payout schedule.
 *
 * This screen owns the onboarding + status surface. The trainee-facing
 * checkout screens are unchanged.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import RapidBg from '../../src/components/RapidBg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as WebBrowser from 'expo-web-browser';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#06080F',
  bgCard: '#0E121C',
  border: 'rgba(255,255,255,0.08)',
  orange: '#FF7A00',
  orangeGlow: '#FF9B2F',
  text: '#FFFFFF',
  textMuted: '#7C8295',
  textSec: '#C6CBD9',
  success: '#00C853',
  warning: '#FFAA00',
  error: '#FF4757',
};

type Payout = {
  id: string;
  amountCents: number;
  status: string;
  arrivalDate?: number | null;
  created?: number | null;
  failureCode?: string | null;
  failureMessage?: string | null;
};

type ConnectStatus = {
  connectStatus: 'not_connected' | 'onboarding' | 'requirements_due' | 'restricted' | 'connected';
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  requirementsDue: string[];
  requirementsPastDue?: string[];
  requirementsDisabledReason?: string | null;
  availableCents: number;
  pendingCents: number;
  payouts: Payout[];
};

// Human-readable label + accent for the status pill at the top of the screen.
function statusChrome(s: ConnectStatus['connectStatus']) {
  switch (s) {
    case 'connected':
      return { label: 'Payouts active', icon: 'checkmark-circle', color: C.success };
    case 'requirements_due':
      return { label: 'Finish verification', icon: 'alert-circle', color: C.warning };
    case 'restricted':
      return { label: 'Payouts restricted', icon: 'lock-closed', color: C.error };
    case 'onboarding':
      return { label: 'Onboarding in progress', icon: 'time', color: C.orange };
    default:
      return { label: 'Not connected', icon: 'link', color: C.textMuted };
  }
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ts(unix?: number | null): string {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString();
}

export default function ConnectPayoutsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returned?: string; refresh?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [status, setStatus] = useState<ConnectStatus | null>(null);

  const authHeaders = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  };

  const load = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await axios.get(`${API_URL}/api/trainer/connect/status`, { headers });
      setStatus(res.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Could not load payout status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // If the trainee just came back from Stripe-hosted onboarding, refresh
  // aggressively — the webhook may still be in flight.
  useEffect(() => {
    if (params?.returned === '1') {
      setTimeout(() => load(), 800);
      setTimeout(() => load(), 3200);
    }
  }, [params?.returned, load]);

  const onConnect = async () => {
    haptic.medium();
    setLaunching(true);
    try {
      const headers = await authHeaders();
      const res = await axios.post(
        `${API_URL}/api/trainer/connect/account-link`,
        {},
        { headers },
      );
      const url = res.data?.url;
      if (!url) throw new Error('No Stripe onboarding URL returned.');
      // Prefer the in-app browser; if that fails (rare), fall back to system.
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        await Linking.openURL(url);
      }
      // Come back — refresh once the sheet dismisses.
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Could not start Stripe onboarding.');
    } finally {
      setLaunching(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <RapidBg variant="trainer-earnings" style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={C.orange} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  const chrome = statusChrome(status?.connectStatus || 'not_connected');
  const notConnected = !status || status.connectStatus === 'not_connected';
  const ctaLabel = notConnected
    ? 'Set up payouts with Stripe'
    : status?.connectStatus === 'connected'
    ? 'Update payout details'
    : 'Finish Stripe onboarding';

  return (
    <View style={styles.container}>
      <RapidBg variant="trainer-earnings" style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            data-testid="connect-back-btn"
          >
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payouts</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />}
        >
          {/* Status hero */}
          <View style={[styles.card, { borderColor: `${chrome.color}55` }]} data-testid="connect-status-card">
            <View style={styles.statusRow}>
              <Ionicons name={chrome.icon as any} size={22} color={chrome.color} />
              <Text style={[styles.statusLabel, { color: chrome.color }]}>{chrome.label}</Text>
            </View>
            <Text style={styles.subCopy}>
              RapidReps uses Stripe Connect to send you 80% of every session directly to your bank —
              typically 24 hours after your client confirms the session ended.
            </Text>

            {status?.connectStatus === 'connected' ? (
              <View style={styles.balanceRow}>
                <View style={styles.balanceCol}>
                  <Text style={styles.balanceLabel}>AVAILABLE</Text>
                  <Text style={styles.balanceValue} data-testid="connect-available">
                    {money(status?.availableCents || 0)}
                  </Text>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceCol}>
                  <Text style={styles.balanceLabel}>PENDING</Text>
                  <Text style={styles.balanceValue} data-testid="connect-pending">
                    {money(status?.pendingCents || 0)}
                  </Text>
                </View>
              </View>
            ) : null}

            {status && status.requirementsDue.length > 0 ? (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={16} color={C.warning} />
                <Text style={styles.warningText}>
                  Stripe still needs: {status.requirementsDue.slice(0, 3).join(', ')}
                  {status.requirementsDue.length > 3 ? '…' : ''}
                </Text>
              </View>
            ) : null}
            {status?.requirementsDisabledReason ? (
              <View style={styles.errorBox}>
                <Ionicons name="lock-closed" size={16} color={C.error} />
                <Text style={styles.errorText}>Restricted: {status.requirementsDisabledReason}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={onConnect}
              disabled={launching}
              style={[styles.cta, launching && { opacity: 0.65 }]}
              data-testid="connect-cta-btn"
            >
              <LinearGradient
                colors={[C.orange, C.orangeGlow]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGrad}
              >
                {launching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={18} color="#fff" />
                    <Text style={styles.ctaText}>{ctaLabel}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.fineprint}>
              Stripe securely collects your bank account and tax info. RapidReps never sees your bank details.
            </Text>
          </View>

          {/* Payout history */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent payouts</Text>
            {status && status.payouts.length > 0 ? (
              status.payouts.map((p) => (
                <View key={p.id} style={styles.payoutRow} data-testid={`payout-row-${p.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payoutAmount}>{money(p.amountCents)}</Text>
                    <Text style={styles.payoutMeta}>
                      {p.status === 'paid' ? `Paid · arrived ${ts(p.arrivalDate)}` :
                       p.status === 'failed' ? `Failed · ${p.failureMessage || p.failureCode || 'update bank'}` :
                       `${p.status}${p.arrivalDate ? ` · ${ts(p.arrivalDate)}` : ''}`}
                    </Text>
                  </View>
                  <Ionicons
                    name={p.status === 'paid' ? 'checkmark-circle' : p.status === 'failed' ? 'close-circle' : 'time'}
                    size={22}
                    color={p.status === 'paid' ? C.success : p.status === 'failed' ? C.error : C.textMuted}
                  />
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="wallet-outline" size={28} color={C.textMuted} />
                <Text style={styles.emptyText}>No payouts yet</Text>
                <Text style={styles.emptySubText}>
                  Your first payout will land in your bank about 24 hours after your first completed session.
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.4 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  subCopy: { color: C.textSec, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  balanceRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  balanceCol: { flex: 1, alignItems: 'center' },
  balanceLabel: { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  balanceValue: { color: C.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  balanceDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,170,0,0.10)',
    borderColor: 'rgba(255,170,0,0.4)', borderWidth: 1,
    borderRadius: 10, padding: 10, marginBottom: 10,
  },
  warningText: { color: C.text, fontSize: 12, fontWeight: '600', flex: 1 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,71,87,0.10)',
    borderColor: 'rgba(255,71,87,0.4)', borderWidth: 1,
    borderRadius: 10, padding: 10, marginBottom: 10,
  },
  errorText: { color: C.text, fontSize: 12, fontWeight: '600', flex: 1 },
  cta: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  fineprint: { color: C.textMuted, fontSize: 11, marginTop: 10, textAlign: 'center', lineHeight: 15 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  payoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  payoutAmount: { color: C.text, fontSize: 15, fontWeight: '800' },
  payoutMeta: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 22, gap: 6 },
  emptyText: { color: C.text, fontSize: 14, fontWeight: '700' },
  emptySubText: { color: C.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 20, lineHeight: 17 },
});

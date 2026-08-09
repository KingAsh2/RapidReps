import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { C, s, formatCents } from './AdminShared';

interface Props {
  payoutsData: any;
  payoutsHistory: any[];
  payingTrainerId: string | null;
  payingAll: boolean;
  onPayTrainer: (trainerId: string, name: string) => void;
  onPayAll: () => void;
}

const STRIPE = '#635BFF';

// iter118q — chrome for the Stripe Connect status pill next to each trainer.
type ConnectRow = {
  trainerId: string;
  trainerName: string;
  stripeConnectAccountId?: string | null;
  connectStatus: 'not_connected' | 'onboarding' | 'requirements_due' | 'restricted' | 'connected';
  payoutsEnabled: boolean;
  requirementsDue: string[];
  requirementsDisabledReason?: string | null;
};

function connectChrome(status: ConnectRow['connectStatus']) {
  switch (status) {
    case 'connected': return { label: 'Connected', color: '#00C853' };
    case 'requirements_due': return { label: 'Requirements due', color: '#FFB300' };
    case 'restricted': return { label: 'Restricted', color: '#FF4757' };
    case 'onboarding': return { label: 'Onboarding', color: STRIPE };
    default: return { label: 'Not connected', color: '#8892A6' };
  }
}

export const PayoutsTab = ({
  payoutsData, payoutsHistory, payingTrainerId, payingAll,
  onPayTrainer, onPayAll,
}: Props) => {
  // iter118q — Fetch the Connect status fleet view on mount so admins can spot
  // trainers stuck in onboarding without leaving this tab.
  const [connectRows, setConnectRows] = useState<ConnectRow[]>([]);
  const [connectLoading, setConnectLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const res = await axios.get(
          `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/trainers/connect-status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setConnectRows(res.data?.trainers || []);
      } catch {
        setConnectRows([]);
      } finally {
        setConnectLoading(false);
      }
    })();
  }, []);

  const needsAttention = connectRows.filter(r =>
    r.connectStatus === 'requirements_due'
    || r.connectStatus === 'restricted'
    || r.connectStatus === 'not_connected'
    || r.connectStatus === 'onboarding'
  );
  const readyCount = connectRows.filter(r => r.connectStatus === 'connected').length;

  return (
  <View>
    {/* iter118q Stripe Connect health strip */}
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
      <View style={[s.statCard, { flex: 1 }]} data-testid="connect-ready-count">
        <Text style={s.statLabel}>Connect Ready</Text>
        <Text style={[s.statValue, { color: '#00C853' }]}>{readyCount}</Text>
      </View>
      <View style={[s.statCard, { flex: 1 }]} data-testid="connect-attention-count">
        <Text style={s.statLabel}>Needs Attention</Text>
        <Text style={[s.statValue, { color: '#FFB300' }]}>{needsAttention.length}</Text>
      </View>
    </View>

    <Text style={s.sectionTitle}>Stripe Connect Status</Text>
    {connectLoading ? (
      <ActivityIndicator color={STRIPE} style={{ marginVertical: 12 }} />
    ) : connectRows.length === 0 ? (
      <Text style={{ textAlign: 'center', color: C.gray, marginBottom: 20 }}>
        No trainer profiles yet.
      </Text>
    ) : (
      <>
        {connectRows.slice(0, 25).map((r) => {
          const chrome = connectChrome(r.connectStatus);
          return (
            <View
              key={r.trainerId}
              style={[s.userCard, { borderLeftWidth: 3, borderLeftColor: chrome.color }]}
              data-testid={`connect-row-${r.trainerId}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>{r.trainerName || r.trainerId}</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <View style={{
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                    backgroundColor: `${chrome.color}22`, borderWidth: 1, borderColor: `${chrome.color}66`,
                  }}>
                    <Text style={{ color: chrome.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>
                      {chrome.label.toUpperCase()}
                    </Text>
                  </View>
                  {r.stripeConnectAccountId ? (
                    <Text style={{ fontSize: 11, color: C.gray }}>{r.stripeConnectAccountId}</Text>
                  ) : null}
                </View>
                {r.requirementsDue?.length > 0 ? (
                  <Text style={{ fontSize: 11, color: '#FFB300', marginTop: 4 }} numberOfLines={2}>
                    Due: {r.requirementsDue.slice(0, 3).join(', ')}
                    {r.requirementsDue.length > 3 ? '…' : ''}
                  </Text>
                ) : null}
                {r.requirementsDisabledReason ? (
                  <Text style={{ fontSize: 11, color: '#FF4757', marginTop: 4 }} numberOfLines={2}>
                    Restricted: {r.requirementsDisabledReason}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
        {connectRows.length > 25 ? (
          <Text style={{ textAlign: 'center', color: C.gray, marginBottom: 20 }}>
            + {connectRows.length - 25} more…
          </Text>
        ) : null}
      </>
    )}

    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 16 }}>
      <View style={[s.statCard, { flex: 1 }]} data-testid="payouts-total-pending">
        <Text style={s.statLabel}>Total Pending (legacy)</Text>
        <Text style={[s.statValue, { color: C.orange }]}>{formatCents(payoutsData?.totalPendingCents || 0)}</Text>
      </View>
      <View style={[s.statCard, { flex: 1 }]} data-testid="payouts-eligible-count">
        <Text style={s.statLabel}>Eligible Trainers</Text>
        <Text style={[s.statValue, { color: '#FF6A00' }]}>{payoutsData?.eligibleCount || 0}</Text>
      </View>
    </View>

    <Text style={[s.sectionTitle, { fontSize: 13, marginBottom: 6, color: C.gray }]}>
      Payouts now flow automatically via Stripe Connect 24 h after each session. Legacy manual queue below is view-only.
    </Text>

    {(payoutsData?.eligibleCount || 0) > 0 && (
      <TouchableOpacity
        style={{ backgroundColor: STRIPE, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 }}
        onPress={onPayAll}
        disabled={payingAll}
        data-testid="pay-all-btn"
      >
        {payingAll ? (
          <ActivityIndicator size="small" color={C.white} />
        ) : (
          <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>
            Mark All Paid ({payoutsData?.eligibleCount}) — {formatCents(payoutsData?.totalPendingCents || 0)}
          </Text>
        )}
      </TouchableOpacity>
    )}

    <Text style={s.sectionTitle}>Trainers</Text>
    {(payoutsData?.trainers || []).map((t: any) => (
      <View key={t.trainerId} style={[s.userCard, { borderLeftWidth: 3, borderLeftColor: t.eligible ? STRIPE : C.gray }]} data-testid={`payout-trainer-${t.trainerId}`}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>{t.trainerName}</Text>
          <Text style={{ fontSize: 13, color: C.gray }}>{t.trainerEmail}</Text>
          {t.payoutMethod ? (
            <Text style={{ fontSize: 12, color: '#FFB300', fontWeight: '700', marginTop: 4 }}>
              {String(t.payoutMethod).toUpperCase()}: <Text style={{ color: '#FFFFFF' }}>{t.payoutHandle || '—'}</Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: C.error, marginTop: 4 }}>No payout method set</Text>
          )}
          {t.tier ? (
            <Text style={{ fontSize: 12, color: STRIPE, fontWeight: '700', marginTop: 4 }}>
              TIER: {String(t.tier).toUpperCase()}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
            <Text style={{ fontSize: 13, color: C.gray }}>Earned: <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{formatCents(t.totalEarningsCents)}</Text></Text>
            <Text style={{ fontSize: 13, color: C.gray }}>Paid: <Text style={{ fontWeight: '700', color: C.success }}>{formatCents(t.totalPaidOutCents)}</Text></Text>
            <Text style={{ fontSize: 13, color: C.gray }}>Pending: <Text style={{ fontWeight: '700', color: C.orange }}>{formatCents(t.pendingBalanceCents)}</Text></Text>
          </View>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: t.eligible ? STRIPE : '#ddd',
            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
            opacity: t.eligible ? 1 : 0.5,
          }}
          onPress={() => onPayTrainer(t.trainerId, t.trainerName)}
          disabled={!t.eligible || payingTrainerId === t.trainerId}
          data-testid={`pay-trainer-${t.trainerId}`}
        >
          {payingTrainerId === t.trainerId ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>
              {t.eligible ? 'Mark Paid' : 'Below Min'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    ))}
    {(payoutsData?.trainers || []).length === 0 && (
      <Text style={{ textAlign: 'center', color: C.gray, marginTop: 20 }}>No eligible trainers yet.</Text>
    )}

    <Text style={[s.sectionTitle, { marginTop: 24 }]}>Payout History</Text>
    {payoutsHistory.length === 0 ? (
      <Text style={{ textAlign: 'center', color: C.gray, marginTop: 10 }}>No payouts yet.</Text>
    ) : (
      payoutsHistory.map((p: any, i: number) => (
        <View key={p.id || i} style={[s.userCard, { borderLeftWidth: 3, borderLeftColor: p.status === 'completed' ? C.success : C.orange }]} data-testid={`payout-history-${i}`}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>{p.trainerName}</Text>
            <Text style={{ fontSize: 13, color: C.gray }}>
              {new Date(p.createdAt).toLocaleDateString()} — {formatCents(p.amountCents)} via {p.paymentMethod ? String(p.paymentMethod).charAt(0).toUpperCase() + String(p.paymentMethod).slice(1) : 'Manual'}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: p.status === 'completed' ? `${C.success}20` : `${C.orange}20` }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: p.status === 'completed' ? C.success : C.orange }}>{p.status?.toUpperCase()}</Text>
          </View>
        </View>
      ))
    )}
  </View>
  );
};

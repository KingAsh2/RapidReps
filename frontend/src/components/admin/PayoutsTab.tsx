import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { C, s, formatCents } from './AdminShared';

interface Props {
  payoutsData: any;
  payoutsHistory: any[];
  payingTrainerId: string | null;
  payingAll: boolean;
  onPayTrainer: (trainerId: string, name: string) => void;
  onPayAll: () => void;
}

export const PayoutsTab = ({
  payoutsData, payoutsHistory, payingTrainerId, payingAll,
  onPayTrainer, onPayAll,
}: Props) => (
  <View>
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
      <View style={[s.statCard, { flex: 1 }]} data-testid="payouts-total-pending">
        <Text style={s.statLabel}>Total Pending</Text>
        <Text style={[s.statValue, { color: C.orange }]}>{formatCents(payoutsData?.totalPendingCents || 0)}</Text>
      </View>
      <View style={[s.statCard, { flex: 1 }]} data-testid="payouts-eligible-count">
        <Text style={s.statLabel}>Eligible Trainers</Text>
        <Text style={[s.statValue, { color: '#FF6A00' }]}>{payoutsData?.eligibleCount || 0}</Text>
      </View>
    </View>

    <Text style={[s.sectionTitle, { fontSize: 13, marginBottom: 6, color: C.gray }]}>
      Minimum payout: {formatCents(payoutsData?.payoutMinimumCents || 3500)} | Paid via Zelle
    </Text>

    {(payoutsData?.eligibleCount || 0) > 0 && (
      <TouchableOpacity
        style={{ backgroundColor: '#6D1ED4', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 }}
        onPress={onPayAll}
        disabled={payingAll}
        data-testid="pay-all-btn"
      >
        {payingAll ? (
          <ActivityIndicator size="small" color={C.white} />
        ) : (
          <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>
            Mark All Paid via Zelle ({payoutsData?.eligibleCount}) - {formatCents(payoutsData?.totalPendingCents || 0)}
          </Text>
        )}
      </TouchableOpacity>
    )}

    <Text style={s.sectionTitle}>Trainers</Text>
    {(payoutsData?.trainers || []).map((t: any) => (
      <View key={t.trainerId} style={[s.userCard, { borderLeftWidth: 3, borderLeftColor: t.eligible ? '#6D1ED4' : C.gray }]} data-testid={`payout-trainer-${t.trainerId}`}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>{t.trainerName}</Text>
          <Text style={{ fontSize: 13, color: C.gray }}>{t.trainerEmail}</Text>
          {(t.zelleEmail || t.zellePhone) ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {t.zelleEmail ? <Text style={{ fontSize: 12, color: '#6D1ED4', fontWeight: '600' }}>Zelle: {t.zelleEmail}</Text> : null}
              {t.zellePhone ? <Text style={{ fontSize: 12, color: '#6D1ED4', fontWeight: '600' }}>{t.zellePhone}</Text> : null}
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: C.error, marginTop: 4 }}>No Zelle info</Text>
          )}
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
            <Text style={{ fontSize: 13, color: C.gray }}>Earned: <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{formatCents(t.totalEarningsCents)}</Text></Text>
            <Text style={{ fontSize: 13, color: C.gray }}>Paid: <Text style={{ fontWeight: '700', color: C.success }}>{formatCents(t.totalPaidOutCents)}</Text></Text>
            <Text style={{ fontSize: 13, color: C.gray }}>Pending: <Text style={{ fontWeight: '700', color: C.orange }}>{formatCents(t.pendingBalanceCents)}</Text></Text>
          </View>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: t.eligible ? '#6D1ED4' : '#ddd',
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
      <Text style={{ textAlign: 'center', color: C.gray, marginTop: 20 }}>No trainers with Zelle accounts yet.</Text>
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
              {new Date(p.createdAt).toLocaleDateString()} - {formatCents(p.amountCents)} via Zelle
            </Text>
            {p.zelleEmail && (
              <Text style={{ fontSize: 12, color: '#6D1ED4' }}>To: {p.zelleEmail}</Text>
            )}
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: p.status === 'completed' ? `${C.success}20` : `${C.orange}20` }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: p.status === 'completed' ? C.success : C.orange }}>{p.status?.toUpperCase()}</Text>
          </View>
        </View>
      ))
    )}
  </View>
);

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, s, formatCents, PAGE_SIZE, FilterPills, PaginationBar } from './AdminShared';

interface Props {
  transactions: any[];
  transTotal: number;
  transPage: number;
  transStatusFilter: string;
  onTransStatusFilterChange: (s: string) => void;
  transTypeFilter: string;
  onTransTypeFilterChange: (s: string) => void;
  fetchTransactions: (page?: number, status?: string, type?: string) => void;
  onRefund: (sessionId: string, amount: number) => void;
  onConfirmPayment: (sessionId: string) => void;
}

export const PaymentsTab = ({
  transactions, transTotal, transPage,
  transStatusFilter, onTransStatusFilterChange,
  transTypeFilter, onTransTypeFilterChange,
  fetchTransactions, onRefund, onConfirmPayment,
}: Props) => {
  const statusOptions = [
    { key: '', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];
  const typeOptions = [
    { key: '', label: 'All Types' },
    { key: 'virtual', label: 'Virtual' },
    { key: 'outdoor', label: 'Outdoor' },
    { key: 'in_home', label: 'In-Home' },
  ];

  return (
    <View>
      <Text style={s.sectionTitle}>Transactions ({transTotal})</Text>
      
      {/* Cancellation Policy Card */}
      <View style={[s.transCard, { backgroundColor: '#FFF9F0', borderWidth: 1, borderColor: C.orange, marginBottom: 16 }]} data-testid="cancellation-policy-card">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Ionicons name="information-circle" size={20} color={C.orange} />
          <Text style={[s.listCardTitle, { color: C.navy, fontWeight: '800' }]}>Cancellation Policy</Text>
        </View>
        <Text style={{ fontSize: 13, color: C.navy, lineHeight: 20, marginBottom: 4 }}>
          Virtual sessions: $15 cancellation fee | In-person: $20 cancellation fee
        </Text>
        <Text style={{ fontSize: 13, color: C.navy, lineHeight: 20, marginBottom: 4 }}>
          Revenue split on cancellation fees: Platform keeps 20%, Trainer receives 80%
        </Text>
        <Text style={{ fontSize: 12, color: C.gray, lineHeight: 18, fontStyle: 'italic' }}>
          Free cancellation if done 24+ hours before session. Fees apply for late cancellations.
        </Text>
      </View>

      <FilterPills
        options={statusOptions}
        selected={transStatusFilter}
        onSelect={(st) => { onTransStatusFilterChange(st); fetchTransactions(0, st, transTypeFilter); }}
        testIdPrefix="trans-status"
      />
      <FilterPills
        options={typeOptions}
        selected={transTypeFilter}
        onSelect={(tp) => { onTransTypeFilterChange(tp); fetchTransactions(0, transStatusFilter, tp); }}
        testIdPrefix="trans-type"
      />
      {transactions.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="card-outline" size={48} color={C.gray} />
          <Text style={s.emptyTitle}>No Transactions</Text>
          <Text style={s.emptySub}>Payments will appear here.</Text>
        </View>
      ) : (
        transactions.map((t, idx) => (
          <View key={t.id || idx} style={s.transCard} data-testid={`transaction-${idx}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[s.listCardIcon, { backgroundColor: t.refunded ? C.error : C.success, width: 34, height: 34, borderRadius: 9 }]}>
                <Ionicons name={t.refunded ? 'arrow-undo' : 'cash'} size={16} color={C.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.listCardTitle}>{t.trainerName} / {t.traineeName}</Text>
                <Text style={s.listCardSub}>{t.sessionType || 'Session'} | {t.status}</Text>
              </View>
              <Text style={[s.transAmount, { color: t.refunded ? C.error : C.navy }]}>
                {t.refunded ? '-' : ''}{t.finalSessionPriceCents ? formatCents(t.finalSessionPriceCents) : '-'}
              </Text>
            </View>
            <View style={s.transBreakdown}>
              <Text style={s.transBreakdownText}>Platform: {formatCents(t.platformFeeCents || 0)}</Text>
              <Text style={s.transBreakdownText}>Trainer: {formatCents(t.trainerEarningsCents || 0)}</Text>
            </View>
            {!t.refunded && t.finalSessionPriceCents > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[s.smallBtn, { backgroundColor: C.error }]}
                  onPress={() => onRefund(t.id, t.finalSessionPriceCents)}
                  data-testid={`refund-btn-${idx}`}
                >
                  <Ionicons name="arrow-undo" size={14} color={C.white} />
                  <Text style={s.smallBtnText}>Refund</Text>
                </TouchableOpacity>
                {!t.paymentConfirmed && (
                  <TouchableOpacity
                    style={[s.smallBtn, { backgroundColor: C.success }]}
                    onPress={() => onConfirmPayment(t.id)}
                    data-testid={`confirm-btn-${idx}`}
                  >
                    <Ionicons name="checkmark-circle" size={14} color={C.white} />
                    <Text style={s.smallBtnText}>Confirm</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {t.refunded && (
              <View style={s.refundedTag}>
                <Text style={s.refundedTagText}>REFUNDED</Text>
              </View>
            )}
          </View>
        ))
      )}
      <PaginationBar current={transPage} total={transTotal} pageSize={PAGE_SIZE} onPageChange={(p) => fetchTransactions(p)} />
    </View>
  );
};

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, s, api, getAuthHeader, formatCents, getStatusColor, PAGE_SIZE, FilterPills, PaginationBar } from './AdminShared';

interface Props {
  onRefresh?: () => void;
}

export const SubscriptionsTab = ({ onRefresh }: Props) => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, paused: 0, cancelled: 0, revenue: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await api.get('/admin/subscriptions', { headers });
      const data = res.data || {};
      setSubscriptions(data.subscriptions || []);
      setStats(data.stats || { total: 0, active: 0, paused: 0, cancelled: 0, revenue: 0 });
    } catch (e) {
      setSubscriptions([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSubscriptions(); }, []);

  const filtered = statusFilter
    ? subscriptions.filter(s => s.status === statusFilter)
    : subscriptions;

  const statusOptions = [
    { key: '', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'paused', label: 'Paused' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <View>
      <Text style={s.sectionTitle}>Subscriptions Overview</Text>

      {/* Stats cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <View style={[s.statCard, { flex: 1, minWidth: 100 }]}>
          <Ionicons name="repeat" size={20} color={C.orange} />
          <Text style={s.statValue}>{stats.total}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
        <View style={[s.statCard, { flex: 1, minWidth: 100 }]}>
          <Ionicons name="checkmark-circle" size={20} color={C.success} />
          <Text style={[s.statValue, { color: C.success }]}>{stats.active}</Text>
          <Text style={s.statLabel}>Active</Text>
        </View>
        <View style={[s.statCard, { flex: 1, minWidth: 100 }]}>
          <Ionicons name="pause-circle" size={20} color={C.warning} />
          <Text style={[s.statValue, { color: C.warning }]}>{stats.paused}</Text>
          <Text style={s.statLabel}>Paused</Text>
        </View>
        <View style={[s.statCard, { flex: 1, minWidth: 100 }]}>
          <Ionicons name="cash" size={20} color={C.success} />
          <Text style={[s.statValue, { color: C.success }]}>{formatCents(stats.revenue)}</Text>
          <Text style={s.statLabel}>Platform Rev</Text>
        </View>
      </View>

      {/* Filter */}
      <FilterPills
        options={statusOptions}
        selected={statusFilter}
        onSelect={(key) => setStatusFilter(key)}
      />

      {/* Subscription list */}
      {loading ? (
        <ActivityIndicator size="large" color={C.orange} style={{ marginVertical: 30 }} />
      ) : filtered.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 30 }}>
          <Ionicons name="calendar-outline" size={40} color={C.gray} />
          <Text style={{ color: C.gray, marginTop: 8 }}>No subscriptions found</Text>
        </View>
      ) : (
        filtered.map((sub: any, idx: number) => (
          <View key={idx} style={[s.card, { marginBottom: 10 }]} data-testid={`admin-sub-${idx}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.white }}>
                  {sub.traineeName || 'Trainee'} → {sub.trainerName || 'Trainer'}
                </Text>
                <Text style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                  {sub.sessionsPerWeek}x/week • {sub.durationMinutes}min • {sub.preferredTimeSlot || 'any'}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: getStatusColor(sub.status) }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.white }}>{sub.status?.toUpperCase()}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: C.gray }}>
                Rate: {formatCents(sub.trainerRateCents || 0)}/session
              </Text>
              <Text style={{ fontSize: 12, color: C.orange, fontWeight: '600' }}>
                Platform: {formatCents(sub.platformFeeCents || 0)}/session
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: C.gray }}>
                Sessions: {sub.sessionsCompleted || 0} completed
              </Text>
              <Text style={{ fontSize: 12, color: C.gray }}>
                {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : ''}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
};

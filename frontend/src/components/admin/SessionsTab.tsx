import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, s, formatCents, getStatusColor, PAGE_SIZE, FilterPills, PaginationBar } from './AdminShared';

interface Props {
  sessions: any[];
  sessionsTotal: number;
  sessionsPage: number;
  sessionStatusFilter: string;
  onStatusFilterChange: (s: string) => void;
  sessionTypeFilter: string;
  onTypeFilterChange: (s: string) => void;
  fetchSessions: (page?: number, status?: string, type?: string) => void;
}

export const SessionsTab = ({
  sessions, sessionsTotal, sessionsPage,
  sessionStatusFilter, onStatusFilterChange,
  sessionTypeFilter, onTypeFilterChange,
  fetchSessions,
}: Props) => {
  const statusOptions = [
    { key: '', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'no_show', label: 'No-Show' },
  ];
  const typeOptions = [
    { key: '', label: 'All Types' },
    { key: 'virtual', label: 'Virtual' },
    { key: 'outdoor', label: 'Outdoor' },
    { key: 'in_home', label: 'In-Home' },
  ];

  return (
    <View>
      <Text style={s.sectionTitle}>Sessions ({sessionsTotal})</Text>
      <FilterPills
        options={statusOptions}
        selected={sessionStatusFilter}
        onSelect={(st) => { onStatusFilterChange(st); fetchSessions(0, st, sessionTypeFilter); }}
        testIdPrefix="sess-status"
      />
      <FilterPills
        options={typeOptions}
        selected={sessionTypeFilter}
        onSelect={(tp) => { onTypeFilterChange(tp); fetchSessions(0, sessionStatusFilter, tp); }}
        testIdPrefix="sess-type"
      />
      {sessions.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={C.gray} />
          <Text style={s.emptyTitle}>No Sessions</Text>
          <Text style={s.emptySub}>Sessions will appear here.</Text>
        </View>
      ) : (
        sessions.map((sess, idx) => (
          <View key={sess.id || idx} style={s.sessionCard} data-testid={`session-${idx}`}>
            <View style={s.sessionHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={[s.statusDot, { backgroundColor: getStatusColor(sess.status) }]} />
                  <Text style={[s.statusText, { color: getStatusColor(sess.status) }]}>{(sess.status || '').toUpperCase()}</Text>
                  <Text style={s.sessionType}>{sess.sessionType || 'outdoor'}</Text>
                </View>
                <Text style={s.sessionNames}>
                  <Text style={{ fontWeight: '700' }}>{sess.trainerName}</Text>
                  <Text style={{ color: C.gray }}> with </Text>
                  <Text style={{ fontWeight: '700' }}>{sess.traineeName}</Text>
                </Text>
              </View>
              <Text style={s.sessionPrice}>{sess.finalSessionPriceCents ? formatCents(sess.finalSessionPriceCents) : '-'}</Text>
            </View>
            <View style={s.sessionDetails}>
              {sess.locationNameOrAddress ? (
                <View style={s.detailRow}>
                  <Ionicons name="location" size={14} color={C.gray} />
                  <Text style={s.detailText}>{sess.locationNameOrAddress}</Text>
                </View>
              ) : null}
              {sess.traineeHomeAddress && sess.sessionType === 'in_home' ? (
                <View style={s.detailRow}>
                  <Ionicons name="home" size={14} color={C.orange} />
                  <Text style={s.detailText}>Home: {sess.traineeHomeAddress}</Text>
                </View>
              ) : null}
              <View style={s.detailRow}>
                <Ionicons name="time" size={14} color={C.gray} />
                <Text style={s.detailText}>
                  Scheduled: {sess.durationMinutes || '?'}min
                  {sess.actualDurationMinutes != null ? ` | Actual: ${sess.actualDurationMinutes}min` : ''}
                </Text>
              </View>
              {sess.sessionStartedAt ? (
                <View style={s.detailRow}>
                  <Ionicons name="play-circle" size={14} color={C.success} />
                  <Text style={s.detailText}>Started: {new Date(sess.sessionStartedAt).toLocaleString()}</Text>
                </View>
              ) : null}
              {sess.sessionEndedAt ? (
                <View style={s.detailRow}>
                  <Ionicons name="stop-circle" size={14} color={C.error} />
                  <Text style={s.detailText}>Ended: {new Date(sess.sessionEndedAt).toLocaleString()}</Text>
                </View>
              ) : null}
              {sess.refunded ? (
                <View style={[s.detailRow, { backgroundColor: '#FFE0E0', borderRadius: 6, padding: 4 }]}>
                  <Ionicons name="alert-circle" size={14} color={C.error} />
                  <Text style={[s.detailText, { color: C.error, fontWeight: '600' }]}>REFUNDED</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}
      <PaginationBar current={sessionsPage} total={sessionsTotal} pageSize={PAGE_SIZE} onPageChange={(p) => fetchSessions(p)} />
    </View>
  );
};

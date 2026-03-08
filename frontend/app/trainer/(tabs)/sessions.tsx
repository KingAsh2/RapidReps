import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  orange: '#FF7F00',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
  warning: '#FFB300',
  error: '#FF4757',
};

const backgroundImage = require('../../../assets/images/bg-box-jumps.png');

type TabFilter = 'upcoming' | 'completed' | 'cancelled';

export default function TrainerSessionsScreen() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TabFilter>('upcoming');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await axios.get(`${API_URL}/api/sessions/trainer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(res.data || []);
    } catch (err) {
      console.error('Load sessions error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  const filteredSessions = sessions.filter((s) => {
    if (activeFilter === 'upcoming') return ['confirmed', 'pending', 'in_progress'].includes(s.status);
    if (activeFilter === 'completed') return s.status === 'completed';
    return ['cancelled', 'no_show'].includes(s.status);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return COLORS.success;
      case 'confirmed': return COLORS.teal;
      case 'pending': return COLORS.warning;
      case 'in_progress': return COLORS.orange;
      default: return COLORS.error;
    }
  };

  const getSessionIcon = (type: string) => {
    switch (type) {
      case 'virtual': return 'videocam';
      case 'outdoor': return 'sunny';
      case 'in_home': return 'home';
      case 'trainee_home': return 'location';
      default: return 'barbell';
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(247, 147, 30, 0.88)', 'rgba(247, 147, 30, 0.80)', 'rgba(255, 165, 38, 0.75)']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Sessions</Text>
          <Text style={styles.headerSubtitle}>{sessions.length} total sessions</Text>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterBar}>
          {(['upcoming', 'completed', 'cancelled'] as TabFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
              onPress={() => setActiveFilter(f)}
              data-testid={`filter-${f}`}
            >
              <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
        >
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.teal} />
            </View>
          ) : filteredSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyTitle}>No {activeFilter} sessions</Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'upcoming'
                  ? 'Complete your profile and get verified so clients can start booking you!'
                  : activeFilter === 'pending'
                  ? 'Session requests from trainees will show up here.'
                  : `Your ${activeFilter} sessions will appear here once you start training.`}
              </Text>
            </View>
          ) : (
            filteredSessions.map((session, idx) => (
              <View key={session.id || idx} style={styles.sessionCard} data-testid={`session-card-${idx}`}>
                <View style={styles.sessionHeader}>
                  <View style={[styles.sessionIconBg, { backgroundColor: `${getStatusColor(session.status)}20` }]}>
                    <Ionicons name={getSessionIcon(session.sessionType) as any} size={20} color={getStatusColor(session.status)} />
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionType}>
                      {(session.sessionType || 'Training').replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Text>
                    <Text style={styles.sessionDate}>
                      {session.scheduledDate ? new Date(session.scheduledDate).toLocaleDateString() : 'TBD'}
                      {session.scheduledTime ? ` at ${session.scheduledTime}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(session.status)}20` }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(session.status) }]}>
                      {session.status?.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.sessionDetails}>
                  {session.durationMinutes && (
                    <View style={styles.detailChip}>
                      <Ionicons name="time-outline" size={14} color={COLORS.gray} />
                      <Text style={styles.detailChipText}>{session.durationMinutes}min</Text>
                    </View>
                  )}
                  {session.trainerEarningsCents > 0 && (
                    <View style={styles.detailChip}>
                      <Ionicons name="cash-outline" size={14} color={COLORS.success} />
                      <Text style={[styles.detailChipText, { color: COLORS.success }]}>
                        +${(session.trainerEarningsCents / 100).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.white },
  headerSubtitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 4 },

  filterBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', overflow: 'hidden' },
  filterTabActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  filterTabText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  filterTabTextActive: { color: COLORS.navy },

  content: { flex: 1, paddingHorizontal: 16 },
  loadingBox: { paddingTop: 60, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 40, marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  emptySubtitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },

  sessionCard: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionIconBg: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sessionInfo: { flex: 1 },
  sessionType: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  sessionDate: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 13, fontWeight: '700' },

  sessionDetails: { flexDirection: 'row', gap: 10, marginTop: 12 },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  detailChipText: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
});

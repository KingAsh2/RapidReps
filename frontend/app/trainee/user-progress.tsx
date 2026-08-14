import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { progressAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { goBack } from '../../src/utils/navigation';
import { InfoTip } from '../../src/components/InfoTip';

const backgroundImage = require('../../assets/images/bg-box-jumps-orange.jpg');
const { width } = Dimensions.get('window');
const COLORS = { orange: '#FF6A00', orangeLight: '#FF9F1C', teal: '#1a2a5e', navy: '#1a2a5e', white: '#FFFFFF', gray: '#5a6785', success: '#00D26A', error: '#FF4757' };

const STREAK_COLORS: Record<string, string[]> = {
  Legend: ['#FFD700', '#FFA500'],
  Blazing: ['#FF4500', '#FF6347'],
  Fire: ['#FF6A00', '#FF9F1C'],
  Warming: ['#1a2a5e', '#2a3a6e'],
  None: ['#5a6785', '#6a7a9a'],
};

export default function UserProgressScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [p, h] = await Promise.all([
        progressAPI.get(user.id),
        progressAPI.getHistory(user.id, 20),
      ]);
      setProgress(p);
      setHistory(h || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const streakColors = STREAK_COLORS[progress?.streakLevel || 'None'];

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <LinearGradient colors={['rgba(255, 127, 0, 0.92)', 'rgba(255, 106, 0, 0.88)']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack('/trainee/(tabs)/home')} style={styles.backBtn} data-testid="progress-back-btn">
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={'#FF6A00'} />}
      >
        {/* Streak Card */}
        <LinearGradient colors={streakColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.streakCard}>
          <View style={styles.streakIcon}>
            <Ionicons name="flame" size={32} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.streakTitleRow}>
              <Text style={styles.streakLevel}>{progress?.streakLevel || 'None'} Streak</Text>
              <InfoTip
                title="How your streak works"
                text="1 week counts every calendar week you complete at least one session. Miss a week and it resets to 0. Levels: Warming (2+), Fire (4+), Blazing (8+), Legend (12+)."
                color="rgba(255,255,255,0.85)"
                size={16}
                testID="progress-streak-info"
              />
            </View>
            <Text style={styles.streakCount}>{progress?.currentStreak || 0} weeks in a row</Text>
          </View>
          <View style={styles.streakBest}>
            <Text style={styles.streakBestLabel}>Best</Text>
            <Text style={styles.streakBestVal}>{progress?.longestStreak || 0}</Text>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="barbell" size={24} color={'#FF6A00'} />
              <InfoTip
                title="Sessions"
                text="The number of RapidReps sessions you completed as a trainee. A session is counted once it's marked complete after the workout ends."
                testID="progress-sessions-info"
              />
            </View>
            <Text style={styles.statVal}>{progress?.totalSessions || 0}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="time" size={24} color={COLORS.orange} />
              <InfoTip
                title="Minutes"
                text="Total minutes trained — added up from the booked duration of every completed session you were the trainee in."
                testID="progress-minutes-info"
              />
            </View>
            <Text style={styles.statVal}>{progress?.totalMinutesTrained || 0}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="flame" size={24} color={COLORS.error} />
              <InfoTip
                title="Calories"
                text="Estimated calorie burn based on session length and type: 8 kcal/min outdoor, 7 kcal/min in-home, 6 kcal/min virtual. It's an average estimate, not a heart-rate measurement."
                testID="progress-calories-info"
              />
            </View>
            <Text style={styles.statVal}>{progress?.estimatedCaloriesBurned || 0}</Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="trending-up" size={24} color={COLORS.success} />
              <InfoTip
                title="Consistency Score"
                text="Rewards showing up regularly. Formula: (sessions × 10) + (unique training weeks × 25) + (total minutes ÷ 10). Higher = more consistent."
                testID="progress-score-info"
              />
            </View>
            <Text style={styles.statVal}>{progress?.consistencyScore || 0}</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
        </View>

        {/* Badges */}
        {progress?.badges?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges Earned</Text>
            <View style={styles.badgeRow}>
              {progress.badges.map((b: any, i: number) => (
                <View key={i} style={styles.badge}>
                  <Ionicons name="trophy" size={20} color={COLORS.orange} />
                  <Text style={styles.badgeName}>{b.badgeName || b.name || 'Badge'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Workouts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="fitness" size={40} color={COLORS.gray} />
              <Text style={styles.emptyText}>No completed workouts yet. Book a session to get started!</Text>
            </View>
          ) : (
            history.map((s: any, i: number) => (
              <View key={s.id || i} style={styles.historyItem} data-testid={`history-item-${i}`}>
                <View style={[styles.historyDot, { backgroundColor: s.sessionType === 'virtual' ? '#FF6A00' : COLORS.orange }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyType}>{(s.sessionType || 'workout').toUpperCase()}</Text>
                  <Text style={styles.historyMeta}>
                    {s.durationMinutes || 30} min {s.trainerName ? `with ${s.trainerName}` : s.traineeName ? `with ${s.traineeName}` : ''}
                  </Text>
                </View>
                <Text style={styles.historyDate}>
                  {s.sessionDateTimeStart ? new Date(s.sessionDateTimeStart).toLocaleDateString() : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  streakCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  streakIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  streakTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakLevel: { fontSize: 18, fontWeight: '800', color: '#fff' },
  streakCount: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  streakBest: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  streakBestLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  streakBestVal: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: (width - 42) / 2, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, alignItems: 'center' },
  statHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statVal: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 6 },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 },
  section: { marginTop: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 12, letterSpacing: 0.5 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  badgeName: { fontSize: 13, color: '#e0e0e0', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 12, paddingHorizontal: 20 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, marginBottom: 8 },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  historyType: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  historyMeta: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  historyDate: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
});

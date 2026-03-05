import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  streak: { currentStreak: number; thisWeekSessions: number; totalSessions: number };
  onPress: () => void;
}

export const StreakBanner = ({ streak, onPress }: Props) => (
  <TouchableOpacity style={styles.container} onPress={onPress} data-testid="streak-banner">
    <LinearGradient colors={['#FF6B00', '#FF9F43']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <Ionicons name="flame" size={28} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{streak.currentStreak} Week Streak!</Text>
        <Text style={styles.sub}>
          {streak.thisWeekSessions} session{streak.thisWeekSessions !== 1 ? 's' : ''} this week | {streak.totalSessions} total
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  gradient: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  title: { fontSize: 18, fontWeight: '900', color: '#fff' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
});

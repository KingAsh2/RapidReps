import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { streaksAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

const { width } = Dimensions.get('window');

const C = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  teal: '#1FB8B4',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  gold: '#FFD700',
};

function getLevelConfig(level: string) {
  switch (level) {
    case 'legend': return { label: 'LEGEND', colors: ['#FF6A00', '#FF9F1C'], icon: 'flame' as const };
    case 'blazing': return { label: 'BLAZING', colors: ['#FF4500', '#FF7F00'], icon: 'flame' as const };
    case 'fire': return { label: 'ON FIRE', colors: ['#FFB300', '#FFC107'], icon: 'flame' as const };
    case 'warming': return { label: 'WARMING UP', colors: ['#FF9800', '#FFB74D'], icon: 'sunny' as const };
    default: return { label: 'JUST STARTED', colors: [C.navy, '#2a3a6e'], icon: 'fitness' as const };
  }
}

export default function ShareStreakScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [streakData, setStreakData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const fireAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (streakData) {
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();

      if (streakData.currentStreak >= 2) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(fireAnim, { toValue: 1.2, duration: 700, useNativeDriver: true }),
            Animated.timing(fireAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          ])
        ).start();
      }
    }
  }, [streakData]);

  const loadData = async () => {
    try {
      const data = await streaksAPI.getMyStreaks();
      setStreakData(data);
    } catch (e) {
      console.log('Error loading streak data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!streakData) return;
    setSharing(true);
    const lvl = getLevelConfig(streakData.streakLevel);
    const name = user?.fullName || 'I';

    const message =
      `${name} is on a ${streakData.currentStreak}-week training streak on RapidReps!\n\n` +
      `Level: ${lvl.label}\n` +
      `Consistency Points: ${streakData.consistencyPoints}\n` +
      `Total Time Trained: ${streakData.totalMinutes} min\n` +
      `Longest Streak: ${streakData.longestStreak} weeks\n\n` +
      `Think you can beat me? Download RapidReps and find a personal trainer near you!`;

    try {
      await Share.share({ message, title: 'My RapidReps Streak' });
    } catch {
      // User cancelled
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.orange} />
      </View>
    );
  }

  const lvl = getLevelConfig(streakData?.streakLevel || '');
  const streak = streakData?.currentStreak || 0;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[C.navy, '#0d1a3a']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} data-testid="share-streak-back-btn">
            <Ionicons name="arrow-back" size={26} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Your Streak</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Card Preview */}
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
          <LinearGradient
            colors={lvl.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* Top row */}
            <View style={styles.cardHeader}>
              <Text style={styles.brandText}>RAPIDREPS</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>{lvl.label}</Text>
              </View>
            </View>

            {/* Fire + streak number */}
            <View style={styles.streakCenter}>
              <Animated.View style={{ transform: [{ scale: fireAnim }] }}>
                <Ionicons name={lvl.icon} size={64} color={C.white} />
              </Animated.View>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakLabel}>WEEK STREAK</Text>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{streakData?.consistencyPoints || 0}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{streakData?.totalMinutes || 0}</Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{streakData?.longestStreak || 0}</Text>
                <Text style={styles.statLabel}>Best Streak</Text>
              </View>
            </View>

            {/* User name */}
            <Text style={styles.userName}>{user?.fullName || 'RapidReps Athlete'}</Text>
          </LinearGradient>
        </Animated.View>

        {/* Share button */}
        <View style={styles.bottom}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            disabled={sharing}
            data-testid="share-streak-btn"
          >
            <LinearGradient colors={[C.teal, '#18A09D']} style={styles.shareBtnGradient}>
              {sharing ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Ionicons name="share-social" size={22} color={C.white} />
                  <Text style={styles.shareBtnText}>Share My Streak</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.hint}>Share to Instagram, iMessage, Twitter, and more</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CARD_W = width - 48;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1a3a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.white },
  cardWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: {
    width: CARD_W,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  brandText: { fontSize: 14, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 3 },
  levelBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  levelText: { fontSize: 11, fontWeight: '800', color: C.white, letterSpacing: 1 },
  streakCenter: { alignItems: 'center', marginBottom: 28 },
  streakNumber: { fontSize: 72, fontWeight: '900', color: C.white, marginTop: -4 },
  streakLabel: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.8)', letterSpacing: 4, marginTop: -6 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: C.white },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  userName: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  bottom: { paddingHorizontal: 24, paddingBottom: 24 },
  shareBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  shareBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  shareBtnText: { fontSize: 17, fontWeight: '800', color: C.white },
  hint: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
});

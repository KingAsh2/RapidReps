import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { streaksAPI } from '../../src/services/api';
import { UserAvatar } from '../../src/components/UserAvatar';
import FloatingOrangeBg from '../../src/components/FloatingOrangeBg';

const backgroundImage = require('../../assets/images/bg-group-gym.png');

const C = {
  orange: '#FF7F00',
  orangeLight: '#FF9F1C',
  teal: '#1a2a5e',
  navy: '#0f1b3d',
  navyLight: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  success: '#00C853',
  bg: '#f0f2f5',
};

const PODIUM_COLORS = [C.gold, C.silver, C.bronze];

export default function LeaderboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myEntry, setMyEntry] = useState<any>(null);
  const [totalParticipants, setTotalParticipants] = useState(0);

  // Animations
  const podiumAnims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const listAnim = useRef(new Animated.Value(0)).current;

  const loadLeaderboard = async () => {
    try {
      const data = await streaksAPI.getLeaderboard();
      setLeaderboard(data.leaderboard || []);
      setMyRank(data.myRank);
      setMyEntry(data.myEntry);
      setTotalParticipants(data.totalParticipants);
    } catch (e) {
      console.error('Leaderboard error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadLeaderboard(); }, []);

  useEffect(() => {
    if (!loading) {
      // Stagger podium animations
      podiumAnims.forEach((anim, i) => {
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          delay: i * 150,
          useNativeDriver: true,
        }).start();
      });
      Animated.timing(listAnim, {
        toValue: 1,
        duration: 600,
        delay: 450,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const getStreakIcon = (level: string) => {
    if (level === 'legend') return 'flame';
    if (level === 'blazing') return 'flame';
    if (level === 'fire') return 'flame';
    if (level === 'warming') return 'sunny';
    return 'snow';
  };

  const getStreakColor = (level: string) => {
    if (level === 'legend') return '#FF3B00';
    if (level === 'blazing') return '#FF6A00';
    if (level === 'fire') return '#FF9F1C';
    if (level === 'warming') return '#FFB300';
    return C.gray;
  };

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  // Podium order: [2nd, 1st, 3rd] for visual layout
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : [];
  const podiumHeights = [100, 130, 80]; // 2nd, 1st, 3rd

  if (loading) {
    return (
      <LinearGradient colors={[C.navy, C.navyLight]} style={s.loadingContainer}>
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={s.loadingText}>Loading Leaderboard...</Text>
      </LinearGradient>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={s.container} resizeMode="cover">
      {/* iter97c: subtle ember ambience */}
      <FloatingOrangeBg density={6} intensity={0.3} />
      <LinearGradient colors={[C.navy, '#1e3470']} style={s.header}>
        <SafeAreaView edges={['top']}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="leaderboard-back-btn">
              <Ionicons name="arrow-back" size={24} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.headerTitle}>Weekly Leaderboard</Text>
              <Text style={s.headerSub}>{totalParticipants} active members</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLeaderboard(); }} tintColor={C.teal} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Podium Section */}
        {podiumOrder.length === 3 && (
          <View style={s.podiumSection}>
            <LinearGradient colors={['#0f1b3d', '#1a2a5e', '#0f1b3d']} style={s.podiumBg}>
              <View style={s.podiumRow}>
                {podiumOrder.map((entry, idx) => {
                  const realRank = entry.rank;
                  const medalColor = PODIUM_COLORS[realRank - 1] || C.gray;
                  const height = podiumHeights[idx];
                  return (
                    <Animated.View
                      key={entry.userId}
                      style={[
                        s.podiumItem,
                        {
                          opacity: podiumAnims[idx],
                          transform: [{
                            translateY: podiumAnims[idx].interpolate({
                              inputRange: [0, 1],
                              outputRange: [50, 0],
                            }),
                          }],
                        },
                      ]}
                      data-testid={`podium-rank-${realRank}`}
                    >
                      <TouchableOpacity onPress={() => router.push(`/trainee/trainer-detail?trainerId=${entry.userId}`)} activeOpacity={0.7}>
                      <View style={[s.podiumAvatar, { borderColor: medalColor }]}>
                        {/* iter106as: unified avatar disc for podium ranks. */}
                        <UserAvatar
                          size={70}
                          style={s.podiumAvatarImg as any}
                          user={{
                            avatarUrl: entry.avatar,
                            fullName: entry.fullName,
                          }}
                        />
                        <View style={[s.medalBadge, { backgroundColor: medalColor }]}>
                          <Text style={s.medalText}>{realRank}</Text>
                        </View>
                      </View>
                      <Text style={s.podiumName} numberOfLines={1}>{entry.fullName}</Text>
                      <Text style={s.podiumPoints}>{entry.consistencyPoints} pts</Text>
                      </TouchableOpacity>
                      <View style={[s.podiumBar, { height, backgroundColor: `${medalColor}40` }]}>
                        <LinearGradient colors={[medalColor, `${medalColor}80`]} style={[s.podiumBarFill, { height }]}>
                          <Ionicons name={getStreakIcon(entry.streakLevel)} size={18} color={C.white} />
                          <Text style={s.podiumBarText}>{entry.currentStreak}wk</Text>
                        </LinearGradient>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* My Rank Banner */}
        {myEntry && (
          <View style={s.myRankBanner} data-testid="my-rank-banner">
            <LinearGradient colors={[C.teal, '#0D8B88']} style={s.myRankGradient}>
              <View style={s.myRankRow}>
                <View style={s.myRankNumBg}>
                  <Text style={s.myRankNum}>#{myRank}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.myRankTitle}>Your Ranking</Text>
                  <Text style={s.myRankSub}>
                    {myEntry.consistencyPoints} pts | {myEntry.currentStreak}wk streak | {myEntry.totalSessions} sessions
                  </Text>
                </View>
                <Ionicons name={getStreakIcon(myEntry.streakLevel)} size={24} color={getStreakColor(myEntry.streakLevel)} />
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Rest of Leaderboard */}
        <Animated.View style={{ opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
          {rest.map((entry) => (
            <TouchableOpacity
              key={entry.userId}
              style={s.listItem}
              onPress={() => router.push(`/trainee/trainer-detail?trainerId=${entry.userId}`)}
              activeOpacity={0.7}
              data-testid={`leaderboard-rank-${entry.rank}`}
            >
              <Text style={s.listRank}>#{entry.rank}</Text>
              <View style={s.listAvatar}>
                {/* iter97b: unified avatar with deterministic colored-initial fallback */}
                <UserAvatar
                  user={{ avatarUrl: entry.avatar, fullName: entry.fullName }}
                  size={40}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.listName}>{entry.fullName}</Text>
                <Text style={s.listMeta}>
                  {entry.totalSessions} sessions | {entry.currentStreak}wk streak
                </Text>
              </View>
              <View style={s.listPoints}>
                <Ionicons name={getStreakIcon(entry.streakLevel)} size={14} color={getStreakColor(entry.streakLevel)} />
                <Text style={s.listPointsText}>{entry.consistencyPoints}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {leaderboard.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="trophy-outline" size={64} color={C.gray} />
            <Text style={s.emptyTitle}>No Rankings Yet</Text>
            <Text style={s.emptySub}>Complete sessions to earn consistency points and appear on the leaderboard!</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.7)', marginTop: 12, fontSize: 14 },
  header: { paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  scroll: { flex: 1 },
  // Podium
  podiumSection: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden' },
  podiumBg: { paddingTop: 20, paddingBottom: 0 },
  podiumRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16 },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, overflow: 'hidden', marginBottom: 6 },
  podiumAvatarImg: { width: '100%', height: '100%' },
  podiumAvatarFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  podiumInitial: { fontSize: 22, fontWeight: '900', color: C.white },
  medalBadge: { position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.navy },
  medalText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  podiumName: { fontSize: 13, fontWeight: '700', color: C.white, textAlign: 'center', maxWidth: 90 },
  podiumPoints: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  podiumBar: { width: '100%', borderTopLeftRadius: 10, borderTopRightRadius: 10, marginTop: 8, overflow: 'hidden' },
  podiumBarFill: { width: '100%', justifyContent: 'center', alignItems: 'center', borderTopLeftRadius: 10, borderTopRightRadius: 10, gap: 2, paddingVertical: 8 },
  podiumBarText: { fontSize: 13, fontWeight: '700', color: C.white },
  // My Rank
  myRankBanner: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: 'hidden', shadowColor: C.teal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  myRankGradient: { padding: 16 },
  myRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  myRankNumBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  myRankNum: { fontSize: 18, fontWeight: '900', color: C.white },
  myRankTitle: { fontSize: 16, fontWeight: '800', color: C.white },
  myRankSub: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  // List
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141929', marginHorizontal: 16, marginTop: 8, borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  listRank: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', width: 30, textAlign: 'center' },
  listAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  listAvatarImg: { width: '100%', height: '100%' },
  listAvatarFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  listInitial: { fontSize: 16, fontWeight: '800', color: C.white },
  listName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  listMeta: { fontSize: 13, color: C.gray, marginTop: 2 },
  listPoints: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${C.navy}10`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  listPointsText: { fontSize: 14, fontWeight: '800', color: '#FF6A00' },
  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptySub: { fontSize: 13, color: C.gray, textAlign: 'center', paddingHorizontal: 40 },
});

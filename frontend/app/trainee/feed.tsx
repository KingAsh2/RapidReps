import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { feedAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

const COLORS = { orange: '#FF6A00', teal: '#1a2a5e', navy: '#1a2a5e', white: '#FFFFFF', offWhite: '#F8F9FA', gray: '#5a6785', success: '#00D26A' };

const POST_ICONS: Record<string, string> = {
  session_complete: 'checkmark-circle',
  badge_unlock: 'trophy',
  streak_milestone: 'flame',
  workout_complete: 'barbell',
  trainer_shoutout: 'heart',
  leaderboard: 'podium',
  user_post: 'chatbubble',
};

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { loadFeed(); }, []);

  const loadFeed = async (p = 1) => {
    try {
      setLoading(true);
      const data = await feedAPI.getFeed(p);
      if (p === 1) setPosts(data.posts);
      else setPosts(prev => [...prev, ...data.posts]);
      setHasMore(data.hasMore);
      setPage(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleLike = async (postId: string) => {
    try {
      const res = await feedAPI.toggleLike(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: res.liked, likeCount: res.likeCount } : p));
    } catch (e) { console.error(e); }
  };

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.postCard} data-testid={`feed-post-${item.id}`}>
      <View style={styles.postHeader}>
        <View style={[styles.postIconCircle, { backgroundColor: item.postType === 'streak_milestone' ? COLORS.orange : COLORS.teal }]}>
          <Ionicons name={(POST_ICONS[item.postType] || 'chatbubble') as any} size={18} color={COLORS.white} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.postUser}>{item.userName}</Text>
          <Text style={styles.postTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      </View>
      <Text style={styles.postContent}>{item.content}</Text>
      <View style={styles.postActions}>
        <TouchableOpacity onPress={() => handleLike(item.id)} style={styles.likeBtn} data-testid={`like-btn-${item.id}`}>
          <Ionicons name={item.isLiked ? 'heart' : 'heart-outline'} size={20} color={item.isLiked ? COLORS.orange : COLORS.gray} />
          <Text style={[styles.likeCount, item.isLiked && { color: COLORS.orange }]}>{item.likeCount || 0}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[COLORS.navy, '#0f1d42']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadFeed(1)} tintColor={COLORS.teal} />}
        onEndReached={() => hasMore && loadFeed(page + 1)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>No posts yet. Complete a workout to see activity here!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  postCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  postIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  postUser: { fontSize: 15, fontWeight: '700', color: '#fff' },
  postTime: { fontSize: 13, color: COLORS.gray },
  postContent: { fontSize: 14, color: '#e0e0e0', lineHeight: 20, marginBottom: 12 },
  postActions: { flexDirection: 'row' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeCount: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
});

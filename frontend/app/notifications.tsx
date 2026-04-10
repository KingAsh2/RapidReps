import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../src/contexts/NotificationContext';
import { Colors } from '../src/utils/colors';
import { LinearGradient } from 'expo-linear-gradient';

const backgroundImage = require('../assets/images/bg-swimming.png');

const ICON_MAP: Record<string, { name: string; color: string }> = {
  session_requested: { name: 'calendar', color: Colors.primary },
  session_accepted: { name: 'checkmark-circle', color: Colors.success },
  session_declined: { name: 'close-circle', color: Colors.error },
  session_ended: { name: 'flag', color: Colors.teal },
  session_reminder: { name: 'alarm', color: Colors.warning },
  rate_reminder: { name: 'star', color: Colors.primary },
  payment_released: { name: 'cash', color: Colors.success },
  new_message: { name: 'chatbubble', color: Colors.secondary },
  streak_warning: { name: 'flame', color: Colors.orangeHot },
  boost_expiring: { name: 'rocket', color: Colors.warning },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, unreadCount, refreshNotifications, markAllRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  }, []);

  const renderItem = ({ item }: { item: any }) => {
    const iconInfo = ICON_MAP[item.type] || { name: 'notifications', color: Colors.gray };
    return (
      <View
        style={[styles.notifCard, !item.read && styles.unreadCard]}
        data-testid={`notification-item-${item.type}`}
      >
        <View style={[styles.iconCircle, { backgroundColor: iconInfo.color + '18' }]}>
          <Ionicons name={iconInfo.name as any} size={22} color={iconInfo.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{item.title}</Text>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
    );
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(255, 255, 255, 0.95)', 'rgba(245, 246, 248, 0.92)']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="notifications-back-btn">
          <Ionicons name="arrow-back" size={26} color={Colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markReadBtn} data-testid="mark-all-read-btn">
              <Text style={styles.markRead}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/notification-preferences')}
            style={styles.settingsBtn}
            data-testid="notification-settings-btn"
          >
            <Ionicons name="settings-outline" size={22} color={Colors.navy} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={renderItem}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState} data-testid="notifications-empty">
            <Ionicons name="notifications-off-outline" size={56} color={Colors.grayLight} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtext}>
              You'll see session updates, messages, and reminders here.
            </Text>
          </View>
        }
      />
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1526' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#141929',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markReadBtn: {},
  markRead: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  settingsBtn: { padding: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141929',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  unreadCard: { backgroundColor: '#FFF8F0', borderLeftWidth: 3, borderLeftColor: Colors.primary },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  notifBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  notifTime: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 6, paddingHorizontal: 50 },
});

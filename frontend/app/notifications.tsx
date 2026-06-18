import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../src/contexts/NotificationContext';
import { Colors } from '../src/utils/colors';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const backgroundImage = require('../assets/images/bg-swimming.png');
const SWIPE_THRESHOLD = -80;

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
  virtual_session_request: { name: 'videocam', color: Colors.primary },
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

/**
 * Swipeable notification row — drag left to reveal a red Delete action.
 * Tap routes via the notification's deepLink (e.g., virtual-session → trainee profile).
 */
function NotifRow({ item, onDelete, onTap }: { item: any; onDelete: () => void; onTap: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const next = Math.min(0, Math.max(-100, g.dx + (isOpen.current ? -80 : 0)));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const final = g.dx + (isOpen.current ? -80 : 0);
        if (final < SWIPE_THRESHOLD) {
          Animated.spring(translateX, { toValue: -80, useNativeDriver: true, bounciness: 0 }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  const iconInfo = ICON_MAP[item.type] || { name: 'notifications', color: Colors.gray };
  const isUnread = !item.read;

  return (
    <View style={s.rowWrap}>
      {/* Delete action under the card */}
      <TouchableOpacity
        style={s.deleteAction}
        onPress={onDelete}
        data-testid={`notif-delete-${item.id}`}
        accessibilityLabel="Delete notification"
        accessibilityRole="button"
      >
        <Ionicons name="trash" size={20} color="#FFF" />
        <Text style={s.deleteText}>DELETE</Text>
      </TouchableOpacity>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onTap}
          style={[s.notifCard, isUnread && s.unreadCard]}
          data-testid={`notification-item-${item.type}`}
        >
          <View style={[s.iconCircle, { backgroundColor: iconInfo.color + '24', borderColor: iconInfo.color + '55' }]}>
            <Ionicons name={iconInfo.name as any} size={22} color={iconInfo.color} />
          </View>
          <View style={s.notifContent}>
            <Text style={[s.notifTitle, isUnread && s.notifTitleUnread]} numberOfLines={1}>{item.title}</Text>
            <Text style={[s.notifBody, isUnread && s.notifBodyUnread]} numberOfLines={2}>{item.body}</Text>
            <Text style={s.notifTime}>{timeAgo(item.createdAt)}</Text>
          </View>
          {isUnread && <View style={s.unreadDot} />}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, unreadCount, refreshNotifications, markAllRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  }, [refreshNotifications]);

  // iter106z: refetch on every focus + lightweight 30 s poll so the list
  // feels "live". Previously it only loaded once at mount, so newly-arrived
  // notifications wouldn't appear until the user manually pull-to-refreshed.
  useFocusEffect(
    useCallback(() => {
      refreshNotifications();
      const id = setInterval(() => { refreshNotifications(); }, 30_000);
      return () => clearInterval(id);
    }, [refreshNotifications])
  );

  const handleDelete = async (notif: any) => {
    if (!notif.id) {
      Alert.alert('Cannot delete', 'This notification is missing an id.');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.delete(`${API_URL}/api/notifications/${notif.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshNotifications();
    } catch {
      Alert.alert('Failed', 'Could not delete notification — please try again.');
    }
  };

  const handleTap = async (notif: any) => {
    // iter106z: notifications tap routing — was firing the "Unmatched Route"
    // screen because:
    //  (1) Some deepLinks are stored as fully-qualified `rapidreps://…` URLs
    //      which expo-router's router.push() can't navigate to.
    //  (2) Many notification types had no route mapping at all and silently
    //      did nothing on tap.
    //  (3) Read-state wasn't updated on tap, so the unread dot stuck around.
    // Fix: strip the scheme, build a comprehensive type→route map using the
    // notification's `data` field (sessionId, userId, screen), and mark as
    // read in the same flow.

    // Mark read (best-effort — UI shouldn't block on it)
    if (!notif.read && notif.id) {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        await axios.post(
          `${API_URL}/api/notifications/${notif.id}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        refreshNotifications();
      } catch { /* non-blocking */ }
    }

    const data = notif.data || {};
    const sessionId: string | undefined = data.sessionId;
    const otherUserId: string | undefined = data.userId || data.traineeId || data.trainerId;
    const role: 'trainer' | 'trainee' = data.screen?.startsWith('trainer') ? 'trainer' : 'trainee';

    // 1️⃣ Honor an explicit deepLink IF it looks like an in-app path
    //    (starts with '/'). Strip the rapidreps:// scheme if present.
    if (notif.deepLink) {
      let dl: string = String(notif.deepLink).trim();
      if (dl.startsWith('rapidreps://')) {
        dl = dl.replace(/^rapidreps:\/\//, '/');
        // Special-case the legacy session-summary route used by post-session DMs
        if (dl.startsWith('/session-summary/')) {
          const sid = dl.split('/session-summary/')[1];
          dl = `/trainee/session-summary?sessionId=${sid}`;
        }
      }
      // Rewrite the stale /trainer/trainee-detail path (it doesn't exist —
      // the actual screen is /trainer/trainee-profile).
      dl = dl.replace('/trainer/trainee-detail?', '/trainer/trainee-profile?');
      if (dl.startsWith('/')) {
        router.push(dl as any);
        return;
      }
    }

    // 2️⃣ Build a route by notification type + payload
    switch (notif.type) {
      case 'new_message':
        if (otherUserId) router.push(`/messages/chat?userId=${otherUserId}` as any);
        else router.push('/messages' as any);
        return;

      case 'session_requested':
        // Trainer side: opens the pending request → trainee profile w/ accept CTA
        if (sessionId) router.push(`/trainer/session-detail?sessionId=${sessionId}` as any);
        else router.push('/trainer/(tabs)/home' as any);
        return;

      case 'session_accepted':
      case 'session_confirmed':
      case 'session_declined':
      case 'session_cancelled':
        if (sessionId) {
          router.push(`/${role}/session-detail?sessionId=${sessionId}` as any);
        } else {
          router.push(`/${role}/(tabs)/sessions` as any);
        }
        return;

      case 'session_reminder':
      case 'session_starting':
      case 'late_warning':
      case 'trainer_en_route':
        if (sessionId) router.push(`/${role}/session-detail?sessionId=${sessionId}` as any);
        else router.push(`/${role}/(tabs)/sessions` as any);
        return;

      case 'session_ended':
      case 'rate_reminder':
        if (sessionId) router.push(`/${role}/session-summary?sessionId=${sessionId}` as any);
        else router.push(`/${role}/(tabs)/sessions` as any);
        return;

      case 'payment_released':
      case 'payout_completed':
        router.push('/trainer/payouts' as any);
        return;

      case 'virtual_session_request':
        if (otherUserId) router.push(`/trainer/trainee-profile?traineeId=${otherUserId}` as any);
        else router.push('/trainer/(tabs)/home' as any);
        return;

      case 'streak_warning':
      case 'achievement_unlocked':
        router.push(`/${role}/(tabs)/profile` as any);
        return;

      case 'boost_expiring':
        router.push('/trainer/boosts' as any);
        return;

      default:
        // Final fallback: use data.screen if present, else the sessions tab.
        if (data.screen) router.push(`/${data.screen}` as any);
        else if (sessionId) router.push(`/${role}/session-detail?sessionId=${sessionId}` as any);
        else router.push(`/${role}/(tabs)/sessions` as any);
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={s.container} resizeMode="cover">
      <LinearGradient colors={['rgba(255, 255, 255, 0.95)', 'rgba(245, 246, 248, 0.92)']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} data-testid="notifications-back-btn">
            <Ionicons name="arrow-back" size={26} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Notifications</Text>
          <View style={s.headerRight}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllRead} style={s.markReadBtn} data-testid="mark-all-read-btn">
                <Text style={s.markRead}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push('/notification-preferences')}
              style={s.settingsBtn}
              data-testid="notification-settings-btn"
            >
              <Ionicons name="settings-outline" size={22} color={Colors.navy} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item: any, idx) => String(item.id || idx)}
          renderItem={({ item }) => (
            <NotifRow item={item} onDelete={() => handleDelete(item)} onTap={() => handleTap(item)} />
          )}
          contentContainerStyle={notifications.length === 0 ? s.emptyContainer : s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={9}
          removeClippedSubviews
          ListHeaderComponent={
            notifications.length > 0 ? (
              <Text style={s.swipeHint}>← Swipe left on a notification to delete</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.emptyState} data-testid="notifications-empty">
              <Ionicons name="notifications-off-outline" size={56} color={Colors.grayLight} />
              <Text style={s.emptyTitle}>No Notifications</Text>
              <Text style={s.emptySubtext}>
                You&apos;ll see session updates, messages, and reminders here.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1526' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#141929',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markReadBtn: {},
  markRead: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  settingsBtn: { padding: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  swipeHint: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 10, letterSpacing: 0.5 },

  rowWrap: { marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  deleteAction: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
    backgroundColor: '#FF4757', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  deleteText: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 1 },

  notifCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(20,25,41,0.92)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  // iter102y: previously the unread card used a faint orange tint
  // (rgba(255,106,0,0.12)) which combined with the orange hero background
  // behind the page to create a near-white card — making the white title
  // text illegible. Fix: keep unread cards on a DARK base so white text
  // always pops, and surface the "unread" signal via a strong orange left
  // border + orange title color + unread dot instead.
  unreadCard: {
    backgroundColor: 'rgba(10,14,26,0.96)',
    borderColor: 'rgba(255,106,0,0.55)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    borderWidth: 1,
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  notifTitleUnread: { color: Colors.primary, fontWeight: '900' },
  notifBody: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },
  notifBodyUnread: { color: '#FFFFFF' },
  notifTime: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.primary, marginLeft: 8,
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 6, paddingHorizontal: 50 },
});

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useAuth } from './AuthContext';
import { notificationsAPI, chatAPI, traineeAPI, trainerAPI } from '../services/api';
import { router } from 'expo-router';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationContextType {
  expoPushToken: string | null;
  notifications: any[];
  unreadCount: number;
  unreadMessageCount: number;
  pendingSessionCount: number;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  refreshMessageCount: () => Promise<void>;
  refreshPendingSessionCount: () => Promise<void>;
  markPendingSessionsSeen: () => Promise<void>;
  isReady: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notifications: [],
  unreadCount: 0,
  unreadMessageCount: 0,
  pendingSessionCount: 0,
  refreshNotifications: async () => {},
  markAllRead: async () => {},
  refreshMessageCount: async () => {},
  refreshPendingSessionCount: async () => {},
  markPendingSessionsSeen: async () => {},
  isReady: false,
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingSessionCount, setPendingSessionCount] = useState(0);
  // Marks "I've seen the Pending tab as of timestamp T" — badge only counts sessions created AFTER T.
  // Persisted in AsyncStorage per-user so it survives app restarts.
  const lastSeenPendingRef = useRef<string | null>(null);
  const PENDING_SEEN_KEY = '@rapidreps_pending_seen_at';
  const [isReady, setIsReady] = useState(false);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const isMounted = useRef(true);

  // Safe state setters that check if component is still mounted
  const safeSetState = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: T | ((prev: T) => T)) => {
    if (isMounted.current) {
      setter(value);
    }
  };

  const refreshNotifications = async () => {
    if (!user) return;
    try {
      const data = await notificationsAPI.getNotifications();
      const notifs = data?.notifications || [];
      if (isMounted.current) {
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: any) => !n.read).length);
      }
    } catch (error) {
      // Silently fail — notifications are non-critical
      console.log('Notification fetch error (non-critical):', error);
    }
  };

  const refreshMessageCount = async () => {
    if (!user) return;
    try {
      const convos = await chatAPI.getConversations();
      const total = (convos || []).reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0);
      if (isMounted.current) {
        setUnreadMessageCount(total);
      }
    } catch (error) {
      // Silently fail
      console.log('Message count fetch error (non-critical):', error);
    }
  };

  const refreshPendingSessionCount = async () => {
    if (!user) return;
    try {
      const isTrainer = (user.roles || []).includes('trainer');
      // Backend session status for awaiting-trainer-approval is 'requested'
      const sessions = isTrainer
        ? await trainerAPI.getSessions('requested')
        : await traineeAPI.getSessions('requested');
      const list = Array.isArray(sessions) ? sessions : [];
      // Hydrate "lastSeen" timestamp once (cheap; AsyncStorage read).
      if (lastSeenPendingRef.current === null) {
        try { lastSeenPendingRef.current = (await AsyncStorage.getItem(PENDING_SEEN_KEY)) || ''; } catch { lastSeenPendingRef.current = ''; }
      }
      const seenAt = lastSeenPendingRef.current;
      const count = !seenAt
        ? list.length
        : list.filter((s: any) => {
            const created = s.createdAt || s.created_at || s.requestedAt || '';
            // Only count sessions newer than the last time the user opened Pending.
            return !created || String(created) > seenAt;
          }).length;
      if (isMounted.current) setPendingSessionCount(count);
    } catch (error) {
      console.log('Pending session count fetch error (non-critical):', error);
    }
  };

  // Called by the Sessions screen when the user lands on / switches to the Pending sub-tab.
  // Optimistically clears the badge and persists a "seen at" timestamp so the badge stays cleared
  // across reloads until a NEW pending request arrives.
  const markPendingSessionsSeen = async () => {
    const now = new Date().toISOString();
    lastSeenPendingRef.current = now;
    try { await AsyncStorage.setItem(PENDING_SEEN_KEY, now); } catch { /* ignore */ }
    if (isMounted.current) setPendingSessionCount(0);
  };

  const markAllRead = async () => {
    if (!user) return;
    try {
      await notificationsAPI.markAllRead();
      if (isMounted.current) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.log('Failed to mark notifications as read:', error);
    }
  };

  // Register for push notifications
  useEffect(() => {
    isMounted.current = true;
    
    // Mark as ready immediately so consumers don't crash
    setIsReady(true);
    
    if (!user) {
      // Reset state when user logs out
      setExpoPushToken(null);
      setNotifications([]);
      setUnreadCount(0);
      setUnreadMessageCount(0);
      setPendingSessionCount(0);
      return;
    }

    // Delay initialization to allow navigation to settle
    const initTimeout = setTimeout(async () => {
      try {
        // Register for push notifications (async, non-blocking)
        if (Device.isDevice && Platform.OS !== 'web') {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;

          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }

          if (finalStatus === 'granted') {
            // iter118k: try to acquire a native device token (FCM on Android, APNs on iOS)
            // first because our backend now sends directly to Google/Apple. Fall back to the
            // Expo Push Service token if the native path fails (Expo Go, dev clients).
            let pushToken: string | null = null;
            let tokenType: 'fcm' | 'apns' | 'expo' | undefined;
            try {
              const nativeToken: any = await Notifications.getDevicePushTokenAsync();
              if (nativeToken?.data) {
                pushToken = String(nativeToken.data);
                // Expo returns { type: 'ios' | 'android' | ... }; map to backend types
                const nt = String(nativeToken.type || '').toLowerCase();
                tokenType = nt === 'ios' || nt === 'apns' ? 'apns'
                          : nt === 'android' || nt === 'fcm' ? 'fcm'
                          : undefined;
              }
            } catch (nativeErr) {
              if (__DEV__) console.log('Native device token unavailable, falling back to Expo:', nativeErr);
            }

            if (!pushToken) {
              try {
                const tokenData = await Notifications.getExpoPushTokenAsync({
                  projectId: 'e17065a3-949a-4a61-8a90-13473a6eafe5',
                });
                pushToken = tokenData.data;
                tokenType = 'expo';
              } catch (expoErr) {
                console.log('Expo push token registration skipped:', expoErr);
              }
            }

            if (pushToken) {
              if (isMounted.current) {
                setExpoPushToken(pushToken);
              }
              // Register token with backend (fire and forget)
              notificationsAPI
                .registerToken(pushToken, Device.modelName || undefined, tokenType)
                .catch(() => {});
            }
          }
        }

        // Configure Android channel
        if (Platform.OS === 'android') {
          Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
          }).catch(() => {});
        }

        // Fetch initial data
        await Promise.allSettled([
          refreshNotifications(),
          refreshMessageCount(),
          refreshPendingSessionCount(),
        ]);
      } catch (error) {
        console.log('Notification initialization error (non-critical):', error);
      }
    }, 500); // 500ms delay to let navigation settle

    // Listen for incoming notifications while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      refreshNotifications();
      refreshMessageCount();
      refreshPendingSessionCount();
    });

    // Listen for notification taps (user interacts with notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (__DEV__) console.log('Notification tapped:', data);
      refreshNotifications();
      refreshMessageCount();
      refreshPendingSessionCount();

      // Deep-link to receipt screen when tapping payment verification notifications
      if (data?.action === 'view_receipt' && data?.sessionId) {
        const roles = user?.roles || [];
        const path = roles.includes('trainer')
          ? `/trainer/receipt?sessionId=${data.sessionId}`
          : `/trainee/receipt?sessionId=${data.sessionId}`;
        try { router.push(path as any); } catch {}
      }
    });

    // Poll for unread messages every 30 seconds; pending sessions every 60s (lower frequency).
    const messageInterval = setInterval(refreshMessageCount, 30000);
    const pendingSessionInterval = setInterval(refreshPendingSessionCount, 60000);

    return () => {
      try {
        isMounted.current = false;
        clearTimeout(initTimeout);
        clearInterval(messageInterval);
        clearInterval(pendingSessionInterval);
        
        // Safe cleanup of notification listeners
        const notifSub = notificationListener.current;
        const respSub = responseListener.current;
        
        if (notifSub && typeof notifSub.remove === 'function') {
          notifSub.remove();
        }
        notificationListener.current = undefined;
        
        if (respSub && typeof respSub.remove === 'function') {
          respSub.remove();
        }
        responseListener.current = undefined;
      } catch (e) {
        // Prevent cleanup errors from crashing the app
        console.log('Notification cleanup error (non-critical):', e);
      }
    };
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notifications,
        unreadCount,
        unreadMessageCount,
        pendingSessionCount,
        refreshNotifications,
        markAllRead,
        refreshMessageCount,
        refreshPendingSessionCount,
        markPendingSessionsSeen,
        isReady,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  // Return safe defaults even if context is somehow undefined
  return context || {
    expoPushToken: null,
    notifications: [],
    unreadCount: 0,
    unreadMessageCount: 0,
    pendingSessionCount: 0,
    refreshNotifications: async () => {},
    markAllRead: async () => {},
    refreshMessageCount: async () => {},
    refreshPendingSessionCount: async () => {},
    markPendingSessionsSeen: async () => {},
    isReady: false,
  };
};

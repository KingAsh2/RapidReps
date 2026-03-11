import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useAuth } from './AuthContext';
import { notificationsAPI, chatAPI } from '../services/api';

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
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  refreshMessageCount: () => Promise<void>;
  isReady: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notifications: [],
  unreadCount: 0,
  unreadMessageCount: 0,
  refreshNotifications: async () => {},
  markAllRead: async () => {},
  refreshMessageCount: async () => {},
  isReady: false,
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
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
            try {
              const tokenData = await Notifications.getExpoPushTokenAsync();
              const pushToken = tokenData.data;
              if (isMounted.current) {
                setExpoPushToken(pushToken);
              }
              // Register token with backend (fire and forget)
              notificationsAPI.registerToken(pushToken, Device.modelName || undefined).catch(() => {});
            } catch (tokenError) {
              console.log('Push token registration skipped:', tokenError);
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
        ]);
      } catch (error) {
        console.log('Notification initialization error (non-critical):', error);
      }
    }, 500); // 500ms delay to let navigation settle

    // Listen for incoming notifications while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      refreshNotifications();
      refreshMessageCount();
    });

    // Listen for notification taps (user interacts with notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (__DEV__) console.log('Notification tapped:', data);
      refreshNotifications();
      refreshMessageCount();
    });

    // Poll for unread messages every 30 seconds
    const messageInterval = setInterval(refreshMessageCount, 30000);

    return () => {
      isMounted.current = false;
      clearTimeout(initTimeout);
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      clearInterval(messageInterval);
    };
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notifications,
        unreadCount,
        unreadMessageCount,
        refreshNotifications,
        markAllRead,
        refreshMessageCount,
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
    refreshNotifications: async () => {},
    markAllRead: async () => {},
    refreshMessageCount: async () => {},
    isReady: false,
  };
};

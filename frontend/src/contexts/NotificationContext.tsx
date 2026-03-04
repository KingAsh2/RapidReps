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
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  // Register for push notifications
  useEffect(() => {
    if (!user || !token) return;

    const registerForPush = async () => {
      try {
        if (!Device.isDevice) {
          // Push notifications only work on physical devices
          return;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: undefined, // Uses the project ID from app.json
        });
        const pushToken = tokenData.data;
        setExpoPushToken(pushToken);

        // Register the token with our backend
        await notificationsAPI.registerToken(pushToken, Device.modelName || undefined);
      } catch (error) {
        console.log('Push notification registration error:', error);
      }
    };

    registerForPush();

    // Configure Android channel
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });
    }

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

    // Initial fetch
    refreshNotifications();
    refreshMessageCount();

    // Poll for unread messages every 30 seconds
    const messageInterval = setInterval(refreshMessageCount, 30000);

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      clearInterval(messageInterval);
    };
  }, [user, token]);

  const refreshNotifications = async () => {
    try {
      const data = await notificationsAPI.getNotifications();
      const notifs = data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n: any) => !n.read).length);
    } catch (error) {
      // Silently fail — notifications are non-critical
    }
  };

  const refreshMessageCount = async () => {
    try {
      const convos = await chatAPI.getConversations();
      const total = convos.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0);
      setUnreadMessageCount(total);
    } catch (error) {
      // Silently fail
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.log('Failed to mark notifications as read:', error);
    }
  };

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
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

/**
 * usePushNotifications.ts — iter118w
 *
 * Emergent / Expo managed push notifications hook. Mount ONCE near the
 * authenticated app root; do not re-mount per screen (it deduplicates
 * subscriptions but the wasted permission prompts get user-hostile).
 *
 * Responsibilities:
 *  1. Request permission (Android 13+ POST_NOTIFICATIONS is runtime — the
 *     playbook required an Android channel BEFORE the prompt for the
 *     system dialog to render category-aware copy).
 *  2. Fetch the ExpoPushToken via `getExpoPushTokenAsync({ projectId })`.
 *  3. POST the token to RapidReps' `/api/push-tokens/register` so the
 *     managed push relay can look up devices per userId later.
 *  4. Wire foreground notification received + tap listeners. Tap-routing
 *     itself lives in `_layout.tsx` — this hook only records analytics.
 *  5. Never dead-end — if permission is denied, we still return the
 *     status so the caller can surface the in-app notifications tab and
 *     the backend fallback ladder (in-app row + email) does the rest.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export type NotificationCategory = 'bookings' | 'chat' | 'promos' | 'streaks' | 'safety' | 'system';

// iter118w — foreground notification handler. Banners on for everything by
// default; the notification-preferences screen can suppress via server-side
// filtering (client can't reliably gate background pushes).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // Older RN types still expect these:
    shouldShowAlert: true,
  } as any),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
    lightColor: '#FF6A00',
  });
  // A dedicated channel for safety/SOS so users can't mute critical pushes
  // while keeping promos on.
  await Notifications.setNotificationChannelAsync('safety', {
    name: 'Safety alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    sound: 'default',
    lightColor: '#FF4757',
    bypassDnd: true,
  });
}

export function usePushNotifications(userId?: string | null, authToken?: string | null) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined' | null>(null);
  const receivedRef = useRef<Notifications.Subscription | null>(null);
  const responseRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        // Simulators can't get a real push token — bail early with a
        // clean status so the caller can render "push not available on
        // this device" if needed.
        if (!Device.isDevice) {
          setPermission('denied');
          return;
        }

        await ensureAndroidChannel();

        const current = await Notifications.getPermissionsAsync();
        let status = current.status as any;
        if (status !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status as any;
        }
        if (cancelled) return;
        setPermission(status === 'granted' ? 'granted' : (status === 'undetermined' ? 'undetermined' : 'denied'));
        if (status !== 'granted') return;

        const projectId =
          (Constants.expoConfig as any)?.extra?.eas?.projectId
          ?? (Constants as any).easConfig?.projectId
          ?? (Constants.expoConfig as any)?.extra?.projectId;
        // If no projectId is set we still try — Expo's classic tokens work
        // without one; only EAS-build tokens require it.
        const tokenResult = projectId
          ? await Notifications.getExpoPushTokenAsync({ projectId })
          : await Notifications.getExpoPushTokenAsync();
        const token = tokenResult.data;
        if (cancelled) return;
        setExpoPushToken(token);

        // Register with our backend so the managed-relay backend can look
        // up userId → devices. Cache the last-registered token so we don't
        // spam the endpoint on every mount.
        const lastKey = `push_registered:${userId}`;
        const last = await AsyncStorage.getItem(lastKey);
        if (last !== token && API_URL) {
          try {
            await fetch(`${API_URL}/api/push-tokens/register`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
              body: JSON.stringify({
                userId,
                token,
                expoPushToken: token,
                tokenType: 'expo',
                platform: Platform.OS,
                deviceName: Device.deviceName ?? undefined,
              }),
            });
            await AsyncStorage.setItem(lastKey, token);
          } catch (e) {
            // Non-fatal — the fallback ladder catches undeliverable pushes.
            console.warn('[push] token register failed', e);
          }
        }
      } catch (e) {
        console.warn('[push] setup failed', e);
      }
    })();

    receivedRef.current = Notifications.addNotificationReceivedListener(() => {
      // Foreground receipt — banner handled by the global handler above.
    });
    responseRef.current = Notifications.addNotificationResponseReceivedListener(() => {
      // Tap routing lives in _layout.tsx at module scope.
    });

    return () => {
      cancelled = true;
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, [userId, authToken]);

  return { expoPushToken, permission };
}

export default usePushNotifications;

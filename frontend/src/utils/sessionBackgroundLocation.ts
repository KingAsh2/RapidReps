/**
 * sessionBackgroundLocation — iter106h.
 *
 * Registers an expo-task-manager background task that pushes the user's GPS
 * to /api/sessions/{id}/gps-update while a session is en route or in
 * progress — even when the app is backgrounded or the screen is locked.
 *
 * Lifecycle:
 *   • startSessionBackgroundLocation(sessionId, token) — call from EnRouteMap
 *     on mount AFTER the user grants Always Allow permission.
 *   • stopSessionBackgroundLocation() — call on EnRouteMap unmount or when
 *     the session ends.
 *
 * The task is **automatically scoped to one session at a time** by storing
 * the active sessionId + auth token in AsyncStorage so the task handler can
 * read them between OS-driven runs.
 */
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TASK_NAME = 'rapidreps.session.bgLocation';
const STORE_KEY = 'rapidreps:bgLocSession';

// Define the task ONCE at module load — TaskManager requires the task name
// to be registered globally before startLocationUpdatesAsync is called.
TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    return;
  }
  const locations: any[] = data?.locations || [];
  if (locations.length === 0) return;
  const latest = locations[locations.length - 1];
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return;
    const { sessionId, token, baseUrl } = JSON.parse(raw);
    if (!sessionId || !token || !baseUrl) return;
    const lat = latest.coords?.latitude;
    const lng = latest.coords?.longitude;
    const acc = latest.coords?.accuracy || 0;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    await fetch(`${baseUrl}/api/sessions/${sessionId}/gps-update?latitude=${lat}&longitude=${lng}&accuracy=${acc}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  } catch {
    /* swallow — best-effort */
  }
});

export async function startSessionBackgroundLocation(
  sessionId: string,
  token: string,
  baseUrl: string,
): Promise<{ started: boolean; reason?: string }> {
  try {
    // 1. Request "Always Allow" — required to receive updates while
    //    backgrounded. The user can downgrade later in Settings without
    //    crashing the app (the task simply stops firing).
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { started: false, reason: 'foreground-denied' };
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return { started: false, reason: 'background-denied' };

    await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ sessionId, token, baseUrl }));

    const already = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
    if (already) return { started: true };

    await Location.startLocationUpdatesAsync(TASK_NAME, {
      // Battery-conscious profile: ~10 s between fixes, ~15 m movement
      // threshold. Plenty for Uber-style "they're moving toward me" rendering
      // without draining the battery.
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10_000,
      distanceInterval: 15,
      showsBackgroundLocationIndicator: true, // iOS blue bar — required by Apple
      pausesUpdatesAutomatically: false,
      foregroundService: {
        // Android persistent notification — required for background location
        notificationTitle: 'RapidReps — en route',
        notificationBody: 'Sharing your live location with your session partner',
        notificationColor: '#FF6A00',
      },
    });
    return { started: true };
  } catch (e: any) {
    return { started: false, reason: e?.message || 'unknown' };
  }
}

export async function stopSessionBackgroundLocation(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
    if (started) {
      await Location.stopLocationUpdatesAsync(TASK_NAME).catch(() => {});
    }
    await AsyncStorage.removeItem(STORE_KEY).catch(() => {});
  } catch {
    /* ignore */
  }
}

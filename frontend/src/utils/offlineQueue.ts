/**
 * offlineQueue.ts — iter106aw G25.
 *
 * Persists critical API POSTs (GPS pings, end-session) to AsyncStorage while
 * offline and replays them in-order the moment connectivity returns.
 *
 * Design:
 *   - Storage key: `offline_queue_v1` → JSON array of { id, url, method,
 *     body, params, queuedAt, headersTokenKey }.
 *   - `enqueue()` never blocks — callers fire-and-forget.
 *   - `flushOfflineQueue()` walks the queue oldest-first, POSTs each, drops
 *     on success, keeps + backs off (5 min) on network error. Auth token is
 *     re-read from AsyncStorage at flush time so a refreshed token still works.
 *   - Idempotency: server-side compare-and-set (client_timestamp for
 *     gps-update, status guards for end-session) makes replay safe.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'offline_queue_v1';
const AUTH_KEY = 'auth_token';
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export type QueuedRequest = {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT';
  body?: any;
  params?: Record<string, string | number>;
  queuedAt: string; // ISO
  requiresAuth?: boolean;
};

async function readQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function writeQueue(items: QueuedRequest[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export async function enqueueOffline(req: Omit<QueuedRequest, 'id' | 'queuedAt'>): Promise<void> {
  const items = await readQueue();
  items.push({
    ...req,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  });
  await writeQueue(items);
}

export async function queueSize(): Promise<number> {
  return (await readQueue()).length;
}

export async function clearOfflineQueue(): Promise<void> {
  await writeQueue([]);
}

let flushing = false;

export async function flushOfflineQueue(): Promise<{ sent: number; failed: number }> {
  if (flushing) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const items = await readQueue();
    if (items.length === 0) return { sent: 0, failed: 0 };
    const remaining: QueuedRequest[] = [];
    const token = (await AsyncStorage.getItem(AUTH_KEY)) || '';
    for (const item of items) {
      try {
        const qs = item.params
          ? '?' + Object.entries(item.params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
          : '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (item.requiresAuth !== false && token) headers['Authorization'] = `Bearer ${token}`;
        const resp = await fetch(`${API_URL}${item.url}${qs}`, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined,
        });
        // Drop on success (2xx) OR 409 (server rejected as stale — expected replay outcome).
        if (resp.ok || resp.status === 409) {
          sent += 1;
        } else if (resp.status >= 500) {
          // Server error → keep for retry.
          remaining.push(item);
          failed += 1;
        } else {
          // 4xx (auth expired, bad payload) → drop, don't retry forever.
          sent += 1;
        }
      } catch {
        // Network error → keep for retry.
        remaining.push(item);
        failed += 1;
      }
    }
    await writeQueue(remaining);
    return { sent, failed };
  } finally {
    flushing = false;
  }
}

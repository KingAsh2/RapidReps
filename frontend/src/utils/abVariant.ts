/**
 * Hash-based A/B Welcome variant assignment (iter96b).
 *
 * Replaces the env-flag controlled `WELCOME_VARIANT` with a deterministic,
 * per-device assignment. Goals:
 *   • Every device gets a stable variant for the lifetime of the install
 *   • The split is ~50/50 across the install base (FNV-1a over a uuid)
 *   • Env override still wins for QA/forcing ('A' or 'B')
 *   • Synchronous after first mount — no flicker
 *
 * Storage key: '@rapidreps_ab_device_id'  (anonymous, never sent off-device)
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@rapidreps_ab_device_id';
const ENV_OVERRIDE = (process.env.EXPO_PUBLIC_WELCOME_VARIANT as 'A' | 'B' | undefined);

// FNV-1a 32-bit (small, branch-free, no native crypto required on web)
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function randomId(): string {
  // 16 hex chars — plenty of entropy for bucket hashing
  let s = '';
  for (let i = 0; i < 16; i++) s += Math.floor(Math.random() * 16).toString(16);
  return `dev_${Date.now().toString(36)}_${s}`;
}

export function variantFromId(deviceId: string): 'A' | 'B' {
  return (fnv1a(deviceId) % 2 === 0) ? 'A' : 'B';
}

/**
 * Hook: returns the assigned variant. On first call it boots from AsyncStorage
 * (or seeds a new device id) and emits the resolved variant on the next tick.
 * Until then, returns 'A' as a safe default to avoid layout flicker.
 */
export function useWelcomeVariant(): 'A' | 'B' {
  const [variant, setVariant] = useState<'A' | 'B'>(ENV_OVERRIDE ?? 'A');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (ENV_OVERRIDE === 'A' || ENV_OVERRIDE === 'B') return; // env wins
      try {
        let id = await AsyncStorage.getItem(STORAGE_KEY);
        if (!id) {
          id = randomId();
          await AsyncStorage.setItem(STORAGE_KEY, id);
        }
        const v = variantFromId(id);
        if (!cancelled) setVariant(v);
      } catch {
        // AsyncStorage unavailable → stick with default A
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return variant;
}

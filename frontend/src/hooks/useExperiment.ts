/**
 * useExperiment — Lightweight client-side A/B testing primitive.
 *
 *  - Assigns each device a stable variant via a deterministic hash → no flicker.
 *  - Reports `impression` on mount and `click`/`conversion` via returned helpers.
 *  - Server records events for later analysis (see /api/experiments/event).
 */
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

const DEVICE_ID_KEY = '__rapidreps_device_id';

// FNV-1a 32-bit hash — small, fast, deterministic.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

async function getDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export interface ExperimentReturn<TVariant extends string> {
  variant: TVariant | null;
  loading: boolean;
  trackClick: () => void;
  trackConversion: () => void;
}

/**
 * @param experimentKey  Unique string id of the experiment (e.g. "google_cta_copy")
 * @param variants       Array of variant names — equal weight, 50/50 if 2 entries.
 */
export function useExperiment<TVariant extends string>(
  experimentKey: string,
  variants: readonly TVariant[],
): ExperimentReturn<TVariant> {
  const [variant, setVariant] = useState<TVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const deviceId = await getDeviceId();
      if (cancelled) return;
      deviceIdRef.current = deviceId;
      const h = fnv1a(`${experimentKey}::${deviceId}`);
      const v = variants[h % variants.length];
      setVariant(v);
      setLoading(false);
      // Fire-and-forget impression
      api.post('/experiments/event', {
        experimentKey,
        variant: v,
        event: 'impression',
        deviceId,
      }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [experimentKey, variants.join('|')]);

  const track = (event: 'click' | 'conversion') => {
    if (!variant) return;
    api.post('/experiments/event', {
      experimentKey,
      variant,
      event,
      deviceId: deviceIdRef.current,
    }).catch(() => {});
  };

  return {
    variant,
    loading,
    trackClick: () => track('click'),
    trackConversion: () => track('conversion'),
  };
}

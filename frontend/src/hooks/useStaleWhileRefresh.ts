/**
 * useStaleWhileRefresh — iter105 perf pass.
 *
 * Eliminates the "blank screen every tab return" feel by:
 *  1. Showing the previously cached value INSTANTLY (no spinner).
 *  2. Refreshing in the background and silently updating when new data arrives.
 *
 * Cache lives in memory + AsyncStorage so it survives screen unmounts.
 * Pure read-through cache; doesn't change any business logic or write paths.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const memCache = new Map<string, any>();

type Options<T> = {
  /** Cache key — pick something stable like "home:nearby:lat,lng". */
  key: string;
  /** Async fetcher. Called once on mount + on `refresh()`. */
  fetcher: () => Promise<T>;
  /** Skip fetch (e.g. waiting for auth). Default false. */
  paused?: boolean;
  /** How long the cached value is "fresh enough" to skip a refresh, ms. Default: 30s. */
  freshMs?: number;
};

export function useStaleWhileRefresh<T>({ key, fetcher, paused = false, freshMs = 30_000 }: Options<T>) {
  const [data, setData] = useState<T | null>(() => (memCache.has(key) ? (memCache.get(key) as T) : null));
  const [loading, setLoading] = useState<boolean>(!memCache.has(key));
  const [error, setError] = useState<any>(null);
  const lastFetchAt = useRef<number>(memCache.has(key) ? Date.now() : 0);
  const inFlight = useRef<Promise<T> | null>(null);

  const run = useCallback(async (force = false) => {
    if (paused) return;
    if (!force && Date.now() - lastFetchAt.current < freshMs && memCache.has(key)) {
      return; // still fresh — skip
    }
    if (inFlight.current) return inFlight.current;
    inFlight.current = (async () => {
      try {
        const next = await fetcher();
        memCache.set(key, next);
        lastFetchAt.current = Date.now();
        setData(next);
        setError(null);
        try {
          await AsyncStorage.setItem(`swr:${key}`, JSON.stringify({ v: next, t: lastFetchAt.current }));
        } catch { /* AsyncStorage best-effort */ }
        return next;
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [key, fetcher, paused, freshMs]);

  // Hydrate from disk on first mount (only if memCache empty)
  useEffect(() => {
    if (memCache.has(key) || paused) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`swr:${key}`);
        if (cancelled || !raw) return;
        const { v, t } = JSON.parse(raw);
        if (v !== undefined) {
          memCache.set(key, v);
          lastFetchAt.current = t || 0;
          setData(v);
          setLoading(false);
        }
      } catch { /* corrupt cache — ignore */ }
    })();
    return () => { cancelled = true; };
  }, [key, paused]);

  // Kick off fetch on mount + when paused flips off
  useEffect(() => {
    if (!paused) run();
  }, [run, paused]);

  return { data, loading, error, refresh: () => run(true) };
}

/** Imperative cache helpers — useful for invalidating after writes. */
export const swrCache = {
  get: <T>(key: string): T | undefined => memCache.get(key),
  set: (key: string, value: any) => {
    memCache.set(key, value);
    AsyncStorage.setItem(`swr:${key}`, JSON.stringify({ v: value, t: Date.now() })).catch(() => {});
  },
  invalidate: (key: string) => {
    memCache.delete(key);
    AsyncStorage.removeItem(`swr:${key}`).catch(() => {});
  },
  invalidatePrefix: (prefix: string) => {
    for (const k of Array.from(memCache.keys())) {
      if (k.startsWith(prefix)) memCache.delete(k);
    }
  },
};

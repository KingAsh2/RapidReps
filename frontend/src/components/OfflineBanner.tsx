/**
 * OfflineBanner — iter106aw G26.
 *
 * Sticky top pill that appears when connectivity drops during a live
 * session. Flips to a green "Synced" state for 3s once the queue drains,
 * then hides. Uses the global NetworkContext + offlineQueue.
 *
 * Mounted per-screen (session-detail, en-route map) where offline behavior
 * matters. Kept intentionally passive — no CTA beyond visibility.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../contexts/NetworkContext';
import { queueSize } from '../utils/offlineQueue';

export const OfflineBanner: React.FC = () => {
  const { online } = useNetwork();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'hidden' | 'offline' | 'synced'>('hidden');
  const [pending, setPending] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let syncTimer: any = null;
    (async () => {
      if (!online) {
        const n = await queueSize();
        if (!mounted) return;
        setPending(n);
        setState('offline');
      } else if (state === 'offline') {
        // Just came back online — flash Synced then hide.
        setState('synced');
        syncTimer = setTimeout(() => { if (mounted) setState('hidden'); }, 3000);
      }
    })();
    return () => { mounted = false; if (syncTimer) clearTimeout(syncTimer); };
  }, [online]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: state === 'hidden' ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [state]);

  if (state === 'hidden') return null;

  const isOffline = state === 'offline';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          top: insets.top + 6,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          backgroundColor: isOffline ? 'rgba(255, 74, 87, 0.18)' : 'rgba(0, 200, 83, 0.18)',
          borderColor: isOffline ? 'rgba(255, 74, 87, 0.55)' : 'rgba(0, 200, 83, 0.55)',
        },
      ]}
      testID={isOffline ? 'offline-banner' : 'synced-banner'}
    >
      <Ionicons
        name={isOffline ? 'cloud-offline-outline' : 'cloud-done-outline'}
        size={14}
        color="#FFFFFF"
      />
      <Text style={styles.text}>
        {isOffline
          ? `Offline — your changes will sync when you're back${pending ? ` (${pending} queued)` : ''}`
          : 'Back online · Synced'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default OfflineBanner;

/**
 * NetworkContext — iter106aw G24.
 *
 * Global `useNetwork()` hook backed by @react-native-community/netinfo.
 * Fires a listener at mount and cleans up on unmount. Consumers can read
 * `{ online, type }` cheaply and re-render only when the state changes.
 *
 * Also fires the offline queue's flush() the moment connectivity returns,
 * so any queued POSTs (GPS pings, end-session) sync automatically.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { flushOfflineQueue } from '../utils/offlineQueue';

type NetworkState = {
  online: boolean;
  type: string | null;
};

const NetworkCtx = createContext<NetworkState>({ online: true, type: null });

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<NetworkState>({ online: true, type: null });

  useEffect(() => {
    const handler = (s: NetInfoState) => {
      const isOnline = !!s.isConnected && s.isInternetReachable !== false;
      setState({ online: isOnline, type: s.type });
      if (isOnline) {
        // Fire-and-forget queue flush on any offline → online transition.
        flushOfflineQueue().catch(() => {});
      }
    };
    // Prime state immediately, then subscribe.
    NetInfo.fetch().then(handler).catch(() => {});
    const unsub = NetInfo.addEventListener(handler);
    return () => { unsub(); };
  }, []);

  const value = useMemo(() => state, [state.online, state.type]);
  return <NetworkCtx.Provider value={value}>{children}</NetworkCtx.Provider>;
};

export function useNetwork(): NetworkState {
  return useContext(NetworkCtx);
}

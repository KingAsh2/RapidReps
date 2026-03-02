import React from 'react';
import { Slot } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { AlertProvider } from '../src/contexts/AlertContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { SoundProvider } from '../src/contexts/SoundContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Web layout: skip native-only modules (Stripe, etc.)
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NotificationProvider>
          <SoundProvider>
            <AlertProvider>
              <Slot />
            </AlertProvider>
          </SoundProvider>
        </NotificationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

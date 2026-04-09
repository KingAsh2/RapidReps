import React from 'react';
import { Slot } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { AlertProvider } from '../src/contexts/AlertContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { SoundProvider } from '../src/contexts/SoundContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import Toast, { BaseToast } from 'react-native-toast-message';

const toastConfig = {
  success: (props: any) => (
    <BaseToast {...props} style={{ borderLeftColor: '#2ECC71', backgroundColor: '#FAFBFC', borderLeftWidth: 5, borderRadius: 10, marginHorizontal: 16 }} contentContainerStyle={{ paddingHorizontal: 14 }} text1Style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }} text1NumberOfLines={2} />
  ),
  info: (props: any) => (
    <BaseToast {...props} style={{ borderLeftColor: '#F7931E', backgroundColor: '#FAFBFC', borderLeftWidth: 5, borderRadius: 10, marginHorizontal: 16 }} contentContainerStyle={{ paddingHorizontal: 14 }} text1Style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }} text1NumberOfLines={2} />
  ),
  error: (props: any) => (
    <BaseToast {...props} style={{ borderLeftColor: '#FF4757', backgroundColor: '#FAFBFC', borderLeftWidth: 5, borderRadius: 10, marginHorizontal: 16 }} contentContainerStyle={{ paddingHorizontal: 14 }} text1Style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }} text1NumberOfLines={2} />
  ),
};

// Web layout: skip native-only modules (Stripe, etc.)
export default function RootLayout() {
  return (
    <ErrorBoundary>
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
        <Toast config={toastConfig} />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

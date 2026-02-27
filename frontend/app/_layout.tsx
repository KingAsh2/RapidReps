import React from 'react';
import { Platform } from 'react-native';
import { Slot } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { AlertProvider } from '../src/contexts/AlertContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

let StripeProviderComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

if (Platform.OS !== 'web') {
  try {
    const { StripeProvider } = require('@stripe/stripe-react-native');
    const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    StripeProviderComponent = ({ children }: { children: React.ReactNode }) => (
      <StripeProvider publishableKey={publishableKey}>
        {children}
      </StripeProvider>
    );
  } catch {
    // Stripe not available on this platform
  }
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StripeProviderComponent>
          <NotificationProvider>
            <AlertProvider>
              <Slot />
            </AlertProvider>
          </NotificationProvider>
        </StripeProviderComponent>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

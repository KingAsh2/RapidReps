import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/signup" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/onboarding-trainer" />
          <Stack.Screen name="auth/onboarding-trainee" />
          <Stack.Screen name="trainer/home" />
          <Stack.Screen name="trainee/home" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

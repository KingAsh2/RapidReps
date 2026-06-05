import React from 'react';
import { Slot } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { AlertProvider } from '../src/contexts/AlertContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { SoundProvider } from '../src/contexts/SoundContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
// iter98f: full-screen intro video on every cold launch
import IntroVideoSplash from '../src/components/IntroVideoSplash';
import Toast, { BaseToast } from 'react-native-toast-message';
import * as Sentry from '@sentry/react-native';
import { useFonts, Oswald_700Bold, Oswald_600SemiBold, Oswald_400Regular } from '@expo-google-fonts/oswald';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Initialize Sentry as early as possible for native crash capturing
Sentry.init({
  dsn: 'https://303fdbcfaa15c23693d7944e2eed47a5@o4511035618361344.ingest.us.sentry.io/4511035640315904',
  // Enable native crash handling - CRITICAL for force closes
  enableNative: true,
  enableNativeCrashHandling: true,
  // Capture all errors in development, reduce in production
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  // Enable auto session tracking
  enableAutoSessionTracking: true,
  // Attach stack traces to all messages
  attachStacktrace: true,
  // Debug mode in development
  debug: __DEV__,
  // Capture unhandled promise rejections
  enableCaptureFailedRequests: true,
  // Environment tag
  environment: __DEV__ ? 'development' : 'production',
  beforeSend(event) {
    // Add extra context before sending
    console.log('[Sentry] Capturing event:', event.event_id);
    return event;
  },
});

const toastConfig = {
  success: (props: any) => (
    props ? (
      <BaseToast
        {...props}
        style={{ borderLeftColor: '#2ECC71', backgroundColor: '#1A2035', borderLeftWidth: 5, borderRadius: 10, marginHorizontal: 16 }}
        contentContainerStyle={{ paddingHorizontal: 14 }}
        text1Style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}
        text1NumberOfLines={2}
      />
    ) : null
  ),
  info: (props: any) => (
    props ? (
      <BaseToast
        {...props}
        style={{ borderLeftColor: '#F7931E', backgroundColor: '#1A2035', borderLeftWidth: 5, borderRadius: 10, marginHorizontal: 16 }}
        contentContainerStyle={{ paddingHorizontal: 14 }}
        text1Style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}
        text1NumberOfLines={2}
      />
    ) : null
  ),
  error: (props: any) => (
    props ? (
      <BaseToast
        {...props}
        style={{ borderLeftColor: '#FF4757', backgroundColor: '#1A2035', borderLeftWidth: 5, borderRadius: 10, marginHorizontal: 16 }}
        contentContainerStyle={{ paddingHorizontal: 14 }}
        text1Style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}
        text1NumberOfLines={2}
      />
    ) : null
  ),
};

// Stripe native SDK removed - payments handled via web-based Stripe Checkout
const StripeProviderComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Oswald_700Bold,
    Oswald_600SemiBold,
    Oswald_400Regular,
  });

  // iter98f: show intro video on every cold launch, then hand off to app
  const [introDone, setIntroDone] = React.useState(false);

  React.useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <StripeProviderComponent>
            <NotificationProvider>
              <SoundProvider>
                <AlertProvider>
                  <Slot />
                </AlertProvider>
              </SoundProvider>
            </NotificationProvider>
          </StripeProviderComponent>
        </AuthProvider>
        <Toast config={toastConfig} />
        {/* Intro video overlays everything on cold start; unmounts on finish/skip/timeout. */}
        {!introDone ? <IntroVideoSplash onFinish={() => setIntroDone(true)} /> : null}
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// Wrap with Sentry for automatic error boundary and performance monitoring
export default Sentry.wrap(RootLayout);

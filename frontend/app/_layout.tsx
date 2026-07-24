import React from 'react';
import { View, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { AlertProvider } from '../src/contexts/AlertContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { SoundProvider } from '../src/contexts/SoundContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
// iter98f: full-screen intro video on every cold launch
import IntroVideoSplash from '../src/components/IntroVideoSplash';
// iter102f: floating orange embers on every screen globally
import FloatingOrangeBg from '../src/components/FloatingOrangeBg';
// iter102k: user-chosen brand color glow around every screen + menu
import AccentGlowOverlay from '../src/components/AccentGlowOverlay';
// iter106av: single global mount for the "?preview=1" banner (replaces
// per-screen <PreviewBanner /> copy-paste).
import { GlobalPreviewBanner } from '../src/components/GlobalPreviewBanner';
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

// iter106o: real Stripe provider for native (was a no-op stub). On web we
// keep the no-op since @stripe/stripe-react-native is native-only — the web
// build would use Stripe.js / Checkout if we ever build a web payment path.
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let StripeProviderComponent: React.FC<{ children: React.ReactNode }>;
if (Platform.OS === 'web' || !STRIPE_PUBLISHABLE_KEY) {
  StripeProviderComponent = ({ children }) => <>{children}</>;
} else {
  // Native import only — avoids pulling the native module into the web bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { StripeProvider } = require('@stripe/stripe-react-native');
  StripeProviderComponent = ({ children }) => (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.kingash.rapidreps"
      urlScheme="rapidreps"
    >
      {children}
    </StripeProvider>
  );
}

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
                  {/* iter102f: global firefly orange embers — visible on EVERY
                      screen. pointerEvents=none so touches pass through. Hidden
                      while intro splash is on screen so they don't fight the
                      video. */}
                  {introDone && (
                    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                      <FloatingOrangeBg />
                    </View>
                  )}
                  {/* iter102k: user-chosen brand accent painted as a soft glow
                      around all four edges + the bottom menu. Reads
                      user.accentColor from AuthContext — defaults to orange. */}
                  {introDone && <AccentGlowOverlay />}
                  {/* iter106av: global preview banner replaces per-screen mounts. */}
                  {introDone && <GlobalPreviewBanner />}
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

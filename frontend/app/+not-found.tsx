/**
 * iter106x: catch-all for any deep-link that lands on an empty / unknown
 * path (e.g. `rapidreps:///` from Stripe / Apple Pay redirects, push
 * notifications without a path, share-extension hand-offs that don't
 * include a route, etc.). Instead of expo-router's default "Unmatched
 * Route — Page could not be found" screen we silently send the user back
 * to wherever they should be:
 *   • Signed in as trainer  → /trainer/(tabs)/home
 *   • Signed in as trainee  → /trainee/(tabs)/home
 *   • Signed out            → /auth (login)
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function NotFoundRedirect() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.roles?.includes('TRAINER')) {
      router.replace('/trainer/(tabs)/home');
    } else if (user) {
      router.replace('/trainee/(tabs)/home');
    } else {
      router.replace('/auth');
    }
  }, [router, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6A00" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E14',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

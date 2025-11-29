import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors } from '../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { AthleticButton } from '../src/components/AthleticButton';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, loading, activeRole } = useAuth();
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user && activeRole && isReady) {
      if (activeRole === 'trainer') {
        router.replace('/trainer/home');
      } else if (activeRole === 'trainee') {
        router.replace('/trainee/home');
      }
    }
  }, [user, activeRole, isReady, router]);

  if (loading || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* BACKGROUND - Solid Orange */}
      <View style={styles.backgroundOrange} />
      
      {/* MAIN CONTENT */}
      <View style={styles.content}>
        {/* LOGO SECTION */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/rapidreps-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* BRAND TEXT */}
        <View style={styles.brandSection}>
          <Text style={styles.brandName}>RAPIDREPS</Text>
          <Text style={styles.slogan}>YOUR WORKOUT,</Text>
          <Text style={styles.sloganBold}>DELIVERED 🔥</Text>
        </View>

        {/* FEATURES */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="search" size={32} color={Colors.navy} />
            </View>
            <Text style={styles.featureTitle}>FIND TRAINERS</Text>
            <Text style={styles.featureText}>Local pros near you</Text>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="flash" size={32} color={Colors.navy} />
            </View>
            <Text style={styles.featureTitle}>BOOK FAST</Text>
            <Text style={styles.featureText}>Sessions on demand</Text>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Ionicons name="cash" size={32} color={Colors.navy} />
            </View>
            <Text style={styles.featureTitle}>PAY EASY</Text>
            <Text style={styles.featureText}>Simple pricing</Text>
          </View>
        </View>

        {/* CTA BUTTONS */}
        <View style={styles.ctaContainer}>
          <AthleticButton
            title="GET STARTED"
            onPress={() => router.push('/auth/signup')}
            variant="primary"
            size="large"
            icon="fitness"
          />

          <TouchableOpacity
            onPress={() => router.push('/auth/login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>ALREADY A MEMBER? LOG IN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  backgroundOrange: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 140,
    height: 140,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandName: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.navy,
    letterSpacing: 2,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  slogan: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sloganBold: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    color: Colors.navy,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 50,
    gap: 12,
  },
  featureCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 16,
    alignItems: 'center',
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondary,
    borderWidth: 3,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.navy,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  ctaContainer: {
    marginTop: 'auto',
    gap: 20,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginLinkText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.navy,
    letterSpacing: 1,
    textDecorationLine: 'underline',
    textDecorationColor: Colors.navy,
    textDecorationStyle: 'solid',
  },
});

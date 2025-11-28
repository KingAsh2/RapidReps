import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors } from '../src/utils/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, loading, activeRole } = useAuth();
  const logoScaleAnim = React.useRef(new Animated.Value(1));
  const logoRotateAnim = React.useRef(new Animated.Value(0));
  const logoJumpAnim = React.useRef(new Animated.Value(0));
  const buttonScaleAnim = React.useRef(new Animated.Value(1));
  const buttonGlowAnim = React.useRef(new Animated.Value(0));
  const buttonShakeAnim = React.useRef(new Animated.Value(0));
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    // Mark as ready after a short delay
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // LOGO: Fitness "Pump" Animation - Like a muscle flexing!
    Animated.loop(
      Animated.parallel([
        // Scale pump (muscle flex)
        Animated.sequence([
          Animated.timing(logoScaleAnim.current, {
            toValue: 1.12,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(logoScaleAnim.current, {
            toValue: 0.98,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(logoScaleAnim.current, {
            toValue: 1.08,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(logoScaleAnim.current, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        // Slight rotation for dynamic feel
        Animated.sequence([
          Animated.timing(logoRotateAnim.current, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(logoRotateAnim.current, {
            toValue: -1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        // Jump effect (like a jump squat!)
        Animated.sequence([
          Animated.timing(logoJumpAnim.current, {
            toValue: -15,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(logoJumpAnim.current, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(1400),
        ]),
      ])
    ).start();

    // BUTTON: Super Energetic "Call to Action" Animation
    Animated.loop(
      Animated.parallel([
        // Scale pulse (bigger emphasis)
        Animated.sequence([
          Animated.spring(buttonScaleAnim.current, {
            toValue: 1.08,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.spring(buttonScaleAnim.current, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        // Intense glow
        Animated.sequence([
          Animated.timing(buttonGlowAnim.current, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(buttonGlowAnim.current, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }),
        ]),
        // Shake effect for urgency
        Animated.sequence([
          Animated.timing(buttonShakeAnim.current, {
            toValue: 3,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(buttonShakeAnim.current, {
            toValue: -3,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(buttonShakeAnim.current, {
            toValue: 3,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(buttonShakeAnim.current, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.delay(1000),
        ]),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!loading && user && activeRole && isReady) {
      // User is logged in, navigate to appropriate home
      if (activeRole === 'trainer') {
        router.replace('/trainer/home');
      } else if (activeRole === 'trainee') {
        router.replace('/trainee/home');
      }
    }
  }, [loading, user, activeRole, isReady, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Animated Gradient Background */}
      <LinearGradient
        colors={['#FF6B1A', '#FF8C42', '#FFD700']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      >
        {/* Decorative circles */}
        <View style={[styles.decorCircle, styles.circle1]} />
        <View style={[styles.decorCircle, styles.circle2]} />
        <View style={[styles.decorCircle, styles.circle3]} />
      </LinearGradient>

      <View style={styles.content}>
        {/* Logo Section */}
        <Animated.View style={[styles.logoSection, { 
          transform: [
            { scale: logoScaleAnim.current },
            { 
              rotate: logoRotateAnim.current.interpolate({
                inputRange: [-1, 1],
                outputRange: ['-2deg', '2deg'],
              })
            },
            { translateY: logoJumpAnim.current }
          ] 
        }]}>
          <View style={styles.logoImageContainer}>
            <Image
              source={require('../assets/rapidreps-logo.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.taglineContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
              style={styles.taglineGradient}
            >
              <Text style={styles.tagline}>🔥 Your Workout, Delivered 🔥</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <View style={styles.featureCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.featureCardGradient}
            >
              <Ionicons name="search" size={32} color={Colors.white} />
              <Text style={styles.featureTitle}>Find Trainers</Text>
              <Text style={styles.featureText}>Certified pros near you</Text>
            </LinearGradient>
          </View>

          <View style={styles.featureCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.featureCardGradient}
            >
              <Ionicons name="flash" size={32} color={Colors.white} />
              <Text style={styles.featureTitle}>Book Instantly</Text>
              <Text style={styles.featureText}>Quick & easy booking</Text>
            </LinearGradient>
          </View>

          <View style={styles.featureCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.featureCardGradient}
            >
              <Ionicons name="cash" size={32} color={Colors.white} />
              <Text style={styles.featureTitle}>$1/Minute</Text>
              <Text style={styles.featureText}>Fair & transparent</Text>
            </LinearGradient>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={styles.buttonContainer}>
          <Animated.View style={{ 
            transform: [
              { scale: buttonScaleAnim.current },
              { translateX: buttonShakeAnim.current }
            ] 
          }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/auth/signup')}
            >
              <Animated.View
                style={[
                  styles.buttonGlowContainer,
                  {
                    shadowOpacity: buttonGlowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.6],
                    }),
                  },
                ]}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F0F0F0']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={20} color={Colors.primary} />
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 1000,
    opacity: 0.1,
  },
  circle1: {
    width: 300,
    height: 300,
    backgroundColor: Colors.white,
    top: -100,
    right: -100,
  },
  circle2: {
    width: 200,
    height: 200,
    backgroundColor: Colors.white,
    bottom: 100,
    left: -50,
  },
  circle3: {
    width: 150,
    height: 150,
    backgroundColor: Colors.white,
    top: height / 2,
    right: -30,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 50,
  },
  logoSection: {
    alignItems: 'center',
  },
  logoImageContainer: {
    width: width * 0.7,
    height: width * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  taglineContainer: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  taglineGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  tagline: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
  },
  featuresSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 20,
  },
  featureCard: {
    flex: 1,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featureCardGradient: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: 8,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 11,
    color: Colors.white,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.9,
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  buttonGlowContainer: {
    borderRadius: 16,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 15,
  },
  primaryButtonText: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  secondaryButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

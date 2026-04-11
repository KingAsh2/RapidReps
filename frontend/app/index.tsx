import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPillButton } from '../src/components/AnimatedPillButton';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const BRAND = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
};

const welcomeBackground = require('../assets/images/bg-battle-ropes.png');

export default function WelcomeScreen() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const videoRef = useRef<Video>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const videoFadeOut = useRef(new Animated.Value(1)).current;
  
  const pulseScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.6)).current;
  const headerShimmer = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-60)).current;
  const headerFade = useRef(new Animated.Value(0)).current;

  const combinedLogoScale = useRef(Animated.multiply(logoScale, pulseScale)).current;
  const animationsAlive = useRef(true);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      const hasSeenIntro = await AsyncStorage.getItem('has_seen_intro_video');
      if (!hasSeenIntro) {
        setShowVideo(true);
        setVideoVisible(true);
      }
      setIsReady(true);
    };
    checkFirstLaunch();
    return () => { animationsAlive.current = false; };
  }, []);

  useEffect(() => {
    if (!showVideo && isReady) {
      // Staggered cinematic entrance: header slides down first, then logo scales up
      Animated.sequence([
        // Step 1: Header slides down from top with fade
        Animated.parallel([
          Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(headerSlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        ]),
        // Step 2: Logo scales up from center + rest of content fades in
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
        ]),
      ]).start(() => {
        if (animationsAlive.current) startPulseAnimation();
      });
    }
  }, [showVideo, isReady]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.06, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 0.98, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.03, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(1800),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.9, duration: 200, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(headerShimmer, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(headerShimmer, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  };

  const handleFindTrainer = () => {
    router.push({ pathname: '/auth/signup', params: { role: 'trainee' } });
  };

  const handleBecomeTrainer = () => {
    router.push({ pathname: '/auth/signup', params: { role: 'trainer' } });
  };

  const handleVideoEnd = () => {
    AsyncStorage.setItem('has_seen_intro_video', 'true');
    Animated.timing(videoFadeOut, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
      setShowVideo(false);
      setVideoVisible(false);
    });
  };

  const handleSkipVideo = () => {
    AsyncStorage.setItem('has_seen_intro_video', 'true');
    Animated.timing(videoFadeOut, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowVideo(false);
      setVideoVisible(false);
    });
  };

  const headerGlowOpacity = headerShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={BRAND.orange} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {videoVisible && (
        <Animated.View style={[styles.videoContainer, { opacity: videoFadeOut }]}>
          <Video
            ref={videoRef}
            source={require('../assets/videos/intro.mp4')}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping={false}
            isMuted={false}
            useNativeControls={false}
            volume={1.0}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish) handleVideoEnd();
            }}
          />
          <TouchableOpacity onPress={handleSkipVideo} style={styles.skipButton} activeOpacity={0.8}>
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="arrow-forward" size={18} color={BRAND.white} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {!showVideo && (
        <ImageBackground source={welcomeBackground} style={styles.backgroundImage} resizeMode="cover">
          <LinearGradient
            colors={['rgba(255, 127, 0, 0.92)', 'rgba(255, 127, 0, 0.88)', 'rgba(255, 165, 38, 0.85)']}
            style={styles.overlay}
          />
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>

              {/* Header Logo — "Rapid Reps" stylized text slides down from top */}
              <Animated.View
                style={[
                  styles.headerLogoSection,
                  {
                    opacity: Animated.multiply(headerFade, headerGlowOpacity),
                    transform: [{ translateY: headerSlide }],
                  },
                ]}
              >
                <View style={styles.headerLogoGlow}>
                  <Image
                    source={require('../assets/rapidreps-header.png')}
                    style={styles.headerLogoImage}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              {/* Pulsating RR Icon Logo — fills entire circular frame */}
              <Animated.View
                style={[
                  styles.logoSection,
                  { opacity: fadeAnim, transform: [{ scale: combinedLogoScale }] },
                ]}
              >
                <Animated.View style={[styles.logoBacking, { opacity: glowOpacity }]}>
                  <Image
                    source={require('../assets/rapidreps-icon-logo.png')}
                    style={styles.logo}
                    resizeMode="cover"
                  />
                </Animated.View>
              </Animated.View>

              {/* Tagline */}
              <Animated.View
                style={[
                  styles.taglineSection,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <Text style={styles.tagline}>YOUR WORKOUT</Text>
                <View style={styles.taglineHighlight}>
                  <Text style={styles.taglineBold}>DELIVERED RAPIDLY</Text>
                </View>
              </Animated.View>

              {/* Value Props */}
              <Animated.View
                style={[
                  styles.valuePropsSection,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <View style={styles.valueProp}>
                  <View style={styles.valuePropIcon}>
                    <Ionicons name="location" size={22} color={BRAND.navy} />
                  </View>
                  <Text style={styles.valuePropText}>Trainers Near You</Text>
                </View>
                <View style={styles.valueProp}>
                  <View style={styles.valuePropIcon}>
                    <Ionicons name="flash" size={22} color={BRAND.navy} />
                  </View>
                  <Text style={styles.valuePropText}>Book Instantly</Text>
                </View>
                <View style={styles.valueProp}>
                  <View style={styles.valuePropIcon}>
                    <Ionicons name="shield-checkmark" size={22} color={BRAND.navy} />
                  </View>
                  <Text style={styles.valuePropText}>Verified Pros</Text>
                </View>
              </Animated.View>

              {/* CTA Buttons */}
              <Animated.View
                style={[
                  styles.ctaSection,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <AnimatedPillButton title="Find a Trainer" onPress={handleFindTrainer} variant="teal" icon="search" testID="find-trainer-btn" />
                <AnimatedPillButton title="Become a Trainer" onPress={handleBecomeTrainer} variant="navy" icon="barbell" testID="become-trainer-btn" />

                <Text style={styles.termsText}>
                  By continuing, you agree to our{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/legal/terms')}>Terms</Text> &{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text>
                </Text>

                <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.loginLinkContainer}>
                  <Text style={styles.loginLinkText}>
                    Already have an account? <Text style={styles.loginLinkBold}>Log In</Text>
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </SafeAreaView>
        </ImageBackground>
      )}
    </View>
  );
}

const LOGO_SIZE = Math.min(width * 0.52, 210);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.orange },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.orange },
  videoContainer: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, width: '100%', height: '100%' },
  skipButton: {
    position: 'absolute', top: 60, right: 20,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, gap: 6,
  },
  skipText: { color: BRAND.white, fontSize: 14, fontWeight: '600' },
  backgroundImage: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  safeArea: { flex: 1 },
  content: {
    flex: 1, paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 4, paddingBottom: 20,
  },

  /* Header Logo — Rapid Reps text at very top */
  headerLogoSection: { alignItems: 'center', marginTop: 0, marginBottom: 4 },
  headerLogoGlow: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
  },
  headerLogoImage: {
    width: width * 0.55, height: width * 0.18,
    maxWidth: 240, maxHeight: 80,
  },

  /* Pulsating Icon Logo (RR dumbbell) — fills circle */
  logoSection: { alignItems: 'center', marginTop: 0, justifyContent: 'center' },
  logoBacking: {
    width: LOGO_SIZE, height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 24, elevation: 10,
    overflow: 'hidden',
  },
  logo: {
    width: LOGO_SIZE, height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
  },

  taglineSection: { alignItems: 'center', marginTop: 8 },
  tagline: { fontSize: 20, fontWeight: '700', color: BRAND.white, letterSpacing: 2 },
  taglineHighlight: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  taglineBold: { fontSize: 26, fontWeight: '900', color: BRAND.navy, letterSpacing: 1 },
  valuePropsSection: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10 },
  valueProp: { alignItems: 'center', flex: 1 },
  valuePropIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: BRAND.white,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  valuePropText: { fontSize: 13, fontWeight: '700', color: BRAND.white, textAlign: 'center' },
  ctaSection: { gap: 14 },
  termsText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8 },
  termsLink: { textDecorationLine: 'underline', fontWeight: '600' },
  loginLinkContainer: { marginTop: 16, paddingVertical: 8 },
  loginLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  loginLinkBold: { fontWeight: '700', textDecorationLine: 'underline' },
});

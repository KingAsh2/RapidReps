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
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPillButton } from '../src/components/AnimatedPillButton';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height: screenHeight } = Dimensions.get('window');

const BRAND = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
};

const welcomeBackground = require('../assets/images/bg-battle-ropes.jpg');

export default function WelcomeScreen() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const videoRef = useRef<Video>(null);

  // ── Entrance Animations ──
  const headerSlam = useRef(new Animated.Value(-250)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerRotate = useRef(new Animated.Value(-12)).current;

  const logoScale = useRef(new Animated.Value(0)).current;
  const logoSpin = useRef(new Animated.Value(0)).current;
  const logoFade = useRef(new Animated.Value(0)).current;

  const flashOpacity = useRef(new Animated.Value(0)).current;

  const taglineFade = useRef(new Animated.Value(0)).current;
  const taglineSlide = useRef(new Animated.Value(40)).current;
  const propsFade = useRef(new Animated.Value(0)).current;
  const propsSlide = useRef(new Animated.Value(50)).current;
  const ctaFade = useRef(new Animated.Value(0)).current;
  const ctaSlide = useRef(new Animated.Value(60)).current;

  const videoFadeOut = useRef(new Animated.Value(1)).current;

  // ── Continuous Animations ──
  const pulseScale = useRef(new Animated.Value(1)).current;
  const headerShimmer = useRef(new Animated.Value(0)).current;
  const energyRing = useRef(new Animated.Value(0.5)).current;

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

  // ── Play THUNDER startup sound — high-energy crack + rolling rumble ──
  const playImpactSound = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/thunder.wav'),
        { volume: 1.0 }
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) { /* silent fail — sound is bonus */ }
  };

  useEffect(() => {
    if (!showVideo && isReady) {
      runEntranceAnimation();
    }
  }, [showVideo, isReady]);

  const runEntranceAnimation = () => {
    // Play impact sound at the moment of header slam
    setTimeout(() => playImpactSound(), 350);

    Animated.sequence([
      // ── PHASE 1: Header SLAMS down (250ms) ──
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(headerSlam, {
          toValue: 0, friction: 6, tension: 120, useNativeDriver: true,
        }),
        Animated.spring(headerRotate, {
          toValue: 0, friction: 8, tension: 100, useNativeDriver: true,
        }),
      ]),

      // ── PHASE 2: Impact flash + Logo EXPLODES in with spin (400ms) ──
      Animated.parallel([
        // Flash burst
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 0.45, duration: 80, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
        // Logo scale explosion with overshoot
        Animated.timing(logoFade, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(logoScale, {
          toValue: 1, friction: 4, tension: 80, useNativeDriver: true,
        }),
        // Logo spin (half rotation)
        Animated.timing(logoSpin, {
          toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true,
        }),
      ]),

      // ── PHASE 3: Content cascade — staggered entrance ──
      Animated.stagger(120, [
        Animated.parallel([
          Animated.timing(taglineFade, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(taglineSlide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(propsFade, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(propsSlide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ctaFade, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(ctaSlide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      if (animationsAlive.current) startContinuousAnimations();
    });
  };

  const startContinuousAnimations = () => {
    // Heartbeat pulse on logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 0.96, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(2000),
      ])
    ).start();

    // Header energy shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerShimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(headerShimmer, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Subtle energy ring pulse behind logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(energyRing, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(energyRing, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
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

  // ── Interpolations ──
  const headerRotateStr = headerRotate.interpolate({
    inputRange: [-12, 0],
    outputRange: ['-12deg', '0deg'],
  });
  const logoSpinStr = logoSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const headerGlow = headerShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
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
            colors={['rgba(255, 127, 0, 0.97)', 'rgba(255, 127, 0, 0.96)', 'rgba(255, 165, 38, 0.95)']}
            style={styles.overlay}
          />

          {/* Impact flash overlay */}
          <Animated.View
            style={[styles.flashOverlay, { opacity: flashOpacity }]}
            pointerEvents="none"
          />

          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>

              {/* Header — SLAMS down with rotation */}
              <Animated.View
                style={[
                  styles.headerLogoSection,
                  {
                    opacity: Animated.multiply(headerFade, headerGlow),
                    transform: [
                      { translateY: headerSlam },
                      { rotate: headerRotateStr },
                    ],
                  },
                ]}
              >
                <Image
                  source={require('../assets/rapidreps-header.png')}
                  style={styles.headerLogoImage}
                  resizeMode="contain"
                />
              </Animated.View>

              {/* Logo — EXPLODES in with spin + energy ring */}
              <Animated.View
                style={[
                  styles.logoSection,
                  {
                    opacity: logoFade,
                    transform: [
                      { scale: combinedLogoScale },
                      { rotate: logoSpinStr },
                    ],
                  },
                ]}
              >
                {/* Energy ring behind logo */}
                <View style={styles.logoBacking}>
                  <Image
                    source={require('../assets/rapidreps-icon-logo.png')}
                    style={styles.logo}
                    resizeMode="cover"
                  />
                </View>
              </Animated.View>

              {/* Tagline — slides up */}
              <Animated.View
                style={[
                  styles.taglineSection,
                  { opacity: taglineFade, transform: [{ translateY: taglineSlide }] },
                ]}
              >
                <Text style={styles.tagline}>YOUR WORKOUT</Text>
                <View style={styles.taglineHighlight}>
                  <Text style={styles.taglineBold}>DELIVERED RAPIDLY</Text>
                </View>
              </Animated.View>

              {/* Value Props — slides up */}
              <Animated.View
                style={[
                  styles.valuePropsSection,
                  { opacity: propsFade, transform: [{ translateY: propsSlide }] },
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

              {/* CTA Buttons — slides up */}
              <Animated.View
                style={[
                  styles.ctaSection,
                  { opacity: ctaFade, transform: [{ translateY: ctaSlide }] },
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

// Adaptive circle: maximize for large screens, safe on small ones
// iPhone 17 Pro Max: min(440*0.60, 956*0.24) = min(264, 229) → 229px ≈ 52% width
// iPhone SE: min(375*0.60, 667*0.24) = min(225, 160) → 160px ≈ 43% width  
const CIRCLE_SIZE = Math.min(width * 0.60, screenHeight * 0.24);
const LOGO_SCALE = 1.30;

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
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFD700',
    zIndex: 100,
  },
  content: {
    flex: 1, paddingHorizontal: 0,
    justifyContent: 'space-between',
    paddingTop: 0, paddingBottom: 16,
  },

  headerLogoSection: { alignItems: 'center', marginTop: -20, marginBottom: 0 },
  headerLogoImage: {
    width: width * 1.69,
    height: undefined,
    aspectRatio: 1179 / 442,
  },

  logoSection: { alignItems: 'center', marginTop: 0, justifyContent: 'center' },
  energyRingOuter: {
    position: 'absolute',
    width: CIRCLE_SIZE + 20,
    height: CIRCLE_SIZE + 20,
    borderRadius: (CIRCLE_SIZE + 20) / 2,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  logoBacking: {
    width: CIRCLE_SIZE, height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: CIRCLE_SIZE * LOGO_SCALE,
    height: CIRCLE_SIZE * LOGO_SCALE,
  },

  taglineSection: { alignItems: 'center', marginTop: 8, marginBottom: 14, paddingHorizontal: 24 },
  tagline: { fontSize: 20, fontWeight: '700', color: BRAND.white, letterSpacing: 2 },
  taglineHighlight: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  taglineBold: { fontSize: 26, fontWeight: '900', color: BRAND.navy, letterSpacing: 1 },
  valuePropsSection: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 24, marginBottom: 16 },
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
  ctaSection: { gap: 14, paddingHorizontal: 24 },
  termsText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8 },
  termsLink: { textDecorationLine: 'underline', fontWeight: '600' },
  loginLinkContainer: { marginTop: 16, paddingVertical: 8 },
  loginLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  loginLinkBold: { fontWeight: '700', textDecorationLine: 'underline' },
});

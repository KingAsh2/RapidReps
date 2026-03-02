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

const { width, height } = Dimensions.get('window');

// Brand Colors
const BRAND = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1FB8B4',
  navy: '#1a2a5e',
  white: '#FFFFFF',
};

// Welcome background image - Battle ropes (intense action for intro)
const welcomeBackground = require('../assets/images/bg-battle-ropes.png');

export default function WelcomeScreen() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const videoRef = useRef<Video>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const videoFadeOut = useRef(new Animated.Value(1)).current;
  
  // Electric pulse animations
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const ringScale1 = useRef(new Animated.Value(1)).current;
  const ringOpacity1 = useRef(new Animated.Value(0.5)).current;
  const ringScale2 = useRef(new Animated.Value(1)).current;
  const ringOpacity2 = useRef(new Animated.Value(0.5)).current;
  const glowIntensity = useRef(new Animated.Value(0)).current;

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
  }, []);

  useEffect(() => {
    if (!showVideo && isReady) {
      // Animate content in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Start electric pulse loop after intro animation
        startElectricPulse();
      });
    }
  }, [showVideo, isReady]);

  const startElectricPulse = () => {
    // Logo heartbeat pulse — quick energizing snap
    const logoPulse = () => {
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.08, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 0.97, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(1800),
      ]).start(() => logoPulse());
    };

    // Electric glow pulse on the backing
    const glowPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowIntensity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(glowIntensity, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(glowIntensity, { toValue: 0.8, duration: 200, useNativeDriver: true }),
          Animated.timing(glowIntensity, { toValue: 0, duration: 600, useNativeDriver: true }),
          Animated.delay(1200),
        ])
      ).start();
    };

    // Expanding ring wave 1
    const ringWave1 = () => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(ringScale1, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringOpacity1, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
      // Reset for next loop
      const interval = setInterval(() => {
        ringScale1.setValue(1);
        ringOpacity1.setValue(0.45);
      }, 1200);
      return interval;
    };

    // Expanding ring wave 2 (staggered)
    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(ringScale2, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringOpacity2, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
      setInterval(() => {
        ringScale2.setValue(1);
        ringOpacity2.setValue(0.35);
      }, 1200);
    }, 600);

    logoPulse();
    glowPulse();
    ringWave1();
  };

  const handleFindTrainer = () => {
    // Navigate to signup with trainee role pre-selected
    router.push({
      pathname: '/auth/signup',
      params: { role: 'trainee' }
    });
  };

  const handleBecomeTrainer = () => {
    // Navigate to signup with trainer role pre-selected
    router.push({
      pathname: '/auth/signup',
      params: { role: 'trainer' }
    });
  };

  const handleVideoEnd = () => {
    AsyncStorage.setItem('has_seen_intro_video', 'true');
    Animated.timing(videoFadeOut, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      setShowVideo(false);
      setVideoVisible(false);
    });
  };

  const handleSkipVideo = () => {
    AsyncStorage.setItem('has_seen_intro_video', 'true');
    Animated.timing(videoFadeOut, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowVideo(false);
      setVideoVisible(false);
    });
  };

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
      
      {/* Intro Video */}
      {videoVisible && (
        <Animated.View style={[styles.videoContainer, { opacity: videoFadeOut }]}>
          <Video
            ref={videoRef}
            source={require('../assets/videos/intro.mp4')}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={true}
            isLooping={false}
            isMuted={false}
            useNativeControls={false}
            volume={1.0}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish) {
                handleVideoEnd();
              }
            }}
          />
          
          {/* Skip Button */}
          <TouchableOpacity 
            onPress={handleSkipVideo}
            style={styles.skipButton}
            activeOpacity={0.8}
          >
            <Text style={styles.skipText}>Skip</Text>
            <Ionicons name="arrow-forward" size={18} color={BRAND.white} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Main Welcome Screen */}
      {!showVideo && (
        <ImageBackground 
          source={welcomeBackground} 
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(255, 127, 0, 0.92)', 'rgba(255, 127, 0, 0.88)', 'rgba(255, 165, 38, 0.85)']}
            style={styles.overlay}
          />
          
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>
              {/* Logo Section */}
              <Animated.View 
                style={[
                  styles.logoSection,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: Animated.multiply(logoScale, pulseScale) }],
                  }
                ]}
              >
                {/* Electric ring wave 1 */}
                <Animated.View style={[styles.electricRing, {
                  transform: [{ scale: ringScale1 }],
                  opacity: ringOpacity1,
                }]} />
                {/* Electric ring wave 2 (staggered) */}
                <Animated.View style={[styles.electricRing, styles.electricRing2, {
                  transform: [{ scale: ringScale2 }],
                  opacity: ringOpacity2,
                }]} />
                {/* Glow backing */}
                <Animated.View style={[styles.logoBacking, {
                  opacity: Animated.add(0.6, Animated.multiply(glowIntensity, 0.4)),
                }]}>
                  <Image
                    source={require('../assets/rapidreps-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </Animated.View>
              </Animated.View>

              {/* Tagline */}
              <Animated.View 
                style={[
                  styles.taglineSection,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
                ]}
              >
                <Text style={styles.tagline}>YOUR WORKOUT</Text>
                <View style={styles.taglineHighlight}>
                  <Text style={styles.taglineBold}>DELIVERED RAPIDLY</Text>
                  <Text style={styles.fireEmoji}>🔥</Text>
                </View>
              </Animated.View>

              {/* Value Props */}
              <Animated.View 
                style={[
                  styles.valuePropsSection,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
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
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
                ]}
              >
                {/* Find a Trainer Button */}
                <AnimatedPillButton
                  title="Find a Trainer"
                  onPress={handleFindTrainer}
                  variant="teal"
                  icon="search"
                  testID="find-trainer-btn"
                />

                {/* Become a Trainer Button */}
                <AnimatedPillButton
                  title="Become a Trainer"
                  onPress={handleBecomeTrainer}
                  variant="navy"
                  icon="barbell"
                  testID="become-trainer-btn"
                />

                {/* Terms */}
                <Text style={styles.termsText}>
                  By continuing, you agree to our{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/legal/terms')}>Terms</Text> &{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text>
                </Text>

                {/* Login Link */}
                <TouchableOpacity 
                  onPress={() => router.push('/auth/login')}
                  style={styles.loginLinkContainer}
                >
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.orange,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND.orange,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  skipText: {
    color: BRAND.white,
    fontSize: 14,
    fontWeight: '600',
  },
  backgroundImage: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 10,
    justifyContent: 'center',
  },
  electricRing: {
    position: 'absolute',
    width: 640,
    height: 640,
    borderRadius: 320,
    borderWidth: 2.5,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  electricRing2: {
    borderColor: '#FF7F00',
    borderWidth: 1.5,
    shadowColor: '#FF7F00',
  },
  logoBacking: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 320,
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: width * 1.4,
    height: width * 1.4,
    maxWidth: 560,
    maxHeight: 560,
  },
  taglineSection: {
    alignItems: 'center',
    marginTop: 12,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND.white,
    letterSpacing: 2,
  },
  taglineHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  taglineBold: {
    fontSize: 26,
    fontWeight: '900',
    color: BRAND.navy,
    letterSpacing: 1,
  },
  fireEmoji: {
    fontSize: 26,
    marginLeft: 8,
  },
  valuePropsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  valueProp: {
    alignItems: 'center',
    flex: 1,
  },
  valuePropIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  valuePropText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.white,
    textAlign: 'center',
  },
  ctaSection: {
    gap: 14,
  },
  primaryButton: {
    // Replaced by AnimatedPillButton
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.white,
    flex: 1,
    textAlign: 'center',
  },
  secondaryButton: {
    // Replaced by AnimatedPillButton
  },
  outlineButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  outlineButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.white,
    flex: 1,
    textAlign: 'center',
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
  },
  termsLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  loginLinkContainer: {
    marginTop: 16,
    paddingVertical: 8,
  },
  loginLinkText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  loginLinkBold: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

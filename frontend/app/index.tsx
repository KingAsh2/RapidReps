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
  const [showVideo, setShowVideo] = useState(true);
  const [videoVisible, setVideoVisible] = useState(true);
  const videoRef = useRef<Video>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const videoFadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
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
      ]).start();
    }
  }, [showVideo, isReady]);

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
            colors={['rgba(255, 127, 0, 0.85)', 'rgba(255, 127, 0, 0.75)', 'rgba(255, 165, 38, 0.7)']}
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
                    transform: [{ scale: logoScale }],
                  }
                ]}
              >
                <View style={styles.logoBacking}>
                  <Image
                    source={require('../assets/rapidreps-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
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
                <TouchableOpacity
                  onPress={handleFindTrainer}
                  style={styles.primaryButton}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={[BRAND.teal, '#18A09D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <Ionicons name="search" size={24} color={BRAND.white} />
                    <Text style={styles.buttonText}>Find a Trainer</Text>
                    <Ionicons name="arrow-forward" size={20} color={BRAND.white} />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Become a Trainer Button */}
                <TouchableOpacity
                  onPress={handleBecomeTrainer}
                  style={styles.secondaryButton}
                  activeOpacity={0.9}
                >
                  <View style={styles.outlineButtonInner}>
                    <Ionicons name="barbell" size={24} color={BRAND.white} />
                    <Text style={styles.outlineButtonText}>Become a Trainer</Text>
                    <Ionicons name="arrow-forward" size={20} color={BRAND.white} />
                  </View>
                </TouchableOpacity>

                {/* Terms */}
                <Text style={styles.termsText}>
                  By continuing, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms</Text> &{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
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
    marginTop: 20,
  },
  logoBacking: {
    backgroundColor: 'rgba(255, 127, 0, 1)',
    borderRadius: 140,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.65,
    height: width * 0.65,
    maxWidth: 280,
    maxHeight: 280,
  },
  taglineSection: {
    alignItems: 'center',
    marginTop: -20,
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
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
    borderRadius: 16,
    borderWidth: 2,
    borderColor: BRAND.white,
    overflow: 'hidden',
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

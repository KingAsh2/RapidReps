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
  Pressable,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { Colors } from '../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { setDemoMode } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [showTransition, setShowTransition] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<Video>(null);
  
  // Transition animation values
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  
  // DELIVERED RAPIDLY animation values
  const phraseScale = useRef(new Animated.Value(1)).current;
  const phraseRotate = useRef(new Animated.Value(0)).current;
  const flameScale = useRef(new Animated.Value(1)).current;
  const flameRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Smooth energetic animation for "DELIVERED RAPIDLY" phrase
  useEffect(() => {
    const createPhraseAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(phraseScale, {
              toValue: 1.15,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(phraseRotate, {
              toValue: 2,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(phraseScale, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(phraseRotate, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(400),
        ])
      );
    };

    const createFlameAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(flameScale, {
              toValue: 1.4,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(flameRotate, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.spring(flameScale, {
              toValue: 1,
              friction: 4,
              tension: 80,
              useNativeDriver: true,
            }),
            Animated.timing(flameRotate, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(flameScale, {
              toValue: 1.2,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(flameScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.delay(600),
        ])
      );
    };

    const phraseAnim = createPhraseAnimation();
    const flameAnim = createFlameAnimation();
    
    phraseAnim.start();
    flameAnim.start();

    return () => {
      phraseAnim.stop();
      flameAnim.stop();
    };
  }, []);

  const handleBeginAsTrainee = () => {
    if (setDemoMode) {
      setDemoMode('trainee');
    }
    router.replace('/trainee/(tabs)/home');
  };

  const handleBeginAsTrainer = () => {
    if (setDemoMode) {
      setDemoMode('trainer');
    }
    router.replace('/trainer/home');
  };

  const handleVideoEnd = () => {
    setVideoEnded(true);
    setShowTransition(true);
    
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1.2,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 40,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setTimeout(() => {
        setShowVideo(false);
        setShowTransition(false);
      }, 100);
    });
  };

  const handleSkipVideo = () => {
    setShowVideo(false);
  };

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Intro Video */}
      {showVideo && (
        <View style={styles.videoContainer}>
          <View style={styles.videoWrapper}>
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
                if (status.isLoaded && status.didJustFinish) {
                  handleVideoEnd();
                }
              }}
            />
          </View>
          
          {/* Skip Button */}
          <Pressable 
            onPress={handleSkipVideo}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>SKIP</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.white} />
          </Pressable>
        </View>
      )}

      {/* Transition Layer */}
      {showTransition && (
        <Animated.View 
          style={[
            styles.transitionContainer,
            { opacity: backgroundOpacity }
          ]}
        >
          <LinearGradient
            colors={Colors.gradientOrangeStart}
            style={StyleSheet.absoluteFillObject}
          />
          
          <Animated.View
            style={[
              styles.transitionFullScreenLogo,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../assets/rapidreps-logo.png')}
              style={styles.transitionLogoFull}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
      )}

      {/* Welcome Screen (shows after transition) */}
      {!showVideo && !showTransition && (
        <>
          {/* BACKGROUND - Solid Orange */}
          <View style={styles.backgroundOrange} />
          
          {/* MAIN CONTENT */}
          <View style={styles.content}>
            {/* LOGO SECTION */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/rapidreps-logo.png')}
                style={styles.logoLarge}
                resizeMode="contain"
              />
            </View>

            {/* BRAND TEXT */}
            <View style={styles.brandSection}>
              <Text style={styles.slogan}>YOUR WORKOUT,</Text>
              <Animated.View 
                style={[
                  styles.animatedPhraseContainer,
                  {
                    transform: [
                      { scale: phraseScale },
                      { 
                        rotate: phraseRotate.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '2deg']
                        })
                      }
                    ]
                  }
                ]}
              >
                <Text style={styles.sloganBold}>DELIVERED RAPIDLY</Text>
                <Animated.Text 
                  style={[
                    styles.flameEmoji,
                    {
                      transform: [
                        { scale: flameScale },
                        { 
                          rotate: flameRotate.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '-15deg']
                          })
                        }
                      ]
                    }
                  ]}
                >
                  🔥
                </Animated.Text>
              </Animated.View>
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

            {/* CTA BUTTONS - Begin as Trainee or Trainer */}
            <View style={styles.ctaContainer}>
              {/* Begin as Trainee Button */}
              <TouchableOpacity
                onPress={handleBeginAsTrainee}
                style={styles.primaryButton}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[Colors.teal || '#1FB8B4', '#22C1C3']}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="fitness" size={28} color={Colors.white} />
                  <Text style={styles.buttonText}>FIND A TRAINER 🏋️</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Begin as Trainer Button */}
              <TouchableOpacity
                onPress={handleBeginAsTrainer}
                style={styles.secondaryButton}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[Colors.secondary, Colors.primary]}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="barbell" size={28} color={Colors.white} />
                  <Text style={styles.buttonText}>BECOME A TRAINER 💪</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: width,
    height: height,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    zIndex: 10,
  },
  skipText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  transitionContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  transitionFullScreenLogo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  transitionLogoFull: {
    width: width * 0.8,
    height: height * 0.5,
    maxWidth: 500,
    maxHeight: 500,
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoLarge: {
    width: 280,
    height: 280,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  slogan: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  animatedPhraseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  sloganBold: {
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    color: Colors.navy,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: -1, height: -1 },
    textShadowRadius: 0,
  },
  flameEmoji: {
    fontSize: 24,
    marginLeft: 6,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 10,
  },
  featureCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 12,
    alignItems: 'center',
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  featureIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.secondary,
    borderWidth: 3,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.navy,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  featureText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  ctaContainer: {
    marginTop: 'auto',
    gap: 16,
  },
  primaryButton: {
    width: '100%',
    height: 65,
    borderRadius: 18,
    overflow: 'hidden',
  },
  secondaryButton: {
    width: '100%',
    height: 65,
    borderRadius: 18,
    overflow: 'hidden',
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 4,
    borderColor: Colors.navy,
    borderRadius: 18,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
    textShadowColor: Colors.navy,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

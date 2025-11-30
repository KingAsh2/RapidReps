import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';

export default function VirtualConfirmScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isHolding, setIsHolding] = useState(false);
  const [booking, setBooking] = useState(false);
  
  const pressProgress = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const handlePressIn = () => {
    if (booking) return;
    
    setIsHolding(true);
    
    // Animate progress circle
    Animated.timing(pressProgress, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false,
    }).start();
    
    // Complete action after 1.5 seconds
    pressTimer.current = setTimeout(() => {
      handleLockIn();
    }, 1500);
  };

  const handlePressOut = () => {
    setIsHolding(false);
    
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    
    Animated.timing(pressProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleLockIn = async () => {
    setBooking(true);
    setIsHolding(false);
    pressProgress.setValue(0);
    
    // Navigate to payment screen
    // After payment, the session will be created with virtual flag
    router.push({
      pathname: '/trainee/payment',
      params: {
        amount: 18,
        sessionType: 'virtual',
        duration: 30,
      },
    });
  };

  const circleProgress = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Back Button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={Colors.navy} />
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="videocam" size={80} color={Colors.secondary} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Virtual Live Video</Text>
        <Text style={styles.subtitle}>TRAINING SESSION</Text>

        {/* Price Card */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Session Price</Text>
          <Text style={styles.priceAmount}>$18</Text>
          <Text style={styles.priceDuration}>for 30 minutes</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.secondary} />
            <Text style={styles.featureText}>Instant trainer matching</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.secondary} />
            <Text style={styles.featureText}>High-quality Zoom video</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.secondary} />
            <Text style={styles.featureText}>Train from anywhere</Text>
          </View>
        </View>

        {/* Lock In Button */}
        <View style={styles.lockInContainer}>
          <Text style={styles.instructionText}>
            {isHolding ? 'Keep holding...' : 'Press & hold to begin'}
          </Text>
          
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={booking}
            style={styles.lockInButton}
          >
            <LinearGradient
              colors={booking ? ['#CCCCCC', '#999999'] : [Colors.secondary, Colors.primary]}
              style={styles.buttonGradient}
            >
              {/* Progress Circle */}
              <View style={styles.progressCircle}>
                <Animated.View
                  style={[
                    styles.progressArc,
                    {
                      transform: [{
                        rotate: circleProgress,
                      }],
                    },
                  ]}
                />
              </View>

              {/* Button Content */}
              <View style={styles.buttonContent}>
                {booking ? (
                  <Text style={styles.buttonText}>Processing...</Text>
                ) : (
                  <>
                    <Text style={styles.buttonText}>LOCK IN 💪🏾</Text>
                    <Text style={styles.buttonSubtext}>Hold for 1.5s</Text>
                  </>
                )}
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    borderWidth: 3,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.white,
    borderWidth: 4,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.navy,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 32,
  },
  priceCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    minWidth: '80%',
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 64,
    fontWeight: '900',
    color: Colors.secondary,
    lineHeight: 64,
  },
  priceDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 4,
  },
  featuresContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  lockInContainer: {
    width: '100%',
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 16,
    textAlign: 'center',
  },
  lockInButton: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 24,
    borderWidth: 4,
    borderColor: Colors.navy,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressCircle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  progressArc: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 6,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderRightColor: 'rgba(255, 255, 255, 0.5)',
  },
  buttonContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
  },
  buttonSubtext: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
    marginTop: 4,
    opacity: 0.9,
  },
});

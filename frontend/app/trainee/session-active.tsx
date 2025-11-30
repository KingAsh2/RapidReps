import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trainerAPI } from '../../src/services/api';

export default function SessionActiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const sessionId = params.sessionId as string;
  const trainerId = params.trainerId as string;
  const trainerName = params.trainerName as string;
  const durationMinutes = parseInt(params.duration as string) || 30;
  const zoomLink = params.zoomLink as string;

  const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60); // seconds
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    // Start countdown timer
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSessionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJoinZoom = async () => {
    try {
      // Check if link is valid
      const canOpen = await Linking.canOpenURL(zoomLink);
      
      if (canOpen) {
        await Linking.openURL(zoomLink);
      } else {
        Alert.alert('Invalid Link', 'Unable to open Zoom link. Please contact support.');
      }
    } catch (error) {
      console.error('Error opening Zoom link:', error);
      Alert.alert('Error', 'Unable to join Zoom meeting. Please try again.');
    }
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Session?',
      'Are you sure you want to end this session early?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: handleSessionEnd,
        },
      ]
    );
  };

  const handleSessionEnd = async () => {
    setIsEnding(true);
    
    try {
      // Mark session as completed
      await trainerAPI.completeSession(sessionId);
      
      // Navigate to session complete screen
      router.replace({
        pathname: '/trainee/session-complete',
        params: {
          sessionId,
          trainerId,
          trainerName,
          duration: durationMinutes,
        },
      });
    } catch (error) {
      console.error('Error ending session:', error);
      // Navigate anyway
      router.replace({
        pathname: '/trainee/session-complete',
        params: {
          sessionId,
          trainerId,
          trainerName,
          duration: durationMinutes,
        },
      });
    }
  };

  const progress = 1 - (timeRemaining / (durationMinutes * 60));
  const progressPercentage = Math.round(progress * 100);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Session Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="videocam" size={80} color={Colors.secondary} />
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Session Info */}
        <View style={styles.infoCard}>
          <Text style={styles.sessionTitle}>Virtual Training Session</Text>
          <Text style={styles.trainerName}>with {trainerName}</Text>
          
          {/* Timer */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>Time Remaining</Text>
            <Text style={styles.timerValue}>{formatTime(timeRemaining)}</Text>
            
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View 
                style={[styles.progressBar, { width: `${progressPercentage}%` }]} 
              />
            </View>
            <Text style={styles.progressText}>{progressPercentage}% Complete</Text>
          </View>
        </View>

        {/* Join Zoom Button */}
        <Pressable onPress={handleJoinZoom} style={styles.zoomButton}>
          <LinearGradient
            colors={[Colors.secondary, Colors.primary]}
            style={styles.zoomButtonGradient}
          >
            <Ionicons name="videocam" size={28} color={Colors.white} />
            <Text style={styles.zoomButtonText}>Join Zoom Meeting</Text>
          </LinearGradient>
        </Pressable>

        {/* Session Tips */}
        <View style={styles.tipsContainer}>
          <View style={styles.tip}>
            <Ionicons name="mic" size={20} color={Colors.white} />
            <Text style={styles.tipText}>Keep your microphone on</Text>
          </View>
          <View style={styles.tip}>
            <Ionicons name="videocam" size={20} color={Colors.white} />
            <Text style={styles.tipText}>Ensure good lighting</Text>
          </View>
          <View style={styles.tip}>
            <Ionicons name="wifi" size={20} color={Colors.white} />
            <Text style={styles.tipText}>Stable internet connection</Text>
          </View>
        </View>

        {/* End Session Button */}
        <Pressable 
          onPress={handleEndSession} 
          disabled={isEnding}
          style={styles.endButton}
        >
          <View style={styles.endButtonContent}>
            <Ionicons name="stop-circle-outline" size={24} color={Colors.danger} />
            <Text style={styles.endButtonText}>End Session Early</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.white,
    borderWidth: 4,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.navy,
    marginTop: -20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  liveText: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 24,
    marginBottom: 24,
  },
  sessionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  timerContainer: {
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.secondary,
    lineHeight: 48,
    marginBottom: 16,
  },
  progressBarContainer: {
    width: '100%',
    height: 12,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.navy,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.secondary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  zoomButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  zoomButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    borderRadius: 20,
    gap: 12,
  },
  zoomButtonText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  tipsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tipText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  endButton: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.danger,
    padding: 16,
  },
  endButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.danger,
  },
});

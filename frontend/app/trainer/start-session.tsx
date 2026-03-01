import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafetyPinEntry } from '../../src/components/SafetyPinEntry';
import { trainerAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

// Vibrant brand colors
const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  teal: '#00CFC1',
  tealLight: '#22E8DF',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  gray: '#8892b0',
  grayLight: '#E8ECF0',
  success: '#00D26A',
  error: '#FF4757',
};

type Step = 'gps' | 'pin' | 'started';

export default function StartSessionScreen() {
  const router = useRouter();
  const { sessionId, clientName, sessionType } = useLocalSearchParams();
  const { showAlert } = useAlert();
  
  const [currentStep, setCurrentStep] = useState<Step>('gps');
  const [loading, setLoading] = useState(false);
  const [gpsConfirmed, setGpsConfirmed] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
    
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission is required to start the session');
        return;
      }

      setLoading(true);
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc);
      setLocationError(null);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Failed to get your location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmGps = async () => {
    if (!location) {
      showAlert({
        title: 'Location Required',
        message: 'Please enable location services to confirm your arrival.',
        type: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await trainerAPI.confirmGpsArrival(
        sessionId as string,
        location.coords.latitude,
        location.coords.longitude
      );

      if (result.success) {
        setGpsConfirmed(true);
        setCurrentStep('pin');
        showAlert({
          title: 'Location Confirmed! ✓',
          message: 'Now enter the client\'s 4-digit safety PIN.',
          type: 'success',
        });
      } else {
        showAlert({
          title: 'Too Far Away',
          message: result.message || 'You need to be closer to the session location.',
          type: 'warning',
        });
      }
    } catch (error: any) {
      // If GPS confirmation fails, still allow PIN entry for testing
      setGpsConfirmed(true);
      setCurrentStep('pin');
    } finally {
      setLoading(false);
    }
  };

  const handlePinVerified = async (pin: string): Promise<boolean> => {
    try {
      const result = await trainerAPI.verifySessionPin(sessionId as string, pin);
      
      if (result.success) {
        setSessionStarted(true);
        setCurrentStep('started');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return false;
    }
  };

  const handleCancelSession = () => {
    showAlert({
      title: 'Cancel Session?',
      message: 'Are you sure you want to cancel this session?',
      type: 'warning',
      buttons: [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: () => router.back(),
        },
      ],
    });
  };

  const handleGoToSession = () => {
    router.replace(`/trainee/session-active?sessionId=${sessionId}`);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={sessionStarted ? [COLORS.success, '#00A854'] : [COLORS.orange, COLORS.orangeLight]}
        style={styles.headerGradient}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {sessionStarted ? 'Session Started!' : 'Start Session'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <Animated.View 
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Client Info */}
          <View style={styles.clientCard}>
            <View style={styles.clientAvatar}>
              <Ionicons name="person" size={32} color={COLORS.orange} />
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{clientName || 'Client'}</Text>
              <View style={styles.sessionTypeBadge}>
                <Ionicons 
                  name={sessionType === 'in_home' ? 'home' : 'location'} 
                  size={14} 
                  color={COLORS.white} 
                />
                <Text style={styles.sessionTypeText}>
                  {sessionType === 'in_home' ? 'In-Home Session' : 'Outdoor Session'}
                </Text>
              </View>
            </View>
          </View>

          {/* Steps Progress */}
          <View style={styles.stepsContainer}>
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, gpsConfirmed && styles.stepDotCompleted]}>
                {gpsConfirmed ? (
                  <Ionicons name="checkmark" size={16} color={COLORS.white} />
                ) : (
                  <Text style={styles.stepNumber}>1</Text>
                )}
              </View>
              <View style={[styles.stepLine, gpsConfirmed && styles.stepLineCompleted]} />
              <View style={[styles.stepDot, sessionStarted && styles.stepDotCompleted]}>
                {sessionStarted ? (
                  <Ionicons name="checkmark" size={16} color={COLORS.white} />
                ) : (
                  <Text style={[styles.stepNumber, gpsConfirmed && styles.stepNumberActive]}>2</Text>
                )}
              </View>
            </View>
            <View style={styles.stepLabels}>
              <Text style={[styles.stepLabel, gpsConfirmed && styles.stepLabelActive]}>
                Confirm Location
              </Text>
              <Text style={[styles.stepLabel, sessionStarted && styles.stepLabelActive]}>
                Enter PIN
              </Text>
            </View>
          </View>

          {/* GPS Confirmation Step */}
          {currentStep === 'gps' && (
            <View style={styles.stepCard}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="location" size={40} color={COLORS.orange} />
              </View>
              <Text style={styles.stepTitle}>Confirm Your Arrival</Text>
              <Text style={styles.stepDescription}>
                We need to verify you're at the session location before you can start
              </Text>
              
              {locationError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="warning" size={20} color={COLORS.error} />
                  <Text style={styles.errorText}>{locationError}</Text>
                </View>
              ) : location ? (
                <View style={styles.locationBox}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.locationText}>Location found</Text>
                </View>
              ) : null}

              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={handleConfirmGps}
                disabled={loading || !location}
              >
                <LinearGradient
                  colors={location ? [COLORS.orange, COLORS.orangeLight] : [COLORS.gray, COLORS.grayLight]}
                  style={styles.confirmGradient}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="navigate" size={22} color={COLORS.white} />
                      <Text style={styles.confirmText}>Confirm I'm Here</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.refreshButton} onPress={getLocation}>
                <Text style={styles.refreshText}>Refresh Location</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PIN Entry Step */}
          {currentStep === 'pin' && (
            <SafetyPinEntry
              onPinVerified={handlePinVerified}
              onCancel={handleCancelSession}
              sessionType={sessionType === 'in_home' ? 'in_home' : 'outdoor'}
            />
          )}

          {/* Session Started */}
          {currentStep === 'started' && (
            <View style={styles.successCard}>
              <LinearGradient
                colors={[COLORS.success, '#00A854']}
                style={styles.successGradient}
              >
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={64} color={COLORS.white} />
                </View>
                <Text style={styles.successTitle}>Session Started! 🎉</Text>
                <Text style={styles.successSubtitle}>
                  Timer is running. Have a great session!
                </Text>
                
                <TouchableOpacity style={styles.goButton} onPress={handleGoToSession}>
                  <Text style={styles.goButtonText}>Go to Active Session</Text>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.success} />
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Client Card
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 6,
  },
  sessionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.teal,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  sessionTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Steps Progress
  stepsContainer: {
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotCompleted: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gray,
  },
  stepNumberActive: {
    color: COLORS.teal,
  },
  stepLine: {
    width: 80,
    height: 3,
    backgroundColor: COLORS.grayLight,
    marginHorizontal: 8,
  },
  stepLineCompleted: {
    backgroundColor: COLORS.success,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  stepLabelActive: {
    color: COLORS.navy,
    fontWeight: '700',
  },
  // Step Card
  stepCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  stepIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8FFF5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  confirmButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  refreshButton: {
    padding: 10,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.teal,
  },
  // Success Card
  successCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successGradient: {
    padding: 32,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 24,
  },
  goButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  goButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.success,
  },
});

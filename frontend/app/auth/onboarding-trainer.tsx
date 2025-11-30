import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { trainerAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainingStyles } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

export default function TrainerOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    bio: '',
    experienceYears: '',
    certifications: '',
    trainingStyles: [] as string[],
    gymsWorkedAt: '',
    primaryGym: '',
    offersInPerson: true,
    offersVirtual: false,
    sessionDurations: [30, 45, 60],
    ratePerMinuteCents: 100,
    travelRadiusMiles: 10,
    cancellationPolicy: 'Free cancellation before 24 hours',
    latitude: null as number | null,
    longitude: null as number | null,
    locationAddress: '',
  });

  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    // Auto-request location on mount
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        await getCurrentLocation();
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const { latitude, longitude } = location.coords;
      
      // Reverse geocode to get address
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (addresses[0]) {
        const addr = addresses[0];
        const locationAddress = `${addr.city || ''}, ${addr.region || ''}`;
        setFormData(prev => ({
          ...prev,
          latitude,
          longitude,
          locationAddress,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          latitude,
          longitude,
        }));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get your location. You can enter it manually in Step 4.');
    } finally {
      setLocationLoading(false);
    }
  };

  const toggleStyle = (style: string) => {
    if (formData.trainingStyles.includes(style)) {
      setFormData({
        ...formData,
        trainingStyles: formData.trainingStyles.filter(s => s !== style),
      });
    } else {
      setFormData({
        ...formData,
        trainingStyles: [...formData.trainingStyles, style],
      });
    }
  };

  const toggleDuration = (duration: number) => {
    if (formData.sessionDurations.includes(duration)) {
      setFormData({
        ...formData,
        sessionDurations: formData.sessionDurations.filter(d => d !== duration),
      });
    } else {
      setFormData({
        ...formData,
        sessionDurations: [...formData.sessionDurations, duration],
      });
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'User not found. Please log in again.');
      return;
    }

    setLoading(true);
    try {
      const certList = formData.certifications
        .split(',')
        .map(c => c.trim())
        .filter(c => c);
      const gymsList = formData.gymsWorkedAt
        .split(',')
        .map(g => g.trim())
        .filter(g => g);

      console.log('Creating trainer profile...');
      
      await trainerAPI.createProfile({
        userId: user.id,
        bio: formData.bio,
        experienceYears: parseInt(formData.experienceYears) || 0,
        certifications: certList,
        trainingStyles: formData.trainingStyles,
        gymsWorkedAt: gymsList,
        primaryGym: formData.primaryGym,
        offersInPerson: formData.offersInPerson,
        offersVirtual: formData.offersVirtual,
        sessionDurationsOffered: formData.sessionDurations,
        ratePerMinuteCents: 100, // Default $1/min
        travelRadiusMiles: formData.travelRadiusMiles,
        cancellationPolicy: 'Free cancellation before 24 hours', // Default policy
        latitude: formData.latitude,
        longitude: formData.longitude,
        locationAddress: formData.locationAddress,
        isAvailable: true,
        isVirtualTrainingAvailable: formData.offersVirtual,
      });

      console.log('Profile created successfully!');
      
      setLoading(false);
      
      Alert.alert(
        'Success! 🎉',
        'Your trainer profile has been created! Ready to connect with trainees.',
        [
          { 
            text: 'Get Started', 
            onPress: () => {
              console.log('Navigating to trainer home...');
              router.replace('/trainer/home');
            }
          },
        ]
      );
    } catch (error: any) {
      console.error('Profile creation error:', error);
      setLoading(false);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create profile. Please try again.');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell us about yourself</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
                placeholder="Tell trainees who you are in 2-3 sentences..."
                placeholderTextColor={Colors.textLight}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Years of Experience</Text>
              <TextInput
                style={styles.input}
                value={formData.experienceYears}
                onChangeText={(text) => setFormData({ ...formData, experienceYears: text })}
                placeholder="5"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Certifications (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={formData.certifications}
                onChangeText={(text) => setFormData({ ...formData, certifications: text })}
                placeholder="NASM CPT, ISSA, ACE"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Training Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>What training styles do you offer?</Text>
              <View style={styles.chipContainer}>
                {TrainingStyles.map((style) => (
                  <TouchableOpacity
                    key={style}
                    style={[
                      styles.chip,
                      formData.trainingStyles.includes(style) && styles.chipSelected,
                    ]}
                    onPress={() => toggleStyle(style)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        formData.trainingStyles.includes(style) && styles.chipTextSelected,
                      ]}
                    >
                      {style}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Session Format</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    formData.offersInPerson && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, offersInPerson: !formData.offersInPerson })}
                >
                  <Ionicons
                    name="location"
                    size={20}
                    color={formData.offersInPerson ? Colors.white : Colors.navy}
                  />
                  <Text
                    style={[
                      styles.toggleButtonText,
                      formData.offersInPerson && styles.toggleButtonTextActive,
                    ]}
                  >
                    In-Person
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    formData.offersVirtual && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, offersVirtual: !formData.offersVirtual })}
                >
                  <Ionicons
                    name="videocam"
                    size={20}
                    color={formData.offersVirtual ? Colors.white : Colors.navy}
                  />
                  <Text
                    style={[
                      styles.toggleButtonText,
                      formData.offersVirtual && styles.toggleButtonTextActive,
                    ]}
                  >
                    Virtual
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Gyms & Location</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gyms You Work At (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={formData.gymsWorkedAt}
                onChangeText={(text) => setFormData({ ...formData, gymsWorkedAt: text })}
                placeholder="Gold's Gym, LA Fitness, Equinox"
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Gym</Text>
              <TextInput
                style={styles.input}
                value={formData.primaryGym}
                onChangeText={(text) => setFormData({ ...formData, primaryGym: text })}
                placeholder="Gold's Gym Downtown"
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Travel Radius (miles)</Text>
              <TextInput
                style={styles.input}
                value={formData.travelRadiusMiles.toString()}
                onChangeText={(text) => setFormData({ ...formData, travelRadiusMiles: parseInt(text) || 10 })}
                placeholder="10"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Your Location 📍</Text>
                {locationLoading && <ActivityIndicator size="small" color={Colors.primary} />}
              </View>
              <TextInput
                style={styles.input}
                value={formData.locationAddress}
                onChangeText={(text) => setFormData({ ...formData, locationAddress: text })}
                placeholder="City, State"
                placeholderTextColor={Colors.textLight}
              />
              <TouchableOpacity 
                style={styles.locationButton} 
                onPress={getCurrentLocation}
                disabled={locationLoading}
              >
                <Ionicons name="locate" size={20} color={Colors.white} />
                <Text style={styles.locationButtonText}>
                  {locationLoading ? 'Getting location...' : 'Use GPS Location'}
                </Text>
              </TouchableOpacity>
              {formData.latitude && formData.longitude && (
                <Text style={styles.helpText}>
                  ✓ Location captured: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                </Text>
              )}
              <Text style={styles.helpText}>
                Important: Setting your location makes you visible to nearby trainees!
              </Text>
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Pricing & Sessions</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Session Durations You Offer</Text>
              <View style={styles.durationContainer}>
                {[30, 45, 60].map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationChip,
                      formData.sessionDurations.includes(duration) && styles.durationChipSelected,
                    ]}
                    onPress={() => toggleDuration(duration)}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        formData.sessionDurations.includes(duration) && styles.durationChipTextSelected,
                      ]}
                    >
                      {duration} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.title}>Trainer Setup</Text>
        <Text style={styles.subtitle}>
          Step {step} of {totalSteps}
        </Text>
        <View style={styles.progressBar}>
          {[...Array(totalSteps)].map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index < step && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
      </LinearGradient>

      {/* Form */}
      <ScrollView style={styles.scrollView}>
        {renderStep()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          <Text style={styles.nextButtonText}>
            {loading ? 'Saving...' : step === totalSteps ? 'Finish' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
    marginBottom: 16,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.white,
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  stepContent: {
    padding: 24,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.navy,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.navy,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  locationButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: Colors.navy,
  },
  chipTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
  },
  toggleButtonTextActive: {
    color: Colors.white,
  },
  durationContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  durationChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  durationChipText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.navy,
  },
  durationChipTextSelected: {
    color: Colors.white,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.navy,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.navy,
  },
  nextButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

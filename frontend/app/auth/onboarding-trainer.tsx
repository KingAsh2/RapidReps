import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { trainerAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainingStyles } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

// Background image
const backgroundImage = require('../../assets/images/bg-battle-ropes.png');

export default function TrainerOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    profilePhoto: '',
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

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      showAlert({
        title: 'Permission Required',
        message: 'Camera roll permission is required!',
        type: 'warning',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setFormData({ ...formData, profilePhoto: `data:image/jpeg;base64,${result.assets[0].base64}` });
    }
  };

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
      showAlert({
        title: 'Location Error',
        message: 'Could not get your location. You can enter it manually in Step 4.',
        type: 'warning',
      });
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

  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      showAlert({
        title: 'Authentication Error',
        message: 'User not found. Please log in again.',
        type: 'error',
      });
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
        profilePhoto: formData.profilePhoto,
        bio: formData.bio,
        experienceYears: parseInt(formData.experienceYears) || 0,
        certifications: certList,
        trainingStyles: formData.trainingStyles,
        gymsWorkedAt: gymsList,
        primaryGym: formData.primaryGym,
        offersInPerson: formData.offersInPerson,
        offersVirtual: formData.offersVirtual,
        sessionDurationsOffered: formData.sessionDurations,
        ratePerMinuteCents: 100,
        travelRadiusMiles: formData.travelRadiusMiles,
        cancellationPolicy: 'Free cancellation before 24 hours',
        latitude: formData.latitude,
        longitude: formData.longitude,
        locationAddress: formData.locationAddress,
        isAvailable: true,
        isVirtualTrainingAvailable: formData.offersVirtual,
      });

      console.log('Profile created successfully!');
      setLoading(false);
      setShowVerificationModal(true);
    } catch (error: any) {
      console.error('Profile creation error:', error);
      setLoading(false);
      showAlert({
        title: 'Profile Creation Failed',
        message: error.response?.data?.detail || 'Failed to create profile. Please try again.',
        type: 'error',
      });
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell us about yourself</Text>
            
            {/* Profile Photo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Profile Photo</Text>
              <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
                {formData.profilePhoto ? (
                  <Image source={{ uri: formData.profilePhoto }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera" size={40} color={Colors.textLight} />
                    <Text style={styles.photoPlaceholderText}>Tap to add photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

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
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(247, 147, 30, 0.92)', 'rgba(255, 106, 0, 0.88)']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Trainer Setup</Text>
            <Text style={styles.subtitle}>
              Step {step} of {totalSteps}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
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
      </SafeAreaView>

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

      {/* Post-Signup Verification Modal */}
      <Modal visible={showVerificationModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="checkmark-circle" size={56} color="#00C853" />
            </View>
            <Text style={styles.modalTitle}>Profile Created!</Text>
            <Text style={styles.modalSubtitle}>
              Your trainer profile is set up. To start accepting clients, you need to complete identity verification.
            </Text>

            <View style={styles.modalSteps}>
              {['Upload Government ID', 'Complete Background Check', 'Upload Certifications', 'Add Profile Photo & Video'].map((s, i) => (
                <View key={i} style={styles.modalStepRow}>
                  <View style={styles.modalStepDot}>
                    <Text style={styles.modalStepNum}>{i + 1}</Text>
                  </View>
                  <Text style={styles.modalStepText}>{s}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setShowVerificationModal(false);
                router.replace('/trainer/verification');
              }}
              data-testid="start-verification-btn"
            >
              <LinearGradient colors={['#1FB8B4', '#18A09D']} style={styles.modalPrimaryGradient}>
                <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.modalPrimaryText}>Start Verification</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => {
                setShowVerificationModal(false);
                router.replace('/trainer/home');
              }}
              data-testid="skip-verification-btn"
            >
              <Text style={styles.modalSecondaryText}>I'll do this later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
    textAlign: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  progressDot: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: Colors.white,
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
  photoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.navy,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.background,
    borderWidth: 3,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 8,
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
  // Verification Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
  },
  modalIconContainer: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a2a5e',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8892b0',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalSteps: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  modalStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalStepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1FB8B4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalStepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalStepText: {
    fontSize: 14,
    color: '#1a2a5e',
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  modalPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  modalPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSecondaryBtn: {
    paddingVertical: 12,
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8892b0',
  },
});

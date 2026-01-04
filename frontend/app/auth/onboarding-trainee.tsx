import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { traineeAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainingStyles, FitnessLevel, TrainingStyleDescriptions } from '../../src/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export default function TraineeOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [showStyleInfo, setShowStyleInfo] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    profilePhoto: '',
    fitnessGoals: '',
    experienceLevel: 'Never trained',
    currentFitnessLevel: FitnessLevel.BEGINNER,
    preferredTrainingStyles: [] as string[],
    injuriesOrLimitations: '',
    homeGymOrZipCode: '',
    prefersInPerson: true,
    prefersVirtual: false,
    isVirtualEnabled: false,
    budgetMinPerMinuteCents: 50,
    budgetMaxPerMinuteCents: 200,
    latitude: null as number | null,
    longitude: null as number | null,
    locationAddress: '',
  });

  const [locationLoading, setLocationLoading] = useState(false);

  const experienceLevels = ['Never trained', 'Some experience', 'Regular exerciser'];

  useEffect(() => {
    // Request location permission on mount
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
        message: 'Could not get your location. You can enter it manually.',
        type: 'warning',
      });
    } finally {
      setLocationLoading(false);
    }
  };

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

  const toggleStyle = (style: string) => {
    if (formData.preferredTrainingStyles.includes(style)) {
      setFormData({
        ...formData,
        preferredTrainingStyles: formData.preferredTrainingStyles.filter(s => s !== style),
      });
    } else {
      setFormData({
        ...formData,
        preferredTrainingStyles: [...formData.preferredTrainingStyles, style],
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
    if (!user) return;

    setLoading(true);
    try {
      await traineeAPI.createProfile({
        userId: user.id,
        profilePhoto: formData.profilePhoto,
        fitnessGoals: formData.fitnessGoals,
        experienceLevel: formData.experienceLevel,
        currentFitnessLevel: formData.currentFitnessLevel,
        preferredTrainingStyles: formData.preferredTrainingStyles,
        injuriesOrLimitations: formData.injuriesOrLimitations,
        homeGymOrZipCode: formData.homeGymOrZipCode,
        prefersInPerson: formData.prefersInPerson,
        prefersVirtual: formData.prefersVirtual,
        isVirtualEnabled: formData.isVirtualEnabled,
        budgetMinPerMinuteCents: formData.budgetMinPerMinuteCents,
        budgetMaxPerMinuteCents: formData.budgetMaxPerMinuteCents,
        latitude: formData.latitude,
        longitude: formData.longitude,
        locationAddress: formData.locationAddress,
      });

      showAlert({
        title: 'Success! 🎉',
        message: 'Your trainee profile has been created!',
        type: 'success',
        buttons: [
          { text: 'OK', onPress: () => router.replace('/trainee/home') },
        ],
      });
    } catch (error: any) {
      showAlert({
        title: 'Profile Creation Failed',
        message: error.response?.data?.detail || 'Failed to create profile',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Profile Photo & Location 📍</Text>
            
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

            {/* Location */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Your Location</Text>
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
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell us about yourself 💪</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fitness Goals</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.fitnessGoals}
                onChangeText={(text) => setFormData({ ...formData, fitnessGoals: text })}
                placeholder="e.g., Lose 20 lbs, build muscle, improve endurance..."
                placeholderTextColor={Colors.textLight}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Experience Level</Text>
              <View style={styles.levelContainer}>
                {experienceLevels.map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.levelChip,
                      formData.experienceLevel === level && styles.levelChipSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, experienceLevel: level })}
                  >
                    <Text
                      style={[
                        styles.levelChipText,
                        formData.experienceLevel === level && styles.levelChipTextSelected,
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Fitness Level</Text>
              <View style={styles.levelContainer}>
                {Object.values(FitnessLevel).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.levelChip,
                      formData.currentFitnessLevel === level && styles.levelChipSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, currentFitnessLevel: level })}
                  >
                    <Text
                      style={[
                        styles.levelChipText,
                        formData.currentFitnessLevel === level && styles.levelChipTextSelected,
                      ]}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Injuries or Limitations (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.injuriesOrLimitations}
                onChangeText={(text) => setFormData({ ...formData, injuriesOrLimitations: text })}
                placeholder="e.g., Bad knee, lower back pain..."
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Training Preferences 🏋️</Text>
            
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Preferred Training Styles</Text>
                <Text style={styles.labelHint}>(Tap ⓘ to learn more)</Text>
              </View>
              <View style={styles.chipContainer}>
                {TrainingStyles.map((style) => (
                  <View key={style} style={styles.chipWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        formData.preferredTrainingStyles.includes(style) && styles.chipSelected,
                      ]}
                      onPress={() => toggleStyle(style)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          formData.preferredTrainingStyles.includes(style) && styles.chipTextSelected,
                        ]}
                      >
                        {style}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowStyleInfo(style)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.infoIcon}
                      >
                        <Ionicons 
                          name="information-circle-outline" 
                          size={18} 
                          color={formData.preferredTrainingStyles.includes(style) ? Colors.white : Colors.navy} 
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Session Format</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    formData.prefersInPerson && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, prefersInPerson: !formData.prefersInPerson })}
                >
                  <Ionicons 
                    name="fitness" 
                    size={20} 
                    color={formData.prefersInPerson ? Colors.white : Colors.navy} 
                  />
                  <Text
                    style={[
                      styles.toggleButtonText,
                      formData.prefersInPerson && styles.toggleButtonTextActive,
                    ]}
                  >
                    In-Person
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    formData.isVirtualEnabled && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, isVirtualEnabled: !formData.isVirtualEnabled })}
                >
                  <Ionicons 
                    name="videocam" 
                    size={20} 
                    color={formData.isVirtualEnabled ? Colors.white : Colors.navy} 
                  />
                  <Text
                    style={[
                      styles.toggleButtonText,
                      formData.isVirtualEnabled && styles.toggleButtonTextActive,
                    ]}
                  >
                    Virtual
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Home Gym or Zip Code</Text>
              <TextInput
                style={styles.input}
                value={formData.homeGymOrZipCode}
                onChangeText={(text) => setFormData({ ...formData, homeGymOrZipCode: text })}
                placeholder="90210 or Gold's Gym Downtown"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={Colors.gradientTealStart}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.title}>Trainee Setup</Text>
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
        <ScrollView 
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

      {/* Training Style Info Modal */}
      <Modal
        visible={showStyleInfo !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStyleInfo(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStyleInfo(null)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{showStyleInfo}</Text>
              <TouchableOpacity onPress={() => setShowStyleInfo(null)}>
                <Ionicons name="close-circle" size={28} color={Colors.navy} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              {showStyleInfo && TrainingStyleDescriptions[showStyleInfo]}
            </Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setShowStyleInfo(null)}
            >
              <Text style={styles.modalButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.navy,
    fontWeight: '700',
    marginBottom: 16,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: Colors.navy,
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
    borderWidth: 2,
    borderColor: Colors.navy,
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
  levelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelChip: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.navy,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  levelChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.navy,
  },
  levelChipTextSelected: {
    color: Colors.white,
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
    borderColor: Colors.navy,
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
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.navy,
    backgroundColor: Colors.white,
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
  budgetRow: {
    flexDirection: 'row',
    gap: 12,
  },
  budgetInput: {
    flex: 1,
  },
  budgetLabel: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 4,
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
    borderWidth: 3,
    borderColor: Colors.navy,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  labelHint: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  chipWrapper: {
    marginBottom: 8,
  },
  infoIcon: {
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 3,
    borderColor: Colors.navy,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.navy,
    flex: 1,
  },
  modalDescription: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: Colors.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.navy,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});

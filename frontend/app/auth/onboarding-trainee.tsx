import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import { traineeAPI } from '../../src/services/api';
import { TrainingStyles, FitnessLevel, TrainingStyleDescriptions } from '../../src/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#8892b0',
  grayLight: '#E8ECF0',
  success: '#00C853',
};

export default function TraineeOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  const [showStyleInfo, setShowStyleInfo] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Animations
  const progressAnim = useRef(new Animated.Value(1)).current;
  const contentAnim = useRef(new Animated.Value(1)).current;

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

  const experienceLevels = ['Never trained', 'Some experience', 'Regular exerciser'];

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: step / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Animate content
    Animated.sequence([
      Animated.timing(contentAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(contentAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        await getCurrentLocation();
      }
    } catch (error) {
      console.error('[Onboarding] Error requesting location:', error);
    }
  };

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      let locationAddress = '';
      if (addresses[0]) {
        const addr = addresses[0];
        locationAddress = `${addr.city || ''}, ${addr.region || ''}`.trim().replace(/^,\s*/, '');
      }

      setFormData(prev => ({
        ...prev,
        latitude,
        longitude,
        locationAddress: locationAddress || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      }));
    } catch (error) {
      console.error('[Onboarding] Error getting location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      showAlert({
        title: 'Permission Required',
        message: 'Camera roll permission is required',
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

      router.replace('/trainee/(tabs)/home');
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

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Let's set you up! 📍</Text>
            <Text style={styles.stepSubtitle}>Add your photo and location</Text>

            {/* Photo */}
            <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
              {formData.profilePhoto ? (
                <Image source={{ uri: formData.profilePhoto }} style={styles.photo} />
              ) : (
                <LinearGradient
                  colors={[COLORS.teal, COLORS.tealLight]}
                  style={styles.photoPlaceholder}
                >
                  <Ionicons name="camera" size={40} color={COLORS.white} />
                  <Text style={styles.photoText}>Add Photo</Text>
                </LinearGradient>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="pencil" size={16} color={COLORS.white} />
              </View>
            </TouchableOpacity>

            {/* Location */}
            <View style={styles.locationCard}>
              <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.locationGradient}>
                <View style={styles.locationHeader}>
                  <Ionicons name="location" size={24} color={COLORS.orange} />
                  <Text style={styles.locationTitle}>Your Location</Text>
                </View>
                {formData.locationAddress ? (
                  <Text style={styles.locationText}>📍 {formData.locationAddress}</Text>
                ) : (
                  <Text style={styles.locationPlaceholder}>Location helps find nearby trainers</Text>
                )}
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={getCurrentLocation}
                  disabled={locationLoading}
                >
                  <LinearGradient
                    colors={[COLORS.teal, COLORS.tealLight]}
                    style={styles.locationButtonGradient}
                  >
                    {locationLoading ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="navigate" size={18} color={COLORS.white} />
                        <Text style={styles.locationButtonText}>
                          {formData.locationAddress ? 'Update' : 'Get Location'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Your fitness journey 💪</Text>
            <Text style={styles.stepSubtitle}>Tell us about your goals</Text>

            {/* Goals */}
            <View style={styles.inputCard}>
              <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.inputCardGradient}>
                <Text style={styles.inputLabel}>What are your fitness goals?</Text>
                <TextInput
                  style={styles.textArea}
                  value={formData.fitnessGoals}
                  onChangeText={(text) => setFormData({ ...formData, fitnessGoals: text })}
                  placeholder="e.g. Lose weight, build muscle, improve endurance..."
                  placeholderTextColor={COLORS.gray}
                  multiline
                  numberOfLines={3}
                />
              </LinearGradient>
            </View>

            {/* Experience Level */}
            <View style={styles.inputCard}>
              <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.inputCardGradient}>
                <Text style={styles.inputLabel}>Experience Level</Text>
                <View style={styles.experienceRow}>
                  {experienceLevels.map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => setFormData({ ...formData, experienceLevel: level })}
                      style={[
                        styles.experienceChip,
                        formData.experienceLevel === level && styles.experienceChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.experienceText,
                          formData.experienceLevel === level && styles.experienceTextSelected,
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </LinearGradient>
            </View>

            {/* Injuries */}
            <View style={styles.inputCard}>
              <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.inputCardGradient}>
                <Text style={styles.inputLabel}>Any injuries or limitations?</Text>
                <TextInput
                  style={styles.input}
                  value={formData.injuriesOrLimitations}
                  onChangeText={(text) => setFormData({ ...formData, injuriesOrLimitations: text })}
                  placeholder="Optional - let trainers know"
                  placeholderTextColor={COLORS.gray}
                />
              </LinearGradient>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Training preferences 🏋️</Text>
            <Text style={styles.stepSubtitle}>What types of training interest you?</Text>

            <View style={styles.stylesCard}>
              <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.stylesGradient}>
                <View style={styles.stylesGrid}>
                  {TrainingStyles.map((style) => (
                    <TouchableOpacity
                      key={style}
                      onPress={() => toggleStyle(style)}
                      onLongPress={() => setShowStyleInfo(style)}
                      style={[
                        styles.styleChip,
                        formData.preferredTrainingStyles.includes(style) && styles.styleChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.styleText,
                          formData.preferredTrainingStyles.includes(style) && styles.styleTextSelected,
                        ]}
                      >
                        {style}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowStyleInfo(style)}
                        style={styles.infoButton}
                      >
                        <Ionicons
                          name="information-circle"
                          size={16}
                          color={formData.preferredTrainingStyles.includes(style) ? COLORS.white : COLORS.gray}
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.helperText}>Tap to select • Hold for info</Text>
              </LinearGradient>
            </View>

            {/* Training Mode */}
            <View style={styles.inputCard}>
              <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.inputCardGradient}>
                <Text style={styles.inputLabel}>Training Mode</Text>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    onPress={() => setFormData({ ...formData, prefersInPerson: !formData.prefersInPerson })}
                    style={[styles.modeChip, formData.prefersInPerson && styles.modeChipSelected]}
                  >
                    <Ionicons
                      name="person"
                      size={20}
                      color={formData.prefersInPerson ? COLORS.white : COLORS.navy}
                    />
                    <Text style={[styles.modeText, formData.prefersInPerson && styles.modeTextSelected]}>
                      In-Person
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setFormData({ ...formData, prefersVirtual: !formData.prefersVirtual })}
                    style={[styles.modeChip, formData.prefersVirtual && styles.modeChipSelected]}
                  >
                    <Ionicons
                      name="videocam"
                      size={20}
                      color={formData.prefersVirtual ? COLORS.white : COLORS.navy}
                    />
                    <Text style={[styles.modeText, formData.prefersVirtual && styles.modeTextSelected]}>
                      Virtual
                    </Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.teal, COLORS.tealLight, COLORS.orange]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          {step > 1 ? (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
          <Text style={styles.headerTitle}>Step {step} of {totalSteps}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBg}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: contentAnim }}>
              {renderStep()}
            </Animated.View>
          </ScrollView>

          {/* Bottom CTA */}
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? [COLORS.gray, COLORS.grayLight] : [COLORS.orangeHot, COLORS.orange]}
                style={styles.nextButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>
                      {step === totalSteps ? 'Complete Setup' : 'Continue'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Style Info Modal */}
      <Modal
        visible={!!showStyleInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStyleInfo(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStyleInfo(null)}
        >
          <View style={styles.modalContent}>
            <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.modalGradient}>
              <Text style={styles.modalTitle}>{showStyleInfo}</Text>
              <Text style={styles.modalDescription}>
                {showStyleInfo ? TrainingStyleDescriptions[showStyleInfo] || 'No description available.' : ''}
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowStyleInfo(null)}
              >
                <Text style={styles.modalButtonText}>Got it!</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 3,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 24,
  },
  // Photo
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  photo: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  photoPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  photoText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    marginTop: 4,
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.orange,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  // Location
  locationCard: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  locationGradient: {
    padding: 20,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.navy,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.teal,
    marginBottom: 14,
  },
  locationPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
    marginBottom: 14,
  },
  locationButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  locationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  locationButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Input Cards
  inputCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  inputCardGradient: {
    padding: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 10,
  },
  input: {
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.navy,
  },
  textArea: {
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.navy,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  experienceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  experienceChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.grayLight,
  },
  experienceChipSelected: {
    backgroundColor: COLORS.teal,
  },
  experienceText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy,
  },
  experienceTextSelected: {
    color: COLORS.white,
  },
  // Styles
  stylesCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  stylesGradient: {
    padding: 18,
  },
  stylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    gap: 6,
  },
  styleChipSelected: {
    backgroundColor: COLORS.teal,
  },
  styleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
  },
  styleTextSelected: {
    color: COLORS.white,
  },
  infoButton: {
    padding: 2,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 14,
  },
  // Mode
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: COLORS.grayLight,
    gap: 8,
  },
  modeChipSelected: {
    backgroundColor: COLORS.teal,
  },
  modeText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
  },
  modeTextSelected: {
    color: COLORS.white,
  },
  // Bottom
  bottomContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  nextButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: COLORS.teal,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
});

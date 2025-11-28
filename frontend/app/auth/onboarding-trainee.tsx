import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { traineeAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainingStyles, FitnessLevel } from '../../src/types';

export default function TraineeOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [formData, setFormData] = useState({
    fitnessGoals: '',
    currentFitnessLevel: FitnessLevel.BEGINNER,
    preferredTrainingStyles: [] as string[],
    injuriesOrLimitations: '',
    homeGymOrZipCode: '',
    prefersInPerson: true,
    prefersVirtual: false,
    budgetMinPerMinuteCents: 50,
    budgetMaxPerMinuteCents: 200,
  });

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
        fitnessGoals: formData.fitnessGoals,
        currentFitnessLevel: formData.currentFitnessLevel,
        preferredTrainingStyles: formData.preferredTrainingStyles,
        injuriesOrLimitations: formData.injuriesOrLimitations,
        homeGymOrZipCode: formData.homeGymOrZipCode,
        prefersInPerson: formData.prefersInPerson,
        prefersVirtual: formData.prefersVirtual,
        budgetMinPerMinuteCents: formData.budgetMinPerMinuteCents,
        budgetMaxPerMinuteCents: formData.budgetMaxPerMinuteCents,
      });

      Alert.alert('Success', 'Your trainee profile has been created!', [
        { text: 'OK', onPress: () => router.replace('/trainee/home') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell us about yourself</Text>
            
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

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Training Preferences</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Training Styles</Text>
              <View style={styles.chipContainer}>
                {TrainingStyles.map((style) => (
                  <TouchableOpacity
                    key={style}
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
                    formData.prefersInPerson && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, prefersInPerson: !formData.prefersInPerson })}
                >
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
                    formData.prefersVirtual && styles.toggleButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, prefersVirtual: !formData.prefersVirtual })}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      formData.prefersVirtual && styles.toggleButtonTextActive,
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

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Budget</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Budget Per Minute (cents)</Text>
              <View style={styles.budgetRow}>
                <View style={styles.budgetInput}>
                  <Text style={styles.budgetLabel}>Min</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.budgetMinPerMinuteCents.toString()}
                    onChangeText={(text) => setFormData({ ...formData, budgetMinPerMinuteCents: parseInt(text) || 50 })}
                    placeholder="50"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.budgetInput}>
                  <Text style={styles.budgetLabel}>Max</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.budgetMaxPerMinuteCents.toString()}
                    onChangeText={(text) => setFormData({ ...formData, budgetMaxPerMinuteCents: parseInt(text) || 200 })}
                    placeholder="200"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Text style={styles.helpText}>
                Budget range: ${formData.budgetMinPerMinuteCents / 100} - ${formData.budgetMaxPerMinuteCents / 100} per minute
              </Text>
              <Text style={styles.helpText}>
                Example: For a 60-min session at $1/min = $60
              </Text>
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
    color: Colors.navy,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.navy,
    opacity: 0.7,
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
  levelContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  levelChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  levelChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  levelChipText: {
    fontSize: 14,
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
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
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

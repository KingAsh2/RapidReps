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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trainerAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainerProfile, TrainingStyles } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';

export default function EditTrainerProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TrainerProfile | null>(null);

  const [formData, setFormData] = useState({
    bio: '',
    experienceYears: '0',
    certifications: '',
    trainingStyles: [] as string[],
    gymsWorkedAt: '',
    primaryGym: '',
    offersInPerson: true,
    offersVirtual: false,
    sessionDurations: [30, 45, 60],
    ratePerMinuteCents: '100',
    travelRadiusMiles: '10',
    cancellationPolicy: 'Free cancellation before 24 hours',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const data = await trainerAPI.getProfile(user.id);
      setProfile(data);
      
      // Populate form
      setFormData({
        bio: data.bio || '',
        experienceYears: data.experienceYears.toString(),
        certifications: data.certifications.join(', '),
        trainingStyles: data.trainingStyles,
        gymsWorkedAt: data.gymsWorkedAt.join(', '),
        primaryGym: data.primaryGym || '',
        offersInPerson: data.offersInPerson,
        offersVirtual: data.offersVirtual,
        sessionDurations: data.sessionDurationsOffered,
        ratePerMinuteCents: data.ratePerMinuteCents.toString(),
        travelRadiusMiles: data.travelRadiusMiles?.toString() || '10',
        cancellationPolicy: data.cancellationPolicy || 'Free cancellation before 24 hours',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
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

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const certList = formData.certifications
        .split(',')
        .map(c => c.trim())
        .filter(c => c);
      const gymsList = formData.gymsWorkedAt
        .split(',')
        .map(g => g.trim())
        .filter(g => g);

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
        ratePerMinuteCents: parseInt(formData.ratePerMinuteCents) || 100,
        travelRadiusMiles: parseInt(formData.travelRadiusMiles) || 10,
        cancellationPolicy: formData.cancellationPolicy,
      });

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Bio */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About You</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(text) => setFormData({ ...formData, bio: text })}
                placeholder="Tell trainees about yourself..."
                placeholderTextColor={Colors.textLight}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Experience (years)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.experienceYears}
                  onChangeText={(text) => setFormData({ ...formData, experienceYears: text })}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Rate ($/min)</Text>
                <TextInput
                  style={styles.input}
                  value={(parseInt(formData.ratePerMinuteCents) / 100).toFixed(2)}
                  onChangeText={(text) => {
                    const cents = Math.round(parseFloat(text) * 100) || 100;
                    setFormData({ ...formData, ratePerMinuteCents: cents.toString() });
                  }}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Certifications (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={formData.certifications}
                onChangeText={(text) => setFormData({ ...formData, certifications: text })}
                placeholder="NASM CPT, ACE, ISSA"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          {/* Training Styles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Training Styles</Text>
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

          {/* Session Format */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Format</Text>
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

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gyms (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={formData.gymsWorkedAt}
                onChangeText={(text) => setFormData({ ...formData, gymsWorkedAt: text })}
                placeholder="Gold's Gym, LA Fitness"
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Primary Gym</Text>
                <TextInput
                  style={styles.input}
                  value={formData.primaryGym}
                  onChangeText={(text) => setFormData({ ...formData, primaryGym: text })}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Travel Radius (mi)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.travelRadiusMiles}
                  onChangeText={(text) => setFormData({ ...formData, travelRadiusMiles: text })}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>
          </View>

          {/* Session Durations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Durations</Text>
            <View style={styles.durationContainer}>
              {[30, 45, 60, 90].map((duration) => (
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

          {/* Cancellation Policy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cancellation Policy</Text>
            <TextInput
              style={styles.input}
              value={formData.cancellationPolicy}
              onChangeText={(text) => setFormData({ ...formData, cancellationPolicy: text })}
              placeholderTextColor={Colors.textLight}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.9}
            style={styles.saveButtonContainer}
          >
            <LinearGradient
              colors={saving ? ['#CCCCCC', '#999999'] : Colors.gradientMain}
              style={styles.saveButton}
            >
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.navy,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
    flexWrap: 'wrap',
    gap: 12,
  },
  durationChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
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
  saveButtonContainer: {
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

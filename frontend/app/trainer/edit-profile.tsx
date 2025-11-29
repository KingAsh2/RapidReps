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
import { useRouter, Stack } from 'expo-router';
import { trainerAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { TrainerProfile, TrainingStyles } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { AnimatedLogo } from '../../src/components/AnimatedLogo';

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
    travelRadiusMiles: '10',
    cancellationPolicy: 'Free cancellation before 24 hours',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const data = await trainerAPI.getMyProfile();
      if (data) {
        setProfile(data);
        setFormData({
          bio: data.bio || '',
          experienceYears: data.experienceYears?.toString() || '0',
          certifications: data.certifications?.join(', ') || '',
          trainingStyles: data.trainingStyles || [],
          gymsWorkedAt: data.gymsWorkedAt?.join(', ') || '',
          primaryGym: data.primaryGym || '',
          offersInPerson: data.offersInPerson ?? true,
          offersVirtual: data.offersVirtual ?? false,
          sessionDurations: data.sessionDurationsOffered || [30, 45, 60],
          travelRadiusMiles: data.travelRadiusMiles?.toString() || '10',
          cancellationPolicy: data.cancellationPolicy || 'Free cancellation before 24 hours',
        });
      }
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
        trainingStyles: formData.trainingStyles.filter((s) => s !== style),
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
        sessionDurations: formData.sessionDurations.filter((d) => d !== duration),
      });
    } else {
      setFormData({
        ...formData,
        sessionDurations: [...formData.sessionDurations, duration].sort((a, b) => a - b),
      });
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    try {
      const certList = formData.certifications
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);
      const gymsList = formData.gymsWorkedAt
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g);

      await trainerAPI.updateProfile({
        bio: formData.bio,
        experienceYears: parseInt(formData.experienceYears) || 0,
        certifications: certList,
        trainingStyles: formData.trainingStyles,
        gymsWorkedAt: gymsList,
        primaryGym: formData.primaryGym,
        offersInPerson: formData.offersInPerson,
        offersVirtual: formData.offersVirtual,
        sessionDurationsOffered: formData.sessionDurations,
        travelRadiusMiles: parseInt(formData.travelRadiusMiles) || 10,
        cancellationPolicy: formData.cancellationPolicy,
      });

      Alert.alert('Success! 🎉', 'Your profile has been updated');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={Colors.gradientMain}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={Colors.gradientMain}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.backgroundGradient}
        >
          <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <LinearGradient
            colors={Colors.gradientOrangeStart}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={Colors.white} />
              </TouchableOpacity>
              <AnimatedLogo size={50} animationType="explosive-entry" />
              <View style={{ width: 40 }} />
            </View>
            <Text style={styles.headerTitle}>Edit Profile 🔥</Text>
            <Text style={styles.headerSubtitle}>Update your trainer details</Text>
          </LinearGradient>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* About You Section */}
              <View style={styles.section}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                  style={styles.sectionCard}
                >
                  <View style={styles.sectionHeader}>
                    <Ionicons name="person" size={24} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>About You</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bio</Text>
                    <LinearGradient
                      colors={['rgba(91,192,190,0.1)', 'rgba(255,139,66,0.05)']}
                      style={styles.inputGradient}
                    >
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={formData.bio}
                        onChangeText={(text) => setFormData({ ...formData, bio: text })}
                        placeholder="Tell trainees about yourself..."
                        placeholderTextColor={Colors.textLight}
                        multiline
                        numberOfLines={4}
                      />
                    </LinearGradient>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Experience (years)</Text>
                      <LinearGradient
                        colors={['rgba(91,192,190,0.1)', 'rgba(255,139,66,0.05)']}
                        style={styles.inputGradient}
                      >
                        <TextInput
                          style={styles.input}
                          value={formData.experienceYears}
                          onChangeText={(text) => setFormData({ ...formData, experienceYears: text })}
                          placeholder="0"
                          placeholderTextColor={Colors.textLight}
                          keyboardType="numeric"
                        />
                      </LinearGradient>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Certifications (comma-separated)</Text>
                    <LinearGradient
                      colors={['rgba(91,192,190,0.1)', 'rgba(255,139,66,0.05)']}
                      style={styles.inputGradient}
                    >
                      <TextInput
                        style={styles.input}
                        value={formData.certifications}
                        onChangeText={(text) => setFormData({ ...formData, certifications: text })}
                        placeholder="NASM CPT, ACE, ISSA"
                        placeholderTextColor={Colors.textLight}
                      />
                    </LinearGradient>
                  </View>
                </LinearGradient>
              </View>

              {/* Training Styles Section */}
              <View style={styles.section}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                  style={styles.sectionCard}
                >
                  <View style={styles.sectionHeader}>
                    <Ionicons name="fitness" size={24} color={Colors.secondary} />
                    <Text style={styles.sectionTitle}>Training Styles</Text>
                  </View>

                  <View style={styles.chipsContainer}>
                    {Object.values(TrainingStyles).map((style) => (
                      <TouchableOpacity
                        key={style}
                        onPress={() => toggleStyle(style)}
                        style={styles.chipWrapper}
                      >
                        <LinearGradient
                          colors={
                            formData.trainingStyles.includes(style)
                              ? Colors.gradientOrangeStart
                              : ['rgba(200,200,200,0.3)', 'rgba(150,150,150,0.2)']
                          }
                          style={[
                            styles.chip,
                            formData.trainingStyles.includes(style) && styles.chipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              formData.trainingStyles.includes(style) && styles.chipTextSelected,
                            ]}
                          >
                            {style}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ))}
                  </View>
                </LinearGradient>
              </View>

              {/* Session Format Section */}
              <View style={styles.section}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                  style={styles.sectionCard}
                >
                  <View style={styles.sectionHeader}>
                    <Ionicons name="time" size={24} color={Colors.neonBlue} />
                    <Text style={styles.sectionTitle}>Session Format</Text>
                  </View>

                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={styles.toggleButton}
                      onPress={() =>
                        setFormData({ ...formData, offersInPerson: !formData.offersInPerson })
                      }
                    >
                      <LinearGradient
                        colors={
                          formData.offersInPerson
                            ? Colors.gradientTealStart
                            : ['rgba(200,200,200,0.3)', 'rgba(150,150,150,0.2)']
                        }
                        style={styles.toggleGradient}
                      >
                        <Ionicons
                          name="location"
                          size={24}
                          color={formData.offersInPerson ? Colors.white : Colors.text}
                        />
                        <Text
                          style={[
                            styles.toggleText,
                            formData.offersInPerson && styles.toggleTextActive,
                          ]}
                        >
                          In-Person
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.toggleButton}
                      onPress={() =>
                        setFormData({ ...formData, offersVirtual: !formData.offersVirtual })
                      }
                    >
                      <LinearGradient
                        colors={
                          formData.offersVirtual
                            ? Colors.gradientOrangeStart
                            : ['rgba(200,200,200,0.3)', 'rgba(150,150,150,0.2)']
                        }
                        style={styles.toggleGradient}
                      >
                        <Ionicons
                          name="videocam"
                          size={24}
                          color={formData.offersVirtual ? Colors.white : Colors.text}
                        />
                        <Text
                          style={[
                            styles.toggleText,
                            formData.offersVirtual && styles.toggleTextActive,
                          ]}
                        >
                          Virtual
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Session Durations (minutes)</Text>
                    <View style={styles.durationChips}>
                      {[30, 45, 60, 90].map((duration) => (
                        <TouchableOpacity
                          key={duration}
                          onPress={() => toggleDuration(duration)}
                          style={styles.durationChipWrapper}
                        >
                          <LinearGradient
                            colors={
                              formData.sessionDurations.includes(duration)
                                ? Colors.gradientMain
                                : ['rgba(200,200,200,0.3)', 'rgba(150,150,150,0.2)']
                            }
                            style={styles.durationChip}
                          >
                            <Text
                              style={[
                                styles.durationText,
                                formData.sessionDurations.includes(duration) &&
                                  styles.durationTextSelected,
                              ]}
                            >
                              {duration}min
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </LinearGradient>
              </View>

              {/* Location Section */}
              <View style={styles.section}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                  style={styles.sectionCard}
                >
                  <View style={styles.sectionHeader}>
                    <Ionicons name="map" size={24} color={Colors.success} />
                    <Text style={styles.sectionTitle}>Location</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Gyms Worked At (comma-separated)</Text>
                    <LinearGradient
                      colors={['rgba(91,192,190,0.1)', 'rgba(255,139,66,0.05)']}
                      style={styles.inputGradient}
                    >
                      <TextInput
                        style={styles.input}
                        value={formData.gymsWorkedAt}
                        onChangeText={(text) => setFormData({ ...formData, gymsWorkedAt: text })}
                        placeholder="Equinox, Gold's Gym, Planet Fitness"
                        placeholderTextColor={Colors.textLight}
                      />
                    </LinearGradient>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Primary Gym</Text>
                    <LinearGradient
                      colors={['rgba(91,192,190,0.1)', 'rgba(255,139,66,0.05)']}
                      style={styles.inputGradient}
                    >
                      <TextInput
                        style={styles.input}
                        value={formData.primaryGym}
                        onChangeText={(text) => setFormData({ ...formData, primaryGym: text })}
                        placeholder="Equinox Downtown"
                        placeholderTextColor={Colors.textLight}
                      />
                    </LinearGradient>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Travel Radius (miles)</Text>
                    <LinearGradient
                      colors={['rgba(91,192,190,0.1)', 'rgba(255,139,66,0.05)']}
                      style={styles.inputGradient}
                    >
                      <TextInput
                        style={styles.input}
                        value={formData.travelRadiusMiles}
                        onChangeText={(text) => setFormData({ ...formData, travelRadiusMiles: text })}
                        placeholder="10"
                        placeholderTextColor={Colors.textLight}
                        keyboardType="numeric"
                      />
                    </LinearGradient>
                  </View>
                </LinearGradient>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={styles.saveButtonWrapper}
              >
                <LinearGradient
                  colors={saving ? ['#CCCCCC', '#999999'] : Colors.gradientMain}
                  style={styles.saveButton}
                >
                  <Ionicons name="save" size={24} color={Colors.white} />
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving...' : 'Save Changes 🔥'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.white,
    opacity: 0.95,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.navy,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 8,
  },
  inputGradient: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: Colors.navy,
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  chipSelected: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  toggleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  durationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationChipWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  durationChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  durationTextSelected: {
    color: Colors.white,
  },
  saveButtonWrapper: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

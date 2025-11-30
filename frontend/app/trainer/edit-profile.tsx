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
import * as Location from 'expo-location';

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
    trainingStyles: [],
    gymsWorkedAt: '',
    primaryGym: '',
    offersInPerson: true,
    offersVirtual: false,
    sessionDurations: [30, 45, 60],
    travelRadiusMiles: '10',
    cancellationPolicy: 'Free cancellation before 24 hours',
    latitude: null,
    longitude: null,
    locationAddress: '',
    isAvailable: true,
  });
  
  const [gettingLocation, setGettingLocation] = useState(false);

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
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          locationAddress: data.locationAddress || '',
          isAvailable: data.isAvailable ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStyle = (style) => {
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

  const toggleDuration = (duration) => {
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

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions to set your location');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get address
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let address = '';
      if (addresses[0]) {
        const addr = addresses[0];
        address = `${addr.city || ''}, ${addr.region || ''}`.trim().replace(/^,\s*/, '');
      }

      setFormData({
        ...formData,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        locationAddress: address || 'Location set',
      });

      Alert.alert('Success!', 'Location updated successfully');
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      console.log('Save failed: user missing', { user });
      Alert.alert('Error', 'User not found. Please log in again.');
      return;
    }

    console.log('Starting save...', { userId: user.id, formData });
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

      console.log('Calling API with data:', {
        userId: user.id,
        locationAddress: formData.locationAddress,
        latitude: formData.latitude,
        longitude: formData.longitude,
      });

      await trainerAPI.updateProfile({
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
        ratePerMinuteCents: 100,
        travelRadiusMiles: parseInt(formData.travelRadiusMiles) || 10,
        cancellationPolicy: formData.cancellationPolicy,
        latitude: formData.latitude,
        longitude: formData.longitude,
        locationAddress: formData.locationAddress,
        isVirtualTrainingAvailable: formData.offersVirtual,
        isAvailable: formData.isAvailable,
      });

      console.log('Profile updated successfully!');
      setSaving(false);
      Alert.alert(
        'Success! 🎉', 
        'Your profile has been updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('Navigating back...');
              loadProfile(); // Reload to confirm save
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Save error:', error);
      setSaving(false);
      Alert.alert('Error', error.response?.data?.detail || error.message || 'Failed to update profile');
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
              {/* Availability Toggle Section */}
              <View style={styles.section}>
                <LinearGradient
                  colors={formData.isAvailable ? Colors.gradientTealStart : ['rgba(200,200,200,0.95)', 'rgba(150,150,150,0.85)']}
                  style={[styles.sectionCard, styles.availabilityCard]}
                >
                  <TouchableOpacity
                    onPress={() => setFormData({ ...formData, isAvailable: !formData.isAvailable })}
                    style={styles.availabilityToggle}
                  >
                    <View style={styles.availabilityContent}>
                      <View style={styles.availabilityLeft}>
                        <Ionicons 
                          name={formData.isAvailable ? "radio-button-on" : "radio-button-off"} 
                          size={32} 
                          color={Colors.white} 
                        />
                        <View style={styles.availabilityText}>
                          <Text style={styles.availabilityTitle}>
                            {formData.isAvailable ? "🟢 Available for Training" : "🔴 Currently Unavailable"}
                          </Text>
                          <Text style={styles.availabilitySubtitle}>
                            {formData.isAvailable 
                              ? "Trainees can find and book you" 
                              : "Hidden from trainee searches"
                            }
                          </Text>
                        </View>
                      </View>
                      <Ionicons 
                        name={formData.isAvailable ? "toggle" : "toggle-outline"} 
                        size={40} 
                        color={Colors.white} 
                      />
                    </View>
                  </TouchableOpacity>
                </LinearGradient>
              </View>

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

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Location (City, State)</Text>
                    <LinearGradient
                      colors={['rgba(91,192,190,0.1)', 'rgba(255,139,66,0.05)']}
                      style={styles.inputGradient}
                    >
                      <TextInput
                        style={styles.input}
                        value={formData.locationAddress}
                        onChangeText={(text) => setFormData({ ...formData, locationAddress: text })}
                        placeholder="Elkridge, MD"
                        placeholderTextColor={Colors.textLight}
                      />
                    </LinearGradient>
                    <Text style={styles.helpText}>
                      Enter your city and state (e.g., &quot;Elkridge, MD&quot;)
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>GPS Location (for precise matching)</Text>
                    <TouchableOpacity
                      onPress={getCurrentLocation}
                      disabled={gettingLocation}
                      style={styles.locationButtonWrapper}
                    >
                      <LinearGradient
                        colors={gettingLocation ? ['#CCCCCC', '#999999'] : Colors.gradientTealStart}
                        style={styles.locationButton}
                      >
                        <Ionicons 
                          name={gettingLocation ? "hourglass" : "location"} 
                          size={24} 
                          color={Colors.white} 
                        />
                        <Text style={styles.locationButtonText}>
                          {gettingLocation ? 'Getting GPS...' : 'Set GPS Location 📍'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    {formData.latitude && formData.longitude && (
                      <View style={styles.locationDisplay}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        <Text style={styles.locationDisplayText}>GPS Coordinates Set</Text>
                      </View>
                    )}
                    <Text style={styles.helpText}>
                      GPS helps calculate exact distances to trainees
                    </Text>
                  </View>

                  {/* Save Button - Moved here for better UX */}
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
                </LinearGradient>
              </View>

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
  locationButtonWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  locationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  locationDisplayText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
    flex: 1,
  },
  helpText: {
    fontSize: 12,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  availabilityCard: {
    marginBottom: 8,
  },
  availabilityToggle: {
    padding: 0,
  },
  availabilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  availabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availabilityText: {
    marginLeft: 16,
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  availabilitySubtitle: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
  },
});

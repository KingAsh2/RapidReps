import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Animated,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { trainerAPI } from '../../src/services/api';
import { TrainerProfile, TrainingStyles } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import * as Location from 'expo-location';

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
  error: '#FF4757',
};

export default function EditTrainerProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(6)].map(() => new Animated.Value(0))).current;

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
    latitude: null as number | null,
    longitude: null as number | null,
    locationAddress: '',
    isAvailable: true,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      cardAnims.forEach((anim, index) => {
        setTimeout(() => {
          Animated.spring(anim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }, 150 + (index * 100));
      });
    }
  }, [loading]);

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

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Denied',
          message: 'Please enable location permissions',
          type: 'warning',
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

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
    } catch (error) {
      console.error('Error getting location:', error);
      showAlert({
        title: 'Location Error',
        message: 'Failed to get your location',
        type: 'error',
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const profileData = {
        userId: user.id,
        bio: formData.bio.trim(),
        experienceYears: parseInt(formData.experienceYears) || 0,
        certifications: formData.certifications.split(',').map((c) => c.trim()).filter(Boolean),
        trainingStyles: formData.trainingStyles,
        gymsWorkedAt: formData.gymsWorkedAt.split(',').map((g) => g.trim()).filter(Boolean),
        primaryGym: formData.primaryGym.trim(),
        offersInPerson: formData.offersInPerson,
        offersVirtual: formData.offersVirtual,
        sessionDurationsOffered: formData.sessionDurations,
        travelRadiusMiles: parseInt(formData.travelRadiusMiles) || 10,
        cancellationPolicy: formData.cancellationPolicy,
        latitude: formData.latitude,
        longitude: formData.longitude,
        locationAddress: formData.locationAddress,
        isAvailable: formData.isAvailable,
      };

      if (profile) {
        await trainerAPI.updateProfile(profileData);
      } else {
        await trainerAPI.createProfile(profileData);
      }

      router.back();
    } catch (error: any) {
      showAlert({
        title: 'Save Failed',
        message: error.response?.data?.detail || 'Failed to save profile',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.orange, COLORS.orangeLight, COLORS.teal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </LinearGradient>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.orange, COLORS.orangeLight, COLORS.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerAnim,
                transform: [{ translateY: headerTranslateY }],
              },
            ]}
          >
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>EDIT PROFILE ✏️</Text>
            <View style={{ width: 44 }} />
          </Animated.View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Bio Card */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardAnims[0],
                    transform: [{
                      translateY: cardAnims[0].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    }],
                  },
                ]}
              >
                <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.cardGradient}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="person-circle" size={22} color={COLORS.orange} />
                    <Text style={styles.cardTitle}>About You</Text>
                  </View>
                  <TextInput
                    style={styles.textArea}
                    value={formData.bio}
                    onChangeText={(text) => setFormData({ ...formData, bio: text })}
                    placeholder="Tell clients about yourself..."
                    placeholderTextColor={COLORS.gray}
                    multiline
                    numberOfLines={4}
                  />
                  <View style={styles.row}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Years Experience</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.experienceYears}
                        onChangeText={(text) => setFormData({ ...formData, experienceYears: text })}
                        keyboardType="numeric"
                        placeholder="5"
                        placeholderTextColor={COLORS.gray}
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Travel Radius (mi)</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.travelRadiusMiles}
                        onChangeText={(text) => setFormData({ ...formData, travelRadiusMiles: text })}
                        keyboardType="numeric"
                        placeholder="10"
                        placeholderTextColor={COLORS.gray}
                      />
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Training Styles */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardAnims[1],
                    transform: [{
                      translateY: cardAnims[1].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    }],
                  },
                ]}
              >
                <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.cardGradient}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="fitness" size={22} color={COLORS.teal} />
                    <Text style={styles.cardTitle}>Training Styles</Text>
                  </View>
                  <View style={styles.chipsContainer}>
                    {TrainingStyles.map((style) => (
                      <TouchableOpacity
                        key={style}
                        onPress={() => toggleStyle(style)}
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
                      </TouchableOpacity>
                    ))}
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Session Options */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardAnims[2],
                    transform: [{
                      translateY: cardAnims[2].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    }],
                  },
                ]}
              >
                <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.cardGradient}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="time" size={22} color={COLORS.orange} />
                    <Text style={styles.cardTitle}>Session Options</Text>
                  </View>
                  
                  <Text style={styles.subLabel}>Session Durations</Text>
                  <View style={styles.durationRow}>
                    {[30, 45, 60, 90].map((duration) => (
                      <TouchableOpacity
                        key={duration}
                        onPress={() => toggleDuration(duration)}
                        style={[
                          styles.durationChip,
                          formData.sessionDurations.includes(duration) && styles.durationChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.durationText,
                            formData.sessionDurations.includes(duration) && styles.durationTextSelected,
                          ]}
                        >
                          {duration} min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>In-Person Training</Text>
                    <Switch
                      value={formData.offersInPerson}
                      onValueChange={(value) => setFormData({ ...formData, offersInPerson: value })}
                      trackColor={{ false: COLORS.grayLight, true: COLORS.teal }}
                      thumbColor={COLORS.white}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Virtual Training</Text>
                    <Switch
                      value={formData.offersVirtual}
                      onValueChange={(value) => setFormData({ ...formData, offersVirtual: value })}
                      trackColor={{ false: COLORS.grayLight, true: COLORS.teal }}
                      thumbColor={COLORS.white}
                    />
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Location */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardAnims[3],
                    transform: [{
                      translateY: cardAnims[3].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    }],
                  },
                ]}
              >
                <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.cardGradient}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="location" size={22} color={COLORS.error} />
                    <Text style={styles.cardTitle}>Location</Text>
                  </View>
                  
                  {formData.locationAddress ? (
                    <Text style={styles.locationText}>📍 {formData.locationAddress}</Text>
                  ) : null}
                  
                  <TouchableOpacity
                    style={styles.locationButton}
                    onPress={getCurrentLocation}
                    disabled={gettingLocation}
                  >
                    <LinearGradient
                      colors={[COLORS.teal, COLORS.tealLight]}
                      style={styles.locationButtonGradient}
                    >
                      {gettingLocation ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <>
                          <Ionicons name="navigate" size={18} color={COLORS.white} />
                          <Text style={styles.locationButtonText}>
                            {formData.locationAddress ? 'Update Location' : 'Set Location'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <Text style={styles.inputLabel}>Primary Gym</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.primaryGym}
                    onChangeText={(text) => setFormData({ ...formData, primaryGym: text })}
                    placeholder="e.g. LA Fitness Downtown"
                    placeholderTextColor={COLORS.gray}
                  />
                </LinearGradient>
              </Animated.View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                <LinearGradient
                  colors={saving ? [COLORS.gray, COLORS.grayLight] : [COLORS.orangeHot, COLORS.orange]}
                  style={styles.saveButtonGradient}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  card: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardGradient: {
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.navy,
  },
  textArea: {
    backgroundColor: COLORS.grayLight,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.navy,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 8,
    marginTop: 8,
  },
  subLabel: {
    fontSize: 13,
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.grayLight,
  },
  chipSelected: {
    backgroundColor: COLORS.teal,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.grayLight,
    alignItems: 'center',
  },
  durationChipSelected: {
    backgroundColor: COLORS.orange,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navy,
  },
  durationTextSelected: {
    color: COLORS.white,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.navy,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.teal,
    marginBottom: 12,
  },
  locationButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
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
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
  },
});

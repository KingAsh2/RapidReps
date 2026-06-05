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
  Modal,
  FlatList,
  ImageBackground,
  Image,
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
import { toast } from '../../src/utils/toast';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';

const backgroundImage = require('../../assets/images/bg-box-jumps-orange.jpg');

// Brand colors
const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
  success: '#00C853',
  error: '#FF4757',
};

export default function EditTrainerProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
  const RADIUS_OPTIONS = Array.from({ length: 35 }, (_, i) => i + 1);

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
    travelRadiusMiles: '',
    profilePhoto: '',
    cancellationPolicy: 'Free cancellation before 24 hours',
    latitude: null as number | null,
    longitude: null as number | null,
    locationAddress: '',
    introVideoTitle: '',
    introVideoDescription: '',
    isAvailable: true,
    socialLinks: {} as Record<string, string>,
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
          travelRadiusMiles: typeof data.travelRadiusMiles === 'number' && data.travelRadiusMiles > 0 ? String(data.travelRadiusMiles) : '',
          profilePhoto: data.profilePhoto || data.avatarUrl || '',
          cancellationPolicy: data.cancellationPolicy || 'Free cancellation before 24 hours',
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          locationAddress: data.locationAddress || '',
          isAvailable: data.isAvailable ?? true,
          socialLinks: data.socialLinks || {},
          introVideoTitle: data.introVideoTitle || '',
          introVideoDescription: data.introVideoDescription || '',
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
        // iter102i: empty string = unlimited (no restriction). Backend treats
        // null/missing as no cap. Any positive int is enforced.
        travelRadiusMiles: formData.travelRadiusMiles && parseInt(formData.travelRadiusMiles) > 0
          ? parseInt(formData.travelRadiusMiles)
          : null,
        // Backend Pydantic model only accepts `avatarUrl`; legacy `profilePhoto` field was silently dropped, hence avatar never persisted.
        avatarUrl: formData.profilePhoto || undefined,
        profilePhoto: formData.profilePhoto || undefined,
        cancellationPolicy: formData.cancellationPolicy,
        latitude: formData.latitude,
        longitude: formData.longitude,
        locationAddress: formData.locationAddress,
        isAvailable: formData.isAvailable,
        socialLinks: formData.socialLinks,
        introVideoTitle: formData.introVideoTitle.trim(),
        introVideoDescription: formData.introVideoDescription.trim(),
      };

      if (profile) {
        await trainerAPI.updateProfile(profileData);
      } else {
        await trainerAPI.createProfile(profileData);
      }

      // iter102: refresh auth user so bottom-tab avatar reflects new photo immediately
      try { await refreshUser?.(); } catch {}

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

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      toast.error('Camera roll permission needed');
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

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.orange, COLORS.orangeLight, '#FF6A00']}
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
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient
          colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
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
              {/* Profile Photo */}
              <TouchableOpacity onPress={pickImage} style={{ alignSelf: 'center', marginBottom: 16 }} data-testid="edit-photo-btn">
                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' }}>
                  {formData.profilePhoto ? (
                    <Image source={{ uri: formData.profilePhoto }} style={{ width: 96, height: 96, borderRadius: 48 }} />
                  ) : (
                    <Ionicons name="camera" size={36} color={COLORS.white} />
                  )}
                </View>
                <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.orange, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white }}>
                  <Ionicons name="pencil" size={16} color={COLORS.white} />
                </View>
              </TouchableOpacity>

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
                <LinearGradient colors={['#141929', '#1A2035']} style={styles.cardGradient}>
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

                  {/* Intro Video Title + Description (iter84) — these appear above the Intro Video on public profile */}
                  <View style={{ marginTop: 18 }}>
                    <Text style={styles.inputLabel}>Intro Video Section Title</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.introVideoTitle}
                      onChangeText={(text) => setFormData({ ...formData, introVideoTitle: text })}
                      placeholder="Intro to my profile"
                      placeholderTextColor={COLORS.gray}
                      maxLength={60}
                      data-testid="intro-video-title-input"
                    />
                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Intro Video Description</Text>
                    <TextInput
                      style={styles.textArea}
                      value={formData.introVideoDescription}
                      onChangeText={(text) => setFormData({ ...formData, introVideoDescription: text })}
                      placeholder="A short note about what trainees will see in your intro video..."
                      placeholderTextColor={COLORS.gray}
                      multiline
                      numberOfLines={3}
                      maxLength={300}
                      data-testid="intro-video-description-input"
                    />
                  </View>
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
                      <Text style={styles.inputLabel}>Travel Radius</Text>
                      <View style={styles.sliderContainer}>
                        {/* iter102i: opt-in cap. Empty value = no limit (default).
                            Trainers can flip on a cap if they don't want to travel far. */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Ionicons
                              name={formData.travelRadiusMiles ? 'location' : 'infinite'}
                              size={16}
                              color={COLORS.orange}
                            />
                            <Text style={styles.sliderValueText}>
                              {formData.travelRadiusMiles
                                ? `${formData.travelRadiusMiles} ${parseInt(formData.travelRadiusMiles) === 1 ? 'mile' : 'miles'}`
                                : 'No limit'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setFormData({
                              ...formData,
                              travelRadiusMiles: formData.travelRadiusMiles ? '' : '10',
                            })}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: 'rgba(255,106,0,0.4)',
                            }}
                            data-testid="travel-radius-toggle-cap"
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.orange }}>
                              {formData.travelRadiusMiles ? 'Remove limit' : 'Set limit'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {formData.travelRadiusMiles ? (
                          <>
                            <Slider
                              style={{ width: '100%', height: 40 }}
                              minimumValue={1}
                              maximumValue={30}
                              step={1}
                              value={parseInt(formData.travelRadiusMiles) || 10}
                              onValueChange={(val: number) => setFormData({ ...formData, travelRadiusMiles: val.toString() })}
                              minimumTrackTintColor={COLORS.orange}
                              maximumTrackTintColor="rgba(26,42,94,0.2)"
                              thumbTintColor={COLORS.orange}
                              data-testid="radius-slider-inline"
                            />
                            <View style={styles.sliderLabelsRow}>
                              <Text style={styles.sliderLabel}>1 mi</Text>
                              <Text style={styles.sliderLabel}>30 mi</Text>
                            </View>
                          </>
                        ) : (
                          <Text style={{ fontSize: 11, color: 'rgba(26,42,94,0.55)', marginTop: 4 }}>
                            You'll appear for any trainee inside their own search radius.
                          </Text>
                        )}
                      </View>
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
                <LinearGradient colors={['#141929', '#1A2035']} style={styles.cardGradient}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="fitness" size={22} color={'#FF6A00'} />
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
                <LinearGradient colors={['#141929', '#1A2035']} style={styles.cardGradient}>
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
                      trackColor={{ false: COLORS.grayLight, true: '#FF6A00' }}
                      thumbColor={COLORS.white}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Virtual Training</Text>
                    <Switch
                      value={formData.offersVirtual}
                      onValueChange={(value) => setFormData({ ...formData, offersVirtual: value })}
                      trackColor={{ false: COLORS.grayLight, true: '#FF6A00' }}
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
                <LinearGradient colors={['#141929', '#1A2035']} style={styles.cardGradient}>
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
                      colors={['#0A0E1A', '#141929']}
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

              {/* Media Upload Section — file-based only */}
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardAnims[4],
                    transform: [{
                      translateY: cardAnims[4].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    }],
                  },
                ]}
              >
                <LinearGradient colors={['#141929', '#1A2035']} style={styles.cardGradient}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="image" size={22} color={'#FF6A00'} />
                    <Text style={styles.cardTitle}>Media</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                    Tap your profile photo above to change it. Add more photos and videos to your gallery from your Profile tab.
                  </Text>
                </LinearGradient>
              </Animated.View>

              {/* Social Links */}
              <Animated.View style={{ opacity: 1 }}>
                <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']} style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Social Media Links</Text>
                  {[
                    { key: 'instagram', icon: 'logo-instagram', label: 'Instagram', placeholder: 'username' },
                    { key: 'tiktok', icon: 'logo-tiktok', label: 'TikTok', placeholder: '@username' },
                    { key: 'youtube', icon: 'logo-youtube', label: 'YouTube', placeholder: '@channel' },
                    { key: 'twitter', icon: 'logo-twitter', label: 'X / Twitter', placeholder: '@handle' },
                    { key: 'website', icon: 'globe-outline', label: 'Website', placeholder: 'https://...' },
                  ].map((platform) => (
                    <View key={platform.key} style={styles.inputGroup}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Ionicons name={platform.icon as any} size={16} color={COLORS.orange} />
                        <Text style={styles.inputLabel}>{platform.label}</Text>
                      </View>
                      <TextInput
                        style={styles.input}
                        value={formData.socialLinks[platform.key] || ''}
                        onChangeText={(text) => setFormData({
                          ...formData,
                          socialLinks: { ...formData.socialLinks, [platform.key]: text },
                        })}
                        placeholder={platform.placeholder}
                        placeholderTextColor={COLORS.gray}
                        autoCapitalize="none"
                        data-testid={`social-${platform.key}-input`}
                      />
                    </View>
                  ))}
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
      </ImageBackground>
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
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 8,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  radiusSelector: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusSelectorValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sliderContainer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sliderValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sliderValueText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  sliderLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipSelected: {
    backgroundColor: '#0A0E1A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  durationChipSelected: {
    backgroundColor: COLORS.orange,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
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
  sectionCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 14,
  },
});


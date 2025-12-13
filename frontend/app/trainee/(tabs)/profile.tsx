import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { traineeAPI } from '../../../src/services/api';
import * as ImagePicker from 'expo-image-picker';

export default function TraineeProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    profilePhoto: '',
    fitnessGoals: '',
    experienceLevel: '',
    currentFitnessLevel: '',
    preferredTrainingStyles: [] as string[],
    injuriesOrLimitations: '',
    homeGymOrZipCode: '',
    prefersInPerson: true,
    prefersVirtual: true,
    budgetMinPerMinuteCents: 50,
    budgetMaxPerMinuteCents: 200,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profileData = await traineeAPI.getMyProfile();
      setProfile(profileData);
      
      // Populate form data
      setFormData({
        profilePhoto: profileData.profilePhoto || '',
        fitnessGoals: profileData.fitnessGoals || '',
        experienceLevel: profileData.experienceLevel || '',
        currentFitnessLevel: profileData.currentFitnessLevel || '',
        preferredTrainingStyles: profileData.preferredTrainingStyles || [],
        injuriesOrLimitations: profileData.injuriesOrLimitations || '',
        homeGymOrZipCode: profileData.homeGymOrZipCode || '',
        prefersInPerson: profileData.prefersInPerson ?? true,
        prefersVirtual: profileData.prefersVirtual ?? true,
        budgetMinPerMinuteCents: profileData.budgetMinPerMinuteCents || 50,
        budgetMaxPerMinuteCents: profileData.budgetMaxPerMinuteCents || 200,
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      showAlert({
        title: 'Loading Failed',
        message: 'Could not load your profile. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      showAlert({
        title: 'Permission Required',
        message: 'Camera roll permission is required to change your photo!',
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
      setFormData({ 
        ...formData, 
        profilePhoto: `data:image/jpeg;base64,${result.assets[0].base64}` 
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await traineeAPI.updateProfile(profile.userId, formData);
      
      showAlert({
        title: 'Success! 🎉',
        message: 'Your profile has been updated successfully!',
        type: 'success',
        buttons: [
          {
            text: 'OK',
            onPress: () => {
              setIsEditing(false);
              loadProfile();
            }
          }
        ],
      });
    } catch (error: any) {
      console.error('Save error:', error);
      showAlert({
        title: 'Update Failed',
        message: error.response?.data?.detail || 'Failed to update profile',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    showAlert({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/');
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={Colors.gradientTealStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={pickImage} style={styles.photoContainer}>
            {formData.profilePhoto ? (
              <Image source={{ uri: formData.profilePhoto }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={60} color={Colors.textLight} />
              </View>
            )}
            <View style={styles.editPhotoButton}>
              <Ionicons name="camera" size={20} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{user?.fullName}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>

        {/* Profile Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile Details</Text>
            {!isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                <Ionicons name="create-outline" size={20} color={Colors.secondary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Fitness Goals */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Fitness Goals</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.fitnessGoals}
              onChangeText={(text) => setFormData({ ...formData, fitnessGoals: text })}
              placeholder="e.g., Lose weight, build muscle, improve endurance"
              placeholderTextColor={Colors.textLight}
              multiline
              editable={isEditing}
            />
          </View>

          {/* Experience Level */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Experience Level</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.experienceLevel}
              onChangeText={(text) => setFormData({ ...formData, experienceLevel: text })}
              placeholder="e.g., Beginner, Intermediate, Advanced"
              placeholderTextColor={Colors.textLight}
              editable={isEditing}
            />
          </View>

          {/* Current Fitness Level */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Current Fitness Level</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.currentFitnessLevel}
              onChangeText={(text) => setFormData({ ...formData, currentFitnessLevel: text })}
              placeholder="Describe your current fitness"
              placeholderTextColor={Colors.textLight}
              editable={isEditing}
            />
          </View>

          {/* Injuries or Limitations */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Injuries or Limitations</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.injuriesOrLimitations}
              onChangeText={(text) => setFormData({ ...formData, injuriesOrLimitations: text })}
              placeholder="Any injuries or limitations?"
              placeholderTextColor={Colors.textLight}
              multiline
              editable={isEditing}
            />
          </View>

          {/* Home Gym or Zip Code */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Home Gym / Zip Code</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.homeGymOrZipCode}
              onChangeText={(text) => setFormData({ ...formData, homeGymOrZipCode: text })}
              placeholder="e.g., LA Fitness or 90210"
              placeholderTextColor={Colors.textLight}
              editable={isEditing}
            />
          </View>

          {/* Training Preferences */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Training Preferences</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>In-Person Training</Text>
              <Switch
                value={formData.prefersInPerson}
                onValueChange={(value) => setFormData({ ...formData, prefersInPerson: value })}
                trackColor={{ false: Colors.background, true: Colors.secondary }}
                thumbColor={formData.prefersInPerson ? Colors.primary : Colors.textLight}
                disabled={!isEditing}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Virtual Training</Text>
              <Switch
                value={formData.prefersVirtual}
                onValueChange={(value) => setFormData({ ...formData, prefersVirtual: value })}
                trackColor={{ false: Colors.background, true: Colors.secondary }}
                thumbColor={formData.prefersVirtual ? Colors.primary : Colors.textLight}
                disabled={!isEditing}
              />
            </View>
          </View>
        </View>

        {/* Save/Cancel Buttons */}
        {isEditing && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsEditing(false);
                loadProfile();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButtonGradient}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes 💪</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textLight,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.white,
    marginBottom: 16,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.navy,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.background,
    borderWidth: 4,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondary,
    borderWidth: 3,
    borderColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.textLight,
  },
  section: {
    backgroundColor: Colors.white,
    padding: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.navy,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: Colors.navy,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  inputDisabled: {
    backgroundColor: Colors.background,
    borderColor: Colors.background,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 3,
    borderColor: Colors.navy,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.navy,
  },
  saveButton: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.navy,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.white,
  },
});

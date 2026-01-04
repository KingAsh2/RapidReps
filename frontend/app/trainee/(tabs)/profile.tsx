import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { traineeAPI } from '../../../src/services/api';
import * as ImagePicker from 'expo-image-picker';

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
  error: '#FF4757',
};

export default function TraineeProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Animation refs
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(6)].map(() => new Animated.Value(0))).current;

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

  useEffect(() => {
    if (!loading) {
      // Header animation
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Staggered cards
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
    try {
      setLoading(true);
      const profileData = await traineeAPI.getMyProfile();
      setProfile(profileData);
      
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
      const profileData = {
        ...formData,
        userId: user?.id || profile?.userId
      };
      await traineeAPI.updateProfile(profileData);
      setIsEditing(false);
      loadProfile();
    } catch (error: any) {
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

  const handleDeleteAccount = async () => {
    showAlert({
      title: 'Delete Account',
      message: 'This will permanently delete your account and all data. This cannot be undone.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              const { authAPI } = await import('../../../src/services/api');
              await authAPI.deleteMe();
              logout();
              router.replace('/');
            } catch (error: any) {
              showAlert({
                title: 'Error',
                message: error?.response?.data?.detail || 'Unable to delete account.',
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.navy, COLORS.teal]}
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
    <View style={styles.container}>
      {/* Full gradient background */}
      <LinearGradient
        colors={[COLORS.navy, '#2a3a6e', COLORS.teal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Header */}
            <Animated.View
              style={[
                styles.profileHeader,
                {
                  opacity: headerAnim,
                  transform: [{ translateY: headerTranslateY }],
                },
              ]}
            >
              <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                {formData.profilePhoto ? (
                  <Image source={{ uri: formData.profilePhoto }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={[COLORS.orange, COLORS.orangeLight]}
                    style={styles.avatarPlaceholder}
                  >
                    <Ionicons name="person" size={50} color={COLORS.white} />
                  </LinearGradient>
                )}
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={16} color={COLORS.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.userName}>{user?.fullName || 'Athlete'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </Animated.View>

            {/* Stats Card */}
            <Animated.View
              style={[
                styles.statsCard,
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
              <LinearGradient
                colors={[COLORS.orange, COLORS.orangeLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statsGradient}
              >
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{profile?.experienceLevel || 'N/A'}</Text>
                  <Text style={styles.statLabel}>Experience</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formData.preferredTrainingStyles.length}</Text>
                  <Text style={styles.statLabel}>Styles</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formData.prefersVirtual ? '✓' : '✗'}</Text>
                  <Text style={styles.statLabel}>Virtual</Text>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Fitness Goals Card */}
            <Animated.View
              style={[
                styles.sectionCard,
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
              <LinearGradient
                colors={[COLORS.white, COLORS.offWhite]}
                style={styles.sectionGradient}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="trophy" size={22} color={COLORS.orange} />
                  <Text style={styles.sectionTitle}>Fitness Goals</Text>
                </View>
                {isEditing ? (
                  <TextInput
                    style={styles.textArea}
                    value={formData.fitnessGoals}
                    onChangeText={(text) => setFormData({ ...formData, fitnessGoals: text })}
                    placeholder="What are you working towards?"
                    placeholderTextColor={COLORS.gray}
                    multiline
                    numberOfLines={3}
                  />
                ) : (
                  <Text style={styles.sectionContent}>
                    {formData.fitnessGoals || 'No goals set yet'}
                  </Text>
                )}
              </LinearGradient>
            </Animated.View>

            {/* Training Preferences Card */}
            <Animated.View
              style={[
                styles.sectionCard,
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
              <LinearGradient
                colors={[COLORS.white, COLORS.offWhite]}
                style={styles.sectionGradient}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="settings" size={22} color={COLORS.teal} />
                  <Text style={styles.sectionTitle}>Training Preferences</Text>
                </View>
                <View style={styles.preferenceRow}>
                  <Text style={styles.preferenceLabel}>In-Person Training</Text>
                  <Switch
                    value={formData.prefersInPerson}
                    onValueChange={(value) => {
                      setFormData({ ...formData, prefersInPerson: value });
                      setIsEditing(true);
                    }}
                    trackColor={{ false: COLORS.grayLight, true: COLORS.teal }}
                    thumbColor={COLORS.white}
                  />
                </View>
                <View style={styles.preferenceRow}>
                  <Text style={styles.preferenceLabel}>Virtual Training</Text>
                  <Switch
                    value={formData.prefersVirtual}
                    onValueChange={(value) => {
                      setFormData({ ...formData, prefersVirtual: value });
                      setIsEditing(true);
                    }}
                    trackColor={{ false: COLORS.grayLight, true: COLORS.teal }}
                    thumbColor={COLORS.white}
                  />
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Quick Actions */}
            <Animated.View
              style={[
                styles.actionsCard,
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
              <LinearGradient
                colors={[COLORS.white, COLORS.offWhite]}
                style={styles.actionsGradient}
              >
                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/trainee/achievements')}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(253, 187, 45, 0.15)' }]}>
                    <Ionicons name="trophy" size={22} color="#FDBB2D" />
                  </View>
                  <Text style={styles.actionText}>Achievements</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/trainee/saved-trainers')}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(31, 184, 180, 0.15)' }]}>
                    <Ionicons name="heart" size={22} color={COLORS.teal} />
                  </View>
                  <Text style={styles.actionText}>Saved Trainers</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionItem}
                  onPress={() => router.push('/legal/terms')}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: 'rgba(136, 146, 176, 0.15)' }]}>
                    <Ionicons name="document-text" size={22} color={COLORS.gray} />
                  </View>
                  <Text style={styles.actionText}>Terms & Privacy</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>

            {/* Save / Edit Button */}
            {isEditing ? (
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                <LinearGradient
                  colors={[COLORS.teal, COLORS.tealLight]}
                  style={styles.saveButtonGradient}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color={COLORS.white} />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
              >
                <LinearGradient
                  colors={[COLORS.white, COLORS.offWhite]}
                  style={styles.editButtonGradient}
                >
                  <Ionicons name="pencil" size={18} color={COLORS.navy} />
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>

            {/* Delete Account */}
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  keyboardView: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Profile Header
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.teal,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userName: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  // Stats Card
  statsCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  statsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  // Section Card
  sectionCard: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  sectionGradient: {
    padding: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
  },
  sectionContent: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: COLORS.grayLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.navy,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy,
  },
  // Actions Card
  actionsCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  actionsGradient: {
    padding: 6,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.navy,
  },
  // Buttons
  saveButton: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  editButton: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    marginBottom: 16,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
    textDecorationLine: 'underline',
  },
});

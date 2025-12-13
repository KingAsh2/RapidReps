import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../src/utils/colors';
import { useAlert } from '../../src/contexts/AlertContext';
import axios from 'axios';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function VerificationScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  useEffect(() => {
    loadDocuments();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({
        title: 'Permission Required',
        message: 'Please grant camera roll permissions to upload documents.',
        type: 'warning',
      });
    }
  };

  const loadDocuments = async () => {
    try {
      const token = await getToken();
      const response = await axios.get(`${BACKEND_URL}/api/trainer-profiles/my-documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setDocuments(response.data.documents || []);
      setIsVerified(response.data.isVerified || false);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getToken = async () => {
    // Get token from AsyncStorage or SecureStore
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    return await AsyncStorage.getItem('token');
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSelectedImages([...selectedImages, base64Image]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to pick image',
        type: 'error',
      });
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSelectedImages([...selectedImages, base64Image]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const removeImage = (index: number) => {
    const updated = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(updated);
  };

  const uploadDocuments = async () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Documents', 'Please select at least one document to upload');
      return;
    }

    setUploading(true);
    try {
      const token = await getToken();
      const response = await axios.post(
        `${BACKEND_URL}/api/trainer-profiles/upload-documents`,
        { documents: selectedImages },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success!', response.data.message, [
        {
          text: 'OK',
          onPress: () => {
            setSelectedImages([]);
            loadDocuments();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to upload documents');
    } finally {
      setUploading(false);
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
      {/* Header */}
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Verification Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Ionicons
              name={isVerified ? 'checkmark-circle' : 'time-outline'}
              size={48}
              color={isVerified ? Colors.success : Colors.warning}
            />
            <Text style={styles.statusTitle}>
              {isVerified ? 'Verified Trainer ✓' : 'Pending Verification'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isVerified
                ? 'Your profile has been verified by our admin team'
                : 'Upload your certification documents for verification'}
            </Text>
          </View>

          <View style={styles.statusInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="document-text" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>
                Documents Uploaded: {documents.length}
              </Text>
            </View>
          </View>
        </View>

        {/* Instructions Card */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 What to Upload</Text>
          <View style={styles.instructionsList}>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.instructionText}>Certification documents (NASM, ACE, etc.)</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.instructionText}>Valid government ID</Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.instructionText}>Proof of insurance (if applicable)</Text>
            </View>
          </View>
        </View>

        {/* Upload Actions */}
        {!isVerified && (
          <>
            <View style={styles.uploadSection}>
              <Text style={styles.sectionTitle}>Add Documents</Text>
              <View style={styles.uploadButtons}>
                <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                  <LinearGradient
                    colors={Colors.gradientTealStart}
                    style={styles.uploadButtonGradient}
                  >
                    <Ionicons name="images" size={28} color={Colors.white} />
                    <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
                  <LinearGradient
                    colors={Colors.gradientOrangeStart}
                    style={styles.uploadButtonGradient}
                  >
                    <Ionicons name="camera" size={28} color={Colors.white} />
                    <Text style={styles.uploadButtonText}>Take Photo</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selected Images Preview */}
            {selectedImages.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.sectionTitle}>
                  Selected Documents ({selectedImages.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.previewContainer}>
                    {selectedImages.map((img, index) => (
                      <View key={index} style={styles.previewItem}>
                        <Image source={{ uri: img }} style={styles.previewImage} />
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close-circle" size={24} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {/* Upload Button */}
                <TouchableOpacity
                  onPress={uploadDocuments}
                  disabled={uploading}
                  style={styles.submitButtonContainer}
                >
                  <LinearGradient colors={Colors.gradientMain} style={styles.submitButton}>
                    <Ionicons name="cloud-upload" size={24} color={Colors.white} />
                    <Text style={styles.submitButtonText}>
                      {uploading ? 'Uploading...' : `Upload ${selectedImages.length} Document(s)`}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Uploaded Documents */}
        {documents.length > 0 && (
          <View style={styles.uploadedSection}>
            <Text style={styles.sectionTitle}>Uploaded Documents</Text>
            <Text style={styles.uploadedCount}>{documents.length} document(s) uploaded</Text>
            <View style={styles.uploadedGrid}>
              {documents.slice(0, 3).map((doc, index) => (
                <View key={index} style={styles.uploadedItem}>
                  <Image source={{ uri: doc }} style={styles.uploadedThumbnail} />
                  <Text style={styles.uploadedLabel}>Doc {index + 1}</Text>
                </View>
              ))}
              {documents.length > 3 && (
                <View style={[styles.uploadedItem, styles.moreItem]}>
                  <Text style={styles.moreText}>+{documents.length - 3}</Text>
                </View>
              )}
            </View>
          </View>
        )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statusCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.navy,
    marginTop: 12,
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusInfo: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    color: Colors.navy,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.navy,
    marginBottom: 16,
  },
  instructionsList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  instructionText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  uploadSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.navy,
    marginBottom: 16,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadButtonGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  previewSection: {
    marginBottom: 20,
  },
  previewContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  previewItem: {
    position: 'relative',
  },
  previewImage: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.white,
    borderRadius: 12,
  },
  submitButtonContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  uploadedSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  uploadedCount: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 16,
  },
  uploadedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  uploadedItem: {
    width: (width - 76) / 3,
    aspectRatio: 0.75,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  uploadedThumbnail: {
    width: '100%',
    height: '100%',
  },
  uploadedLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    fontSize: 11,
    color: Colors.white,
    textAlign: 'center',
  },
  moreItem: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  moreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

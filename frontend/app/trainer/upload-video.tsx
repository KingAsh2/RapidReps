import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { trainerAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';

const { width, height } = Dimensions.get('window');

// Vibrant brand colors
const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  teal: '#1a2a5e',
  tealLight: '#22E8DF',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
  success: '#00D26A',
  error: '#FF4757',
};

export default function UploadVideoScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  
  const videoRef = useRef<Video>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Please grant camera roll permissions to select a video.',
          type: 'warning',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setVideoUri(asset.uri);
        
        // Check duration
        if (asset.duration) {
          const durationSec = asset.duration / 1000;
          setVideoDuration(durationSec);
          
          if (durationSec < 10) {
            showAlert({
              title: 'Video Too Short',
              message: 'Your intro video must be at least 10 seconds.',
              type: 'warning',
            });
          } else if (durationSec > 30) {
            showAlert({
              title: 'Video Too Long',
              message: 'Your intro video must be 30 seconds or less.',
              type: 'warning',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error picking video:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to select video',
        type: 'error',
      });
    }
  };

  const recordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Please grant camera permissions to record a video.',
          type: 'warning',
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setVideoUri(asset.uri);
        
        if (asset.duration) {
          setVideoDuration(asset.duration / 1000);
        }
      }
    } catch (error) {
      console.error('Error recording video:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to record video',
        type: 'error',
      });
    }
  };

  const handleUpload = async () => {
    if (!videoUri) return;
    
    // Validate duration
    if (videoDuration < 10 || videoDuration > 30) {
      showAlert({
        title: 'Invalid Duration',
        message: 'Video must be between 10-30 seconds.',
        type: 'error',
      });
      return;
    }

    setUploading(true);
    
    try {
      // In production, you would upload to cloud storage (S3, etc.)
      // For now, we'll simulate the upload and save the local URI
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate upload
      
      await trainerAPI.uploadIntroVideo(videoUri);
      
      setUploaded(true);
      showAlert({
        title: 'Video Uploaded! 🎬',
        message: 'Your intro video has been uploaded successfully.',
        type: 'success',
      });
      
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error('Error uploading video:', error);
      showAlert({
        title: 'Upload Failed',
        message: 'Failed to upload video. Please try again.',
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const clearVideo = () => {
    setVideoUri(null);
    setVideoDuration(0);
  };

  const isValidDuration = videoDuration >= 10 && videoDuration <= 30;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.orange, COLORS.orangeLight]}
        style={styles.headerGradient}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Intro Video</Text>
          <View style={{ width: 40 }} />
        </View>

        <Animated.View 
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
          ]}
        >
          {!videoUri ? (
            /* Upload Options */
            <View style={styles.uploadSection}>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={[COLORS.orange, COLORS.orangeLight]}
                  style={styles.iconGradient}
                >
                  <Ionicons name="videocam" size={48} color={COLORS.white} />
                </LinearGradient>
              </View>
              
              <Text style={styles.title}>Record Your Intro</Text>
              <Text style={styles.subtitle}>
                Create a 10-30 second video introducing yourself to potential clients
              </Text>
              
              <View style={styles.requirementsList}>
                <View style={styles.requirementItem}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.requirementText}>Show your face clearly</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.requirementText}>State your name</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.requirementText}>Share your fitness background</Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.requirementText}>Be friendly & professional</Text>
                </View>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.recordButton} onPress={recordVideo}>
                  <LinearGradient
                    colors={[COLORS.orange, COLORS.orangeLight]}
                    style={styles.buttonGradient}
                  >
                    <Ionicons name="camera" size={24} color={COLORS.white} />
                    <Text style={styles.buttonText}>Record Video</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.uploadButton} onPress={pickVideo}>
                  <Ionicons name="folder-open" size={24} color={COLORS.orange} />
                  <Text style={styles.uploadButtonText}>Choose File</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Video Preview */
            <View style={styles.previewSection}>
              <View style={styles.videoContainer}>
                <Video
                  ref={videoRef}
                  source={{ uri: videoUri }}
                  style={styles.video}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                  isLooping
                />
                
                {/* Duration Badge */}
                <View style={[
                  styles.durationBadge,
                  isValidDuration ? styles.durationValid : styles.durationInvalid
                ]}>
                  <Ionicons 
                    name={isValidDuration ? "checkmark-circle" : "warning"} 
                    size={16} 
                    color={COLORS.white} 
                  />
                  <Text style={styles.durationText}>
                    {videoDuration.toFixed(1)}s
                  </Text>
                </View>
              </View>

              {/* Duration Info */}
              {!isValidDuration && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning" size={20} color={COLORS.error} />
                  <Text style={styles.warningText}>
                    {videoDuration < 10 
                      ? 'Video must be at least 10 seconds'
                      : 'Video must be 30 seconds or less'}
                  </Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.clearButton} onPress={clearVideo}>
                  <Ionicons name="trash" size={20} color={COLORS.error} />
                  <Text style={styles.clearButtonText}>Remove</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.submitButton,
                    (!isValidDuration || uploading) && styles.submitButtonDisabled
                  ]}
                  onPress={handleUpload}
                  disabled={!isValidDuration || uploading}
                >
                  <LinearGradient
                    colors={isValidDuration && !uploading 
                      ? [COLORS.success, '#00A854'] 
                      : [COLORS.gray, COLORS.grayLight]}
                    style={styles.submitGradient}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : uploaded ? (
                      <>
                        <Ionicons name="checkmark" size={24} color={COLORS.white} />
                        <Text style={styles.submitText}>Uploaded!</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={24} color={COLORS.white} />
                        <Text style={styles.submitText}>Upload Video</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A2035',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Upload Section
  uploadSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  requirementsList: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  requirementText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonRow: {
    width: '100%',
    gap: 12,
  },
  recordButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: COLORS.orange,
    borderRadius: 16,
    backgroundColor: '#141929',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.teal,
  },
  // Preview Section
  previewSection: {
    flex: 1,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: height * 0.5,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    marginBottom: 16,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  durationValid: {
    backgroundColor: COLORS.success,
  },
  durationInvalid: {
    backgroundColor: COLORS.error,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#141929',
    borderWidth: 2,
    borderColor: COLORS.error,
    borderRadius: 16,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.error,
  },
  submitButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
});

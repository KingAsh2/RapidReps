import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/services/api';

const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  grayLight: '#F5F6F8',
  success: '#00C853',
  error: '#FF4757',
  warning: '#FFB300',
};

const backgroundImage = require('../../assets/images/bg-gym-weights.png');

const VERIFICATION_STEPS = [
  {
    id: 'identity',
    title: 'Identity Verification',
    description: "Upload a valid government ID (Driver's License or Passport)",
    icon: 'id-card',
    required: true,
  },
  {
    id: 'background',
    title: 'Background Check',
    description: 'Authorize a secure background screening through Checkr',
    icon: 'shield-checkmark',
    required: true,
  },
  {
    id: 'certification',
    title: 'Fitness Certification',
    description: 'Upload your personal training certification (NASM, ACE, ISSA, etc.)',
    icon: 'ribbon',
    required: false,
  },
  {
    id: 'cpr',
    title: 'CPR/AED Certification',
    description: 'Upload your current CPR/AED certification',
    icon: 'heart',
    required: true,
  },
  {
    id: 'insurance',
    title: 'Liability Insurance',
    description: 'Upload proof of professional liability insurance',
    icon: 'document-text',
    required: false,
  },
  {
    id: 'photo',
    title: 'Profile Photo',
    description: 'Upload a professional headshot for your profile',
    icon: 'camera',
    required: true,
  },
  {
    id: 'video',
    title: 'Intro Video',
    description: 'Record a 30-60 second introduction video',
    icon: 'videocam',
    required: true,
  },
];

type StepStatus = 'pending' | 'uploading' | 'submitted' | 'approved' | 'rejected';

export default function TrainerVerificationScreen() {
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<Record<string, StepStatus>>({});
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [holdProgress] = useState(new Animated.Value(0));
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadVerificationStatus();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadVerificationStatus = async () => {
    try {
      const response = await api.get('/trainer/verification-status');
      const steps = response.data.steps || {};
      setVerificationStatus(steps);
    } catch (err) {
      console.log('Could not load verification status, using defaults');
      setVerificationStatus({
        identity: 'pending',
        background: 'pending',
        certification: 'pending',
        cpr: 'pending',
        insurance: 'pending',
        photo: 'pending',
        video: 'pending',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return { name: 'checkmark-circle', color: COLORS.success };
      case 'submitted':
        return { name: 'time', color: COLORS.warning };
      case 'rejected':
        return { name: 'close-circle', color: COLORS.error };
      case 'uploading':
        return { name: 'cloud-upload', color: COLORS.teal };
      default:
        return { name: 'ellipse-outline', color: COLORS.gray };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'submitted':
        return 'Under Review';
      case 'rejected':
        return 'Needs Attention';
      case 'uploading':
        return 'Uploading...';
      default:
        return 'Not Started';
    }
  };

  const submitStepToBackend = async (stepId: string, fileUri?: string, fileName?: string) => {
    try {
      await api.post('/trainer/submit-verification-step', {
        stepId,
        fileUri: fileUri || null,
        fileName: fileName || null,
      });
    } catch (err) {
      console.error('Failed to submit verification step:', err);
    }
  };

  const handleUploadDocument = async (stepId: string) => {
    try {
      setVerificationStatus(prev => ({ ...prev, [stepId]: 'uploading' }));

      if (stepId === 'photo') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          await submitStepToBackend(stepId, asset.uri, 'profile_photo.jpg');
          setVerificationStatus(prev => ({ ...prev, [stepId]: 'submitted' }));
          Alert.alert('Success', 'Profile photo uploaded successfully!');
        } else {
          setVerificationStatus(prev => ({ ...prev, [stepId]: 'pending' }));
        }
      } else if (stepId === 'video') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 0.8,
          videoMaxDuration: 60,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          await submitStepToBackend(stepId, asset.uri, 'intro_video.mp4');
          setVerificationStatus(prev => ({ ...prev, [stepId]: 'submitted' }));
          Alert.alert('Success', 'Intro video uploaded successfully!');
        } else {
          setVerificationStatus(prev => ({ ...prev, [stepId]: 'pending' }));
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          await submitStepToBackend(stepId, asset.uri, asset.name);
          setVerificationStatus(prev => ({ ...prev, [stepId]: 'submitted' }));
          Alert.alert('Success', 'Document uploaded successfully!');
        } else {
          setVerificationStatus(prev => ({ ...prev, [stepId]: 'pending' }));
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setVerificationStatus(prev => ({ ...prev, [stepId]: 'pending' }));
      Alert.alert('Error', 'Failed to upload. Please try again.');
    }
  };

  const handleStartBackgroundCheck = () => {
    Alert.alert(
      'Background Check',
      'You will be redirected to Checkr to complete your background check. This typically takes 2-5 business days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            await submitStepToBackend('background');
            setVerificationStatus(prev => ({ ...prev, background: 'submitted' }));
            Alert.alert('Background Check Started', 'You will receive an email from Checkr to complete the process.');
          },
        },
      ]
    );
  };

  const handleHoldSubmitStart = () => {
    holdProgress.setValue(0);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    holdTimer.current = setTimeout(async () => {
      setIsSubmitting(true);
      try {
        await api.post('/trainer/submit-all-verification');
        Alert.alert(
          'Verification Submitted!',
          'Your documents have been submitted for review. You will be notified once your account is approved.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.detail || 'Failed to submit verification.');
      } finally {
        setIsSubmitting(false);
      }
    }, 2000);
  };

  const handleHoldSubmitEnd = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdProgress.setValue(0);
  };

  const completedCount = Object.values(verificationStatus).filter(
    s => s === 'approved' || s === 'submitted'
  ).length;
  const progress = (completedCount / VERIFICATION_STEPS.length) * 100;

  const requiredComplete = VERIFICATION_STEPS.filter(s => s.required).every(
    s => verificationStatus[s.id] === 'submitted' || verificationStatus[s.id] === 'approved'
  );

  // Hide hold button once all docs are submitted or approved
  const allSubmitted = VERIFICATION_STEPS.filter(s => s.required).every(
    s => verificationStatus[s.id] === 'submitted' || verificationStatus[s.id] === 'approved'
  );

  const holdBarWidth = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(247, 147, 30, 0.9)', 'rgba(247, 147, 30, 0.85)', 'rgba(255, 165, 38, 0.8)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="verification-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trainer Verification</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Ionicons name="shield-checkmark" size={32} color={COLORS.teal} />
                <View style={styles.progressTextContainer}>
                  <Text style={styles.progressTitle}>Verification Progress</Text>
                  <Text style={styles.progressSubtitle}>
                    {completedCount} of {VERIFICATION_STEPS.length} steps completed
                  </Text>
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={COLORS.teal} />
                <Text style={styles.infoText}>
                  Complete all required steps to start accepting clients. Verification typically takes 1-3 business days.
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Required Documents</Text>

            {VERIFICATION_STEPS.map((step) => {
              const status = verificationStatus[step.id] || 'pending';
              const statusInfo = getStatusIcon(status);
              const isExpanded = expandedStep === step.id;

              return (
                <TouchableOpacity
                  key={step.id}
                  style={[
                    styles.stepCard,
                    status === 'approved' && styles.stepCardApproved,
                    status === 'rejected' && styles.stepCardRejected,
                  ]}
                  onPress={() => setExpandedStep(isExpanded ? null : step.id)}
                  activeOpacity={0.9}
                  data-testid={`verification-step-${step.id}`}
                >
                  <View style={styles.stepHeader}>
                    <View style={[styles.stepIconContainer, { backgroundColor: `${statusInfo.color}20` }]}>
                      <Ionicons name={step.icon as any} size={24} color={statusInfo.color} />
                    </View>

                    <View style={styles.stepContent}>
                      <View style={styles.stepTitleRow}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        {step.required && status === 'pending' && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredText}>REQUIRED</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.statusRow}>
                        <Ionicons name={statusInfo.name as any} size={16} color={statusInfo.color} />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {getStatusText(status)}
                        </Text>
                      </View>
                    </View>

                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={COLORS.gray}
                    />
                  </View>

                  {isExpanded && (
                    <View style={styles.stepExpanded}>
                      <Text style={styles.stepDescription}>{step.description}</Text>

                      {status !== 'approved' && status !== 'uploading' && (
                        <TouchableOpacity
                          style={styles.uploadButton}
                          onPress={() => {
                            if (step.id === 'background') {
                              handleStartBackgroundCheck();
                            } else {
                              handleUploadDocument(step.id);
                            }
                          }}
                          data-testid={`upload-btn-${step.id}`}
                        >
                          <LinearGradient
                            colors={[COLORS.teal, '#18A09D']}
                            style={styles.uploadButtonGradient}
                          >
                            <Ionicons
                              name={step.id === 'background' ? 'open-outline' : 'cloud-upload'}
                              size={20}
                              color={COLORS.white}
                            />
                            <Text style={styles.uploadButtonText}>
                              {status === 'submitted' ? 'Re-upload' :
                               step.id === 'background' ? 'Start Check' :
                               step.id === 'photo' || step.id === 'video' ? 'Select File' : 'Upload Document'}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}

                      {status === 'uploading' && (
                        <View style={styles.uploadingContainer}>
                          <ActivityIndicator size="small" color={COLORS.teal} />
                          <Text style={styles.uploadingText}>Uploading...</Text>
                        </View>
                      )}

                      {status === 'rejected' && (
                        <View style={styles.rejectedInfo}>
                          <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                          <Text style={styles.rejectedText}>
                            Document was rejected. Please upload a clearer image.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Trust & Safety */}
            <View style={styles.trustCard}>
              <View style={styles.trustHeader}>
                <Ionicons name="lock-closed" size={24} color={COLORS.teal} />
                <Text style={styles.trustTitle}>Trust & Safety</Text>
              </View>
              <Text style={styles.trustText}>
                Your documents are encrypted and stored securely. We partner with Checkr for background checks,
                the same service used by Uber, Lyft, and other major platforms.
              </Text>
              <View style={styles.trustBadges}>
                <View style={styles.trustBadge}>
                  <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
                  <Text style={styles.trustBadgeText}>SSL Encrypted</Text>
                </View>
                <View style={styles.trustBadge}>
                  <Ionicons name="eye-off" size={16} color={COLORS.success} />
                  <Text style={styles.trustBadgeText}>Privacy Protected</Text>
                </View>
              </View>
            </View>

            {/* Hold to Submit Button - Only show if not all submitted/approved */}
            {!allSubmitted && (
            <View style={styles.submitSection}>
              <Text style={styles.submitHint}>
                {requiredComplete
                  ? 'Hold the button below for 2 seconds to submit your verification.'
                  : 'Complete all required steps above before submitting.'}
              </Text>
              <Pressable
                onPressIn={requiredComplete && !isSubmitting ? handleHoldSubmitStart : undefined}
                onPressOut={handleHoldSubmitEnd}
                disabled={!requiredComplete || isSubmitting}
                style={({ pressed }) => [
                  styles.holdButton,
                  !requiredComplete && styles.holdButtonDisabled,
                  pressed && requiredComplete && styles.holdButtonPressed,
                ]}
                data-testid="hold-to-submit-btn"
              >
                <View style={styles.holdButtonInner}>
                  <Animated.View
                    style={[
                      styles.holdProgressBar,
                      { width: holdBarWidth, backgroundColor: COLORS.success },
                    ]}
                  />
                  <View style={styles.holdButtonContent}>
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Ionicons name="hand-left" size={24} color={COLORS.white} />
                    )}
                    <Text style={styles.holdButtonText}>
                      {isSubmitting ? 'Submitting...' : 'Hold to Submit Verification'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
            )}

            <View style={{ height: 100 }} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  content: { flex: 1, paddingHorizontal: 16 },
  progressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 14 },
  progressTextContainer: { flex: 1 },
  progressTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  progressSubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  progressBarBg: { flex: 1, height: 8, backgroundColor: COLORS.grayLight, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.teal, borderRadius: 4 },
  progressPercent: { fontSize: 14, fontWeight: '700', color: COLORS.teal, width: 45 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(31, 184, 180, 0.1)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.gray, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginBottom: 16 },
  stepCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  stepCardApproved: { borderLeftWidth: 4, borderLeftColor: COLORS.success },
  stepCardRejected: { borderLeftWidth: 4, borderLeftColor: COLORS.error },
  stepHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  stepIconContainer: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  stepContent: { flex: 1 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  requiredBadge: { backgroundColor: COLORS.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  requiredText: { fontSize: 9, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  stepExpanded: { padding: 16, paddingTop: 0, borderTopWidth: 1, borderTopColor: COLORS.grayLight },
  stepDescription: { fontSize: 13, color: COLORS.gray, lineHeight: 20, marginBottom: 16, marginTop: 12 },
  uploadButton: { borderRadius: 12, overflow: 'hidden' },
  uploadButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  uploadButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  uploadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  uploadingText: { fontSize: 14, color: COLORS.teal, fontWeight: '600' },
  rejectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginTop: 12,
  },
  rejectedText: { flex: 1, fontSize: 12, color: COLORS.error },
  trustCard: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 20, marginTop: 8 },
  trustHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  trustTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  trustText: { fontSize: 13, color: COLORS.gray, lineHeight: 20, marginBottom: 16 },
  trustBadges: { flexDirection: 'row', gap: 16 },
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.success },
  // Hold to Submit
  submitSection: { marginTop: 24, alignItems: 'center' },
  submitHint: { fontSize: 13, color: COLORS.white, textAlign: 'center', marginBottom: 16, lineHeight: 18, opacity: 0.9 },
  holdButton: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  holdButtonDisabled: { opacity: 0.5 },
  holdButtonPressed: { transform: [{ scale: 0.98 }] },
  holdButtonInner: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  holdProgressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 16 },
  holdButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
    zIndex: 1,
  },
  holdButtonText: { fontSize: 17, fontWeight: '800', color: COLORS.white },
});

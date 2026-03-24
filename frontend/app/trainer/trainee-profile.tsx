import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trainerAPI, safetyAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';

export default function TraineeProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();


  const handleReportTrainee = () => {
    showAlert({
      title: 'Report',
      message: 'Report this trainee for spam, harassment, or inappropriate content?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await safetyAPI.reportUser({
                reportedUserId: traineeId as string,
                reason: 'Reported from trainee profile',
                contentType: 'profile',
              });
              // Silent success - no popup
            } catch (e: any) {
              showAlert({ title: 'Error', message: e?.message || 'Unable to submit report.', type: 'error' });
            }
          },
        },
      ],
    });
  };

  const handleBlockTrainee = () => {
    showAlert({
      title: 'Block Trainee',
      message: 'Blocking hides this trainee from your results and prevents future interactions.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await safetyAPI.blockUser(traineeId as string);
              // Navigate back silently
              router.back();
            } catch (e: any) {
              showAlert({ title: 'Error', message: e?.message || 'Unable to block user.', type: 'error' });
            }
          },
        },
      ],
    });
  };
  
  const sessionId = params.sessionId as string;
  const traineeId = params.traineeId as string;
  const traineeName = params.traineeName as string;
  const traineePhoto = params.traineePhoto as string;
  const sessionDetails = params.sessionDetails as string;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [proposedLocation, setProposedLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sessionDetails) {
      try {
        setSession(JSON.parse(sessionDetails));
      } catch (e) {
        console.error('Error parsing session details:', e);
      }
    }
  }, [sessionDetails]);

  const reloadSession = async () => {
    try {
      const sessions = await trainerAPI.getSessions();
      const found = sessions.find((s: any) => s.id === sessionId);
      if (found) setSession(found);
    } catch (e) {
      console.error('Error reloading session:', e);
    }
  };

  const handleProposeLocation = async () => {
    if (!proposedLocation.trim()) {
      toast.error('Please enter a location');
      return;
    }
    setSubmitting(true);
    try {
      await trainerAPI.proposeLocation(session.id, proposedLocation.trim());
      haptic.success();
      toast.success('Location proposal sent!');
      setShowLocationModal(false);
      setProposedLocation('');
      reloadSession();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to send proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmArrival = async () => {
    setSubmitting(true);
    try {
      const result = await trainerAPI.confirmArrival(session.id);
      haptic.success();
      toast.success(result.message);
      reloadSession();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to confirm arrival');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    showAlert({
      title: 'Accept Session Request',
      message: 'Are you sure you want to accept this session?',
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setLoading(true);
            try {
              await trainerAPI.acceptSession(sessionId);
              
              // Show success with payment notification
              showAlert({
                title: 'Session Accepted! 🎉',
                message: 'The trainee has been notified and will process payment. You\'ll receive location details once confirmed.',
                type: 'success',
                buttons: [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ],
              });
            } catch (error: any) {
              console.error('Error accepting session:', error);
              showAlert({
                title: 'Accept Failed',
                message: 'Failed to accept session. Please try again.',
                type: 'error',
              });
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    });
  };

  const handleDeny = async () => {
    showAlert({
      title: 'Decline Session Request',
      message: 'Are you sure you want to decline this session? The trainee will be notified.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await trainerAPI.declineSession(sessionId);
              
              showAlert({
                title: 'Session Declined',
                message: 'The trainee has been notified that you are unavailable.',
                type: 'info',
                buttons: [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ],
              });
            } catch (error) {
              console.error('Error declining session:', error);
              showAlert({
                title: 'Decline Failed',
                message: 'Failed to decline session. Please try again.',
                type: 'error',
              });
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    });
  };

  const handleNavigate = () => {
    // Open en-route screen with GPS tracking instead of raw maps link
    router.push({
      pathname: '/trainer/en-route',
      params: {
        sessionId,
        traineeName,
        traineeId,
        traineeAddress: session?.locationNameOrAddress || '',
        traineeLat: session?.traineeLatitude?.toString() || '',
        traineeLng: session?.traineeLongitude?.toString() || '',
        sessionType: session?.sessionType || 'outdoor',
      },
    });
  };

  const handleMessage = () => {
    router.push({
      pathname: '/messages/chat',
      params: { userId: traineeId, userName: traineeName },
    });
  };

  const handleCall = () => {
    const phone = session?.traineePhone || params.traineePhone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      showAlert({
        title: 'Contact Unavailable',
        message: 'Contact information will be shared after session is confirmed.',
        type: 'info',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trainee Profile</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {traineePhoto ? (
              <Image
                source={{ uri: traineePhoto }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={60} color={Colors.primary} />
              </View>
            )}
          </View>
          
          <Text style={styles.traineeName}>{traineeName || 'Trainee'}</Text>
          
          {session?.traineeGoals && (
            <View style={styles.goalsContainer}>
              <Text style={styles.goalsLabel}>Goals:</Text>
              <Text style={styles.goalsText}>{session.traineeGoals}</Text>
            </View>
          )}
        </View>

        {/* Session Details Card */}
        {session && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Session Details</Text>
            
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={Colors.navy} />
              <Text style={styles.detailText}>
                {new Date(session.sessionDateTimeStart).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color={Colors.navy} />
              <Text style={styles.detailText}>
                {new Date(session.sessionDateTimeStart).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="hourglass-outline" size={20} color={Colors.navy} />
              <Text style={styles.detailText}>{session.durationMinutes} minutes</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={20} color={Colors.navy} />
              <Text style={styles.detailText}>{session.locationType || 'In-Person'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={20} color={Colors.navy} />
              <Text style={styles.detailText}>
                ${((session.finalSessionPriceCents || 0) / 100).toFixed(2)}
              </Text>
            </View>

            {session.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{session.notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            onPress={async () => {
              try {
                const { chatAPI } = await import('../../src/services/api');
                const result = await chatAPI.getOrCreateConversation(session?.traineeId || '');
                router.push(`/messages/chat?conversationId=${result.conversationId}&userId=${session?.traineeId}&userName=${traineeName}`);
              } catch (error) {
                console.error('Error creating conversation:', error);
              }
            }}
            style={styles.actionButton}
          >
            <Ionicons name="chatbubble" size={24} color={Colors.secondary} />
            <Text style={styles.actionButtonText}>Message Trainee</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNavigate} style={styles.actionButton}>
            <Ionicons name="navigate" size={24} color={Colors.primary} />
            <Text style={styles.actionButtonText}>Navigate to Trainee</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCall} style={styles.actionButton}>
            <Ionicons name="call" size={24} color={Colors.success} />
            <Text style={styles.actionButtonText}>Call Trainee</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Location Management for Outdoor Sessions */}
        {session && session.sessionType === 'outdoor' && (session.status === 'confirmed' || session.status === 'en_route') && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Meeting Location</Text>
            
            {/* Current Location */}
            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color={Colors.primary} />
              <Text style={styles.detailText}>
                {session.locationNameOrAddress || session.outdoorLocationTrainerProposal || 'Not set'}
              </Text>
            </View>

            {/* Location Agreement Status */}
            {session.outdoorLocationAgreed ? (
              <View style={styles.agreedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.agreedText}>Location Confirmed</Text>
              </View>
            ) : session.outdoorLocationTrainerProposal ? (
              <View style={styles.pendingBadge}>
                <Ionicons name="time" size={18} color={Colors.warning} />
                <Text style={styles.pendingText}>Waiting for trainee to confirm</Text>
              </View>
            ) : null}

            {/* Propose/Change Location Button */}
            <TouchableOpacity
              style={styles.proposeLocationBtn}
              onPress={() => setShowLocationModal(true)}
              data-testid="propose-location-btn"
            >
              <Ionicons name="create" size={20} color={Colors.white} />
              <Text style={styles.proposeLocationText}>
                {session.outdoorLocationTrainerProposal ? 'Change Location' : 'Propose Meeting Spot'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Arrival Confirmation */}
        {session && (session.status === 'confirmed' || session.status === 'en_route') && !session.trainerArrivedConfirmed && (
          <TouchableOpacity
            style={styles.arrivalCard}
            onPress={handleConfirmArrival}
            disabled={submitting}
            data-testid="confirm-arrival-btn"
          >
            <LinearGradient colors={[Colors.secondary, Colors.primary]} style={styles.arrivalGradient}>
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="location" size={24} color={Colors.white} />
                  <View style={styles.arrivalContent}>
                    <Text style={styles.arrivalTitle}>I Have Arrived</Text>
                    <Text style={styles.arrivalSubtitle}>Tap to notify the trainee</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={Colors.white} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Arrival Status */}
        {session?.trainerArrivedConfirmed && (
          <View style={styles.arrivalStatus}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.arrivalStatusText}>You have confirmed arrival</Text>
            {session.traineeArrivedConfirmed ? (
              <View style={styles.bothArrivedBadge}>
                <Ionicons name="people" size={16} color={Colors.white} />
                <Text style={styles.bothArrivedText}>Both Ready!</Text>
              </View>
            ) : (
              <Text style={styles.waitingText}>Waiting for trainee...</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Location Proposal Modal */}
      <Modal visible={showLocationModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Propose Meeting Location</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)} data-testid="close-location-modal">
                <Ionicons name="close" size={24} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Enter the address or description of where you will meet:</Text>
            <TextInput
              style={styles.locationInput}
              placeholder="e.g., Central Park near 72nd St entrance"
              placeholderTextColor={Colors.textLight}
              value={proposedLocation}
              onChangeText={setProposedLocation}
              multiline
              data-testid="location-proposal-input"
            />
            <TouchableOpacity
              style={[styles.modalBtn, !proposedLocation.trim() && styles.modalBtnDisabled]}
              onPress={handleProposeLocation}
              disabled={submitting || !proposedLocation.trim()}
              data-testid="submit-location-proposal-btn"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.modalBtnText}>Send to Trainee</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Action Buttons */}
      {session?.status === 'requested' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            onPress={handleDeny}
            disabled={loading}
            style={[styles.actionButtonLarge, styles.denyButton]}
          >
            <Ionicons name="close-circle" size={24} color={Colors.white} />
            <Text style={styles.actionButtonLargeText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAccept}
            disabled={loading}
            style={[styles.actionButtonLarge, styles.acceptButton]}
          >
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              style={styles.acceptButtonGradient}
            >
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
              <Text style={styles.actionButtonLargeText}>
                {loading ? 'Accepting...' : 'Accept'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.navy,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.navy,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  traineeName: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 8,
  },
  goalsContainer: {
    marginTop: 12,
    width: '100%',
  },
  goalsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 4,
  },
  goalsText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  detailsCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 24,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  notesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  actionsCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 24,
    marginBottom: 100,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.navy,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 3,
    borderTopColor: Colors.navy,
  },
  actionButtonLarge: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  denyButton: {
    backgroundColor: Colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  acceptButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  actionButtonLargeText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },

  section: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  dangerRow: {
    borderColor: Colors.error,
  },
  dangerText: {
    color: Colors.error,
  },
  // Location proposal styles
  agreedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  agreedText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning,
  },
  proposeLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  proposeLocationText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  // Arrival styles
  arrivalCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  arrivalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  arrivalContent: {
    flex: 1,
  },
  arrivalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  arrivalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  arrivalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  arrivalStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  waitingText: {
    fontSize: 13,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  bothArrivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bothArrivedText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.navy,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 12,
  },
  locationInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtn: {
    backgroundColor: Colors.secondary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});

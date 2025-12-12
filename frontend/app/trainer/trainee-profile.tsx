import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trainerAPI } from '../../src/services/api';

export default function TraineeProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const sessionId = params.sessionId as string;
  const traineeId = params.traineeId as string;
  const traineeName = params.traineeName as string;
  const traineePhoto = params.traineePhoto as string;
  const sessionDetails = params.sessionDetails as string;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionDetails) {
      try {
        setSession(JSON.parse(sessionDetails));
      } catch (e) {
        console.error('Error parsing session details:', e);
      }
    }
  }, [sessionDetails]);

  const handleAccept = async () => {
    Alert.alert(
      'Accept Session Request',
      'Are you sure you want to accept this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setLoading(true);
            try {
              await trainerAPI.acceptSession(sessionId);
              
              // Show success with payment notification
              Alert.alert(
                'Session Accepted! 🎉',
                'The trainee has been notified and will process payment. You\'ll receive location details once confirmed.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error accepting session:', error);
              Alert.alert('Error', 'Failed to accept session. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeny = async () => {
    Alert.alert(
      'Decline Session Request',
      'Are you sure you want to decline this session? The trainee will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Mock API call - in real app would update session status
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              Alert.alert(
                'Session Declined',
                'The trainee has been notified that you are unavailable.',
                [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error) {
              console.error('Error declining session:', error);
              Alert.alert('Error', 'Failed to decline session. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleNavigate = () => {
    if (session?.traineeLocation) {
      const { latitude, longitude } = session.traineeLocation;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Location Not Available', 'Trainee location will be shared after payment confirmation.');
    }
  };

  const handleCall = () => {
    if (session?.traineePhone) {
      Linking.openURL(`tel:${session.traineePhone}`);
    } else {
      Alert.alert('Contact Unavailable', 'Contact information will be shared after session is confirmed.');
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
      </ScrollView>

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
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Image,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { trainerAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { Session, SessionStatus } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import { AnimatedLogo } from '../../src/components/AnimatedLogo';

export default function TrainerHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [nearbyTrainees, setNearbyTrainees] = useState<any[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsData, earningsData, traineesData, profileData] = await Promise.all([
        trainerAPI.getSessions(),
        trainerAPI.getEarnings(),
        trainerAPI.getNearbyTrainees(),
        trainerAPI.getMyProfile().catch(() => null),
      ]);
      setSessions(sessionsData);
      setEarnings(earningsData);
      setNearbyTrainees(traineesData.trainees || []);
      if (profileData) {
        setIsAvailable(profileData.isAvailable ?? true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleAvailability = async (value: boolean) => {
    setAvailabilityLoading(true);
    try {
      await trainerAPI.toggleAvailability(value);
      setIsAvailable(value);
    } catch (error) {
      console.error('Error toggling availability:', error);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleAccept = async (sessionId: string) => {
    try {
      await trainerAPI.acceptSession(sessionId);
      loadData();
    } catch (error) {
      console.error('Error accepting session:', error);
    }
  };

  const handleDecline = async (sessionId: string) => {
    try {
      await trainerAPI.declineSession(sessionId);
      loadData();
    } catch (error) {
      console.error('Error declining session:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const pendingSessions = sessions.filter(s => s.status === SessionStatus.REQUESTED);
  const upcomingSessions = sessions.filter(s => s.status === SessionStatus.CONFIRMED);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <AnimatedLogo size={50} animationType="elastic-scale" />
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>Hello, {user?.fullName?.split(' ')[0] || 'Trainer'}!</Text>
            <Text style={styles.subGreeting}>Manage your sessions</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => router.push('/messages')} 
              style={styles.messagesButton}
            >
              <Ionicons name="chatbubbles-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/trainer/achievements')} 
              style={styles.achievementsButton}
            >
              <Ionicons name="trophy" size={24} color={Colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {/* Availability Toggle Card */}
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityHeader}>
            <View style={styles.availabilityIconContainer}>
              <Ionicons 
                name={isAvailable ? "radio-button-on" : "radio-button-off"} 
                size={28} 
                color={isAvailable ? Colors.success : Colors.textLight} 
              />
            </View>
            <View style={styles.availabilityInfo}>
              <Text style={styles.availabilityTitle}>Trainer Status</Text>
              <Text style={[styles.availabilityStatus, isAvailable && styles.availabilityStatusOnline]}>
                {isAvailable ? '🟢 Available to Trainees' : '🔴 Unavailable'}
              </Text>
            </View>
            {availabilityLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Switch
                value={isAvailable}
                onValueChange={handleToggleAvailability}
                trackColor={{ false: Colors.textLight, true: Colors.primary }}
                thumbColor={Colors.white}
                ios_backgroundColor={Colors.textLight}
              />
            )}
          </View>
          <Text style={styles.availabilityDescription}>
            {isAvailable 
              ? 'You are visible to trainees in your area' 
              : 'Toggle on to accept new clients'}
          </Text>
        </View>

        {/* Nearby Trainees Section */}
        {nearbyTrainees.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nearby Trainees ({nearbyTrainees.length}) 📍</Text>
            {nearbyTrainees.map((trainee, index) => (
              <View key={index} style={styles.traineeCard}>
                <View style={styles.traineeAvatarContainer}>
                  {trainee.profilePhoto ? (
                    <Image source={{ uri: trainee.profilePhoto }} style={styles.traineeAvatar} />
                  ) : (
                    <View style={styles.traineeAvatarPlaceholder}>
                      <Ionicons name="person" size={28} color={Colors.primary} />
                    </View>
                  )}
                </View>
                <View style={styles.traineeInfo}>
                  <View style={styles.traineeHeader}>
                    <Text style={styles.traineeName}>{trainee.fullName}</Text>
                    <View style={styles.distanceBadge}>
                      <Ionicons name="location" size={14} color={Colors.white} />
                      <Text style={styles.distanceText}>{trainee.distance} mi</Text>
                    </View>
                  </View>
                  {trainee.fitnessGoals && (
                    <View style={styles.goalRow}>
                      <Ionicons name="trophy" size={14} color={Colors.secondary} />
                      <Text style={styles.goalText} numberOfLines={2}>{trainee.fitnessGoals}</Text>
                    </View>
                  )}
                  {trainee.experienceLevel && (
                    <View style={styles.expRow}>
                      <Ionicons name="barbell" size={14} color={Colors.textLight} />
                      <Text style={styles.expText}>{trainee.experienceLevel}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {nearbyTrainees.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nearby Trainees 📍</Text>
            <View style={styles.emptySection}>
              <Ionicons name="people-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No trainees in your area yet</Text>
              <Text style={styles.emptySubtext}>Make sure your location is set in your profile</Text>
            </View>
          </View>
        )}

        {/* Earnings Card */}
        {earnings && (
          <View style={styles.earningsCard}>
            <View style={styles.earningsHeader}>
              <Ionicons name="wallet" size={24} color={Colors.primary} />
              <Text style={styles.earningsTitle}>Earnings</Text>
            </View>
            <Text style={styles.earningsAmount}>
              ${(earnings.totalEarningsCents / 100).toFixed(2)}
            </Text>
            <View style={styles.earningsBreakdown}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsLabel}>This Week</Text>
                <Text style={styles.earningsValue}>
                  ${(earnings.weekEarningsCents / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsLabel}>This Month</Text>
                <Text style={styles.earningsValue}>
                  ${(earnings.monthEarningsCents / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/trainer/edit-profile')}
          >
            <Ionicons name="person-circle" size={32} color={Colors.primary} />
            <Text style={styles.actionText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/trainer/verification')}
          >
            <Ionicons name="shield-checkmark" size={32} color={Colors.success} />
            <Text style={styles.actionText}>Verification</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Requests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Requests ({pendingSessions.length})</Text>
          {pendingSessions.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No pending requests</Text>
            </View>
          ) : (
            pendingSessions.map((session) => (
              <TouchableOpacity 
                key={session.id} 
                style={styles.sessionCard}
                onPress={() => router.push({
                  pathname: '/trainer/trainee-profile',
                  params: {
                    sessionId: session.id,
                    traineeId: session.traineeId,
                    traineeName: session.traineeName || 'Trainee',
                    traineePhoto: session.traineePhoto || '',
                    sessionDetails: JSON.stringify(session),
                  }
                })}
                activeOpacity={0.7}
              >
                <View style={styles.sessionHeader}>
                  <View style={styles.traineeInfo}>
                    {session.traineePhoto ? (
                      <Image 
                        source={{ uri: session.traineePhoto }} 
                        style={styles.traineeAvatar}
                      />
                    ) : (
                      <View style={styles.traineeAvatarPlaceholder}>
                        <Ionicons name="person" size={20} color={Colors.textLight} />
                      </View>
                    )}
                    <View>
                      <Text style={styles.traineeName}>
                        {session.traineeName || 'Trainee'}
                      </Text>
                      <Text style={styles.sessionDate}>
                        {new Date(session.sessionDateTimeStart).toLocaleDateString()} at{' '}
                        {new Date(session.sessionDateTimeStart).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>Pending</Text>
                  </View>
                </View>
                
                <View style={styles.sessionDetails}>
                  <View style={styles.sessionDetail}>
                    <Ionicons name="time-outline" size={16} color={Colors.textLight} />
                    <Text style={styles.sessionDetailText}>
                      {session.durationMinutes} minutes
                    </Text>
                  </View>
                  <View style={styles.sessionDetail}>
                    <Ionicons name="location-outline" size={16} color={Colors.textLight} />
                    <Text style={styles.sessionDetailText}>
                      {session.locationType}
                    </Text>
                  </View>
                  <View style={styles.sessionDetail}>
                    <Ionicons name="cash-outline" size={16} color={Colors.textLight} />
                    <Text style={styles.sessionDetailText}>
                      ${(session.finalSessionPriceCents / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.tapHint}>
                  <Ionicons name="eye-outline" size={16} color={Colors.secondary} />
                  <Text style={styles.tapHintText}>Tap to view trainee profile</Text>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAccept(session.id);
                    }}
                  >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDecline(session.id);
                    }}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Upcoming Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Sessions ({upcomingSessions.length})</Text>
          {upcomingSessions.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No upcoming sessions</Text>
            </View>
          ) : (
            upcomingSessions.map((session) => (
              <View key={session.id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View>
                    <Text style={styles.sessionDate}>
                      {new Date(session.sessionDateTimeStart).toLocaleDateString()}
                    </Text>
                    <Text style={styles.sessionTime}>
                      {new Date(session.sessionDateTimeStart).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, styles.statusBadgeConfirmed]}>
                    <Text style={styles.statusText}>Confirmed</Text>
                  </View>
                </View>
                
                <View style={styles.sessionDetails}>
                  <View style={styles.sessionDetail}>
                    <Ionicons name="time-outline" size={16} color={Colors.textLight} />
                    <Text style={styles.sessionDetailText}>
                      {session.durationMinutes} minutes
                    </Text>
                  </View>
                  <View style={styles.sessionDetail}>
                    <Ionicons name="location-outline" size={16} color={Colors.textLight} />
                    <Text style={styles.sessionDetailText}>
                      {session.locationType}
                    </Text>
                  </View>
                  <View style={styles.sessionDetail}>
                    <Ionicons name="cash-outline" size={16} color={Colors.textLight} />
                    <Text style={styles.sessionDetailText}>
                      You earn: ${(session.trainerEarningsCents / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      </SafeAreaView>
    </>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  greetingSection: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.navy,
    letterSpacing: 0.5,
  },
  subGreeting: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  achievementsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  availabilityCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.navy,
    marginHorizontal: 24,
    marginTop: 24,
    padding: 20,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  availabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  availabilityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  availabilityInfo: {
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 4,
  },
  availabilityStatus: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textLight,
  },
  availabilityStatusOnline: {
    color: Colors.success,
  },
  availabilityDescription: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 8,
  },
  earningsCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.navy,
    marginHorizontal: 24,
    marginTop: 24,
    padding: 20,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  earningsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.navy,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 16,
  },
  earningsBreakdown: {
    flexDirection: 'row',
    gap: 24,
  },
  earningsStat: {
    flex: 1,
  },
  earningsLabel: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.navy,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.navy,
    marginBottom: 16,
  },
  emptySection: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  traineeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  traineeAvatarContainer: {
    marginRight: 16,
  },
  traineeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.navy,
  },
  traineeAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  traineeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  traineeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  traineeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.navy,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  goalText: {
    flex: 1,
    fontSize: 13,
    color: Colors.navy,
    lineHeight: 18,
  },
  expRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  sessionCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.navy,
  },
  sessionTime: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeConfirmed: {
    backgroundColor: Colors.success,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  sessionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  sessionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionDetailText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
  declineButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.error,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.error,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  tapHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 24,
    marginTop: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 20,
    alignItems: 'center',
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.navy,
    marginTop: 8,
    textAlign: 'center',
  },
});

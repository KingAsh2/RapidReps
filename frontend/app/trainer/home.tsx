import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { trainerAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { Session, SessionStatus } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { AnimatedLogo } from '../../src/components/AnimatedLogo';

export default function TrainerHomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [earnings, setEarnings] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsData, earningsData] = await Promise.all([
        trainerAPI.getSessions(),
        trainerAPI.getEarnings(),
      ]);
      setSessions(sessionsData);
      setEarnings(earningsData);
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
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
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

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(session.id)}
                  >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => handleDecline(session.id)}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  subGreeting: {
    fontSize: 14,
    color: Colors.white,
    marginTop: 2,
    opacity: 0.9,
  },
  logoutButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  earningsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 24,
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 24,
    marginTop: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.navy,
    marginTop: 8,
    textAlign: 'center',
  },
});

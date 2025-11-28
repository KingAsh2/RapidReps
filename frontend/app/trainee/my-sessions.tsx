import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { traineeAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { Session, SessionStatus } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MySessionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await traineeAPI.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  const handleRateSession = (sessionId: string, trainerId: string) => {
    router.push(`/trainee/rate-session?sessionId=${sessionId}&trainerId=${trainerId}`);
  };

  const upcomingSessions = sessions.filter(
    (s) =>
      s.status === SessionStatus.REQUESTED ||
      s.status === SessionStatus.CONFIRMED ||
      new Date(s.sessionDateTimeStart) > new Date()
  );

  const pastSessions = sessions.filter(
    (s) =>
      s.status === SessionStatus.COMPLETED ||
      s.status === SessionStatus.DECLINED ||
      s.status === SessionStatus.CANCELLED ||
      (s.status === SessionStatus.CONFIRMED && new Date(s.sessionDateTimeStart) <= new Date())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case SessionStatus.REQUESTED:
        return Colors.warning;
      case SessionStatus.CONFIRMED:
        return Colors.success;
      case SessionStatus.COMPLETED:
        return Colors.neonBlue;
      case SessionStatus.DECLINED:
      case SessionStatus.CANCELLED:
        return Colors.error;
      default:
        return Colors.textLight;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case SessionStatus.REQUESTED:
        return 'Pending';
      case SessionStatus.CONFIRMED:
        return 'Confirmed';
      case SessionStatus.COMPLETED:
        return 'Completed';
      case SessionStatus.DECLINED:
        return 'Declined';
      case SessionStatus.CANCELLED:
        return 'Cancelled';
      default:
        return status;
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
        colors={Colors.gradientTealStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Sessions</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcomingSessions.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past ({pastSessions.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        <View style={styles.sessionsList}>
          {activeTab === 'upcoming' ? (
            upcomingSessions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color={Colors.textLight} />
                <Text style={styles.emptyText}>No upcoming sessions</Text>
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={() => router.push('/trainee/home')}
                >
                  <Text style={styles.browseButtonText}>Find Trainers</Text>
                </TouchableOpacity>
              </View>
            ) : (
              upcomingSessions.map((session) => (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View>
                      <Text style={styles.sessionDate}>
                        {new Date(session.sessionDateTimeStart).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.sessionTime}>
                        {new Date(session.sessionDateTimeStart).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(session.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.sessionDetails}>
                    <View style={styles.detail}>
                      <Ionicons name="time-outline" size={18} color={Colors.textLight} />
                      <Text style={styles.detailText}>{session.durationMinutes} minutes</Text>
                    </View>
                    <View style={styles.detail}>
                      <Ionicons name="location-outline" size={18} color={Colors.textLight} />
                      <Text style={styles.detailText}>{session.locationType}</Text>
                    </View>
                    {session.locationNameOrAddress && (
                      <View style={styles.detail}>
                        <Ionicons name="business-outline" size={18} color={Colors.textLight} />
                        <Text style={styles.detailText}>{session.locationNameOrAddress}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.priceSection}>
                    <Text style={styles.priceLabel}>Total Paid</Text>
                    <Text style={styles.priceValue}>
                      ${(session.finalSessionPriceCents / 100).toFixed(2)}
                    </Text>
                  </View>

                  {session.discountAmountCents > 0 && (
                    <View style={styles.discountBadge}>
                      <Ionicons name="pricetag" size={16} color={Colors.success} />
                      <Text style={styles.discountText}>
                        Saved ${(session.discountAmountCents / 100).toFixed(2)}!
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )
          ) : (
            pastSessions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={64} color={Colors.textLight} />
                <Text style={styles.emptyText}>No past sessions</Text>
              </View>
            ) : (
              pastSessions.map((session) => (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View>
                      <Text style={styles.sessionDate}>
                        {new Date(session.sessionDateTimeStart).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.sessionTime}>
                        {new Date(session.sessionDateTimeStart).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(session.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(session.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.sessionDetails}>
                    <View style={styles.detail}>
                      <Ionicons name="time-outline" size={18} color={Colors.textLight} />
                      <Text style={styles.detailText}>{session.durationMinutes} minutes</Text>
                    </View>
                    <View style={styles.detail}>
                      <Ionicons name="location-outline" size={18} color={Colors.textLight} />
                      <Text style={styles.detailText}>{session.locationType}</Text>
                    </View>
                  </View>

                  {session.status === SessionStatus.COMPLETED && (
                    <TouchableOpacity
                      style={styles.rateButton}
                      onPress={() => handleRateSession(session.id, session.trainerId)}
                    >
                      <LinearGradient
                        colors={Colors.gradientOrange}
                        style={styles.rateButtonGradient}
                      >
                        <Ionicons name="star" size={20} color={Colors.white} />
                        <Text style={styles.rateButtonText}>Rate Session</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  sessionsList: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.navy,
    marginTop: 16,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  sessionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
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
    marginBottom: 12,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.textLight,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  discountText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
  },
  rateButton: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  rateButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

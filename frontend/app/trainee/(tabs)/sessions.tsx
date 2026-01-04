import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { traineeAPI } from '../../../src/services/api';

export default function SessionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await traineeAPI.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
      showAlert({
        title: 'Loading Failed',
        message: 'Could not load your sessions. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  const upcomingSessions = sessions.filter(s => s.status === 'confirmed' && new Date(s.sessionDateTimeStart) > new Date());
  const pendingSessions = sessions.filter(s => s.status === 'requested');
  const pastSessions = sessions.filter(s => s.status === 'completed' || (s.status === 'confirmed' && new Date(s.sessionDateTimeStart) <= new Date()));
  const cancelledSessions = sessions.filter(s => s.status === 'cancelled');

  const handleCancelSession = async (session: any) => {
    const isAccepted = session.status === 'confirmed';
    const sessionPrice = session.finalSessionPriceCents / 100;
    const cancellationFee = isAccepted ? sessionPrice * 0.20 : 0;
    const refundAmount = sessionPrice - cancellationFee;

    let message = `Session Price: $${sessionPrice.toFixed(2)}\n\n`;
    
    if (isAccepted) {
      message += `⚠️ This session was already accepted by the trainer.\n\n`;
      message += `Cancellation Fee (20%): $${cancellationFee.toFixed(2)}\n`;
      message += `Refund Amount (80%): $${refundAmount.toFixed(2)}\n\n`;
      message += `Do you want to proceed?`;
    } else {
      message += `✓ No cancellation fee (session not yet accepted)\n`;
      message += `Full Refund: $${refundAmount.toFixed(2)}`;
    }

    showAlert({
      title: 'Cancel Session?',
      message: message,
      type: 'warning',
      buttons: [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await traineeAPI.cancelSession(session._id);
              
              showAlert({
                title: 'Session Cancelled ✓',
                message: result.message,
                type: 'success',
              });
              
              loadSessions();
            } catch (error: any) {
              showAlert({
                title: 'Cancellation Failed',
                message: error.response?.data?.detail || 'Could not cancel session. Please try again or contact support.',
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const renderSession = (session: any) => {
    const isUpcoming = session.status === 'confirmed';
    const isPending = session.status === 'requested';
    const isPast = session.status === 'completed';
    const isCancelled = session.status === 'cancelled';

    return (
      <View key={session.id} style={styles.sessionCard}>
        {/* Status Badge */}
        <View style={[
          styles.statusBadge,
          isPending && styles.statusPending,
          isUpcoming && styles.statusUpcoming,
          isPast && styles.statusPast,
          isCancelled && styles.statusCancelled,
        ]}>
          <Ionicons 
            name={
              isPending ? 'time-outline' : 
              isUpcoming ? 'checkmark-circle' :
              isPast ? 'checkmark-done' : 
              'close-circle'
            } 
            size={16} 
            color={Colors.white} 
          />
          <Text style={styles.statusText}>
            {isPending ? 'Pending' : isUpcoming ? 'Confirmed' : isPast ? 'Completed' : 'Cancelled'}
          </Text>
        </View>

        {/* Session Info */}
        <View style={styles.sessionHeader}>
          {session.trainerPhoto ? (
            <Image source={{ uri: session.trainerPhoto }} style={styles.trainerAvatar} />
          ) : (
            <View style={styles.trainerAvatarPlaceholder}>
              <Ionicons name="person" size={24} color={Colors.textLight} />
            </View>
          )}
          <View style={styles.sessionInfo}>
            <Text style={styles.trainerName}>{session.trainerName || 'Trainer'}</Text>
            <View style={styles.sessionDetail}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textLight} />
              <Text style={styles.sessionDetailText}>
                {new Date(session.sessionDateTimeStart).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.sessionDetail}>
              <Ionicons name="time-outline" size={14} color={Colors.textLight} />
              <Text style={styles.sessionDetailText}>
                {new Date(session.sessionDateTimeStart).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })} • {session.durationMinutes} min
              </Text>
            </View>
          </View>
        </View>

        {/* Location & Price */}
        <View style={styles.sessionMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={16} color={Colors.secondary} />
            <Text style={styles.metaText}>{session.locationType || 'In-Person'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={16} color={Colors.secondary} />
            <Text style={styles.metaText}>
              ${((session.finalSessionPriceCents || 0) / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionButtons}>
          {isUpcoming && (
            <>
              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={() => handleCancelSession(session)}
              >
                <Text style={styles.actionButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButtonPrimary}
                onPress={() => router.push(`/trainee/trainer-detail?trainerId=${session.trainerId}`)}
              >
                <LinearGradient
                  colors={[Colors.secondary, Colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionButtonGradient}
                >
                  <Text style={styles.actionButtonPrimaryText}>View Details</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
          {isPending && (
            <>
              <View style={styles.pendingInfo}>
                <Ionicons name="hourglass-outline" size={16} color={Colors.warning} />
                <Text style={styles.pendingText}>Waiting for trainer to accept...</Text>
              </View>
              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={() => handleCancelSession(session)}
              >
                <Text style={styles.actionButtonSecondaryText}>Withdraw Request</Text>
              </TouchableOpacity>
            </>
          )}
          {isPast && !session.hasRated && (
            <TouchableOpacity
              style={styles.actionButtonPrimary}
              onPress={() => router.push({
                pathname: '/trainee/rate-session',
                params: {
                  sessionId: session.id,
                  trainerId: session.trainerId,
                },
              })}
            >
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="star-outline" size={16} color={Colors.white} />
                <Text style={styles.actionButtonPrimaryText}>Rate Session</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {isPast && session.hasRated && (
            <View style={styles.ratedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.ratedText}>Rated</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTabContent = () => {
    const sessionsToShow = activeTab === 'upcoming' ? upcomingSessions : 
                          activeTab === 'pending' ? pendingSessions : 
                          [...pastSessions, ...cancelledSessions];

    if (sessionsToShow.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons 
            name={
              activeTab === 'upcoming' ? 'calendar-outline' : 
              activeTab === 'pending' ? 'time-outline' : 
              'checkmark-done-outline'
            } 
            size={80} 
            color={Colors.textLight} 
          />
          <Text style={styles.emptyTitle}>
            {activeTab === 'upcoming' ? 'No Upcoming Sessions' :
             activeTab === 'pending' ? 'No Pending Requests' :
             'No Past Sessions'}
          </Text>
          <Text style={styles.emptyText}>
            {activeTab === 'upcoming' ? 'Book a session to see it here!' :
             activeTab === 'pending' ? 'Your session requests will appear here' :
             'Completed sessions will appear here'}
          </Text>
        </View>
      );
    }

    return sessionsToShow.map(renderSession);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading sessions...</Text>
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
        <Text style={styles.headerTitle}>My Sessions</Text>
        <Text style={styles.headerSubtitle}>
          {upcomingSessions.length} upcoming • {pendingSessions.length} pending
        </Text>
      </LinearGradient>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
          {upcomingSessions.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{upcomingSessions.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending
          </Text>
          {pendingSessions.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingSessions.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sessions List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {renderTabContent()}
        <View style={{ height: 20 }} />
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 2,
    borderBottomColor: Colors.background,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    gap: 8,
  },
  tabActive: {
    borderBottomColor: Colors.secondary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: Colors.secondary,
  },
  tabBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.white,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sessionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 16,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  statusPending: {
    backgroundColor: Colors.warning,
  },
  statusUpcoming: {
    backgroundColor: Colors.success,
  },
  statusPast: {
    backgroundColor: Colors.textLight,
  },
  statusCancelled: {
    backgroundColor: Colors.error,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.white,
  },
  sessionHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  trainerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.navy,
    marginRight: 12,
  },
  trainerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 4,
  },
  sessionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  sessionDetailText: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '600',
  },
  sessionMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.navy,
    alignItems: 'center',
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.navy,
  },
  actionButtonPrimary: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.navy,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.white,
  },
  pendingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.warning,
  },
  ratedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  ratedText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.navy,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    maxWidth: 250,
  },
});

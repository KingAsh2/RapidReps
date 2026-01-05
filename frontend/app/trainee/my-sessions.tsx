import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { traineeAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { Session, SessionStatus } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  success: '#00D68F',
  warning: '#FFAA00',
  error: '#FF4757',
  gray: '#8892b0',
};

export default function MySessionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSessions();
    Animated.spring(headerAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: activeTab === 'upcoming' ? 0 : 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case SessionStatus.REQUESTED:
        return { color: COLORS.warning, text: 'Pending', icon: 'time' };
      case SessionStatus.CONFIRMED:
        return { color: COLORS.success, text: 'Confirmed', icon: 'checkmark-circle' };
      case SessionStatus.COMPLETED:
        return { color: COLORS.teal, text: 'Completed', icon: 'trophy' };
      case SessionStatus.DECLINED:
        return { color: COLORS.error, text: 'Declined', icon: 'close-circle' };
      case SessionStatus.CANCELLED:
        return { color: COLORS.error, text: 'Cancelled', icon: 'close-circle' };
      default:
        return { color: COLORS.gray, text: status, icon: 'help-circle' };
    }
  };

  const displayedSessions = activeTab === 'upcoming' ? upcomingSessions : pastSessions;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[COLORS.navy, COLORS.navyLight, COLORS.teal]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading your sessions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.navy, COLORS.navyLight, COLORS.teal]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <Animated.View style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }]
          }
        ]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MY SESSIONS</Text>
          <View style={{ width: 44 }} />
        </Animated.View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <View style={styles.tabBackground}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
              onPress={() => setActiveTab('upcoming')}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="calendar" 
                size={18} 
                color={activeTab === 'upcoming' ? COLORS.navy : COLORS.white} 
              />
              <Text style={[
                styles.tabText,
                activeTab === 'upcoming' && styles.tabTextActive
              ]}>
                Upcoming ({upcomingSessions.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'past' && styles.tabButtonActive]}
              onPress={() => setActiveTab('past')}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="time" 
                size={18} 
                color={activeTab === 'past' ? COLORS.navy : COLORS.white} 
              />
              <Text style={[
                styles.tabText,
                activeTab === 'past' && styles.tabTextActive
              ]}>
                Past ({pastSessions.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={[COLORS.teal]}
              tintColor={COLORS.white}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {displayedSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.08)']}
                style={styles.emptyCard}
              >
                <Ionicons 
                  name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'} 
                  size={64} 
                  color={COLORS.white} 
                />
                <Text style={styles.emptyTitle}>
                  {activeTab === 'upcoming' ? 'No Upcoming Sessions' : 'No Past Sessions'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 'upcoming' 
                    ? 'Book your next workout and crush your goals!' 
                    : 'Your session history will appear here'}
                </Text>
                {activeTab === 'upcoming' && (
                  <TouchableOpacity
                    style={styles.findTrainersButton}
                    onPress={() => router.push('/trainee/(tabs)/home')}
                  >
                    <LinearGradient
                      colors={[COLORS.orange, COLORS.orangeHot]}
                      style={styles.findTrainersGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="search" size={20} color={COLORS.white} />
                      <Text style={styles.findTrainersText}>Find Trainers</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </LinearGradient>
            </View>
          ) : (
            displayedSessions.map((session, index) => {
              const statusConfig = getStatusConfig(session.status);
              
              return (
                <View key={session.id} style={styles.sessionCard}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)']}
                    style={styles.sessionCardGradient}
                  >
                    {/* Status Badge */}
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
                      <Ionicons name={statusConfig.icon as any} size={14} color={COLORS.white} />
                      <Text style={styles.statusText}>{statusConfig.text}</Text>
                    </View>

                    {/* Date & Time */}
                    <View style={styles.dateTimeRow}>
                      <View style={styles.dateBox}>
                        <Text style={styles.dateDay}>
                          {new Date(session.sessionDateTimeStart).getDate()}
                        </Text>
                        <Text style={styles.dateMonth}>
                          {new Date(session.sessionDateTimeStart).toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                      </View>
                      <View style={styles.timeDetails}>
                        <Text style={styles.sessionTitle}>Training Session</Text>
                        <View style={styles.timeRow}>
                          <Ionicons name="time-outline" size={16} color={COLORS.gray} />
                          <Text style={styles.timeText}>
                            {new Date(session.sessionDateTimeStart).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                          <Text style={styles.durationText}>
                            • {session.durationMinutes} min
                          </Text>
                        </View>
                        <View style={styles.locationRow}>
                          <Ionicons name="location-outline" size={16} color={COLORS.gray} />
                          <Text style={styles.locationText}>{session.locationType}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Price Section */}
                    <View style={styles.priceSection}>
                      <Text style={styles.priceLabel}>Total Paid</Text>
                      <Text style={styles.priceValue}>
                        ${(session.finalSessionPriceCents / 100).toFixed(2)}
                      </Text>
                    </View>

                    {/* Discount Badge */}
                    {session.discountAmountCents > 0 && (
                      <View style={styles.discountBadge}>
                        <Ionicons name="pricetag" size={16} color={COLORS.success} />
                        <Text style={styles.discountText}>
                          Saved ${(session.discountAmountCents / 100).toFixed(2)}!
                        </Text>
                      </View>
                    )}

                    {/* Rate Button for Completed Sessions */}
                    {session.status === SessionStatus.COMPLETED && activeTab === 'past' && (
                      <TouchableOpacity
                        style={styles.rateButton}
                        onPress={() => handleRateSession(session.id, session.trainerId)}
                      >
                        <LinearGradient
                          colors={[COLORS.orange, COLORS.orangeHot]}
                          style={styles.rateButtonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons name="star" size={18} color={COLORS.white} />
                          <Text style={styles.rateButtonText}>Rate Session</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </LinearGradient>
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  tabContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tabBackground: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: COLORS.white,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  tabTextActive: {
    color: COLORS.navy,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  emptyState: {
    paddingTop: 40,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  findTrainersButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  findTrainersGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  findTrainersText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  sessionCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  sessionCardGradient: {
    padding: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dateBox: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 56,
    marginRight: 16,
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    lineHeight: 24,
  },
  dateMonth: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  timeDetails: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.teal,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 214, 143, 0.1)',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  discountText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.success,
  },
  rateButton: {
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  rateButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
});

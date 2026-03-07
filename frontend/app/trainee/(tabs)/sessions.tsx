import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { traineeAPI } from '../../../src/services/api';

const { width } = Dimensions.get('window');

// Background image
const backgroundImage = require('../../../assets/images/bg-spin-class.png');

// Brand colors - UNIFIED DESIGN SYSTEM
const COLORS = {
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  tealDark: '#0D8B88',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  orangeGlow: '#FFB347',
  yellow: '#FDBB2D',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#8892b0',
  grayLight: '#E8ECF0',
  success: '#00C853',
  error: '#FF4757',
  warning: '#FFA502',
  // Glass card colors
  cardBg: 'rgba(255,255,255,0.12)',
  cardBorder: 'rgba(255,255,255,0.2)',
};

export default function SessionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const tabsAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(20)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (!loading) {
      // Header animation
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Tabs animation
      setTimeout(() => {
        Animated.spring(tabsAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 150);

      // Staggered cards
      cardAnims.forEach((anim, index) => {
        setTimeout(() => {
          Animated.spring(anim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }, 250 + (index * 80));
      });
    }
  }, [loading, activeTab]);

  const loadSessions = async () => {
    try {
      setLoading(true);
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

  const upcomingSessions = sessions.filter(s => s.status === 'confirmed' && new Date(s.sessionDateTimeStart) > new Date());
  const pendingSessions = sessions.filter(s => s.status === 'requested');
  const pastSessions = sessions.filter(s => s.status === 'completed' || s.status === 'cancelled' || (s.status === 'confirmed' && new Date(s.sessionDateTimeStart) <= new Date()));

  const handleCancelSession = async (session: any) => {
    const isAccepted = session.status === 'confirmed';
    const sessionPrice = session.finalSessionPriceCents / 100;
    const cancellationFee = isAccepted ? sessionPrice * 0.20 : 0;
    const refundAmount = sessionPrice - cancellationFee;

    let message = `Session Price: $${sessionPrice.toFixed(2)}\n\n`;
    
    if (isAccepted) {
      message += `⚠️ This session was already accepted.\n\n`;
      message += `Cancellation Fee (20%): $${cancellationFee.toFixed(2)}\n`;
      message += `Refund Amount: $${refundAmount.toFixed(2)}`;
    } else {
      message += `✓ No cancellation fee\nFull Refund: $${refundAmount.toFixed(2)}`;
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
              await traineeAPI.cancelSession(session.id);
              loadSessions();
            } catch (error: any) {
              showAlert({
                title: 'Cancellation Failed',
                message: error.response?.data?.detail || 'Could not cancel session.',
                type: 'error',
              });
            }
          },
        },
      ],
    });
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'upcoming': return upcomingSessions;
      case 'pending': return pendingSessions;
      case 'past': return pastSessions;
      default: return [];
    }
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  const tabsTranslateY = tabsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.teal, COLORS.tealLight, COLORS.orange]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading your sessions...</Text>
      </LinearGradient>
    );
  }

  return (
    <ImageBackground 
      source={backgroundImage} 
      style={styles.container}
      resizeMode="cover"
    >
      {/* Orange overlay for consistency */}
      <LinearGradient
        colors={['rgba(247, 147, 30, 0.85)', 'rgba(247, 147, 30, 0.75)', 'rgba(255, 165, 38, 0.7)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <Text style={styles.headerTitle}>MY SESSIONS 📅</Text>
          <Text style={styles.headerSubtitle}>
            {upcomingSessions.length} upcoming • {pendingSessions.length} pending
          </Text>
        </Animated.View>

        {/* Tab Bar */}
        <Animated.View
          style={[
            styles.tabBar,
            {
              opacity: tabsAnim,
              transform: [{ translateY: tabsTranslateY }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('upcoming')}
            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          >
            <LinearGradient
              colors={activeTab === 'upcoming' ? [COLORS.white, COLORS.offWhite] : ['transparent', 'transparent']}
              style={styles.tabGradient}
            >
              <Ionicons 
                name="calendar" 
                size={18} 
                color={activeTab === 'upcoming' ? COLORS.teal : 'rgba(255,255,255,0.7)'} 
              />
              <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                Upcoming
              </Text>
              {upcomingSessions.length > 0 && (
                <View style={[styles.tabBadge, activeTab === 'upcoming' && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === 'upcoming' && styles.tabBadgeTextActive]}>
                    {upcomingSessions.length}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('pending')}
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          >
            <LinearGradient
              colors={activeTab === 'pending' ? [COLORS.white, COLORS.offWhite] : ['transparent', 'transparent']}
              style={styles.tabGradient}
            >
              <Ionicons 
                name="time" 
                size={18} 
                color={activeTab === 'pending' ? COLORS.orange : 'rgba(255,255,255,0.7)'} 
              />
              <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
                Pending
              </Text>
              {pendingSessions.length > 0 && (
                <View style={[styles.tabBadge, styles.tabBadgePending, activeTab === 'pending' && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === 'pending' && styles.tabBadgeTextActive]}>
                    {pendingSessions.length}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('past')}
            style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          >
            <LinearGradient
              colors={activeTab === 'past' ? [COLORS.white, COLORS.offWhite] : ['transparent', 'transparent']}
              style={styles.tabGradient}
            >
              <Ionicons 
                name="checkmark-done" 
                size={18} 
                color={activeTab === 'past' ? COLORS.gray : 'rgba(255,255,255,0.7)'} 
              />
              <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
                History
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />
          }
        >
          {getActiveData().length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyGradient}>
                <Ionicons 
                  name={activeTab === 'upcoming' ? 'calendar-outline' : activeTab === 'pending' ? 'time-outline' : 'archive-outline'} 
                  size={56} 
                  color={COLORS.white} 
                />
                <Text style={styles.emptyTitle}>
                  {activeTab === 'upcoming' ? 'No upcoming sessions' : 
                   activeTab === 'pending' ? 'No pending requests' : 
                   'No session history'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 'upcoming' ? 'Book a trainer to get started!' : 
                   activeTab === 'pending' ? 'Your requests will appear here' : 
                   'Completed sessions show up here'}
                </Text>
                {activeTab !== 'past' && (
                  <TouchableOpacity 
                    style={styles.emptyButton}
                    onPress={() => router.push('/trainee/(tabs)/home')}
                  >
                    <LinearGradient
                      colors={[COLORS.orange, COLORS.orangeLight]}
                      style={styles.emptyButtonGradient}
                    >
                      <Text style={styles.emptyButtonText}>Find Trainers</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            getActiveData().map((session, index) => {
              const isUpcoming = session.status === 'confirmed' && new Date(session.sessionDateTimeStart) > new Date();
              const isPending = session.status === 'requested';
              const isCancelled = session.status === 'cancelled';
              const isCompleted = session.status === 'completed';
              const isEnRoute = session.status === 'en_route';

              return (
                <Animated.View
                  key={session.id || index}
                  style={[
                    styles.sessionCard,
                    {
                      opacity: cardAnims[index] || 1,
                      transform: [{
                        translateY: (cardAnims[index] || new Animated.Value(1)).interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        }),
                      }],
                    },
                  ]}
                >
                  <View style={styles.sessionGradient}>
                    {/* Status Badge */}
                    <View style={[
                      styles.statusBadge,
                      isPending && styles.statusPending,
                      (isUpcoming || isEnRoute) && styles.statusUpcoming,
                      isCompleted && styles.statusCompleted,
                      isCancelled && styles.statusCancelled,
                    ]}>
                      <Ionicons 
                        name={
                          isPending ? 'time' : 
                          isEnRoute ? 'navigate' :
                          isUpcoming ? 'checkmark-circle' :
                          isCompleted ? 'checkmark-done' : 
                          'close-circle'
                        } 
                        size={14} 
                        color={COLORS.white} 
                      />
                      <Text style={styles.statusText}>
                        {isPending ? 'PENDING' : isEnRoute ? 'EN ROUTE' : isUpcoming ? 'CONFIRMED' : isCompleted ? 'COMPLETED' : 'CANCELLED'}
                      </Text>
                    </View>

                    {/* Trainer Info */}
                    <View style={styles.trainerRow}>
                      {session.trainerPhoto ? (
                        <Image source={{ uri: session.trainerPhoto }} style={styles.trainerAvatar} />
                      ) : (
                        <LinearGradient
                          colors={[COLORS.teal, COLORS.tealLight]}
                          style={styles.trainerAvatarPlaceholder}
                        >
                          <Ionicons name="person" size={22} color={COLORS.white} />
                        </LinearGradient>
                      )}
                      <View style={styles.trainerInfo}>
                        <Text style={styles.trainerName}>{session.trainerName || 'Trainer'}</Text>
                        <Text style={styles.sessionDate}>
                          {new Date(session.sessionDateTimeStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' • '}
                          {new Date(session.sessionDateTimeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>

                    {/* Session Stats */}
                    <View style={styles.sessionStats}>
                      <View style={styles.sessionStat}>
                        <Ionicons name="time-outline" size={16} color={COLORS.gray} />
                        <Text style={styles.sessionStatText}>{session.durationMinutes} min</Text>
                      </View>
                      <View style={styles.sessionStat}>
                        <Ionicons name="location-outline" size={16} color={COLORS.gray} />
                        <Text style={styles.sessionStatText}>{session.locationType}</Text>
                      </View>
                      <View style={styles.sessionStat}>
                        <Ionicons name="cash-outline" size={16} color={COLORS.teal} />
                        <Text style={[styles.sessionStatText, { color: COLORS.teal, fontWeight: '700' }]}>
                          ${(session.finalSessionPriceCents / 100).toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    {session.status === 'en_route' && (
                      <TouchableOpacity
                        style={styles.trackButton}
                        onPress={() => router.push({
                          pathname: '/trainee/trainer-en-route',
                          params: {
                            sessionId: session.id,
                            trainerName: session.trainerName || 'Trainer',
                            trainerId: session.trainerId,
                            sessionType: session.locationType,
                          },
                        })}
                        data-testid="track-trainer-btn"
                      >
                        <LinearGradient
                          colors={[COLORS.teal, COLORS.tealLight]}
                          style={styles.trackButtonGradient}
                        >
                          <Ionicons name="navigate" size={18} color={COLORS.white} />
                          <Text style={styles.trackButtonText}>Track Trainer</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {(isPending || isUpcoming) && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleCancelSession(session)}
                      >
                        <Ionicons name="close-outline" size={18} color={COLORS.error} />
                        <Text style={styles.cancelButtonText}>Cancel Session</Text>
                      </TouchableOpacity>
                    )}

                    {isCompleted && !session.hasRated && (
                      <TouchableOpacity
                        style={styles.rateButton}
                        onPress={() => router.push(`/trainee/rate-session?sessionId=${session.id}&trainerId=${session.trainerId}`)}
                      >
                        <LinearGradient
                          colors={[COLORS.orange, COLORS.orangeLight]}
                          style={styles.rateButtonGradient}
                        >
                          <Ionicons name="star" size={18} color={COLORS.white} />
                          <Text style={styles.rateButtonText}>Rate Session</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {/* Rebook Button for Completed Sessions */}
                    {isCompleted && (
                      <TouchableOpacity
                        style={styles.rebookButton}
                        onPress={() => router.push({
                          pathname: '/trainee/trainer-detail',
                          params: { trainerId: session.trainerId }
                        })}
                        data-testid={`rebook-${session.id}`}
                      >
                        <View style={styles.rebookButtonInner}>
                          <Ionicons name="refresh" size={16} color={COLORS.teal} />
                          <Text style={styles.rebookButtonText}>Book Again</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </Animated.View>
              );
            })
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
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
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  tabTextActive: {
    color: COLORS.navy,
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgePending: {
    backgroundColor: COLORS.orange,
  },
  tabBadgeActive: {
    backgroundColor: COLORS.teal,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
  },
  tabBadgeTextActive: {
    color: COLORS.white,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  // Empty State
  emptyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  emptyGradient: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  // Session Card - Glass style
  sessionCard: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sessionGradient: {
    padding: 18,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 14,
    backgroundColor: COLORS.gray,
  },
  statusPending: {
    backgroundColor: COLORS.orange,
  },
  statusUpcoming: {
    backgroundColor: COLORS.teal,
  },
  statusCompleted: {
    backgroundColor: COLORS.success,
  },
  statusCancelled: {
    backgroundColor: COLORS.error,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  trainerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
  },
  trainerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  trainerInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1a2a5e',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7B9E',
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  sessionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionStatText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7B9E',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,71,87,0.6)',
    backgroundColor: 'rgba(255,71,87,0.1)',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B7A',
  },
  rateButton: {
    borderRadius: 12,
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
    fontWeight: '700',
    color: COLORS.white,
  },
  rebookButton: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  rebookButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  rebookButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.teal,
  },
  trackButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  trackButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  trackButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
});

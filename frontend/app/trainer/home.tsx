import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { trainerAPI } from '../../src/services/api';
import { Session, SessionStatus } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';

const { width } = Dimensions.get('window');

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
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
  successDark: '#00A844',
  error: '#FF4757',
};

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

  // Animation refs
  const heroAnim = useRef(new Animated.Value(0)).current;
  const statusCardAnim = useRef(new Animated.Value(0)).current;
  const earningsAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef([...Array(10)].map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
  }, []);

  // Start animations when loading completes
  useEffect(() => {
    if (!loading) {
      // Hero animation
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Status card
      setTimeout(() => {
        Animated.spring(statusCardAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 150);

      // Earnings card
      setTimeout(() => {
        Animated.spring(earningsAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 300);

      // Staggered cards
      cardAnims.forEach((anim, index) => {
        setTimeout(() => {
          Animated.spring(anim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }, 400 + (index * 100));
      });

      // Pulse animation for status
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [loading]);

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

  const heroTranslateY = heroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 0],
  });

  const statusTranslateY = statusCardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  const earningsTranslateY = earningsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.orangeHot, COLORS.orange, COLORS.orangeLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </LinearGradient>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Full gradient background */}
        <LinearGradient
          colors={[COLORS.orangeHot, COLORS.orange, COLORS.orangeGlow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => router.push('/messages')} 
              style={styles.headerButton}
            >
              <Ionicons name="chatbubbles" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('/trainer/achievements')} 
              style={styles.headerButton}
            >
              <Ionicons name="trophy" size={24} color={COLORS.yellow} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
              <Ionicons name="log-out-outline" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />
            }
          >
            {/* Hero Banner */}
            <Animated.View
              style={[
                styles.heroBanner,
                {
                  opacity: heroAnim,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(26, 42, 94, 0.95)', 'rgba(26, 42, 94, 0.85)']}
                style={styles.heroGradient}
              >
                <View style={styles.heroGlow} />
                <Text style={styles.heroTitle}>
                  LET'S TRAIN, {user?.fullName?.split(' ')[0]?.toUpperCase() || 'COACH'}! 🔥
                </Text>
                <Text style={styles.heroSubtitle}>
                  {pendingSessions.length > 0 
                    ? `${pendingSessions.length} client${pendingSessions.length > 1 ? 's' : ''} waiting for you`
                    : 'Your training empire awaits'}
                </Text>
              </LinearGradient>
            </Animated.View>

            {/* Availability Status Card */}
            <Animated.View
              style={[
                styles.statusCard,
                {
                  opacity: statusCardAnim,
                  transform: [{ translateY: statusTranslateY }],
                },
              ]}
            >
              <LinearGradient
                colors={isAvailable ? [COLORS.success, COLORS.successDark] : [COLORS.gray, '#6a7a9a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statusGradient}
              >
                <Animated.View style={[styles.statusIconContainer, { transform: [{ scale: isAvailable ? pulseAnim : 1 }] }]}>
                  <Ionicons 
                    name={isAvailable ? "radio-button-on" : "radio-button-off"} 
                    size={32} 
                    color={COLORS.white} 
                  />
                </Animated.View>
                <View style={styles.statusContent}>
                  <Text style={styles.statusTitle}>
                    {isAvailable ? '🟢 AVAILABLE NOW' : '🔴 UNAVAILABLE'}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {isAvailable 
                      ? 'Trainees can find and book you' 
                      : 'Toggle on to accept new clients'}
                  </Text>
                </View>
                {availabilityLoading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Switch
                    value={isAvailable}
                    onValueChange={handleToggleAvailability}
                    trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.4)' }}
                    thumbColor={COLORS.white}
                    ios_backgroundColor="rgba(255,255,255,0.3)"
                  />
                )}
              </LinearGradient>
            </Animated.View>

            {/* Earnings Card */}
            {earnings && (
              <Animated.View
                style={[
                  styles.earningsCard,
                  {
                    opacity: earningsAnim,
                    transform: [{ translateY: earningsTranslateY }],
                  },
                ]}
              >
                <LinearGradient
                  colors={[COLORS.teal, COLORS.tealLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.earningsGradient}
                >
                  <View style={styles.earningsHeader}>
                    <View style={styles.earningsIconBg}>
                      <Ionicons name="wallet" size={24} color={COLORS.teal} />
                    </View>
                    <Text style={styles.earningsLabel}>TOTAL EARNINGS</Text>
                  </View>
                  <Text style={styles.earningsAmount}>
                    ${(earnings.totalEarningsCents / 100).toFixed(2)}
                  </Text>
                  <View style={styles.earningsBreakdown}>
                    <View style={styles.earningsStat}>
                      <Text style={styles.earningsStatLabel}>This Week</Text>
                      <Text style={styles.earningsStatValue}>
                        ${(earnings.weekEarningsCents / 100).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.earningsDivider} />
                    <View style={styles.earningsStat}>
                      <Text style={styles.earningsStatLabel}>This Month</Text>
                      <Text style={styles.earningsStatValue}>
                        ${(earnings.monthEarningsCents / 100).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>
            )}

            {/* Quick Actions */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => router.push('/trainer/edit-profile')}
              >
                <LinearGradient
                  colors={[COLORS.white, COLORS.offWhite]}
                  style={styles.quickActionGradient}
                >
                  <View style={styles.quickActionIcon}>
                    <Ionicons name="person-circle" size={28} color={COLORS.orange} />
                  </View>
                  <Text style={styles.quickActionText}>Edit Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => router.push('/trainer/verification')}
              >
                <LinearGradient
                  colors={[COLORS.white, COLORS.offWhite]}
                  style={styles.quickActionGradient}
                >
                  <View style={styles.quickActionIcon}>
                    <Ionicons name="shield-checkmark" size={28} color={COLORS.teal} />
                  </View>
                  <Text style={styles.quickActionText}>Verification</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Pending Requests Section */}
            {pendingSessions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>⚡ PENDING REQUESTS</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{pendingSessions.length}</Text>
                  </View>
                </View>
                {pendingSessions.map((session, index) => (
                  <Animated.View
                    key={session.id}
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
                    <TouchableOpacity 
                      activeOpacity={0.9}
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
                    >
                      <LinearGradient
                        colors={[COLORS.white, COLORS.offWhite]}
                        style={styles.sessionCardGradient}
                      >
                        <View style={styles.sessionHeader}>
                          <View style={styles.traineeRow}>
                            {session.traineePhoto ? (
                              <Image 
                                source={{ uri: session.traineePhoto }} 
                                style={styles.traineeAvatar}
                              />
                            ) : (
                              <LinearGradient
                                colors={[COLORS.orange, COLORS.orangeLight]}
                                style={styles.traineeAvatarPlaceholder}
                              >
                                <Ionicons name="person" size={20} color={COLORS.white} />
                              </LinearGradient>
                            )}
                            <View style={styles.traineeInfo}>
                              <Text style={styles.traineeName}>{session.traineeName || 'New Client'}</Text>
                              <Text style={styles.sessionDateTime}>
                                {new Date(session.sessionDateTimeStart).toLocaleDateString()} • {new Date(session.sessionDateTimeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>PENDING</Text>
                          </View>
                        </View>

                        <View style={styles.sessionStats}>
                          <View style={styles.sessionStat}>
                            <Ionicons name="time" size={16} color={COLORS.gray} />
                            <Text style={styles.sessionStatText}>{session.durationMinutes} min</Text>
                          </View>
                          <View style={styles.sessionStat}>
                            <Ionicons name="location" size={16} color={COLORS.gray} />
                            <Text style={styles.sessionStatText}>{session.locationType}</Text>
                          </View>
                          <View style={styles.sessionStat}>
                            <Ionicons name="cash" size={16} color={COLORS.teal} />
                            <Text style={[styles.sessionStatText, { color: COLORS.teal, fontWeight: '700' }]}>
                              ${(session.trainerEarningsCents / 100).toFixed(2)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.tapHint}>
                          <Ionicons name="eye-outline" size={14} color={COLORS.orange} />
                          <Text style={styles.tapHintText}>Tap to view client profile</Text>
                        </View>

                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleAccept(session.id);
                            }}
                          >
                            <LinearGradient
                              colors={[COLORS.success, COLORS.successDark]}
                              style={styles.acceptButtonGradient}
                            >
                              <Ionicons name="checkmark" size={20} color={COLORS.white} />
                              <Text style={styles.acceptButtonText}>Accept</Text>
                            </LinearGradient>
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
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            )}

            {/* Upcoming Sessions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📅 UPCOMING SESSIONS</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{upcomingSessions.length}</Text>
                </View>
              </View>
              {upcomingSessions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.9)']}
                    style={styles.emptyGradient}
                  >
                    <Ionicons name="calendar-outline" size={48} color={COLORS.orange} />
                    <Text style={styles.emptyTitle}>No sessions yet</Text>
                    <Text style={styles.emptySubtitle}>Accept requests to fill your calendar</Text>
                  </LinearGradient>
                </View>
              ) : (
                upcomingSessions.map((session, index) => (
                  <View key={session.id} style={styles.upcomingCard}>
                    <LinearGradient
                      colors={[COLORS.white, COLORS.offWhite]}
                      style={styles.upcomingGradient}
                    >
                      <View style={styles.upcomingHeader}>
                        <View>
                          <Text style={styles.upcomingDate}>
                            {new Date(session.sessionDateTimeStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </Text>
                          <Text style={styles.upcomingTime}>
                            {new Date(session.sessionDateTimeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <View style={styles.confirmedBadge}>
                          <Text style={styles.confirmedBadgeText}>CONFIRMED</Text>
                        </View>
                      </View>
                      <View style={styles.sessionStats}>
                        <View style={styles.sessionStat}>
                          <Ionicons name="time" size={16} color={COLORS.gray} />
                          <Text style={styles.sessionStatText}>{session.durationMinutes} min</Text>
                        </View>
                        <View style={styles.sessionStat}>
                          <Ionicons name="location" size={16} color={COLORS.gray} />
                          <Text style={styles.sessionStatText}>{session.locationType}</Text>
                        </View>
                        <View style={styles.sessionStat}>
                          <Ionicons name="cash" size={16} color={COLORS.teal} />
                          <Text style={[styles.sessionStatText, { color: COLORS.teal, fontWeight: '700' }]}>
                            ${(session.trainerEarningsCents / 100).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                ))
              )}
            </View>

            {/* Nearby Trainees */}
            {nearbyTrainees.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>📍 NEARBY TRAINEES</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{nearbyTrainees.length}</Text>
                  </View>
                </View>
                {nearbyTrainees.slice(0, 3).map((trainee, index) => (
                  <View key={index} style={styles.traineeCard}>
                    <LinearGradient
                      colors={[COLORS.white, COLORS.offWhite]}
                      style={styles.traineeCardGradient}
                    >
                      <View style={styles.traineeCardRow}>
                        {trainee.profilePhoto ? (
                          <Image source={{ uri: trainee.profilePhoto }} style={styles.traineeCardAvatar} />
                        ) : (
                          <LinearGradient
                            colors={[COLORS.teal, COLORS.tealLight]}
                            style={styles.traineeCardAvatarPlaceholder}
                          >
                            <Ionicons name="person" size={24} color={COLORS.white} />
                          </LinearGradient>
                        )}
                        <View style={styles.traineeCardInfo}>
                          <Text style={styles.traineeCardName}>{trainee.fullName}</Text>
                          {trainee.fitnessGoals && (
                            <Text style={styles.traineeCardGoal} numberOfLines={1}>{trainee.fitnessGoals}</Text>
                          )}
                        </View>
                        <View style={styles.distanceBadge}>
                          <Ionicons name="location" size={12} color={COLORS.white} />
                          <Text style={styles.distanceText}>{trainee.distance} mi</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
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
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  headerButton: {
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  // Hero
  heroBanner: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  heroGradient: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(247, 147, 30, 0.3)',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  // Status Card
  statusCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  statusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  statusIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  statusSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  // Earnings
  earningsCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.teal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  earningsGradient: {
    padding: 20,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  earningsAmount: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 16,
  },
  earningsBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsStat: {
    flex: 1,
  },
  earningsStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  earningsStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  earningsDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },
  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  quickActionGradient: {
    padding: 18,
    alignItems: 'center',
  },
  quickActionIcon: {
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navy,
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
    flex: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  // Session Card
  sessionCard: {
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  sessionCardGradient: {
    padding: 18,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  traineeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  traineeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  traineeAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  traineeInfo: {
    flex: 1,
  },
  traineeName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 2,
  },
  sessionDateTime: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
  },
  pendingBadge: {
    backgroundColor: COLORS.orangeHot,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  sessionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionStatText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(247, 147, 30, 0.1)',
    borderRadius: 8,
    marginBottom: 14,
  },
  tapHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.orange,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.error,
  },
  // Upcoming
  upcomingCard: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  upcomingGradient: {
    padding: 16,
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  upcomingDate: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
  },
  upcomingTime: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 2,
  },
  confirmedBadge: {
    backgroundColor: COLORS.teal,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  confirmedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  // Empty State
  emptyCard: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyGradient: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
  },
  // Trainee Card
  traineeCard: {
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  traineeCardGradient: {
    padding: 14,
  },
  traineeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  traineeCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  traineeCardAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  traineeCardInfo: {
    flex: 1,
  },
  traineeCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
  },
  traineeCardGoal: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray,
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.teal,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});

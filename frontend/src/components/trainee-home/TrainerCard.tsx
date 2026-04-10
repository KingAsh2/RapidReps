import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TrainerVibePlayer } from '../TrainerVibePlayer';
import { PersonalityTagBadge } from '../PersonalityTagBadge';

const { width } = Dimensions.get('window');

interface Props {
  trainer: any;
  cardAnim: Animated.Value;
  onViewProfile: (trainerId: string) => void;
  onAvatarLongPress?: (trainer: any) => void;
}

export const TrainerCard = ({ trainer, cardAnim, onViewProfile, onAvatarLongPress }: Props) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle ambient shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    // Green glow pulse for available trainers
    if (trainer.isAvailable) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.97, friction: 8, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  };

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.03, 0.08, 0.03],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const hasVibe = !!trainer.vibeTrackTitle;
  const hasPersonalityTag = !!trainer.personalityTag;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: cardAnim,
          transform: [{
            translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }),
          }, {
            scale: Animated.multiply(
              cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
              pressScale
            ),
          }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onViewProfile(trainer.userId)}
        accessibilityLabel={`View ${trainer.fullName || 'trainer'} profile. Rating ${trainer.averageRating?.toFixed(1) || '5.0'}. ${trainer.isAvailable ? 'Available now.' : ''}`}
        accessibilityRole="button"
        data-testid={`trainer-card-${trainer.userId}`}
      >
        <LinearGradient
          colors={['#0F1526', '#141D33', '#0F1526']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Animated shimmer overlay */}
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: shimmerOpacity,
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,106,0,0.3)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: 120, height: '100%' }}
            />
          </Animated.View>

          {/* Top accent line */}
          <LinearGradient
            colors={['transparent', '#FF6A00', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topAccent}
          />

          {/* Glow orbs */}
          <View style={[styles.glowOrb, styles.glowOrbTopRight]} />
          <View style={[styles.glowOrb, styles.glowOrbBottomLeft]} />

          {/* Hero row: Large avatar + info */}
          <View style={styles.heroRow}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => onViewProfile(trainer.userId)}
              onLongPress={() => onAvatarLongPress?.(trainer)}
              activeOpacity={0.7}
              data-testid={`trainer-avatar-${trainer.userId}`}
            >
              {trainer.avatarUrl ? (
                <Image source={{ uri: trainer.avatarUrl }} style={styles.avatar} />
              ) : (
                <LinearGradient colors={['#FF6A00', '#FF3D00']} style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={32} color="#FFFFFF" />
                </LinearGradient>
              )}
              {/* Avatar glow ring */}
              <View style={styles.avatarRing} />
              {trainer.isVerified && (
                <View style={styles.verifiedBadge}>
                  <LinearGradient colors={['#FF6A00', '#FF9F1C']} style={styles.verifiedGradient}>
                    <Ionicons name="checkmark" size={10} color="#FFF" />
                  </LinearGradient>
                </View>
              )}
              {trainer.isAvailable && (
                <Animated.View style={[styles.liveDot, { opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}>
                  <View style={styles.liveDotInner} />
                </Animated.View>
              )}
            </TouchableOpacity>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{trainer.fullName || 'Trainer'}</Text>
                {hasVibe && (
                  <TrainerVibePlayer vibe={trainer} compact />
                )}
              </View>

              {/* Star rating inline */}
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color="#FFD700" />
                <Text style={styles.ratingText}>{trainer.averageRating?.toFixed(1) || '5.0'}</Text>
                {trainer.totalSessionsCompleted > 0 && (
                  <Text style={styles.sessionCount}>{trainer.totalSessionsCompleted} sessions</Text>
                )}
              </View>

              {/* Price + distance */}
              <View style={styles.metaRow}>
                <View style={styles.priceChip}>
                  <Text style={styles.priceText}>
                    ${(trainer.ratePerMinuteCents / 100).toFixed(0)}<Text style={styles.priceUnit}>/min</Text>
                  </Text>
                </View>
                {trainer.distance !== null && trainer.distance !== undefined && (
                  <View style={styles.distanceChip}>
                    <Ionicons name="navigate" size={11} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.distanceText}>{trainer.distance.toFixed(1)} mi</Text>
                  </View>
                )}
                {trainer.isAvailable && (
                  <View style={styles.availableChip}>
                    <View style={styles.availableDot} />
                    <Text style={styles.availableText}>Available</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Bio */}
          {trainer.bio && (
            <Text style={styles.bio} numberOfLines={2}>{trainer.bio}</Text>
          )}

          {/* Tags strip */}
          <View style={styles.tagStrip}>
            {hasPersonalityTag && (
              <PersonalityTagBadge tag={trainer.personalityTag} compact />
            )}
            {trainer.isVirtualTrainingAvailable && (
              <View style={styles.virtualTag}>
                <Ionicons name="videocam" size={11} color="#FF6A00" />
                <Text style={styles.virtualTagText}>VIRTUAL</Text>
              </View>
            )}
            {trainer.trainingStyles?.slice(0, 3).map((style: string, i: number) => (
              <View key={i} style={styles.styleTag}>
                <Text style={styles.styleTagText}>{style}</Text>
              </View>
            ))}
            {(trainer.trainingStyles?.length || 0) > 3 && (
              <Text style={styles.moreTag}>+{trainer.trainingStyles.length - 3}</Text>
            )}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => onViewProfile(trainer.userId)}
            activeOpacity={0.85}
            accessibilityLabel={`View profile of ${trainer.fullName || 'trainer'}`}
            accessibilityRole="button"
            data-testid={`view-profile-${trainer.userId}`}
          >
            <LinearGradient
              colors={['#FF6A00', '#FF3D00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>VIEW PROFILE</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.08)',
  },
  gradient: {
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1.5,
    opacity: 0.4,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 50,
  },
  glowOrbTopRight: {
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255, 106, 0, 0.04)',
  },
  glowOrbBottomLeft: {
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 61, 0, 0.03)',
  },
  heroRow: {
    flexDirection: 'row',
    marginBottom: 12,
    zIndex: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,106,0,0.25)',
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255,106,0,0.12)',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0F1526',
  },
  verifiedGradient: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,214,143,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F1526',
  },
  liveDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D68F',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    flex: 1,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFD700',
  },
  sessionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceChip: {
    backgroundColor: 'rgba(255,106,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.15)',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FF6A00',
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,106,0,0.7)',
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  availableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,214,143,0.08)',
  },
  availableDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00D68F',
  },
  availableText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00D68F',
  },
  bio: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 19,
    marginBottom: 12,
    zIndex: 2,
  },
  tagStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
    zIndex: 2,
  },
  virtualTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,106,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.12)',
  },
  virtualTagText: {
    fontSize: 10,
    fontFamily: 'Oswald_600SemiBold',
    color: '#FF6A00',
    letterSpacing: 1.2,
  },
  styleTag: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  styleTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  moreTag: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
  },
  ctaButton: {
    borderRadius: 14,
    overflow: 'hidden',
    zIndex: 2,
  },
  ctaGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
});

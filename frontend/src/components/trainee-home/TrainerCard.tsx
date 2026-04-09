import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  trainer: any;
  cardAnim: Animated.Value;
  onViewProfile: (trainerId: string) => void;
  onAvatarLongPress?: (trainer: any) => void;
}

export const TrainerCard = ({ trainer, cardAnim, onViewProfile, onAvatarLongPress }: Props) => (
  <Animated.View
    style={[
      styles.card,
      {
        opacity: cardAnim,
        transform: [{
          translateY: cardAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [40, 0],
          }),
        }, {
          scale: cardAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.95, 1],
          }),
        }],
      },
    ]}
  >
    <LinearGradient colors={['#141929', '#1A2035']} style={styles.gradient}>
      {/* Subtle glow orb */}
      <View style={styles.glowOrb} />
      
      {/* Header */}
      <View style={styles.header}>
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
            <LinearGradient colors={['#FF6A00', '#FF9F1C']} style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={28} color="#FFFFFF" />
            </LinearGradient>
          )}
          {trainer.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#00D68F" />
            </View>
          )}
          {trainer.isAvailable && (
            <View style={styles.activeDot} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.info}
          onPress={() => onViewProfile(trainer.userId)}
          onLongPress={() => onAvatarLongPress?.(trainer)}
          activeOpacity={0.7}
        >
          <Text style={styles.name}>{trainer.fullName || 'Trainer'}</Text>
          <View style={styles.stats}>
            <View style={styles.statBadge}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.statText}>{trainer.averageRating?.toFixed(1) || '5.0'}</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: 'rgba(255,106,0,0.12)', borderColor: 'rgba(255,106,0,0.2)' }]}>
              <Ionicons name="cash" size={14} color="#FF6A00" />
              <Text style={styles.statText}>${(trainer.ratePerMinuteCents / 100).toFixed(2)}/min</Text>
            </View>
            {trainer.distance !== null && (
              <View style={styles.statBadge}>
                <Ionicons name="location" size={14} color="#FF6A00" />
                <Text style={styles.statText}>{trainer.distance.toFixed(1)} mi</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Bio */}
      {trainer.bio && (
        <Text style={styles.bio} numberOfLines={2}>{trainer.bio}</Text>
      )}

      {/* Tags */}
      <View style={styles.tagRow}>
        {trainer.isVirtualTrainingAvailable && (
          <View style={styles.virtualTag}>
            <Ionicons name="videocam" size={12} color="#FFFFFF" />
            <Text style={styles.virtualTagText}>VIRTUAL</Text>
          </View>
        )}
        {trainer.trainingStyles?.slice(0, 2).map((style: string, i: number) => (
          <View key={i} style={styles.styleTag}>
            <Text style={styles.styleTagText}>{style}</Text>
          </View>
        ))}
        {trainer.trainingStyles?.length > 2 && (
          <Text style={styles.moreTag}>+{trainer.trainingStyles.length - 2}</Text>
        )}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.viewProfileButton}
        onPress={() => onViewProfile(trainer.userId)}
        activeOpacity={0.8}
        data-testid={`view-profile-${trainer.userId}`}
      >
        <LinearGradient
          colors={['#FF6A00', '#FF9F1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.viewProfileGradient}
        >
          <Text style={styles.viewProfileText}>VIEW PROFILE & BOOK</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  </Animated.View>
);

const styles = StyleSheet.create({
  card: {
    marginBottom: 16, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  gradient: { padding: 18, position: 'relative', overflow: 'hidden' },
  glowOrb: {
    position: 'absolute', top: -20, right: -20, width: 80, height: 80,
    borderRadius: 40, backgroundColor: 'rgba(255, 106, 0, 0.06)',
  },
  header: { flexDirection: 'row', marginBottom: 12 },
  avatarContainer: { position: 'relative', marginRight: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'rgba(255,106,0,0.25)' },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: '#141929', borderRadius: 10, padding: 1,
  },
  activeDot: {
    position: 'absolute', top: 0, right: 0, width: 14, height: 14,
    borderRadius: 7, backgroundColor: '#00D68F', borderWidth: 2, borderColor: '#141929',
  },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  bio: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginBottom: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  virtualTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,106,0,0.15)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(255,106,0,0.2)',
  },
  virtualTagText: { fontSize: 13, fontWeight: '800', color: '#FF6A00', letterSpacing: 0.5 },
  styleTag: {
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  styleTagText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  moreTag: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)', alignSelf: 'center' },
  viewProfileButton: { borderRadius: 14, overflow: 'hidden' },
  viewProfileGradient: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, gap: 8,
  },
  viewProfileText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  trainer: any;
  cardAnim: Animated.Value;
  onViewProfile: (trainerId: string) => void;
}

export const TrainerCard = ({ trainer, cardAnim, onViewProfile }: Props) => (
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
        }],
      },
    ]}
  >
    <LinearGradient colors={['#FFFFFF', '#F8F9FA']} style={styles.gradient}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {trainer.avatarUrl ? (
            <Image source={{ uri: trainer.avatarUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={['#2a3a6e', '#1a2a5e']} style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={28} color="#FFFFFF" />
            </LinearGradient>
          )}
          {trainer.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#2a3a6e" />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{trainer.fullName || 'Trainer'}</Text>
          <View style={styles.stats}>
            <View style={styles.statBadge}>
              <Ionicons name="star" size={14} color="#FFB347" />
              <Text style={styles.statText}>{trainer.averageRating?.toFixed(1) || '5.0'}</Text>
            </View>
            <View style={styles.statBadge}>
              <Ionicons name="cash" size={14} color="#2a3a6e" />
              <Text style={styles.statText}>${(trainer.ratePerMinuteCents / 100).toFixed(2)}/min</Text>
            </View>
            {trainer.distance !== null && (
              <View style={styles.statBadge}>
                <Ionicons name="location" size={14} color="#F7931E" />
                <Text style={styles.statText}>{trainer.distance.toFixed(1)} mi</Text>
              </View>
            )}
          </View>
        </View>
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
      >
        <LinearGradient
          colors={['#1a2a5e', '#2a3a6e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.viewProfileGradient}
        >
          <Text style={styles.viewProfileText}>VIEW PROFILE</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  </Animated.View>
);

const styles = StyleSheet.create({
  card: {
    marginBottom: 16, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
  },
  gradient: { padding: 18 },
  header: { flexDirection: 'row', marginBottom: 12 },
  avatarContainer: { position: 'relative', marginRight: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 2 },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4F8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  bio: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginBottom: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  virtualTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a2a5e', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 4 },
  virtualTagText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  styleTag: { backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  styleTagText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  moreTag: { fontSize: 13, fontWeight: '600', color: '#5a6785', alignSelf: 'center' },
  viewProfileButton: { borderRadius: 14, overflow: 'hidden' },
  viewProfileGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, gap: 8 },
  viewProfileText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
});

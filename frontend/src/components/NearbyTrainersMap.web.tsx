import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveSessionPriceCents } from '../utils/sessionPricing';
import { UserAvatar } from './UserAvatar';

const COLORS = {
  orange: '#FF6A00',
  orangeHot: '#FF8C33',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8a95b0',
  success: '#00D26A',
};

interface Trainer {
  trainerId: string;
  fullName: string;
  avatarUrl?: string;
  averageRating?: number;
  ratePerMinuteCents?: number;
  tierRates?: Record<string, number | undefined>;
  outdoorRateCents?: number;
  virtualRateCents?: number;
  inHomeRateCents?: number;
  distanceMiles?: number;
  etaMinutes?: number;
  sessionTypes?: string[];
}

interface Props {
  userLocation?: any;
  trainers?: Trainer[];
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function NearbyTrainersMap({ trainers = [] }: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="location" size={18} color={COLORS.orange} />
          <Text style={styles.title}>Nearby Trainers</Text>
        </View>
        {trainers.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{trainers.length}</Text>
          </View>
        )}
      </View>

      {trainers.length === 0 ? (
        <View style={styles.emptyContent}>
          <Ionicons name="compass-outline" size={40} color={COLORS.orange} />
          <Text style={styles.emptyTitle}>You're early — no trainers here yet</Text>
          <Text style={styles.emptySubtitle}>
            Try a virtual session, widen your search radius, or invite a friend to become a RapidReps trainer. We'll ping you the moment someone joins nearby.
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => router.push('/trainee/referrals' as any)}
            data-testid="empty-invite-cta"
          >
            <Ionicons name="paper-plane" size={16} color="#FFF" />
            <Text style={styles.emptyCtaText}>Invite a trainer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
          {trainers.map((trainer) => (
            <TouchableOpacity
              key={trainer.trainerId}
              style={styles.trainerCard}
              onPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.trainerId}`)}
              activeOpacity={0.75}
              data-testid={`nearby-trainer-${trainer.trainerId}`}
            >
              <View style={styles.avatarWrap}>
                <UserAvatar
                  user={{
                    id: trainer.trainerId,
                    fullName: trainer.fullName,
                    avatarUrl: trainer.avatarUrl,
                  }}
                  size={56}
                  ring
                />
                <View style={styles.onlineDot} />
              </View>
              <Text style={styles.trainerName} numberOfLines={1}>{trainer.fullName}</Text>
              {(trainer.averageRating ?? 0) > 0 && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color={COLORS.orange} />
                  <Text style={styles.ratingText}>{trainer.averageRating?.toFixed(1)}</Text>
                </View>
              )}
              {(trainer.distanceMiles ?? 0) > 0 && (
                <Text style={styles.distanceText}>{trainer.distanceMiles?.toFixed(1)} mi</Text>
              )}
              {(() => {
                // iter102ah: canonical 30-min outdoor rate via resolver.
                const cents = resolveSessionPriceCents(trainer as any, 'outdoor', 30);
                if (!cents || cents <= 0) return null;
                return <Text style={styles.priceText}>${(cents / 100).toFixed(0)}/30min</Text>;
              })()}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: -20,
    marginBottom: 16,
    backgroundColor: '#0A0E1A',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(26, 42, 94, 0.98)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  countBadge: {
    backgroundColor: 'rgba(255,106,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.orange,
  },
  emptyContent: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  emptyCta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  listContainer: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  trainerCard: {
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.orange,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: '#FF6A00',
  },
  trainerName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    maxWidth: 100,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.orange,
  },
  distanceText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
    fontWeight: '600',
  },
  priceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
    marginTop: 3,
  },
});

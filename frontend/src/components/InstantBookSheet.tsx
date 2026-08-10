/**
 * InstantBookSheet — iter118x
 *
 * Uber-style tap-to-book confirm sheet. Appears from the trainee home map
 * the moment an avatar is tapped. Shows the trainer, the price for the
 * chosen modality/duration, and a single "BOOK INSTANTLY" CTA that fires
 * POST /api/sessions/instant-book. Success → navigates to the existing
 * /trainee/trainer-en-route screen where the trainer's live route paints
 * as they close in on the trainee.
 *
 * Deliberately minimal:
 *   - No modality picker here (defaults to what makes sense: outdoor).
 *     Users who want to switch modality can tap "View full profile" to
 *     drop into the normal booking flow.
 *   - No payment method picker — assumes the trainee has a card on file
 *     (existing sessions rail already enforces this on capture).
 *   - Live location is read from the map's props (userLocation) so the
 *     trainer has coordinates to route to.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { TrainerAvatar } from './TrainerAvatar';
import { instantBookAPI } from '../services/instantBookAPI';
import { haptic } from '../utils/haptics';

export type InstantBookTrainer = {
  trainerId: string;
  fullName: string;
  avatarUrl?: string | null;
  averageRating?: number;
  distanceMiles?: number;
  etaMinutes?: number;
  ratePerMinuteCents?: number;
  outdoorRatePerMinuteCents?: number | null;
  accentColor?: string;
};

type Props = {
  visible: boolean;
  trainer: InstantBookTrainer | null;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
};

const COLORS = {
  bg: '#0A0E1A',
  card: '#141929',
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  white: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.65)',
  textDim: 'rgba(255,255,255,0.45)',
  success: '#00D68F',
  border: 'rgba(255,255,255,0.08)',
};

const DEFAULT_DURATION = 30;

function initialsOf(name: string): string {
  return (name || '?').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export const InstantBookSheet: React.FC<Props> = ({ visible, trainer, userLocation, onClose }) => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!trainer) return null;

  const perMin = trainer.outdoorRatePerMinuteCents || trainer.ratePerMinuteCents || 100;
  const totalCents = perMin * DEFAULT_DURATION;
  const priceDollars = Math.round(totalCents / 100);
  const accent = trainer.accentColor || COLORS.orange;

  const handleConfirm = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    haptic.success();
    try {
      const res = await instantBookAPI.book({
        trainerId: trainer.trainerId,
        sessionType: 'outdoor',
        durationMin: DEFAULT_DURATION,
        currentLat: userLocation?.latitude,
        currentLng: userLocation?.longitude,
      });
      onClose();
      // Navigate to the existing en-route screen — the same one the
      // negotiated-booking path uses on the trainee side.
      router.push({
        pathname: '/trainee/trainer-en-route',
        params: {
          sessionId: res.sessionId,
          trainerId: res.trainerId,
          trainerName: res.trainerName,
          sessionType: res.sessionType,
        },
      });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Could not book right now — try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.grabber} />

          {/* Header: avatar + name + rating */}
          <View style={styles.headerRow}>
            <TrainerAvatar
              uri={trainer.avatarUrl}
              initials={initialsOf(trainer.fullName)}
              ringColor={accent}
              size={60}
              pulse
            />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.eyebrow}>INSTANT BOOK</Text>
              <Text style={styles.name} numberOfLines={1}>{trainer.fullName}</Text>
              <View style={styles.metaRow}>
                {typeof trainer.averageRating === 'number' && trainer.averageRating > 0 ? (
                  <>
                    <Ionicons name="star" size={12} color={COLORS.orange} />
                    <Text style={styles.metaText}>{trainer.averageRating.toFixed(1)}</Text>
                    <Text style={styles.metaDot}>·</Text>
                  </>
                ) : null}
                {trainer.distanceMiles !== undefined ? (
                  <Text style={styles.metaText}>{trainer.distanceMiles.toFixed(1)} mi</Text>
                ) : null}
                {trainer.etaMinutes ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{trainer.etaMinutes} min away</Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          {/* Session summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Ionicons name="sunny" size={16} color={COLORS.orange} />
              <Text style={styles.summaryText}>Outdoor session</Text>
              <Text style={styles.summaryDot}>·</Text>
              <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.summaryText}>{DEFAULT_DURATION} min</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 6 }]}>
              <Ionicons name="location" size={16} color={COLORS.textMuted} />
              <Text style={[styles.summaryText, { color: COLORS.textMuted }]}>
                {userLocation ? 'Your current location' : 'Location unavailable — enable GPS to route'}
              </Text>
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>You&apos;ll pay</Text>
            <Text style={styles.priceValue}>${priceDollars}</Text>
          </View>
          <Text style={styles.priceHint}>
            Authorized on your card now. Charged only after your session completes.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={14} color="#FF5C7A" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Primary CTA */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={submitting || !userLocation}
            activeOpacity={0.9}
            style={{ marginTop: 18, opacity: (!userLocation || submitting) ? 0.6 : 1 }}
            data-testid="instant-book-confirm-btn"
          >
            <LinearGradient
              colors={[COLORS.orange, COLORS.orangeLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="flash" size={20} color={COLORS.white} />
                  <Text style={styles.ctaText}>Book instantly · ${priceDollars}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary: view full profile */}
          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push(`/trainee/trainer-detail?trainerId=${trainer.trainerId}`);
            }}
            style={styles.secondary}
            data-testid="instant-book-view-profile"
          >
            <Text style={styles.secondaryText}>Or view full profile →</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: 'rgba(255,106,0,0.2)',
  },
  grabber: {
    alignSelf: 'center',
    width: 44, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.orange,
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  metaDot: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDim,
    marginHorizontal: 3,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  summaryDot: {
    fontSize: 14,
    color: COLORS.textDim,
    marginHorizontal: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  priceValue: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -1,
  },
  priceHint: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textDim,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,92,122,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,122,0.3)',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#FF8FA1',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    borderRadius: 14,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 12,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  secondary: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
});

export default InstantBookSheet;

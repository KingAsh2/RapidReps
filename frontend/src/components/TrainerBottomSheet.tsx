import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../utils/haptics';
import { TrainerAvatar } from './TrainerAvatar';

// iter118h — Uber-style instant-booking sheet.
// Principles:
//   1. Sheet is ALWAYS visible with a decision + action surface.
//   2. A trainer is auto-selected so "Book Now" is one tap from open.
//   3. Distance filter lives INSIDE the sheet (no separate step).
//   4. Map is context, not something you interact with to book.

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_HEIGHT = 340;   // enough to show 1.5 trainers + Book Now
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.78;

const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  white: '#FFFFFF',
  cardBg: '#141929',
  cardBgSelected: '#1F1A15',
  border: 'rgba(255,255,255,0.08)',
  borderFocus: '#FF6A00',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.45)',
  goodDeal: '#00D68F',
  fastest: '#3B82F6',
};

interface Trainer {
  id: string;
  name: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  distance?: number;
  eta?: string;
  price?: number;
  specialty?: string;
  isAvailable?: boolean;
}

interface TrainerBottomSheetProps {
  trainers: Trainer[];
  selectedTrainerId?: string;
  onSelectTrainer: (trainer: Trainer) => void;
  onBookTrainer: (trainer: Trainer) => void;
  isVisible: boolean;
  // iter118h: distance filter is now embedded in the sheet
  proximityMiles?: number;
  onProximityPress?: () => void;
  onAutoSelect?: (trainer: Trainer) => void;
}

export const TrainerBottomSheet: React.FC<TrainerBottomSheetProps> = ({
  trainers,
  selectedTrainerId,
  onSelectTrainer,
  onBookTrainer,
  isVisible,
  proximityMiles = 10,
  onProximityPress,
  onAutoSelect,
}) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT - COLLAPSED_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute badges — Fastest match (shortest ETA) + Top rated (highest rating)
  const badges = useMemo(() => {
    const map: Record<string, string> = {};
    if (trainers.length === 0) return map;
    const withEta = trainers.filter((t) => t.distance !== undefined);
    if (withEta.length > 0) {
      const fastest = withEta.reduce((a, b) => ((a.distance ?? 9999) < (b.distance ?? 9999) ? a : b));
      if (fastest.distance !== undefined) map[fastest.id] = 'FASTEST';
    }
    const topRated = trainers
      .filter((t) => t.rating > 0)
      .sort((a, b) => (b.rating - a.rating) || (b.reviewCount - a.reviewCount))[0];
    if (topRated && map[topRated.id] !== 'FASTEST') {
      map[topRated.id] = 'TOP RATED';
    }
    return map;
  }, [trainers]);

  // Auto-select the fastest-match trainer on mount so Book Now is one tap.
  useEffect(() => {
    if (trainers.length === 0) return;
    if (selectedTrainerId && trainers.some((t) => t.id === selectedTrainerId)) return;
    // Prefer fastest, else top rated, else first
    const fastest = Object.keys(badges).find((id) => badges[id] === 'FASTEST');
    const pick = trainers.find((t) => t.id === fastest) || trainers[0];
    if (pick && onAutoSelect) onAutoSelect(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainers.length]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderGrant: () => {
        translateY.extractOffset();
      },
      onPanResponderMove: (_, g) => {
        translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        translateY.flattenOffset();
        const shouldExpand = g.dy < -50 || g.vy < -0.5;
        Animated.spring(translateY, {
          toValue: shouldExpand ? SCREEN_HEIGHT - EXPANDED_HEIGHT : SCREEN_HEIGHT - COLLAPSED_HEIGHT,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
        setIsExpanded(shouldExpand);
        haptic.light();
      },
    })
  ).current;

  useEffect(() => {
    if (!isVisible) {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - COLLAPSED_HEIGHT,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    }
  }, [isVisible]);

  const selectedTrainer = trainers.find((t) => t.id === selectedTrainerId) || trainers[0];

  const toggleExpand = () => {
    const next = !isExpanded;
    Animated.spring(translateY, {
      toValue: next ? SCREEN_HEIGHT - EXPANDED_HEIGHT : SCREEN_HEIGHT - COLLAPSED_HEIGHT,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    setIsExpanded(next);
    haptic.light();
  };

  const renderTrainerRow = (t: Trainer) => {
    const selected = t.id === (selectedTrainer?.id);
    const badge = badges[t.id];
    return (
      <TouchableOpacity
        key={t.id}
        style={[styles.row, selected && styles.rowSelected]}
        onPress={() => {
          haptic.light();
          onSelectTrainer(t);
        }}
        activeOpacity={0.85}
        data-testid={`trainer-row-${t.id}`}
      >
        <View style={styles.rowAvatarWrap}>
          <TrainerAvatar
            uri={t.photo}
            initials={(t.name || '?').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
            ringColor={selected ? COLORS.orange : 'rgba(255,255,255,0.15)'}
            size={54}
            pulse={false}
          />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>{t.name}</Text>
          <View style={styles.rowMetaLine}>
            {t.eta ? (
              <>
                <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                <Text style={styles.rowMetaText}>{t.eta}</Text>
                <Text style={styles.rowMetaDot}>·</Text>
              </>
            ) : null}
            {t.distance !== undefined ? (
              <Text style={styles.rowMetaText}>{t.distance.toFixed(1)} mi</Text>
            ) : null}
            {t.rating > 0 ? (
              <>
                <Text style={styles.rowMetaDot}>·</Text>
                <Ionicons name="star" size={12} color={COLORS.orange} />
                <Text style={styles.rowMetaText}>{t.rating.toFixed(1)}</Text>
              </>
            ) : null}
          </View>
          {badge ? (
            <View style={[
              styles.badgePill,
              badge === 'FASTEST' && { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)' },
              badge === 'TOP RATED' && { backgroundColor: 'rgba(0,214,143,0.15)', borderColor: 'rgba(0,214,143,0.4)' },
            ]}>
              <Ionicons
                name={badge === 'FASTEST' ? 'flash' : 'star'}
                size={11}
                color={badge === 'FASTEST' ? COLORS.fastest : COLORS.goodDeal}
              />
              <Text style={[
                styles.badgePillText,
                { color: badge === 'FASTEST' ? COLORS.fastest : COLORS.goodDeal },
              ]}>{badge === 'FASTEST' ? 'Fastest match' : 'Top rated'}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowPriceCol}>
          {t.price ? <Text style={styles.rowPrice}>${t.price}</Text> : null}
          <Text style={styles.rowPriceSub}>/ session</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      {/* Grab handle — pan gestures live only on the top strip so the trainer list scrolls freely */}
      <View {...panResponder.panHandlers} style={styles.handleStrip}>
        <View style={styles.handle} />
      </View>

      {/* Top row — "Available Now" + trainer count + proximity chip */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={toggleExpand}
        style={styles.topRow}
        data-testid="trainer-bottom-sheet-header"
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>AVAILABLE NOW</Text>
          <Text style={styles.headline}>
            {trainers.length} Trainer{trainers.length !== 1 ? 's' : ''} Nearby
          </Text>
        </View>
        {onProximityPress ? (
          <TouchableOpacity
            style={styles.proximityChip}
            onPress={() => {
              haptic.light();
              onProximityPress();
            }}
            data-testid="sheet-proximity-chip"
          >
            <Ionicons name="navigate" size={13} color={COLORS.orange} />
            <Text style={styles.proximityChipText}>{proximityMiles} mi</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.orange} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {/* Trainer list — always visible (collapsed: shows first ~1.5 rows;
          expanded: shows all with scrolling) */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: isExpanded ? 120 : 24 }}
      >
        {trainers.map((t) => renderTrainerRow(t))}
        {trainers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={28} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No trainers within {proximityMiles} miles.</Text>
            <TouchableOpacity onPress={onProximityPress} style={styles.emptyCta} data-testid="empty-widen-btn">
              <Text style={styles.emptyCtaText}>Widen search</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {/* Fixed Book Now — always visible when a trainer is selected */}
      {selectedTrainer ? (
        <View style={styles.bookBar}>
          <TouchableOpacity
            onPress={() => {
              haptic.success();
              onBookTrainer(selectedTrainer);
            }}
            activeOpacity={0.9}
            data-testid="book-trainer-btn"
          >
            <LinearGradient
              colors={[COLORS.orange, COLORS.orangeLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookGradient}
            >
              <Text style={styles.bookButtonText}>
                Book {selectedTrainer.name.split(' ')[0]} Now
              </Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: EXPANDED_HEIGHT,
    backgroundColor: '#0A0E1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,106,0,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  handleStrip: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.orange,
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  headline: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  proximityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.5)',
    backgroundColor: 'rgba(255,106,0,0.08)',
  },
  proximityChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.orange,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  rowSelected: {
    borderColor: COLORS.borderFocus,
    backgroundColor: COLORS.cardBgSelected,
  },
  rowAvatarWrap: {
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
    justifyContent: 'center',
  },
  rowName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  rowMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  rowMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  rowMetaDot: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textTertiary,
    marginHorizontal: 2,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rowPriceCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  rowPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  rowPriceSub: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textTertiary,
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyCta: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.orange,
  },
  emptyCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.orange,
    letterSpacing: 0.3,
  },
  bookBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  bookGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  bookButtonText: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.3,
  },
});

export default TrainerBottomSheet;

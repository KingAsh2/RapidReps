import React, { useRef, useEffect, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
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
// iter118s (P0): first-mount sheet height ~58% of screen — matches Uber's
// "Choose a ride" reveal so trainees see ~3 full trainer rows without
// swiping. Was 340px which showed only 1.5 rows and felt hidden.
const COLLAPSED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.58);
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.82;

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
  /** iter118p (spec #4): trainer paid for higher visibility. Rendered as a
   *  neutral "Promoted" tag (Instacart / Amazon style) so ranking is
   *  transparent to trainees. */
  isBoosted?: boolean;
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

// iter118q: expose imperative handle so the trainee home screen can slide
// the sheet into expanded state the instant a map marker is tapped
// (Uber-style: one tap on the pin → sheet snaps up with that trainer
// pre-selected and "Book Now" prominent).
export interface TrainerBottomSheetHandle {
  expand: () => void;
  collapse: () => void;
}

export const TrainerBottomSheet = forwardRef<TrainerBottomSheetHandle, TrainerBottomSheetProps>(({
  trainers,
  selectedTrainerId,
  onSelectTrainer,
  onBookTrainer,
  isVisible,
  proximityMiles = 10,
  onProximityPress,
  onAutoSelect,
}, ref) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT - COLLAPSED_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const rowOffsets = useRef<Record<string, number>>({});

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

  // iter118q: imperative expand/collapse used by the trainee home screen when
  // a map marker is tapped — snaps the sheet to full height so the selected
  // trainer's row is instantly visible with "Book Now" ready.
  useImperativeHandle(ref, () => ({
    expand: () => {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - EXPANDED_HEIGHT,
        useNativeDriver: true,
        bounciness: 6,
        speed: 14,
      }).start();
      setIsExpanded(true);
      haptic.success();
    },
    collapse: () => {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - COLLAPSED_HEIGHT,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
      setIsExpanded(false);
    },
  }), [translateY]);

  // iter118q: when the selected trainer changes (e.g. via map marker tap),
  // scroll that row into view inside the sheet so the highlight is obvious.
  useEffect(() => {
    if (!selectedTrainerId) return;
    const y = rowOffsets.current[selectedTrainerId];
    if (typeof y === 'number' && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 8), animated: true });
    }
  }, [selectedTrainerId]);

  const renderTrainerRow = (t: Trainer) => {
    const selected = t.id === (selectedTrainer?.id);
    const badge = badges[t.id];
    return (
      <TouchableOpacity
        key={t.id}
        style={[styles.row, selected && styles.rowSelected]}
        onLayout={(e) => {
          rowOffsets.current[t.id] = e.nativeEvent.layout.y;
        }}
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
          {/* iter118p (spec #4): neutral "Promoted" tag on boosted rows so
              paid placement is disclosed to trainees. Grey — not alarming. */}
          {t.isBoosted ? (
            <View
              style={styles.promotedPill}
              data-testid={`trainer-row-${t.id}-promoted`}
              accessibilityLabel="Promoted placement"
            >
              <Text style={styles.promotedPillText}>Promoted</Text>
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

      {/* Top row — "Available Now" + trainer count (proximity moved to Settings — iter118i) */}
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
        <View style={styles.headerArrow}>
          <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-up'} size={18} color={COLORS.white} />
        </View>
      </TouchableOpacity>

      {/* Trainer list — always visible (collapsed: shows first ~1.5 rows;
          expanded: shows all with scrolling) */}
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: isExpanded ? 180 : 160 }}
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
          {/* iter118s (P1): pre-commit context row — mirrors Uber's
              "Personal · Apple Pay" strip. Answers "what am I actually
              booking?" before the trainee taps Book Now. Session type +
              duration are safe defaults; they can refine on the next screen. */}
          <View style={styles.contextRow} data-testid="booking-context-row">
            <View style={styles.contextChip}>
              <Ionicons name="sunny" size={13} color={COLORS.orange} />
              <Text style={styles.contextChipText}>Outdoor</Text>
            </View>
            <View style={styles.contextDot} />
            <View style={styles.contextChip}>
              <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.contextChipText}>30 min</Text>
            </View>
            <View style={styles.contextDot} />
            <View style={styles.contextChip}>
              <Ionicons name="card-outline" size={13} color={COLORS.textSecondary} />
              <Text style={styles.contextChipText}>Card</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
          </View>

          <TouchableOpacity
            onPress={() => {
              haptic.success();
              onBookTrainer(selectedTrainer);
            }}
            activeOpacity={0.92}
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
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}
    </Animated.View>
  );
});

TrainerBottomSheet.displayName = 'TrainerBottomSheet';

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
  headerArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    // iter118s (P0): unselected border weight bumped so rows read as distinct
    // cards (mirrors Uber's option list). Selected state gets a heavier ring
    // just below to make the pick unmistakable.
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: COLORS.cardBg,
  },
  rowSelected: {
    borderWidth: 2.5,
    borderColor: COLORS.borderFocus,
    backgroundColor: COLORS.cardBgSelected,
    // iter118s (P0): soft orange glow lifts the selected row like Uber's
    // black-on-white ring lifts the "Comfort" option.
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
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
  // iter118p (spec #4): neutral "Promoted" tag — deliberately grey, not
  // alarming; mirrors Instacart / Amazon sponsored-placement disclosure.
  promotedPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  promotedPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.62)',
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
  // iter118s (P1): pre-commit context row above the CTA — Uber "Personal ·
  // Apple Pay" analogue. Faint divider on top so it reads as a summary strip.
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contextChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.1,
  },
  contextDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.textTertiary,
  },
  // iter118s (P1): CTA restyled — brand orange preserved, but Uber-weight
  // geometry (rectangle > pill, tighter radius, heavier vertical padding,
  // bigger type). Reads as decisive without borrowing Uber's black.
  bookGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    borderRadius: 14,
    gap: 10,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  },
  bookButtonText: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
});

export default TrainerBottomSheet;

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
import { haptic } from '../utils/haptics';
import { TrainerAvatar } from './TrainerAvatar';

// iter118u — SIMPLIFIED sheet.
// A passive, scrollable list of nearby trainers. Tap a row → parent
// navigates straight to that trainer's profile (single-step booking flow).
// Deliberately drops the earlier Uber-style two-step (select then Book Now),
// the session-details picker, the pre-commit context row, and the imperative
// expand handle. The map above is the primary discovery surface; this sheet
// is just a secondary list for trainers who want to scan without zooming.

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// iter118v: sheet is anchored to the BOTTOM of its parent (bottom: 0) and
// slid up/down via translateY so it works regardless of parent height
// (e.g. inside a tab screen where the tab bar shrinks the parent). Was
// using top: 0 + big translateY which got clipped by the tab bar.
const COLLAPSED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.42);
const EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.82);

const COLORS = {
  orange: '#FF6A00',
  white: '#FFFFFF',
  cardBg: '#141929',
  border: 'rgba(255,255,255,0.06)',
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
  isBoosted?: boolean;
}

interface TrainerBottomSheetProps {
  trainers: Trainer[];
  /** iter118u: single, simple callback — tapping a row navigates to that
   *  trainer's profile. Parent supplies the routing. */
  onTrainerPress: (trainer: Trainer) => void;
  isVisible: boolean;
  proximityMiles?: number;
  onProximityPress?: () => void;
}

export const TrainerBottomSheet: React.FC<TrainerBottomSheetProps> = ({
  trainers,
  onTrainerPress,
  isVisible,
  proximityMiles = 10,
  onProximityPress,
}) => {
  const translateY = useRef(new Animated.Value(EXPANDED_HEIGHT - COLLAPSED_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  // Fastest match (shortest distance) + Top rated — pure display badges.
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

  // Drag-to-expand — only the grab strip is a drag target so the list
  // scrolls freely.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
      onPanResponderGrant: () => translateY.extractOffset(),
      onPanResponderMove: (_, g) => translateY.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        translateY.flattenOffset();
        const shouldExpand = g.dy < -50 || g.vy < -0.5;
        Animated.spring(translateY, {
          // iter118v: bottom-anchored math — expanded = 0, collapsed = the
          // height difference so only COLLAPSED_HEIGHT peeks above bottom.
          toValue: shouldExpand ? 0 : EXPANDED_HEIGHT - COLLAPSED_HEIGHT,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
        setIsExpanded(shouldExpand);
        haptic.light();
      },
    })
  ).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isVisible ? EXPANDED_HEIGHT - COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, [isVisible, translateY]);

  const toggleExpand = () => {
    const next = !isExpanded;
    Animated.spring(translateY, {
      toValue: next ? 0 : EXPANDED_HEIGHT - COLLAPSED_HEIGHT,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    setIsExpanded(next);
    haptic.light();
  };

  const renderTrainerRow = (t: Trainer) => {
    const badge = badges[t.id];
    return (
      <TouchableOpacity
        key={t.id}
        style={styles.row}
        onPress={() => {
          haptic.light();
          onTrainerPress(t);
        }}
        activeOpacity={0.85}
        data-testid={`trainer-row-${t.id}`}
        accessibilityRole="button"
        accessibilityLabel={`View ${t.name}'s profile`}
      >
        <View style={styles.rowAvatarWrap}>
          <TrainerAvatar
            uri={t.photo}
            initials={(t.name || '?').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
            ringColor="rgba(255,255,255,0.18)"
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
          {t.isBoosted ? (
            <View style={styles.promotedPill} data-testid={`trainer-row-${t.id}-promoted`}>
              <Text style={styles.promotedPillText}>Promoted</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowPriceCol}>
          {t.price ? <Text style={styles.rowPrice}>${t.price}</Text> : null}
          <Text style={styles.rowPriceSub}>/ session</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      {/* Grab handle */}
      <View {...panResponder.panHandlers} style={styles.handleStrip}>
        <View style={styles.handle} />
      </View>

      {/* Header */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={toggleExpand}
        style={styles.topRow}
        data-testid="trainer-bottom-sheet-header"
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>NEARBY TRAINERS</Text>
          <Text style={styles.headline}>
            {trainers.length} available · tap to view
          </Text>
        </View>
        <View style={styles.headerArrow}>
          <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-up'} size={18} color={COLORS.white} />
        </View>
      </TouchableOpacity>

      {/* List */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 32 }}
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    // iter118v: anchor to BOTTOM of parent (not top) so the tab bar can't
    // clip the visible portion of the sheet. Height is fixed at
    // EXPANDED_HEIGHT and translateY slides it up/down from the bottom edge.
    bottom: 0,
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
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.3,
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
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  rowAvatarWrap: { marginRight: 12 },
  rowBody: { flex: 1, justifyContent: 'center' },
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
});

export default TrainerBottomSheet;

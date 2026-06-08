/**
 * Skeleton — iter105 perf pass.
 *
 * Lightweight shimmer placeholder used in place of bare ActivityIndicator
 * spinners. Perceived load times drop dramatically when users see the shape
 * of the content materialising instead of an empty screen.
 *
 * Pure presentational, no business logic. Uses native-driven opacity so the
 * shimmer runs on the UI thread.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';

type Props = {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
};

export const Skeleton: React.FC<Props> = ({ width = '100%', height = 16, radius = 8, style }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        // @ts-expect-error RN accepts string % widths at runtime
        { width, height, borderRadius: radius, opacity },
        style as any,
      ]}
    />
  );
};

/** Composite: profile-card skeleton (avatar + 2 lines) */
export const SkeletonProfileCard: React.FC = () => (
  <View style={styles.row}>
    <Skeleton width={56} height={56} radius={28} />
    <View style={{ flex: 1, marginLeft: 14, gap: 8 }}>
      <Skeleton width="60%" height={14} />
      <Skeleton width="35%" height={12} />
    </View>
  </View>
);

/** Composite: trainer hero skeleton */
export const SkeletonTrainerHero: React.FC = () => (
  <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 14 }}>
    <Skeleton width={140} height={140} radius={70} style={{ alignSelf: 'center' }} />
    <Skeleton width="70%" height={22} style={{ alignSelf: 'center' }} />
    <Skeleton width="40%" height={14} style={{ alignSelf: 'center' }} />
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
      <Skeleton height={80} radius={14} style={{ flex: 1 }} />
      <Skeleton height={80} radius={14} style={{ flex: 1 }} />
      <Skeleton height={80} radius={14} style={{ flex: 1 }} />
    </View>
  </View>
);

/** Composite: list-row skeleton (session card, chat row, etc.) */
export const SkeletonListRow: React.FC = () => (
  <View style={[styles.row, { paddingVertical: 14 }]}>
    <Skeleton width={48} height={48} radius={24} />
    <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
      <Skeleton width="55%" height={14} />
      <Skeleton width="75%" height={12} />
    </View>
    <Skeleton width={60} height={12} />
  </View>
);

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});

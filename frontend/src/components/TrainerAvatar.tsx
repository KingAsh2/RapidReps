/**
 * TrainerAvatar — iter106n.
 *
 * Single source of truth for the circular-profile-photo marker used across
 * every trainer-facing surface: NearbyTrainers map pins, the Available Now
 * strip, Quick Book, EnRouteMap, search results, popups, etc.
 *
 * Visual contract:
 *   • Circular avatar (no diamond).
 *   • A 2px ring in the trainer's brand / tier color (passed in via prop,
 *     defaults to the platform orange).
 *   • A subtle 2.4s pulsing halo behind the ring — slow opacity breath,
 *     no scale jump, so it draws the eye without distracting.
 *   • Falls back to a colored disc with the trainer's initials when no
 *     `uri` is supplied (handles trainers without a profile photo).
 *
 * Pass `size` for non-default dimensions; the ring + halo scale together.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';

const DEFAULT_RING = '#FF5F1F'; // platform orange

type Props = {
  uri?: string | null;
  /** First letter(s) shown when there's no photo */
  initials: string;
  /** Brand / tier color for the ring (hex). Defaults to platform orange. */
  ringColor?: string;
  /** Diameter of the inner photo circle. Default 56. */
  size?: number;
  /** Turn off the pulsing halo (e.g. when many markers are on screen). */
  pulse?: boolean;
};

export const TrainerAvatar: React.FC<Props> = ({
  uri,
  initials,
  ringColor = DEFAULT_RING,
  size = 56,
  pulse = true,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseAnim]);

  const ringBorder = Math.max(2, Math.round(size * 0.04));
  const haloSize = size + 12;

  return (
    <View style={[styles.wrap, { width: haloSize, height: haloSize }]}>
      {pulse && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              width: haloSize,
              height: haloSize,
              borderRadius: haloSize / 2,
              borderColor: ringColor,
              opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.55] }),
              transform: [{
                scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.18] }),
              }],
            },
          ]}
        />
      )}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ringBorder,
            borderColor: ringColor,
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={[styles.photo, { borderRadius: (size - ringBorder * 2) / 2 }]} resizeMode="cover" />
        ) : (
          <View style={[styles.fallback, { backgroundColor: ringColor, borderRadius: (size - ringBorder * 2) / 2 }]}>
            <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>{initials}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', borderWidth: 1.5 },
  ring: {
    backgroundColor: '#0A0E14',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
  fallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.5 },
});

export default TrainerAvatar;

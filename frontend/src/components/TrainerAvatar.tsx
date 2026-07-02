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
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, AppState } from 'react-native';
// iter106am — migrate from legacy RN Image to expo-image. expo-image uses
// SDWebImage on iOS and Coil on Android, both of which add disk + memory
// caching, automatic downsampling, and proper memory release on screens with
// many remote avatars (trainer list, saved list, chat list, map markers).
// This is a primary fix for the iOS WatchdogTermination crash where many
// avatars at once were exceeding the jetsam memory threshold.
import { Image as ExpoImage } from 'expo-image';
import { isPlaceholderAvatarUrl } from '../utils/avatar';

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
  // iter106am: pause the per-avatar pulse loop while the app is backgrounded.
  // Dense list views (Discovery, Saved, NearbyTrainers, chat) mount 20+
  // TrainerAvatars at once; each runs its own JS-driven Animated.loop.
  // Stopping them on background eliminates run-loop reconciliation work
  // when iOS resumes a long-suspended app — a known contributor to the
  // WatchdogTermination crash.
  const [paused, setPaused] = useState(AppState.currentState !== 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setPaused(next !== 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pulse || paused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, paused, pulseAnim]);

  const ringBorder = Math.max(2, Math.round(size * 0.04));
  const haloSize = size + 12;

  // iter106ap: track whether the network fetch actually produced a rendered
  // image. Silent 404s (stale profile URLs, dead example.com placeholders,
  // etc.) previously left a blank circle — now we fall back to initials so
  // the admin portal + user profiles always show something recognizable.
  const [imgFailed, setImgFailed] = useState(false);

  // Normalize the source. expo-image accepts a plain string OR an object; the
  // object form is more forgiving with data: URIs and file:// URIs, which is
  // what the onboarding flow feeds us. Whitespace-only and obviously-broken
  // placeholder URLs (example.com) are treated as "no photo" so we skip the
  // network round-trip and go straight to initials.
  const cleaned = typeof uri === 'string' ? uri.trim() : '';
  // iter106ap (v2, fixed after testing-agent iteration_110): use the shared
  // helper so this file and resolveAvatarUrl stay in lockstep. Previously
  // duplicated a fragile regex here that missed `https://example.com/...`.
  const isPlaceholder = isPlaceholderAvatarUrl(cleaned);
  const showPhoto = !!cleaned && !isPlaceholder && !imgFailed;

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
        {showPhoto ? (
          <ExpoImage
            // iter106ap: object-form source. In expo-image v3 the string form
            // has quirks with data: URIs on iOS (occasional silent no-render)
            // and with file:// URIs picked from expo-image-picker. The object
            // form is the canonical shape and works everywhere.
            source={{ uri: cleaned }}
            style={[styles.photo, { borderRadius: (size - ringBorder * 2) / 2 }]}
            contentFit="cover"
            // iter106am: memory-disk cache = LRU eviction on iOS (SDWebImage),
            // so we don't pin every avatar in RAM.
            cachePolicy="memory-disk"
            transition={120}
            recyclingKey={cleaned}
            // iter106ap: fall back to initials on 404 / bad payload / decode error.
            onError={() => setImgFailed(true)}
          />
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

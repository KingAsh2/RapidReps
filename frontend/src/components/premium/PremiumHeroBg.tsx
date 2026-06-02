/**
 * Premium cinematic background — orange ember radial wash fading to navy/black.
 * Used by Welcome + Login + Signup. CSS-only (no external image dependency)
 * so it stays fast and reproducible across Expo Go + EAS builds.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PremiumColors } from '../theme/premium';

type Props = {
  /** Which screen variant — affects gradient stops & overall hue. */
  variant?: 'welcome' | 'login' | 'signup';
  children?: React.ReactNode;
};

export const PremiumHeroBg: React.FC<Props> = ({ variant = 'welcome', children }) => {
  // Base gradient stack — multi-stop "fire-into-night" wash
  const baseColors: readonly [string, string, ...string[]] =
    variant === 'login'
      ? ['#FF6A00', '#E55A00', '#7A2100', '#3A0F00', '#0A0A0A']
      : variant === 'signup'
      ? ['#091A3A', '#10254F', '#3A0F00', '#0A0A0A']
      : ['#1B0700', '#3A0F00', '#5C1800', '#0A0A0A'];

  return (
    <View style={styles.root}>
      {/* Base vertical gradient (fire → night) */}
      <LinearGradient colors={baseColors} style={StyleSheet.absoluteFill} locations={undefined} />

      {/* Top-center orange ember glow */}
      <LinearGradient
        colors={['rgba(255,122,0,0.55)', 'rgba(255,122,0,0.18)', 'transparent']}
        style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
      />

      {/* Bottom navy fade for content legibility */}
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.4)', 'rgba(10,10,10,0.85)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Subtle warm ember vignette top-left & bottom-right (asymmetric flair) */}
      <View style={[styles.emberBlob, { top: -80, left: -60 }]} pointerEvents="none" />
      <View style={[styles.emberBlobSm, { bottom: 40, right: -40 }]} pointerEvents="none" />

      {/* Motion streaks — subtle horizontal lines giving the "rapid" vibe */}
      <View pointerEvents="none" style={styles.streaksWrap}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.streak,
              {
                top: `${20 + i * 14}%`,
                width: `${50 + (i % 3) * 18}%`,
                left: `${i % 2 === 0 ? 0 : 30}%`,
                opacity: 0.06 + (i % 3) * 0.04,
              },
            ]}
          />
        ))}
      </View>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PremiumColors.black },
  emberBlob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,122,0,0.32)',
    transform: [{ scaleX: 1.3 }],
  },
  emberBlobSm: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,155,47,0.22)',
  },
  streaksWrap: { ...StyleSheet.absoluteFillObject },
  streak: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: PremiumColors.orangeEmber,
  },
});

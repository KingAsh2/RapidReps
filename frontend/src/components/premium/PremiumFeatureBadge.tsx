/**
 * Premium glassmorphism feature badge.
 * - Outer ember glow ring (radial)
 * - Mid orange edge-light ring
 * - Inner deep-glass disk with linear gradient (depth)
 * - Floating drop shadow for parallax feel
 * - Stronger ember dot at top-left corner = light source illusion
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PremiumColors } from '../../theme/premium';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  topLine: string;
  bottomLine: string;
  testID?: string;
};

export const PremiumFeatureBadge: React.FC<Props> = ({ icon, topLine, bottomLine, testID }) => {
  return (
    <View style={styles.wrap} testID={testID} accessibilityLabel={`${topLine} ${bottomLine}`}>
      {/* Soft ember halo — outermost (shadow only, no fill) */}
      <View pointerEvents="none" style={styles.halo} />
      {/* Orange edge-light ring */}
      <View style={styles.ringOuter}>
        {/* Deep-glass inner disk */}
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.10)',
            'rgba(10,10,10,0.55)',
            'rgba(5,8,18,0.85)',
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.ringInner}
        >
          {/* Top-left specular highlight — sells the glass illusion */}
          <View pointerEvents="none" style={styles.specHighlight} />
          <Ionicons name={icon} size={30} color={PremiumColors.white} />
        </LinearGradient>
      </View>
      <Text style={styles.topLine}>{topLine}</Text>
      <Text style={styles.bottomLine}>{bottomLine}</Text>
    </View>
  );
};

const SIZE = 84;
const INNER = 64;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, flex: 1 },
  halo: {
    position: 'absolute',
    top: -4,
    width: SIZE + 22,
    height: SIZE + 22,
    borderRadius: (SIZE + 22) / 2,
    backgroundColor: 'rgba(255,122,0,0.06)',
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  ringOuter: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
    borderColor: 'rgba(255,155,47,0.75)',
    backgroundColor: 'rgba(10,10,10,0.45)',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ringInner: {
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  specHighlight: {
    position: 'absolute',
    top: 5,
    left: 9,
    width: 28,
    height: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.42)',
    transform: [{ rotate: '-22deg' }],
    opacity: 0.7,
  },
  topLine: {
    fontSize: 14,
    fontWeight: '800',
    color: PremiumColors.white,
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  bottomLine: {
    fontSize: 13,
    fontWeight: '800',
    color: PremiumColors.orangeGlow,
    letterSpacing: 0.6,
    textShadowColor: 'rgba(255,122,0,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});

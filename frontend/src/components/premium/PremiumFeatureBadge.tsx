/**
 * Glowing-ring feature badge (the 3 round icons under the hero in the mockup:
 * "Trainers Near You", "Book Instantly", "Verified Pros").
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
      <View style={styles.ringOuter}>
        <View style={styles.ringInner}>
          <Ionicons name={icon} size={28} color={PremiumColors.white} />
        </View>
      </View>
      <Text style={styles.topLine}>{topLine}</Text>
      <Text style={styles.bottomLine}>{bottomLine}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, flex: 1 },
  ringOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,122,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,155,47,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PremiumColors.orange,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  ringInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(10,10,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topLine: {
    fontSize: 14,
    fontWeight: '800',
    color: PremiumColors.white,
    letterSpacing: 0.6,
  },
  bottomLine: {
    fontSize: 13,
    fontWeight: '800',
    color: PremiumColors.orangeGlow,
    letterSpacing: 0.6,
  },
});

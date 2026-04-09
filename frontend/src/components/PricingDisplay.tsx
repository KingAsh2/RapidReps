import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Vibrant brand colors
const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  orangeGlow: '#FFB347',
  teal: '#1a2a5e',
  tealLight: '#22E8DF',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gold: '#FFD700',
  success: '#00D26A',
};

interface PricingDisplayProps {
  sessionType: 'virtual' | 'outdoor' | 'in_home';
  priceCents: number;
  trainerTier?: 'basic' | 'pro' | 'elite';
  travelDistanceMiles?: number;
  travelFeeCents?: number;
  showBreakdown?: boolean;
}

export const PricingDisplay: React.FC<PricingDisplayProps> = ({
  sessionType,
  priceCents,
  trainerTier = 'basic',
  travelDistanceMiles,
  travelFeeCents = 0,
  showBreakdown = false,
}) => {
  const getSessionTypeLabel = () => {
    switch (sessionType) {
      case 'virtual': return '🎥 Virtual Session';
      case 'outdoor': return '🌳 Outdoor Session';
      case 'in_home': return '🏠 In-Home Session';
      default: return 'Session';
    }
  };

  const getSessionIcon = () => {
    switch (sessionType) {
      case 'virtual': return 'videocam';
      case 'outdoor': return 'sunny';
      case 'in_home': return 'home';
      default: return 'fitness';
    }
  };

  const getTierBadge = () => {
    switch (trainerTier) {
      case 'elite':
        return (
          <LinearGradient
            colors={[COLORS.gold, '#FFA500']}
            style={styles.tierBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="diamond" size={12} color={'#FFFFFF'} />
            <Text style={[styles.tierText, { color: '#FFFFFF' }]}>ELITE</Text>
          </LinearGradient>
        );
      case 'pro':
        return (
          <LinearGradient
            colors={['#FF6A00', '#FF6A00'Light]}
            style={styles.tierBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="star" size={12} color={COLORS.white} />
            <Text style={styles.tierText}>PRO</Text>
          </LinearGradient>
        );
      default:
        return null;
    }
  };

  const totalCents = priceCents + travelFeeCents;
  const platformFeeCents = Math.round(totalCents * 0.20);

  return (
    <View style={styles.container}>
      {/* Session Type Header */}
      <View style={styles.header}>
        <View style={styles.sessionTypeRow}>
          <Ionicons name={getSessionIcon() as any} size={20} color={COLORS.orange} />
          <Text style={styles.sessionTypeText}>{getSessionTypeLabel()}</Text>
        </View>
        {getTierBadge()}
      </View>

      {/* Main Price */}
      <View style={styles.priceContainer}>
        <Text style={styles.currencySymbol}>$</Text>
        <Text style={styles.priceMain}>{Math.floor(priceCents / 100)}</Text>
        {priceCents % 100 > 0 && (
          <Text style={styles.priceCents}>.{String(priceCents % 100).padStart(2, '0')}</Text>
        )}
      </View>

      {/* Breakdown */}
      {showBreakdown && (
        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Session Rate</Text>
            <Text style={styles.breakdownValue}>${(priceCents / 100).toFixed(2)}</Text>
          </View>
          
          {travelFeeCents > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>
                Travel Fee ({travelDistanceMiles?.toFixed(1)} mi)
              </Text>
              <Text style={styles.breakdownValue}>${(travelFeeCents / 100).toFixed(2)}</Text>
            </View>
          )}
          
          <View style={styles.divider} />
          
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, styles.totalLabel]}>Total</Text>
            <Text style={[styles.breakdownValue, styles.totalValue]}>
              ${(totalCents / 100).toFixed(2)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

interface TrainerTierBadgeProps {
  tier: 'basic' | 'pro' | 'elite';
  size?: 'small' | 'medium' | 'large';
}

export const TrainerTierBadge: React.FC<TrainerTierBadgeProps> = ({ 
  tier, 
  size = 'medium' 
}) => {
  const sizes = {
    small: { padding: 4, fontSize: 13, iconSize: 10 },
    medium: { padding: 6, fontSize: 13, iconSize: 14 },
    large: { padding: 8, fontSize: 14, iconSize: 16 },
  };

  const s = sizes[size];

  if (tier === 'elite') {
    return (
      <LinearGradient
        colors={[COLORS.gold, '#FFA500']}
        style={[styles.tierBadgeLarge, { paddingHorizontal: s.padding * 2, paddingVertical: s.padding }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Ionicons name="diamond" size={s.iconSize} color={'#FFFFFF'} />
        <Text style={[styles.tierTextLarge, { fontSize: s.fontSize, color: '#FFFFFF' }]}>
          ELITE TRAINER
        </Text>
      </LinearGradient>
    );
  }

  if (tier === 'pro') {
    return (
      <LinearGradient
        colors={['#FF6A00', '#FF6A00'Light]}
        style={[styles.tierBadgeLarge, { paddingHorizontal: s.padding * 2, paddingVertical: s.padding }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Ionicons name="star" size={s.iconSize} color={COLORS.white} />
        <Text style={[styles.tierTextLarge, { fontSize: s.fontSize }]}>PRO TRAINER</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.basicBadge, { paddingHorizontal: s.padding * 2, paddingVertical: s.padding }]}>
      <Ionicons name="fitness" size={s.iconSize} color={COLORS.orange} />
      <Text style={[styles.basicText, { fontSize: s.fontSize }]}>TRAINER</Text>
    </View>
  );
};

interface VerifiedBadgeProps {
  isVerified: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ 
  isVerified, 
  size = 'medium' 
}) => {
  if (!isVerified) return null;

  const iconSizes = { small: 14, medium: 18, large: 22 };
  const fontSizes = { small: 10, medium: 12, large: 14 };

  return (
    <View style={styles.verifiedBadge}>
      <Ionicons name="checkmark-shield" size={iconSizes[size]} color={COLORS.success} />
      <Text style={[styles.verifiedText, { fontSize: fontSizes[size] }]}>Verified</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tierText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.orange,
    marginTop: 4,
  },
  priceMain: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 56,
  },
  priceCents: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  breakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF0',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8ECF0',
    marginVertical: 8,
  },
  totalLabel: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalValue: {
    fontWeight: '800',
    color: COLORS.orange,
    fontSize: 16,
  },
  tierBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    gap: 6,
  },
  tierTextLarge: {
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  basicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5EB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.orange,
    gap: 6,
  },
  basicText: {
    fontWeight: '700',
    color: COLORS.orange,
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontWeight: '600',
    color: COLORS.success,
  },
});

export default PricingDisplay;

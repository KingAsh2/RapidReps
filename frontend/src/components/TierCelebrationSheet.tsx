/**
 * TierCelebrationSheet — One-shot bottom sheet that greets a trainer the
 * first time they open the app after admin places them in a pricing tier.
 *
 * Lifecycle:
 *   1. Trainer Home calls GET /api/trainer/tier-celebration on focus.
 *   2. If `shouldShow:true`, this sheet pops with confetti + tier label
 *      + take-home % + a "Set My Rates" primary CTA.
 *   3. Either CTA (close or set-rates) calls POST .../acknowledge so the
 *      backend stops returning shouldShow:true forever.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../services/api';
import { DS } from '../theme/designSystem';
import { haptic } from '../utils/haptics';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  tier: 'new' | 'certified' | 'specialty' | string;
  tierLabel: string;
  takeHomePct: number;
  onClose: () => void;
}

const TIER_GRADIENT: Record<string, [string, string]> = {
  new: ['#FF7A00', '#FFB347'],
  certified: ['#3B82F6', '#7AB6FF'],
  specialty: ['#22C55E', '#86EFAC'],
};

// Lightweight CSS-only confetti — 18 colored squares spread across the top
const Confetti = () => {
  const pieces = useRef(
    Array.from({ length: 18 }).map(() => ({
      x: Math.random() * width,
      delay: Math.random() * 600,
      anim: new Animated.Value(0),
      color: ['#FF7A00', '#FFB347', '#3B82F6', '#22C55E', '#FFD700'][Math.floor(Math.random() * 5)],
      rot: Math.random() * 360,
    })),
  ).current;

  useEffect(() => {
    pieces.forEach((p) => {
      Animated.loop(
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 2400,
          delay: p.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    });
  }, [pieces]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {pieces.map((p, i) => {
        const ty = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 380] });
        const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: [`${p.rot}deg`, `${p.rot + 360}deg`] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: 0,
              width: 8,
              height: 8,
              backgroundColor: p.color,
              borderRadius: 2,
              transform: [{ translateY: ty }, { rotate }],
              opacity,
            }}
          />
        );
      })}
    </View>
  );
};

export const TierCelebrationSheet: React.FC<Props> = ({ visible, tier, tierLabel, takeHomePct, onClose }) => {
  const router = useRouter();
  const scale = useRef(new Animated.Value(0.7)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      haptic.success();
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 100 }),
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.7);
      fade.setValue(0);
    }
  }, [visible, scale, fade]);

  const acknowledge = async () => {
    try { await api.post('/trainer/tier-celebration/acknowledge'); } catch { /* best-effort */ }
  };

  const handleClose = async () => {
    await acknowledge();
    onClose();
  };

  const handleSetRates = async () => {
    await acknowledge();
    onClose();
    router.push('/trainer/set-rates');
  };

  const gradient = TIER_GRADIENT[tier] || TIER_GRADIENT.new;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Animated.View style={[s.backdrop, { opacity: fade }]}>
        <Animated.View style={[s.sheet, { transform: [{ scale }] }]} testID="tier-celebration-sheet">
          <Confetti />
          <LinearGradient colors={gradient} style={s.crest}>
            <Ionicons name="trophy" size={36} color="#FFF" />
          </LinearGradient>

          <Text style={s.eyebrow}>YOU'RE IN</Text>
          <Text style={s.tierName}>{tierLabel}</Text>
          <Text style={s.tagline}>Tier unlocked. Time to set your price.</Text>

          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>{takeHomePct}%</Text>
              <Text style={s.statLabel}>Your Take-Home</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statValue}>{100 - takeHomePct}%</Text>
              <Text style={s.statLabel}>RapidReps Fee</Text>
            </View>
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={handleSetRates} testID="tier-celebration-set-rates">
            <LinearGradient colors={gradient} style={s.primaryBtnInner}>
              <Text style={s.primaryBtnText}>Set My Rates</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn} onPress={handleClose} testID="tier-celebration-close">
            <Text style={s.secondaryBtnText}>Later</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default TierCelebrationSheet;

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: DS.colors.bgRaised,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  crest: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  eyebrow: { color: DS.colors.orangeGlow, fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 6 },
  tierName: { color: DS.colors.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  tagline: { color: DS.colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  statRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 24, width: '100%', marginBottom: 22, borderWidth: 1, borderColor: DS.colors.border },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: DS.colors.border },
  statValue: { color: DS.colors.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  statLabel: { color: DS.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  primaryBtn: { width: '100%', borderRadius: 999, overflow: 'hidden', marginBottom: 8 },
  primaryBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnText: { color: DS.colors.textMuted, fontSize: 14, fontWeight: '700' },
});

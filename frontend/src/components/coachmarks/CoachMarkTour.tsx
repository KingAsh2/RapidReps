/**
 * CoachMarkTour — iter118v
 *
 * A lightweight first-run coach-mark system. Point it at any set of refs on
 * screen; it shows one spotlight card at a time, arrow-pointing at the
 * target, with a "Got it" button that advances the tour. When the last step
 * is dismissed the entire tour is remembered in AsyncStorage under the
 * caller-supplied `tourId` and will never appear again for that user.
 *
 * Design choices:
 *  - Uses `measureInWindow` (not `onLayout`) so positions are absolute to the
 *    screen — this survives ScrollView contents, nested containers, etc.
 *  - Backdrop is a semi-transparent LinearGradient rather than a hard black
 *    Modal fade; it lets athletes still see WHERE they are, keeping the
 *    tour feel like a helpful nudge instead of a hijack.
 *  - Spotlight is a rounded orange-glow "halo" drawn around the target rect
 *    — deliberately not a cutout mask, because RN's SVG-free clipping is
 *    fiddly across iOS/Android and the halo reads clearer at small sizes.
 *  - Card auto-orients above or below the target based on remaining space
 *    (screen safe-area aware, so it never lands under the notch).
 *  - Progress dots at the bottom of the card so users know how many left.
 *  - Skip button in the top-right for the exceptionally impatient.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type CoachStep = {
  /** Ref pointing at the ELEMENT to spotlight. It must render before the tour opens. */
  targetRef: React.RefObject<any>;
  title: string;
  body: string;
  /** Small icon name (Ionicons) for the top of the card. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Optional CTA copy override for the last step (default: "Got it"). */
  cta?: string;
};

type Props = {
  /** Unique storage key. Same id will never show again once completed. */
  tourId: string;
  steps: CoachStep[];
  /** If false the tour is disabled at the caller level (e.g. onboarding still open). */
  enabled?: boolean;
  /** Delay in ms before first attempt to measure — gives refs a beat to lay out. */
  startDelayMs?: number;
};

type Rect = { x: number; y: number; width: number; height: number };

const STORAGE_PREFIX = 'coachmark_v1_';

async function isCompleted(tourId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_PREFIX + tourId);
    return v === '1';
  } catch {
    return false;
  }
}

async function markCompleted(tourId: string): Promise<void> {
  try { await AsyncStorage.setItem(STORAGE_PREFIX + tourId, '1'); } catch { /* non-blocking */ }
}

/**
 * QA helper — wipe a single tour flag so it fires again on next mount.
 * Not wired to any UI in production; can be called from a dev-only settings
 * screen or via the React Native inspector.
 */
export async function resetCoachMarkTour(tourId: string): Promise<void> {
  try { await AsyncStorage.removeItem(STORAGE_PREFIX + tourId); } catch { /* non-blocking */ }
}

export function CoachMarkTour({ tourId, steps, enabled = true, startDelayMs = 700 }: Props) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Kick off once — check storage + wait for refs to lay out.
  useEffect(() => {
    let cancelled = false;
    if (!enabled || steps.length === 0) return;
    (async () => {
      if (await isCompleted(tourId)) return;
      // Give the caller's UI time to render + refs to hydrate.
      setTimeout(() => { if (!cancelled) setVisible(true); }, startDelayMs);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, enabled]);

  // Re-measure whenever the current step changes.
  const measureCurrent = useCallback(() => {
    const step = steps[stepIndex];
    if (!step || !step.targetRef?.current) {
      setRect(null);
      return;
    }
    const node = step.targetRef.current;
    // React Native's `measureInWindow` gives coords relative to the screen.
    // Retry up to 3× with small delays because during first-render some
    // parents haven't finished layout yet.
    let attempts = 0;
    const tryMeasure = () => {
      attempts += 1;
      try {
        node.measureInWindow?.((x: number, y: number, width: number, height: number) => {
          if (width && height) {
            setRect({ x, y, width, height });
          } else if (attempts < 3) {
            setTimeout(tryMeasure, 120);
          } else {
            setRect(null);
          }
        });
      } catch {
        if (attempts < 3) setTimeout(tryMeasure, 120);
      }
    };
    tryMeasure();
  }, [stepIndex, steps]);

  useEffect(() => {
    if (!visible) return;
    measureCurrent();
    // Fade + pulse animation
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [visible, stepIndex, measureCurrent, fadeAnim, pulseAnim]);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const handleAdvance = () => {
    if (isLast) {
      markCompleted(tourId);
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setVisible(false);
      });
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    markCompleted(tourId);
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  };

  // Card placement: prefer BELOW the target if there's room; else ABOVE.
  const cardLayout = useMemo(() => {
    const cardW = Math.min(SCREEN_W - 40, 360);
    const cardH = 190; // approx — pad to real height at runtime
    const gap = 18;
    if (!rect) {
      // No target — center the card.
      return {
        left: (SCREEN_W - cardW) / 2,
        top: SCREEN_H / 2 - cardH / 2,
        width: cardW,
        arrowSide: 'none' as const,
        arrowLeft: 0,
      };
    }
    const targetCenterX = rect.x + rect.width / 2;
    const spaceBelow = SCREEN_H - (rect.y + rect.height) - insets.bottom - 24;
    const spaceAbove = rect.y - insets.top - 24;
    const placeBelow = spaceBelow >= cardH + gap || spaceBelow > spaceAbove;
    const top = placeBelow
      ? Math.min(SCREEN_H - cardH - insets.bottom - 12, rect.y + rect.height + gap)
      : Math.max(insets.top + 12, rect.y - cardH - gap);
    const left = Math.max(16, Math.min(SCREEN_W - cardW - 16, targetCenterX - cardW / 2));
    return {
      left, top, width: cardW,
      arrowSide: (placeBelow ? 'up' : 'down') as 'up' | 'down',
      arrowLeft: Math.max(20, Math.min(cardW - 40, targetCenterX - left - 8)),
    };
  }, [rect, insets.top, insets.bottom]);

  // Spotlight glow around the target — a rounded orange halo that "breathes"
  // via the pulse animation for a little bit of life.
  const glow = useMemo(() => {
    if (!rect) return null;
    const pad = 10;
    return {
      left: rect.x - pad,
      top: rect.y - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      // Radius that hugs pill / disc / rect shapes gracefully:
      borderRadius: Math.min((rect.width + pad * 2) / 2, 24),
    };
  }, [rect]);

  if (!visible || !step) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleSkip}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.root, { opacity: fadeAnim }]} pointerEvents="box-none">
        {/* Deep-navy scrim with a warm orange bloom toward the spotlight. */}
        <View style={styles.backdrop} pointerEvents="auto" />
        {/* Spotlight glow — only rendered once we've measured the target. */}
        {glow ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.spotlight,
              glow,
              {
                opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                transform: [{
                  scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
                }],
              },
            ]}
          />
        ) : null}

        {/* Skip pill — top right */}
        <TouchableOpacity
          onPress={handleSkip}
          style={[styles.skipPill, { top: insets.top + 12 }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID={`coachmark-${tourId}-skip`}
          // @ts-ignore
          data-testid={`coachmark-${tourId}-skip`}
        >
          <Text style={styles.skipText}>Skip tour</Text>
        </TouchableOpacity>

        {/* Coach card */}
        <View style={[styles.card, { left: cardLayout.left, top: cardLayout.top, width: cardLayout.width }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 24 : 60} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(30,20,10,0.92)', 'rgba(10,10,15,0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Arrow pointing at the target */}
          {cardLayout.arrowSide === 'up' ? (
            <View style={[styles.arrowUp, { left: cardLayout.arrowLeft }]} />
          ) : cardLayout.arrowSide === 'down' ? (
            <View style={[styles.arrowDown, { left: cardLayout.arrowLeft }]} />
          ) : null}

          <View style={styles.cardBody}>
            {step.icon ? (
              <View style={styles.iconBubble}>
                <Ionicons name={step.icon} size={18} color="#FFB673" />
              </View>
            ) : null}
            <Text style={styles.cardTitle}>{step.title}</Text>
            <Text style={styles.cardCopy}>{step.body}</Text>

            <View style={styles.cardFooter}>
              <View style={styles.dots}>
                {steps.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === stepIndex && styles.dotActive]}
                  />
                ))}
              </View>
              <TouchableOpacity
                onPress={handleAdvance}
                style={styles.cta}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID={`coachmark-${tourId}-next`}
                accessibilityRole="button"
                // @ts-ignore
                data-testid={`coachmark-${tourId}-next`}
              >
                <LinearGradient
                  colors={['#FF9B2F', '#FF6A00']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGrad}
                >
                  <Text style={styles.ctaText}>
                    {isLast ? (step.cta || 'Got it') : 'Next'}
                  </Text>
                  <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={15} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,8,15,0.72)',
  },
  spotlight: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(255,155,47,0.95)',
    shadowColor: '#FF9B2F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 22,
    // Android needs elevation for shadow to render; iOS uses shadow props.
    elevation: 12,
  },
  skipPill: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  card: {
    position: 'absolute',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,155,47,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  cardBody: {
    padding: 18,
  },
  iconBubble: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,122,0,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,155,47,0.5)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  cardCopy: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  dotActive: {
    backgroundColor: '#FF9B2F',
    width: 18,
  },
  cta: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  arrowUp: {
    position: 'absolute',
    top: -8,
    width: 16, height: 16,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'rgba(30,20,10,0.92)',
    borderLeftWidth: 1, borderTopWidth: 1,
    borderColor: 'rgba(255,155,47,0.35)',
  },
  arrowDown: {
    position: 'absolute',
    bottom: -8,
    width: 16, height: 16,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'rgba(10,10,15,0.92)',
    borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(255,155,47,0.35)',
  },
});

export default CoachMarkTour;

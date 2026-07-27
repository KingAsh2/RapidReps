/**
 * LadderButton — iter106ax "Performance Pro" button primitive.
 *
 * Shape and motion align with /app/design_guidelines.json (Ladder-inspired):
 *   - Sharp 8px corners (not pills, not rounded rectangles — editorial)
 *   - Solid fill or 1px outlined ghost
 *   - 250ms press-down scale to 0.97 + opacity dip (via Pressable)
 *   - Uppercase-off, tight-tracked label using InterTight 700
 *   - Haptic light impact on primary/destructive taps (iOS only)
 *
 * Variants:
 *   - primary    → filled orange (RapidReps brand accent, high-signal CTA)
 *   - secondary  → filled white text on 1px border, transparent bg
 *   - ghost      → text-only, 44px hit region, no border
 *   - destructive → filled #FF3B30 (delete/cancel/leave)
 *
 * Sizes: 'sm' (36px), 'md' (48px default), 'lg' (56px)
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LADDER, LADDER_TYPE } from '../../theme/ladder';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
};

const HEIGHTS: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
const PADDINGS: Record<Size, number> = { sm: 12, md: 20, lg: 24 };
const FONT_SIZES: Record<Size, number> = { sm: 13, md: 15, lg: 16 };

function containerStyleFor(v: Variant, disabled: boolean): ViewStyle {
  if (disabled) return { backgroundColor: LADDER.bgElevated, borderWidth: 0 };
  switch (v) {
    case 'primary':
      return { backgroundColor: LADDER.accent, borderWidth: 0 };
    case 'destructive':
      return { backgroundColor: LADDER.accentBright, borderWidth: 0 };
    case 'secondary':
      return { backgroundColor: 'transparent', borderWidth: 1, borderColor: LADDER.borderStrong };
    case 'ghost':
    default:
      return { backgroundColor: 'transparent', borderWidth: 0 };
  }
}

function labelColorFor(v: Variant, disabled: boolean): string {
  if (disabled) return LADDER.textTertiary;
  if (v === 'ghost' || v === 'secondary') return LADDER.textPrimary;
  return '#FFFFFF';
}

export const LadderButton: React.FC<Props> = ({
  label, onPress, variant = 'primary', size = 'md',
  disabled, loading, iconLeft, iconRight, fullWidth, style, testID,
}) => {
  const isDisabled = !!disabled || !!loading;
  const containerBase = containerStyleFor(variant, isDisabled);
  const labelColor = labelColorFor(variant, isDisabled);

  const handlePress = () => {
    if (isDisabled) return;
    // Light haptic feedback on high-signal buttons; skip for ghost/secondary
    // to avoid feeling noisy on secondary actions.
    if (variant === 'primary' || variant === 'destructive') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const label$: TextStyle = {
    ...LADDER_TYPE.button,
    fontSize: FONT_SIZES[size],
    color: labelColor,
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        containerBase,
        {
          height: HEIGHTS[size],
          paddingHorizontal: PADDINGS[size],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: pressed && !isDisabled ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <View style={styles.content}>
          {iconLeft && <Ionicons name={iconLeft} size={FONT_SIZES[size] + 3} color={labelColor} style={styles.iconLeft} />}
          <Text style={label$} numberOfLines={1}>{label}</Text>
          {iconRight && <Ionicons name={iconRight} size={FONT_SIZES[size] + 3} color={labelColor} style={styles.iconRight} />}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    // Motion: transitions via `transform` + `opacity` only. `transition: all`
    // is a known iOS gotcha that can break transforms; we're per-property.
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});

export default LadderButton;

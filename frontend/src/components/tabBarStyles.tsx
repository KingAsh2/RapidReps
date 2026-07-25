/**
 * iter102m — Shared tab-bar styling tokens.
 * iter106ax — Refactored to a Ladder-inspired dark-blur glass surface.
 *
 * Both trainee and trainer (tabs)/_layout.tsx import these so the bottom
 * navigation looks identical across roles — only the *content* of each tab
 * differs based on role.
 */
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import React from 'react';
import { LADDER, LADDER_FONTS } from '../theme/ladder';

export const TAB_COLORS = {
  accent: LADDER.accent,
  navy: LADDER.bgBase,
  white: LADDER.textPrimary,
  gray: LADDER.textTertiary,
  tabBg: 'transparent', // glass — actual surface is BlurView
};

// iter106ax: transparent bar so BlurView shows through; content sits on
// a heavy dark tint (rgba(10,10,10,0.72)) with a hairline top border.
export const TAB_BAR_STYLE = {
  backgroundColor: 'transparent',
  borderTopWidth: 0,
  height: Platform.OS === 'ios' ? 88 : 72,
  paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  paddingTop: 10,
  elevation: 0,
  position: 'absolute' as const,
} as const;

export const TAB_LABEL_STYLE = {
  fontFamily: LADDER_FONTS.sansSemibold,
  fontSize: 11,
  letterSpacing: 0.3,
  marginTop: 2,
};

export const TAB_ICON_STYLE = {
  marginBottom: -2,
};

export const TAB_BADGE_STYLE = {
  backgroundColor: LADDER.accent,
  fontSize: 11,
  fontWeight: '700' as const,
  fontFamily: LADDER_FONTS.sansBold,
};

export const tabSharedStyles = StyleSheet.create({
  activeIconContainer: {
    backgroundColor: 'rgba(255, 106, 0, 0.14)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

/**
 * Glass background component — passed to expo-router's <Tabs> via the
 * `tabBarBackground` screenOption. Absolutely positioned; the top hairline
 * separator sits inside so it doesn't clip.
 */
export const TabBarGlassBackground: React.FC = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <BlurView
      intensity={Platform.OS === 'ios' ? 60 : 90}
      tint="dark"
      style={StyleSheet.absoluteFill}
    />
    <View
      style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 10, 10, 0.72)',
      }}
    />
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, height: 1,
        backgroundColor: LADDER.borderSubtle,
      }}
    />
  </View>
);

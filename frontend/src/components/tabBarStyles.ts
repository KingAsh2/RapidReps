/**
 * iter102m — Shared tab-bar styling tokens.
 *
 * Both the trainee and trainer (tabs)/_layout.tsx import these so the bottom
 * navigation looks identical across roles — only the *content* of each tab
 * differs based on role. Keeps "uniform UI" enforceable from a single file.
 */
import { Platform, StyleSheet } from 'react-native';

export const TAB_COLORS = {
  accent: '#FF6A00',
  navy: '#0A0E1A',
  white: '#FFFFFF',
  gray: 'rgba(255,255,255,0.4)',
  tabBg: '#0D1117',
};

export const TAB_BAR_STYLE = {
  backgroundColor: TAB_COLORS.tabBg,
  borderTopWidth: 1,
  borderTopColor: 'rgba(255,255,255,0.06)',
  height: Platform.OS === 'ios' ? 88 : 70,
  paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  paddingTop: 10,
  shadowColor: '#FF6A00',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 12,
} as const;

export const TAB_LABEL_STYLE = {
  fontSize: 13,
  fontWeight: '700' as const,
  marginTop: 2,
};

export const TAB_ICON_STYLE = {
  marginBottom: -2,
};

export const TAB_BADGE_STYLE = {
  backgroundColor: TAB_COLORS.accent,
  fontSize: 13,
  fontWeight: '700' as const,
};

export const tabSharedStyles = StyleSheet.create({
  activeIconContainer: {
    backgroundColor: 'rgba(255, 106, 0, 0.12)',
    borderRadius: 12,
    padding: 4,
  },
});

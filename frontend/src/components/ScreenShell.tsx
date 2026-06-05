/**
 * iter102n — Shared screen primitives.
 *
 * One source of truth for the chrome shared by both trainee and trainer
 * screens (back button + title + optional right action + body container).
 * Drop into any screen as:
 *
 *   <ScreenShell title="My Sessions" onBack={() => router.back()}>
 *     {body...}
 *   </ScreenShell>
 *
 * The shell:
 *  - Uses a consistent dark navy background that plays well with the global
 *    FloatingOrangeBg + AccentGlowOverlay.
 *  - SafeAreaView-aware so the header sits below the notch.
 *  - Renders a 44pt left-aligned back button if `onBack` is provided.
 *  - Optional `right` slot for an icon button (e.g. settings, edit, share).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccentColor } from '../utils/accentColor';

const COLORS = {
  bg0: '#0A0E1A',
  bg1: '#0D1117',
  white: '#FFFFFF',
  dim: 'rgba(255,255,255,0.55)',
  divider: 'rgba(255,255,255,0.08)',
};

export const ScreenHeader: React.FC<{
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  testID?: string;
}> = ({ title, subtitle, onBack, right, testID }) => (
  <View style={styles.header} data-testid={testID || 'screen-header'}>
    {onBack ? (
      <TouchableOpacity
        onPress={onBack}
        style={styles.headerBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        data-testid="screen-header-back"
      >
        <Ionicons name="chevron-back" size={22} color={COLORS.white} />
      </TouchableOpacity>
    ) : (
      <View style={styles.headerBtn} />
    )}
    <View style={styles.headerTitleWrap}>
      {title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : null}
      {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
    <View style={styles.headerBtn}>{right}</View>
  </View>
);

/**
 * iter102n Wave 5 — TabScreenHeader: variant for top-level tab screens that
 * don't have a back button. Title is left-aligned (more app-like, less modal-like)
 * and a right slot is reserved for primary tab actions (filters, search, +).
 */
export const TabScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  testID?: string;
}> = ({ title, subtitle, right, testID }) => (
  <View style={styles.tabHeader} data-testid={testID || 'tab-screen-header'}>
    <View style={{ flex: 1 }}>
      <Text style={styles.tabHeaderTitle}>{title}</Text>
      {subtitle ? <Text style={styles.tabHeaderSubtitle}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

interface ShellProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  scroll?: boolean;
  children: React.ReactNode;
  testID?: string;
}

export const ScreenShell: React.FC<ShellProps> = ({
  title, subtitle, onBack, right, scroll = true, children, testID,
}) => {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView edges={['top']} style={styles.safe} data-testid={testID || 'screen-shell'}>
      <LinearGradient colors={[COLORS.bg0, COLORS.bg1]} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader title={title} subtitle={subtitle} onBack={onBack} right={right} />
      <Body
        style={styles.body}
        contentContainerStyle={scroll ? styles.bodyScrollContent : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Body>
    </SafeAreaView>
  );
};

/** Consistent primary CTA — full-width accent gradient pill (uses user's brand color). */
export const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: any;
}> = ({ label, onPress, icon, disabled, loading, testID, style }) => {
  const { gradient, glow } = useAccentColor();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.primaryWrap, { shadowColor: gradient[0] }, disabled && { opacity: 0.45 }, style]}
      data-testid={testID || 'primary-btn'}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGrad}
      >
        {icon ? <Ionicons name={icon} size={18} color="#FFF" /> : null}
        <Text style={styles.primaryText}>{loading ? 'Please wait…' : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

/** Consistent secondary CTA — outlined pill, transparent fill, accent border. */
export const SecondaryButton: React.FC<{
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  testID?: string;
  style?: any;
}> = ({ label, onPress, icon, disabled, testID, style }) => {
  const { accent, ring } = useAccentColor();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.secondaryWrap, { borderColor: ring }, disabled && { opacity: 0.45 }, style]}
      data-testid={testID || 'secondary-btn'}
    >
      {icon ? <Ionicons name={icon} size={18} color={accent} /> : null}
      <Text style={[styles.secondaryText, { color: accent }]}>{label}</Text>
    </TouchableOpacity>
  );
};

/** Uniform card surface — use for any "section card" on either side. */
export const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const SHELL_COLORS = COLORS;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 6 : 10,
    paddingBottom: 12,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  headerSubtitle: { color: COLORS.dim, fontSize: 11, marginTop: 2 },

  body: { flex: 1 },
  bodyScrollContent: { paddingBottom: 32 },

  card: {
    backgroundColor: 'rgba(20,25,41,0.7)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  primaryWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryGrad: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  secondaryWrap: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,159,28,0.55)',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: '#FF9F1C', fontSize: 14, fontWeight: '700' },
});

export default ScreenShell;

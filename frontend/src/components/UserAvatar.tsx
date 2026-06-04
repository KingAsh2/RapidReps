/**
 * UserAvatar — iter97 (#7, #18, #19). One component for every user thumbnail.
 *
 * Renders the user's real photo when available; falls back to colored initials.
 * Used in: nearby cards, profile tab icon, chat headers, admin lists, etc.
 *
 *   <UserAvatar user={trainer} size={48} />
 *   <UserAvatar user={user} size={28} ring />   // tab-bar style
 */
import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { avatarAccentFor, initialsFor, resolveAvatarUrl } from '../utils/avatar';

type Props = {
  user?: any;
  size?: number;
  ring?: boolean;       // accent ring for active states (e.g. selected tab)
  style?: ViewStyle;
};

export const UserAvatar: React.FC<Props> = ({ user, size = 40, ring = false, style }) => {
  const url = resolveAvatarUrl(user);
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle: ViewStyle | undefined = ring
    ? { borderWidth: 2, borderColor: '#FF7A00' }
    : undefined;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.img, dim, ringStyle, style]}
        accessibilityLabel="User avatar"
        data-testid="user-avatar-img"
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        dim,
        { backgroundColor: avatarAccentFor(user) },
        ringStyle,
        style,
      ]}
      data-testid="user-avatar-initials"
    >
      <Text style={[styles.initials, { fontSize: Math.max(10, size * 0.4) }]}>
        {initialsFor(user)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  img: { backgroundColor: '#1a2238' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
});

export default UserAvatar;

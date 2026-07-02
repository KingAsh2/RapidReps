/**
 * UserAvatar — iter106ac / iter106ar.
 *
 * Thin wrapper around `TrainerAvatar` so the WHOLE app renders avatars with
 * the same disc: unified ring, subtle brand-color pulse, gradient-monogram
 * fallback when there's no photo (iter106aq), placeholder-URL scrubbing
 * (iter106ap), and now an OPTIONAL "tap-to-upload" edit affordance
 * (iter106ar) for own-profile screens.
 *
 * The legacy API (`user`, `size`, `ring`, `style`) is preserved so the
 * 30+ existing call sites keep working without edits.
 *
 *   <UserAvatar user={trainer} size={48} />                       // read-only, no pulse
 *   <UserAvatar user={user} size={28} ring />                     // pulse on
 *   <UserAvatar user={u} size={40} pulse={false} />               // explicit override
 *   <UserAvatar user={me} size={96} editable onEditPress={pick} /> // own-profile edit affordance
 */
import React from 'react';
import { ViewStyle, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { avatarAccentFor, initialsFor, resolveAvatarUrl } from '../utils/avatar';
import { TrainerAvatar } from './TrainerAvatar';

type Props = {
  user?: any;
  size?: number;
  /** Show the active-state ring (was the trigger for the orange border).
   *  When true we also turn the pulse halo on, since that's what visually
   *  signals "live / active" to the user. */
  ring?: boolean;
  /** Explicit pulse control if the call site needs to override `ring`. */
  pulse?: boolean;
  /** When true, render a small "+" badge overlay + dashed accent ring and
   *  wrap the disc in a TouchableOpacity. Only use on the current user's
   *  OWN avatar (own profile, edit-profile) — surfaces the ability to
   *  upload a photo without adding a separate button.
   *  Requires `onEditPress` to be meaningful. */
  editable?: boolean;
  /** Invoked when the user taps an `editable` avatar. */
  onEditPress?: () => void;
  /** Optional testID for the outer touch target. */
  testID?: string;
  style?: ViewStyle;
};

export const UserAvatar: React.FC<Props> = ({
  user,
  size = 40,
  ring = false,
  pulse,
  editable = false,
  onEditPress,
  testID,
  style,
}) => {
  const url = resolveAvatarUrl(user);
  const ringColor = user?.accentColor || avatarAccentFor(user) || '#FF5F1F';
  const initials = initialsFor(user);

  // iter106ar: the edit affordance's badge scales with the disc so it looks
  // proportional on both 40px chat avatars and 96px profile heroes.
  const badgeSize = Math.max(18, Math.round(size * 0.28));
  const badgeOffset = Math.max(-2, Math.round(size * 0.02));

  const disc = (
    <TrainerAvatar
      uri={url || undefined}
      initials={initials}
      ringColor={ringColor}
      size={size}
      pulse={pulse !== undefined ? pulse : ring}
    />
  );

  if (!editable) {
    return <View style={style}>{disc}</View>;
  }

  return (
    <TouchableOpacity
      onPress={onEditPress}
      activeOpacity={0.85}
      testID={testID || 'user-avatar-edit'}
      accessibilityRole="button"
      accessibilityLabel="Change profile photo"
      style={[styles.editWrap, style]}
      // Bump the tap target a bit for finger friendliness on the smaller sizes.
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {disc}
      {/* + badge — sits on the bottom-right, uses the same accent as the ring
          so the whole disc reads as one coherent element. */}
      <View
        pointerEvents="none"
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            right: badgeOffset,
            bottom: badgeOffset,
            backgroundColor: ringColor,
          },
        ]}
      >
        <Text style={[styles.badgeGlyph, { fontSize: Math.round(badgeSize * 0.62), lineHeight: badgeSize }]}>+</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  editWrap: {
    // Own the layout box so the absolute-positioned + badge lands on the
    // disc, not on the parent's next sibling.
    alignSelf: 'flex-start',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    // Ring the badge with the surface color so it looks lifted off the disc
    // regardless of screen background. rgba(0,0,0,0) is a browser hint — on
    // native we use a translucent white to punch the badge outward.
    borderWidth: 2,
    borderColor: '#0A0A0F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeGlyph: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    // Nudge the plus up 1px so it optically centers within the small badge.
    marginTop: -1,
  },
});

export default UserAvatar;

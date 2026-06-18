/**
 * UserAvatar — iter106ac.
 *
 * Was a separate avatar implementation (plain circle, optional orange ring,
 * no pulse). The user asked for a SINGLE unified look across the app, so
 * this is now a thin wrapper around `TrainerAvatar` — same circular ring +
 * subtle brand-color pulse that the discovery surfaces already use.
 *
 * The legacy API (`user`, `size`, `ring`, `style`) is preserved so the
 * 30+ existing call sites keep working without edits.
 *
 *   <UserAvatar user={trainer} size={48} />          // pulse off (default)
 *   <UserAvatar user={user} size={28} ring />        // pulse on
 *   <UserAvatar user={u} size={40} pulse={false} />  // explicit override
 */
import React from 'react';
import { ViewStyle, View } from 'react-native';
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
  style?: ViewStyle;
};

export const UserAvatar: React.FC<Props> = ({
  user,
  size = 40,
  ring = false,
  pulse,
  style,
}) => {
  const url = resolveAvatarUrl(user);
  const ringColor = user?.accentColor || avatarAccentFor(user) || '#FF5F1F';
  const initials = initialsFor(user);
  return (
    <View style={style}>
      <TrainerAvatar
        uri={url || undefined}
        initials={initials}
        ringColor={ringColor}
        size={size}
        pulse={pulse !== undefined ? pulse : ring}
      />
    </View>
  );
};

export default UserAvatar;

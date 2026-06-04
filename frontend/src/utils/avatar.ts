/**
 * Unified avatar helpers — iter97 (#7, #18, #19).
 *
 * Single source of truth for rendering a user/trainer/trainee profile photo.
 * Backend stores `avatarUrl` (sometimes `profilePhotoUrl` for legacy reasons);
 * this normalizer picks the right field, ensures we don't render `null`/`""`,
 * and provides a deterministic colored-initial fallback when no photo exists.
 *
 * Usage:
 *   const src = resolveAvatarUrl(user);
 *   const initials = initialsFor(user);
 *   // Render <Image source={{uri: src}}/> if src, else <InitialsAvatar text={initials}/>
 */

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type AvatarBearer = {
  avatarUrl?: string | null;
  profilePhotoUrl?: string | null;
  photoUrl?: string | null;
  profilePicture?: string | null;
  fullName?: string;
  name?: string;
  email?: string;
};

/**
 * Returns a usable URL or null. Promotes relative `/api/files/...` to absolute
 * via EXPO_PUBLIC_BACKEND_URL so Image components can render it on web/native.
 */
export function resolveAvatarUrl(u?: AvatarBearer | null): string | null {
  if (!u) return null;
  const raw =
    u.avatarUrl ||
    u.profilePhotoUrl ||
    u.photoUrl ||
    u.profilePicture ||
    null;
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_URL}${raw}`;
  return raw;
}

/** Two-letter initials with sane fallbacks (e.g. "John Doe" → "JD", "alex" → "A", undefined → "?"). */
export function initialsFor(u?: AvatarBearer | null): string {
  if (!u) return '?';
  const name = (u.fullName || u.name || u.email || '').trim();
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

/** Deterministic accent color from a name string — used by the InitialsAvatar fallback. */
export function avatarAccentFor(u?: AvatarBearer | null): string {
  const palette = ['#FF7A00', '#FF5500', '#00C2FF', '#7C4DFF', '#26C281', '#FFC400', '#EC407A'];
  const seed = (u?.fullName || u?.name || u?.email || 'x');
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

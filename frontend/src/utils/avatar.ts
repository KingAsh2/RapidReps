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
  profilePhoto?: string | null;       // iter102l: canonical field returned by /auth/me — must be checked
  profilePhotoUrl?: string | null;
  photoUrl?: string | null;
  profilePicture?: string | null;
  fullName?: string;
  name?: string;
  email?: string;
};

/**
 * iter106ap (v2, fixed after testing-agent iteration_110 review): Known
 * placeholder patterns that leaked into production data during earlier test
 * iterations. Returns true when the URL should be treated as "no photo".
 *
 * Exported so TrainerAvatar can use the SAME check without duplicating the
 * regex — a maintenance trap the previous version created.
 *
 * Bug fixed: the previous regex `(^|\.)example\.com\b` failed for the
 * canonical `https://example.com/...` form because the char before
 * `example.com` is `/`, not `.` or start-of-string. New pattern accepts
 * `/`, `:`, `@`, `.`, or start-of-string as the pre-boundary character.
 * Also hardens the some-photo.png check against `?`/`#` suffixes.
 */
export function isPlaceholderAvatarUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed === '') return false;
  // example.com in hostname position: covers https://example.com/x,
  // http://example.com/x, sub.example.com/x, user@example.com/x.
  if (/(?:^|[./:@])example\.com(?:[/:?#]|$)/i.test(trimmed)) return true;
  // Legacy /some-photo.png stub, tolerant of query-string/fragment.
  if (/\/some-photo\.png(?:[?#]|$)/i.test(trimmed)) return true;
  return false;
}

/**
 * Returns a usable URL or null. Promotes relative `/api/files/...` to absolute
 * via EXPO_PUBLIC_BACKEND_URL so Image components can render it on web/native.
 *
 * iter106ap: also filters out known-broken placeholder URLs that were seeded
 * during earlier test iterations (example.com, some-photo.png). These leaked
 * into production data and caused the admin portal + trainer cards to render
 * blank circles instead of falling through to the colored-initials fallback.
 */
export function resolveAvatarUrl(u?: AvatarBearer | null): string | null {
  if (!u) return null;
  const raw =
    u.avatarUrl ||
    u.profilePhoto ||           // iter102l — was missing; caused Profile tab to show initials when only profilePhoto was set
    u.profilePhotoUrl ||
    u.photoUrl ||
    u.profilePicture ||
    null;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // iter106ap: hard-drop known-bad placeholders so we go straight to initials
  // and skip the wasted network round-trip + flash-of-blank-circle.
  if (isPlaceholderAvatarUrl(trimmed)) return null;

  // Absolute URLs (http/https/data/file/content/blob) — return as-is.
  if (/^(https?|data|file|content|blob):/i.test(trimmed)) return trimmed;

  // Backend-relative path — promote to absolute.
  if (trimmed.startsWith('/')) return `${API_URL}${trimmed}`;

  // Unknown scheme — trust the caller as a last resort.
  return trimmed;
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

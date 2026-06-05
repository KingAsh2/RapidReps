/**
 * iter102n Wave 3 — Accent color utilities.
 *
 * Centralised place to read the signed-in user's chosen brand accent color
 * and derive consistent variants (button gradient stops, soft fills, border
 * rings, glow shadows). Default brand orange when no preference is set.
 *
 *   const { accent, soft, ring, gradient } = useAccentColor();
 *
 * `gradient` is a two-stop `[from, to]` tuple that LinearGradient consumes
 * directly. We keep two distinct stops so the button still feels rich even
 * when the user picks a flat color.
 */
import { useAuth } from '../contexts/AuthContext';

export const DEFAULT_ACCENT = '#FF6A00';
export const DEFAULT_ACCENT_DEEP = '#FF3D00';

/** "#RRGGBB" → "rgba(r,g,b,alpha)". Falls back to brand orange on invalid input. */
export const hexToRgba = (hex: string | undefined, alpha: number): string => {
  const fallback = '255,106,0';
  if (!hex || typeof hex !== 'string') return `rgba(${fallback},${alpha})`;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) {
    return `rgba(${fallback},${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Slightly darken a hex color for a 2-stop gradient deeper edge. */
export const darken = (hex: string | undefined, amount = 0.18): string => {
  if (!hex || typeof hex !== 'string') return DEFAULT_ACCENT_DEEP;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return DEFAULT_ACCENT_DEEP;
  const r = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount))));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

export interface AccentPalette {
  /** Raw accent hex chosen by the user (or fallback orange). */
  accent: string;
  /** Slightly darker hex used as the second gradient stop. */
  accentDeep: string;
  /** Two-stop tuple for LinearGradient. */
  gradient: [string, string];
  /** Translucent fill (12% alpha) for soft surfaces, e.g. button hover. */
  soft: string;
  /** Translucent border (35% alpha) for outlined CTAs / rings. */
  ring: string;
  /** Translucent glow (55% alpha) for shadow + outer glow effects. */
  glow: string;
}

/** React hook that resolves the current user's accent palette. */
export const useAccentColor = (): AccentPalette => {
  const { user } = useAuth();
  const accent = ((user as any)?.accentColor as string | undefined) || DEFAULT_ACCENT;
  const accentDeep = darken(accent, 0.18);
  return {
    accent,
    accentDeep,
    gradient: [accent, accentDeep],
    soft: hexToRgba(accent, 0.12),
    ring: hexToRgba(accent, 0.35),
    glow: hexToRgba(accent, 0.55),
  };
};

/** Pure helper for when you have an accent string already (e.g. from a profile prop). */
export const paletteFor = (hex: string | undefined): AccentPalette => {
  const accent = hex || DEFAULT_ACCENT;
  const accentDeep = darken(accent, 0.18);
  return {
    accent,
    accentDeep,
    gradient: [accent, accentDeep],
    soft: hexToRgba(accent, 0.12),
    ring: hexToRgba(accent, 0.35),
    glow: hexToRgba(accent, 0.55),
  };
};

/**
 * GlobalPreviewBanner — iter106av.
 *
 * Mounted once at the root layout so every screen with `?preview=1` (or
 * `?preview=true`) in its URL params gets the "You're previewing..." pill
 * automatically. Replaces the per-screen `<PreviewBanner />` we were
 * copy-pasting into trainer-detail, trainee-profile, and (soon) more.
 *
 * Accent picking: URL param `previewAccent` (URL-encoded hex like `%23FF6A00`)
 * wins; otherwise defaults to RapidReps orange.
 */
import React from 'react';
import { useGlobalSearchParams } from 'expo-router';
import { PreviewBanner } from './PreviewBanner';

export const GlobalPreviewBanner: React.FC = () => {
  const params = useGlobalSearchParams<{ preview?: string; previewAccent?: string }>();
  const visible = params.preview === '1' || params.preview === 'true';
  if (!visible) return null;
  return <PreviewBanner visible accent={params.previewAccent || null} />;
};

export default GlobalPreviewBanner;

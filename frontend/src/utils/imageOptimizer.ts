/**
 * imageOptimizer — iter105 perf pass.
 *
 * Compresses and resizes images BEFORE upload so we stop shipping multi-MB
 * camera-raw photos over the wire. Pre-iter105 onboarding/edit-profile sent
 * raw camera output as base64; payloads regularly hit 4–7 MB and uploads felt
 * "stuck" for 10+ s on cellular.
 *
 * Targets:
 *  - avatar / profile photo: 720px max edge, 80% JPEG.
 *  - gallery / highlight thumbnail: 1080px max edge, 78% JPEG.
 *  - receipt / id document: 1200px max edge, 85% JPEG (keep legibility).
 *
 * No business-logic change: callers still pass the resulting URI to the same
 * upload endpoint — we just shrink it first.
 */
import * as ImageManipulator from 'expo-image-manipulator';

export type ImagePreset = 'avatar' | 'gallery' | 'document';

const PRESETS: Record<ImagePreset, { maxEdge: number; quality: number }> = {
  avatar:   { maxEdge: 720,  quality: 0.80 },
  gallery:  { maxEdge: 1080, quality: 0.78 },
  document: { maxEdge: 1200, quality: 0.85 },
};

/**
 * Returns a compressed local file URI ready for upload.
 * Falls back to the original URI if manipulation fails (so onboarding never
 * dead-ends on an old device that can't decode the source format).
 */
export async function optimizeImage(uri: string, preset: ImagePreset = 'avatar'): Promise<string> {
  if (!uri) return uri;
  const { maxEdge, quality } = PRESETS[preset];
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxEdge } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri || uri;
  } catch {
    return uri; // best-effort — never block the user on a manipulator failure
  }
}

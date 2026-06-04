/**
 * Global single-audio coordinator — iter97 (#1).
 *
 * Guarantee: at most ONE Audio.Sound is playing across the entire app.
 * When a screen mounts a vibe player and starts playback, any previously
 * registered audio is stopped + unloaded first.
 *
 * Usage:
 *   import { registerActiveAudio, releaseActiveAudio } from './audioCoordinator';
 *   await registerActiveAudio(sound);  // stops any prior sound, then registers this one
 *   ...
 *   await releaseActiveAudio(sound);   // call on unmount or pause
 */
import { Audio } from 'expo-av';

type ActiveSound = Audio.Sound | null;

let active: ActiveSound = null;

export async function registerActiveAudio(next: Audio.Sound): Promise<void> {
  if (active && active !== next) {
    try { await active.stopAsync(); } catch { /* ignore */ }
    try { await active.unloadAsync(); } catch { /* ignore */ }
  }
  active = next;
}

export async function releaseActiveAudio(target: Audio.Sound): Promise<void> {
  // Only clear the slot if the caller is the current active sound.
  if (active === target) {
    try { await active.stopAsync(); } catch { /* ignore */ }
    try { await active.unloadAsync(); } catch { /* ignore */ }
    active = null;
  } else {
    try { await target.stopAsync(); } catch { /* ignore */ }
    try { await target.unloadAsync(); } catch { /* ignore */ }
  }
}

export async function stopAllAudio(): Promise<void> {
  if (active) {
    try { await active.stopAsync(); } catch { /* ignore */ }
    try { await active.unloadAsync(); } catch { /* ignore */ }
    active = null;
  }
}

export function getActiveAudio(): ActiveSound {
  return active;
}

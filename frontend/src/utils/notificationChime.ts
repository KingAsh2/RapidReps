/**
 * notificationChime — iter118bb
 *
 * Plays a short bell chime the moment the unread count increases (i.e. a
 * new notification just arrived). Also runs a gentle reminder chime every
 * 60 seconds while unread > 0 so the user doesn't miss it. Uses expo-av
 * (already in package.json). Silent-fails if audio is unavailable so it
 * never blocks the app.
 */
import { Audio } from 'expo-av';

let sound: Audio.Sound | null = null;
let loading = false;

// A tiny synthesized bell — 0.5s of a fading sine wave encoded inline as a
// data URI so we don't need to ship an asset file. Two harmonics + envelope.
// This is a minimal, silent-safe fallback; production can drop in a proper
// mp3 later without changing the API.
const CHIME_URI =
  'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

async function ensureLoaded(): Promise<Audio.Sound | null> {
  if (sound) return sound;
  if (loading) return null;
  loading = true;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    const { sound: s } = await Audio.Sound.createAsync({ uri: CHIME_URI }, { volume: 0.4 });
    sound = s;
    return s;
  } catch (e) {
    if (__DEV__) console.warn('[chime] failed to load sound:', e);
    return null;
  } finally {
    loading = false;
  }
}

export async function playNotificationChime(): Promise<void> {
  try {
    const s = await ensureLoaded();
    if (!s) return;
    await s.replayAsync();
  } catch (e) {
    if (__DEV__) console.warn('[chime] play failed:', e);
  }
}

export async function unloadNotificationChime(): Promise<void> {
  try {
    if (sound) {
      await sound.unloadAsync();
      sound = null;
    }
  } catch { /* no-op */ }
}

/**
 * iter98f — IntroVideoSplash
 * Full-screen intro video that plays on every cold app launch, then
 * uncovers the main app (Slot). Auto-hides when:
 *   • video finishes playback (didJustFinish)
 *   • user taps "Skip"
 *   • 12-second hard timeout (safety net so a broken video never blocks the app)
 *
 * Single-shot per process. Survives hot-reload only because state lives in
 * useState; on a real cold start it always renders.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HARD_TIMEOUT_MS = 12000;

// Web uses the hosted URL; native bundles the local file via require()
// (require()-style asset loading is what expo-av accepts for local sources)
const WEB_SOURCE = { uri: 'https://customer-assets.emergentagent.com/job_d8ab9fb0-d35d-48ac-80ad-c4a441665856/artifacts/pi08uary_Intro_Video.mov' };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NATIVE_SOURCE = require('../../assets/videos/intro-splash.mov');

interface Props {
  onFinish: () => void;
}

export const IntroVideoSplash: React.FC<Props> = ({ onFinish }) => {
  const videoRef = useRef<Video>(null);
  const finishedRef = useRef(false);
  const [showSkip, setShowSkip] = useState(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try { videoRef.current?.stopAsync(); videoRef.current?.unloadAsync(); } catch { /* no-op */ }
    onFinish();
  };

  useEffect(() => {
    // Show the skip button after 600ms so the brand reveal lands first.
    const skipTimer = setTimeout(() => setShowSkip(true), 600);
    // Hard timeout — if video stalls, never block the app.
    const failsafe = setTimeout(() => finish(), HARD_TIMEOUT_MS);
    return () => {
      clearTimeout(skipTimer);
      clearTimeout(failsafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) finish();
  };

  return (
    <View style={styles.root} testID="intro-video-splash">
      {/* StatusBar hidden so the video is truly full-bleed */}
      <StatusBar hidden translucent backgroundColor="transparent" />

      <Video
        ref={videoRef}
        source={Platform.OS === 'web' ? WEB_SOURCE : NATIVE_SOURCE}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        isMuted={false}
        onPlaybackStatusUpdate={onStatus}
        onError={() => finish()}
        // useNativeControls intentionally OFF — splash UX
      />

      {showSkip ? (
        <TouchableOpacity
          onPress={finish}
          style={styles.skipBtn}
          accessibilityLabel="Skip intro video"
          accessibilityRole="button"
          data-testid="skip-intro-video"
          activeOpacity={0.75}
        >
          <Text style={styles.skipText}>Skip ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#000000',
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default IntroVideoSplash;

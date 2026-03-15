import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = 'rapidreps_sound_effects_enabled';

interface SoundContextType {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  playTap: () => void;
  playNotification: () => void;
}

const SoundContext = createContext<SoundContextType>({
  soundEnabled: true,
  setSoundEnabled: () => {},
  playTap: () => {},
  playNotification: () => {},
});

export const useSoundEffects = () => useContext(SoundContext);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const tapSoundRef = useRef<Audio.Sound | null>(null);
  const notificationSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SOUND_ENABLED_KEY).then((val) => {
      if (val !== null) setSoundEnabledState(val === 'true');
    });
    // Preload sounds
    loadTapSound();
    loadNotificationSound();
    return () => {
      try {
        tapSoundRef.current?.unloadAsync();
        notificationSoundRef.current?.unloadAsync();
      } catch (e) { /* cleanup */ }
    };
  }, []);

  const loadTapSound = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/tap.mp3'),
        { volume: 0.4 }
      );
      tapSoundRef.current = sound;
    } catch (e) {
      // Sound file may not exist yet - fail silently
    }
  };

  const loadNotificationSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/notification.mp3'),
        { volume: 0.6 }
      );
      notificationSoundRef.current = sound;
    } catch (e) {
      // Sound file may not exist yet - fail silently
    }
  };

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }, []);

  const playTap = useCallback(() => {
    if (!soundEnabled || !tapSoundRef.current) return;
    tapSoundRef.current.setPositionAsync(0).then(() => {
      tapSoundRef.current?.playAsync();
    }).catch(() => {});
  }, [soundEnabled]);

  const playNotification = useCallback(() => {
    if (!soundEnabled || !notificationSoundRef.current) return;
    notificationSoundRef.current.setPositionAsync(0).then(() => {
      notificationSoundRef.current?.playAsync();
    }).catch(() => {});
  }, [soundEnabled]);

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, playTap, playNotification }}>
      {children}
    </SoundContext.Provider>
  );
};

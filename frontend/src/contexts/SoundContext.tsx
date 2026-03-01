import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_ENABLED_KEY = 'rapidreps_sound_effects_enabled';

interface SoundContextType {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  playTap: () => void;
}

const SoundContext = createContext<SoundContextType>({
  soundEnabled: true,
  setSoundEnabled: () => {},
  playTap: () => {},
});

export const useSoundEffects = () => useContext(SoundContext);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const tapSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SOUND_ENABLED_KEY).then((val) => {
      if (val !== null) setSoundEnabledState(val === 'true');
    });
    // Preload the tap sound
    loadTapSound();
    return () => {
      tapSoundRef.current?.unloadAsync();
    };
  }, []);

  const loadTapSound = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
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

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, playTap }}>
      {children}
    </SoundContext.Provider>
  );
};

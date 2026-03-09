import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface SessionCountdownProps {
  sessionStartedAt: string;
  durationMinutes: number;
  compact?: boolean;
}

export const SessionCountdown = ({ sessionStartedAt, durationMinutes, compact = false }: SessionCountdownProps) => {
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const totalSeconds = durationMinutes * 60;
    const startTime = new Date(sessionStartedAt).getTime();

    const tick = () => {
      const now = Date.now();
      const elapsedSecs = Math.floor((now - startTime) / 1000);
      const remainingSecs = Math.max(0, totalSeconds - elapsedSecs);
      setElapsed(elapsedSecs);
      setRemaining(remainingSecs);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionStartedAt, durationMinutes]);

  // Pulse when under 5 minutes
  useEffect(() => {
    if (remaining > 0 && remaining <= 300) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [remaining <= 300]);

  const totalSeconds = durationMinutes * 60;
  const progress = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;
  const isOvertime = remaining === 0 && elapsed > totalSeconds;
  const isWarning = remaining > 0 && remaining <= 300;
  const isComplete = remaining === 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const bgColor = isComplete ? '#FF4757' : isWarning ? '#FFA502' : '#00C853';
  const bgColorLight = isComplete ? '#FFE0E3' : isWarning ? '#FFF8E1' : '#E8F5E9';

  if (compact) {
    return (
      <Animated.View style={[cStyles.compactWrap, { transform: [{ scale: pulseAnim }] }]}>
        <View style={[cStyles.compactDot, { backgroundColor: bgColor }]} />
        <Text style={[cStyles.compactTime, { color: bgColor }]} data-testid="countdown-compact">
          {isComplete ? 'DONE' : formatTime(remaining)}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bgColorLight, borderColor: `${bgColor}40` }, { transform: [{ scale: pulseAnim }] }]}
      data-testid="session-countdown-timer"
    >
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <Ionicons name="timer" size={16} color={bgColor} />
          <Text style={[styles.label, { color: bgColor }]}>
            {isComplete ? 'Session Complete' : isWarning ? 'Almost Done' : 'Session Timer'}
          </Text>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: bgColor }]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Timer Display */}
      <View style={styles.timerRow}>
        <Text style={[styles.timerMain, { color: bgColor }]} data-testid="countdown-remaining">
          {isComplete ? '0:00' : formatTime(remaining)}
        </Text>
        <Text style={styles.timerSep}>/</Text>
        <Text style={styles.timerTotal}>{durationMinutes}:00</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={isComplete ? ['#FF4757', '#FF6B81'] : isWarning ? ['#FFA502', '#FECA57'] : ['#00C853', '#69F0AE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]}
        />
      </View>

      <Text style={styles.elapsedText}>
        {formatTime(elapsed)} elapsed
      </Text>
    </Animated.View>
  );
};

const cStyles = StyleSheet.create({
  compactWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  compactDot: { width: 6, height: 6, borderRadius: 3 },
  compactTime: { fontSize: 13, fontWeight: '800' },
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14, padding: 14, marginTop: 10,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 13, fontWeight: '700' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF' },
  liveText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 1 },

  timerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 8 },
  timerMain: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  timerSep: { fontSize: 18, color: '#999', fontWeight: '600' },
  timerTotal: { fontSize: 16, color: '#999', fontWeight: '700' },

  progressTrack: {
    height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },

  elapsedText: { fontSize: 12, color: '#999', marginTop: 6, fontWeight: '600' },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { traineeAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';

const COLORS = {
  orange: '#FF7F00',
  teal: '#1FB8B4',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  success: '#00C853',
  grayLight: '#F5F6F8',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00',
];

export default function RecurringSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const trainerName = params.trainerName as string || 'Trainer';
  const trainerId = params.trainerId as string;

  const [selectedDay, setSelectedDay] = useState(1); // Tuesday default
  const [selectedTime, setSelectedTime] = useState('07:00');
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'biweekly'>('weekly');
  const [numberOfSessions, setNumberOfSessions] = useState(4);
  const [locationType, setLocationType] = useState('outdoor');
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await traineeAPI.createRecurringSessions({
        trainerId,
        locationType,
        durationMinutes: duration,
        dayOfWeek: selectedDay,
        timeSlot: selectedTime,
        recurrenceType,
        numberOfSessions,
      });
      toast.success(res.message);
      router.back();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create recurring sessions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bg-gym-blue.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient colors={['rgba(26,42,94,0.96)', 'rgba(26,42,94,0.92)']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="recurring-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recurring Sessions</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.subtitle}>
            Set up automatic {recurrenceType} sessions with {trainerName}. Each session is paid individually.
          </Text>

          {/* Day Selection */}
          <Text style={styles.label}>Day of Week</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {DAYS.map((day, idx) => (
              <TouchableOpacity
                key={day}
                style={[styles.chip, selectedDay === idx && styles.chipActive]}
                onPress={() => setSelectedDay(idx)}
                data-testid={`day-${idx}`}
              >
                <Text style={[styles.chipText, selectedDay === idx && styles.chipTextActive]}>
                  {day.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time Selection */}
          <Text style={styles.label}>Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {TIME_SLOTS.map((time) => {
              const hour = parseInt(time.split(':')[0]);
              const label = hour >= 12 ? `${hour === 12 ? 12 : hour - 12} PM` : `${hour} AM`;
              return (
                <TouchableOpacity
                  key={time}
                  style={[styles.chip, selectedTime === time && styles.chipActive]}
                  onPress={() => setSelectedTime(time)}
                  data-testid={`time-${time}`}
                >
                  <Text style={[styles.chipText, selectedTime === time && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Recurrence Type */}
          <Text style={styles.label}>Frequency</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, recurrenceType === 'weekly' && styles.toggleBtnActive]}
              onPress={() => setRecurrenceType('weekly')}
              data-testid="freq-weekly"
            >
              <Text style={[styles.toggleText, recurrenceType === 'weekly' && styles.toggleTextActive]}>Weekly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, recurrenceType === 'biweekly' && styles.toggleBtnActive]}
              onPress={() => setRecurrenceType('biweekly')}
              data-testid="freq-biweekly"
            >
              <Text style={[styles.toggleText, recurrenceType === 'biweekly' && styles.toggleTextActive]}>Biweekly</Text>
            </TouchableOpacity>
          </View>

          {/* Number of Sessions */}
          <Text style={styles.label}>Number of Sessions</Text>
          <View style={styles.toggleRow}>
            {[4, 8, 12].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.toggleBtn, numberOfSessions === n && styles.toggleBtnActive]}
                onPress={() => setNumberOfSessions(n)}
                data-testid={`count-${n}`}
              >
                <Text style={[styles.toggleText, numberOfSessions === n && styles.toggleTextActive]}>{n} Sessions</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Session Type */}
          <Text style={styles.label}>Session Type</Text>
          <View style={styles.toggleRow}>
            {['outdoor', 'virtual', 'atHome'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.toggleBtn, locationType === type && styles.toggleBtnActive]}
                onPress={() => setLocationType(type)}
                data-testid={`type-${type}`}
              >
                <Ionicons
                  name={type === 'outdoor' ? 'sunny' : type === 'virtual' ? 'videocam' : 'home'}
                  size={16}
                  color={locationType === type ? COLORS.white : COLORS.gray}
                />
                <Text style={[styles.toggleText, locationType === type && styles.toggleTextActive]}>
                  {type === 'atHome' ? 'At Home' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Duration */}
          <Text style={styles.label}>Duration</Text>
          <View style={styles.toggleRow}>
            {[30, 60, 90].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.toggleBtn, duration === d && styles.toggleBtnActive]}
                onPress={() => setDuration(d)}
                data-testid={`dur-${d}`}
              >
                <Text style={[styles.toggleText, duration === d && styles.toggleTextActive]}>{d} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <Text style={styles.summaryText}>
              {numberOfSessions} {locationType} sessions, {DAYS[selectedDay]}s at {selectedTime.replace(':00', '')}:00, {recurrenceType}, {duration} min each
            </Text>
            <Text style={styles.summaryNote}>Each session is paid individually. Trainer must accept each request.</Text>
          </View>

          {/* Create Button */}
          <TouchableOpacity onPress={handleCreate} disabled={loading} style={styles.createBtn} data-testid="create-recurring-btn">
            <LinearGradient colors={[COLORS.orange, '#FF9F43']} style={styles.createBtnGradient}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="repeat" size={20} color={COLORS.white} />
                  <Text style={styles.createBtnText}>Create {numberOfSessions} Sessions</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  label: { color: COLORS.white, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  chipActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  chipText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  chipTextActive: { color: COLORS.white },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  toggleBtnActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  toggleText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  toggleTextActive: { color: COLORS.white },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryTitle: { color: COLORS.white, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  summaryText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20 },
  summaryNote: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  createBtn: { borderRadius: 14, overflow: 'hidden' },
  createBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  createBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
});

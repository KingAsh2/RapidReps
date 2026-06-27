import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Animated,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveSessionPriceCents } from '../../src/utils/sessionPricing';

// Brand colors
const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1a2a5e',
  tealLight: '#2a3a6e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
};

// Background image
const backgroundImage = require('../../assets/images/bg-spin-class.jpg');

// Quick schedule options
const QUICK_OPTIONS = [
  { id: 'today', label: 'Today', sublabel: 'Next available', icon: 'flash' },
  { id: 'tomorrow', label: 'Tomorrow', sublabel: 'Morning slots', icon: 'sunny' },
  { id: 'thisWeek', label: 'This Week', sublabel: 'Multiple times', icon: 'calendar' },
  { id: 'custom', label: 'Pick Date', sublabel: 'Choose specific', icon: 'calendar-outline' },
];

// Time slots
const TIME_SLOTS = [
  { id: '6am', label: '6:00 AM', period: 'Morning' },
  { id: '7am', label: '7:00 AM', period: 'Morning' },
  { id: '8am', label: '8:00 AM', period: 'Morning' },
  { id: '9am', label: '9:00 AM', period: 'Morning' },
  { id: '10am', label: '10:00 AM', period: 'Morning' },
  { id: '12pm', label: '12:00 PM', period: 'Afternoon' },
  { id: '1pm', label: '1:00 PM', period: 'Afternoon' },
  { id: '2pm', label: '2:00 PM', period: 'Afternoon' },
  { id: '3pm', label: '3:00 PM', period: 'Afternoon' },
  { id: '5pm', label: '5:00 PM', period: 'Evening' },
  { id: '6pm', label: '6:00 PM', period: 'Evening' },
  { id: '7pm', label: '7:00 PM', period: 'Evening' },
  { id: '8pm', label: '8:00 PM', period: 'Evening' },
];

// Duration options (labels only; prices computed at render time from the
// trainer's actual rates via `resolveSessionPriceCents`).
const DURATION_OPTIONS: { id: '30' | '45' | '60' | '90'; label: string; popular?: boolean }[] = [
  { id: '30', label: '30 min' },
  { id: '45', label: '45 min' },
  { id: '60', label: '1 hour', popular: true },
  { id: '90', label: '1.5 hrs' },
];

export default function ScheduleTrainingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedQuickOption, setSelectedQuickOption] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState('60');
  const [step, setStep] = useState(1);

  // iter102ag: fetch trainer's actual rates so duration tiles + summary
  // show real prices instead of the legacy hardcoded "$30+/$45+/$60+/$90+"
  // ladder.
  const [trainerProfile, setTrainerProfile] = useState<any>(null);
  const sessionType = (params.sessionType as string) || 'outdoor';
  useEffect(() => {
    if (!params.trainerId) return;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/trainer-profiles/${params.trainerId}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (res.ok) setTrainerProfile(await res.json());
      } catch { /* keep tiles as label-only if fetch fails */ }
    })();
  }, [params.trainerId]);

  const priceLabelFor = (durationId: '30' | '45' | '60' | '90') => {
    const modality: 'outdoor' | 'virtual' | 'in_home' =
      sessionType === 'virtual' ? 'virtual'
      : sessionType === 'in_home' ? 'in_home'
      : 'outdoor';
    const cents = resolveSessionPriceCents(
      trainerProfile,
      modality,
      parseInt(durationId, 10) as 30 | 45 | 60 | 90,
    );
    return cents !== null ? `$${(cents / 100).toFixed(2)}` : '—';
  };
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [step]);

  const trainerName = params.trainerName || 'Your Trainer';

  const handleQuickOption = (optionId: string) => {
    setSelectedQuickOption(optionId);
    
    if (optionId === 'today') {
      setSelectedDate(new Date());
    } else if (optionId === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedDate(tomorrow);
    } else if (optionId === 'custom') {
      setShowDatePicker(true);
    }
    
    if (optionId !== 'custom') {
      setTimeout(() => setStep(2), 300);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      setTimeout(() => setStep(2), 300);
    }
  };

  const handleTimeSelect = (timeId: string) => {
    setSelectedTime(timeId);
    setTimeout(() => setStep(3), 300);
  };

  const handleDurationSelect = (durationId: string) => {
    setSelectedDuration(durationId);
  };

  const handleConfirm = () => {
    const timeSlot = TIME_SLOTS.find(t => t.id === selectedTime);
    router.push({
      pathname: '/trainee/confirm-booking',
      params: {
        trainerName,
        date: selectedDate.toDateString(),
        time: timeSlot?.label,
        duration: selectedDuration,
        trainerId: params.trainerId,
        sessionType: params.sessionType || 'outdoor',
        priceCents: params.priceCents || '0',
      },
    });
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(10, 14, 26, 0.93)', 'rgba(17, 24, 39, 0.90)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => step > 1 ? setStep(step - 1) : router.back()} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Schedule Training</Text>
            <Text style={styles.headerSubtitle}>with {trainerName}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress Steps */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]}>
              {step > 1 ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : <Text style={styles.progressNumber}>1</Text>}
            </View>
            <Text style={[styles.progressLabel, step >= 1 && styles.progressLabelActive]}>Date</Text>
          </View>
          <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]}>
              {step > 2 ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : <Text style={styles.progressNumber}>2</Text>}
            </View>
            <Text style={[styles.progressLabel, step >= 2 && styles.progressLabelActive]}>Time</Text>
          </View>
          <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, step >= 3 && styles.progressDotActive]}>
              <Text style={styles.progressNumber}>3</Text>
            </View>
            <Text style={[styles.progressLabel, step >= 3 && styles.progressLabelActive]}>Duration</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Step 1: Date Selection */}
            {step === 1 && (
              <View>
                <Text style={styles.sectionTitle}>When would you like to train?</Text>
                
                <View style={styles.quickOptionsGrid}>
                  {QUICK_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.quickOption,
                        selectedQuickOption === option.id && styles.quickOptionSelected
                      ]}
                      onPress={() => handleQuickOption(option.id)}
                    >
                      <View style={[
                        styles.quickOptionIcon,
                        selectedQuickOption === option.id && styles.quickOptionIconSelected
                      ]}>
                        <Ionicons 
                          name={option.icon as any} 
                          size={24} 
                          color={selectedQuickOption === option.id ? COLORS.white : COLORS.orange} 
                        />
                      </View>
                      <Text style={[
                        styles.quickOptionLabel,
                        selectedQuickOption === option.id && styles.quickOptionLabelSelected
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={styles.quickOptionSublabel}>{option.sublabel}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {showDatePicker && (
                  <View style={styles.datePickerContainer}>
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      minimumDate={new Date()}
                      textColor={'#FFFFFF'}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity 
                        style={styles.dateConfirmButton}
                        onPress={() => {
                          setShowDatePicker(false);
                          setStep(2);
                        }}
                      >
                        <Text style={styles.dateConfirmText}>Confirm Date</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Step 2: Time Selection */}
            {step === 2 && (
              <View>
                <Text style={styles.sectionTitle}>Pick a time on {formatDate(selectedDate)}</Text>
                
                {['Morning', 'Afternoon', 'Evening'].map(period => (
                  <View key={period}>
                    <Text style={styles.periodLabel}>{period}</Text>
                    <View style={styles.timeSlotsContainer}>
                      {TIME_SLOTS.filter(t => t.period === period).map(slot => (
                        <TouchableOpacity
                          key={slot.id}
                          style={[
                            styles.timeSlot,
                            selectedTime === slot.id && styles.timeSlotSelected
                          ]}
                          onPress={() => handleTimeSelect(slot.id)}
                        >
                          <Text style={[
                            styles.timeSlotText,
                            selectedTime === slot.id && styles.timeSlotTextSelected
                          ]}>
                            {slot.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Step 3: Duration Selection */}
            {step === 3 && (
              <View>
                <Text style={styles.sectionTitle}>How long do you want to train?</Text>
                
                <View style={styles.durationGrid}>
                  {DURATION_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.durationOption,
                        selectedDuration === option.id && styles.durationOptionSelected,
                        option.popular && styles.durationOptionPopular
                      ]}
                      onPress={() => handleDurationSelect(option.id)}
                    >
                      {option.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>POPULAR</Text>
                        </View>
                      )}
                      <Text style={[
                        styles.durationLabel,
                        selectedDuration === option.id && styles.durationLabelSelected
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={styles.durationPrice}>{priceLabelFor(option.id)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Summary Card */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Session Summary</Text>
                  <View style={styles.summaryRow}>
                    <Ionicons name="calendar" size={18} color={COLORS.gray} />
                    <Text style={styles.summaryText}>{formatDate(selectedDate)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Ionicons name="time" size={18} color={COLORS.gray} />
                    <Text style={styles.summaryText}>
                      {TIME_SLOTS.find(t => t.id === selectedTime)?.label} ({selectedDuration} min)
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Ionicons name="person" size={18} color={COLORS.gray} />
                    <Text style={styles.summaryText}>{trainerName}</Text>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Confirm Button (Step 3 only) */}
        {step === 3 && (
          <View style={styles.bottomContainer}>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <LinearGradient
                colors={['#FF6A00', '#FF9F1C']}
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>Continue to Book</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: '#0A0E1A',
  },
  progressNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  progressLabelActive: {
    color: COLORS.white,
  },
  progressLine: {
    width: 50,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  progressLineActive: {
    backgroundColor: '#0A0E1A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 20,
    textAlign: 'center',
  },
  quickOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  quickOption: {
    width: '46%',
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quickOptionSelected: {
    backgroundColor: '#0A0E1A',
  },
  quickOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 127, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickOptionIconSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  quickOptionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  quickOptionLabelSelected: {
    color: COLORS.white,
  },
  quickOptionSublabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  datePickerContainer: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  dateConfirmButton: {
    backgroundColor: '#0A0E1A',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  dateConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 12,
    marginTop: 8,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  timeSlot: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#141929',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  timeSlotSelected: {
    backgroundColor: '#0A0E1A',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeSlotTextSelected: {
    color: COLORS.white,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 24,
  },
  durationOption: {
    width: '46%',
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  durationOptionSelected: {
    backgroundColor: '#0A0E1A',
    borderWidth: 0,
  },
  durationOptionPopular: {
    borderWidth: 2,
    borderColor: COLORS.orange,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  durationLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  durationLabelSelected: {
    color: COLORS.white,
  },
  durationPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  summaryCard: {
    backgroundColor: '#141929',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  bottomContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  confirmButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
});

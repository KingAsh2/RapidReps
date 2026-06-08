/**
 * BookingCard — iter104c refactor.
 *
 * Extracted from app/trainee/trainer-detail.tsx (which had grown to 2,367
 * lines). Owns the single-screen booking UI: session-type chips, outdoor
 * location autocomplete, duration chips, inline date + time pickers, price
 * pill + breakdown, cancellation policy, and the SEND REQUEST button.
 *
 * State stays in the parent (so the surrounding "Schedule Ahead" and
 * "Share Status" quick actions can still read selectedSessionType / prices).
 * Behaviour is unchanged from the pre-iter104c monolith — see iter104 test
 * report for the deferred-payment contract this enforces.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import PlacesAutocomplete from '../PlacesAutocomplete';
import { resolveSessionPriceCents } from '../../utils/sessionPricing';

const COLORS = {
  white: '#FFFFFF',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  gray: '#5a6785',
  grayLight: '#E8ECF0',
};

type SessionType = 'virtual' | 'outdoor' | 'in_home';

type Prices = {
  sessionRate: number;
  travelFee: number;
  serviceFee: number;
  totalCharged: number;
  ratesSet: boolean;
};

type Props = {
  trainer: any;
  accent: string;
  styles: any; // parent stylesheet — keeps visual parity without duplicating styles
  contentAnim: Animated.Value;
  contentTranslateY: Animated.AnimatedInterpolation<number>;
  onLayout: (e: any) => void;

  selectedSessionType: SessionType;
  setSelectedSessionType: (t: SessionType) => void;
  selectedDuration: number;
  setSelectedDuration: (d: number) => void;
  outdoorLocation: string;
  setOutdoorLocation: (s: string) => void;
  sessionDateTime: Date;
  setSessionDateTime: (d: Date) => void;
  showDatePicker: boolean;
  setShowDatePicker: (v: boolean) => void;
  showTimePicker: boolean;
  setShowTimePicker: (v: boolean) => void;
  priceExpanded: boolean;
  setPriceExpanded: (v: boolean) => void;
  booking: boolean;

  prices: Prices;
  traineeHomeConsented: boolean;
  onRequestInHomeConsent: () => void;
  onSendRequest: () => Promise<void> | void;
};

export const BookingCard: React.FC<Props> = ({
  trainer, accent, styles, contentAnim, contentTranslateY, onLayout,
  selectedSessionType, setSelectedSessionType,
  selectedDuration, setSelectedDuration,
  outdoorLocation, setOutdoorLocation,
  sessionDateTime, setSessionDateTime,
  showDatePicker, setShowDatePicker,
  showTimePicker, setShowTimePicker,
  priceExpanded, setPriceExpanded,
  booking, prices,
  traineeHomeConsented, onRequestInHomeConsent,
  onSendRequest,
}) => {
  const outdoorMissing = selectedSessionType === 'outdoor' && outdoorLocation.trim().length < 3;
  const disabled = booking || !trainer || !prices.ratesSet || outdoorMissing;

  // Per-modality "from $X" labels — null when the trainer has no rate set.
  const tr: any = trainer?.tierRates || {};
  const durations = (trainer?.sessionDurationsOffered || [30, 45, 60, 90]) as number[];
  const minRate = (modality: 'inPerson' | 'virtual'): number | null => {
    const vals = durations
      .map((d) => tr[`${modality}${d}Cents`])
      .filter((v: any) => typeof v === 'number' && v > 0);
    return vals.length ? Math.min(...vals) : null;
  };
  const minVirtualCents = minRate('virtual');
  const minInPersonCents = minRate('inPerson');

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.bookingCard,
        { opacity: contentAnim, transform: [{ translateY: contentTranslateY }] },
      ]}
    >
      <LinearGradient colors={['#141929', '#1A2035']} style={styles.bookingGradient}>
        <Text style={styles.bookingTitle}>Book a Session</Text>

        {/* Session Type */}
        <Text style={styles.sectionLabel}>SESSION TYPE</Text>
        <View style={styles.sessionTypeRow}>
          {trainer.offersVirtual && (
            <TouchableOpacity
              onPress={() => setSelectedSessionType('virtual')}
              style={[styles.sessionTypeChip, selectedSessionType === 'virtual' && styles.sessionTypeChipSelected]}
              data-testid="session-type-virtual"
            >
              <Ionicons name="videocam" size={18} color={selectedSessionType === 'virtual' ? COLORS.white : COLORS.orange} />
              <Text style={[styles.sessionTypeText, selectedSessionType === 'virtual' && styles.sessionTypeTextSelected]}>Virtual</Text>
              {minVirtualCents != null && (
                <Text style={[styles.sessionTypePrice, selectedSessionType === 'virtual' && styles.sessionTypePriceSelected]}>
                  from ${Math.round(minVirtualCents / 100)}
                </Text>
              )}
            </TouchableOpacity>
          )}
          {(trainer.offersInPerson || trainer.offersOutdoor) && (
            <TouchableOpacity
              onPress={() => setSelectedSessionType('outdoor')}
              style={[styles.sessionTypeChip, selectedSessionType === 'outdoor' && styles.sessionTypeChipSelected]}
              data-testid="session-type-outdoor"
            >
              <Ionicons name="sunny" size={18} color={selectedSessionType === 'outdoor' ? COLORS.white : COLORS.orange} />
              <Text style={[styles.sessionTypeText, selectedSessionType === 'outdoor' && styles.sessionTypeTextSelected]}>Outdoor</Text>
              {minInPersonCents != null && (
                <Text style={[styles.sessionTypePrice, selectedSessionType === 'outdoor' && styles.sessionTypePriceSelected]}>
                  from ${Math.round(minInPersonCents / 100)}
                </Text>
              )}
            </TouchableOpacity>
          )}
          {trainer.offersInHome && (
            <TouchableOpacity
              onPress={() => {
                if (!traineeHomeConsented) onRequestInHomeConsent();
                else setSelectedSessionType('in_home');
              }}
              style={[styles.sessionTypeChip, selectedSessionType === 'in_home' && styles.sessionTypeChipSelected]}
              data-testid="session-type-at-home"
            >
              <Ionicons name="home" size={18} color={selectedSessionType === 'in_home' ? COLORS.white : COLORS.orange} />
              <Text style={[styles.sessionTypeText, selectedSessionType === 'in_home' && styles.sessionTypeTextSelected]}>At Home</Text>
              {minInPersonCents != null && (
                <Text style={[styles.sessionTypePrice, selectedSessionType === 'in_home' && styles.sessionTypePriceSelected]}>
                  from ${Math.round(minInPersonCents / 100)}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Safety PIN Notice */}
        {selectedSessionType === 'in_home' && (
          <View style={styles.safetyNotice}>
            <Ionicons name="shield-checkmark" size={18} color={accent} />
            <Text style={styles.safetyNoticeText}>
              You&apos;ll receive a 4-digit safety PIN to verify your trainer
            </Text>
          </View>
        )}

        {/* Outdoor location */}
        {selectedSessionType === 'outdoor' && (
          <View style={styles.locationField}>
            <Text style={styles.sectionLabel}>WHERE WILL YOU MEET?</Text>
            <PlacesAutocomplete
              value={outdoorLocation}
              onChangeText={setOutdoorLocation}
              onSelect={(address) => setOutdoorLocation(address)}
              placeholder="Park, gym, address…"
              accentColor={accent}
              testID="outdoor-location-input"
            />
            <Text style={styles.locationHint}>
              Required so your trainer knows exactly where to find you. The trainer reviews & confirms before payment is taken.
            </Text>
          </View>
        )}

        {/* Duration */}
        <Text style={styles.sectionLabel}>SESSION DURATION</Text>
        <View style={styles.durationRow}>
          {(trainer.sessionDurationsOffered || [30, 45, 60, 90]).map((duration: number) => {
            const modality: 'outdoor' | 'virtual' = selectedSessionType === 'virtual' ? 'virtual' : 'outdoor';
            const cents = resolveSessionPriceCents(trainer, modality, duration as 30 | 45 | 60 | 90);
            const labelPrice = cents !== null ? (cents / 100).toFixed(2) : '—';
            return (
              <TouchableOpacity
                key={duration}
                onPress={() => setSelectedDuration(duration)}
                style={[styles.durationChip, selectedDuration === duration && styles.durationChipSelected]}
                data-testid={`duration-${duration}`}
              >
                <Text style={[styles.durationText, selectedDuration === duration && styles.durationTextSelected]}>{duration} min</Text>
                <Text style={[styles.durationPrice, selectedDuration === duration && styles.durationPriceSelected]}>${labelPrice}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date + Time */}
        <View style={styles.dateTimeRow}>
          <TouchableOpacity style={styles.dateTimeChip} onPress={() => setShowDatePicker(true)} data-testid="pick-date-btn">
            <Ionicons name="calendar" size={18} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dateTimeLabel}>DATE</Text>
              <Text style={styles.dateTimeValue}>
                {sessionDateTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateTimeChip} onPress={() => setShowTimePicker(true)} data-testid="pick-time-btn">
            <Ionicons name="time" size={18} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dateTimeLabel}>TIME</Text>
              <Text style={styles.dateTimeValue}>
                {sessionDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={sessionDateTime}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={new Date()}
            themeVariant="dark"
            onChange={(_e, selected) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selected) {
                const next = new Date(sessionDateTime);
                next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                setSessionDateTime(next);
              }
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={sessionDateTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minuteInterval={15}
            themeVariant="dark"
            onChange={(_e, selected) => {
              setShowTimePicker(Platform.OS === 'ios');
              if (selected) {
                const next = new Date(sessionDateTime);
                next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                setSessionDateTime(next);
              }
            }}
          />
        )}

        {/* Price pill */}
        <TouchableOpacity
          style={styles.pricePill}
          onPress={() => setPriceExpanded(!priceExpanded)}
          activeOpacity={0.8}
          data-testid="price-pill"
        >
          <View>
            <Text style={styles.pricePillLabel}>TOTAL</Text>
            <Text style={styles.pricePillValue}>
              {prices.ratesSet ? `$${prices.totalCharged.toFixed(2)}` : '—'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.pricePillHint}>inc. fees</Text>
            <Ionicons name={priceExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.5)" />
          </View>
        </TouchableOpacity>
        {priceExpanded && (
          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{selectedDuration} min session</Text>
              <Text style={styles.priceValue}>{prices.ratesSet ? `$${prices.sessionRate.toFixed(2)}` : '—'}</Text>
            </View>
            {prices.travelFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Travel Fee</Text>
                <Text style={styles.priceValue}>${prices.travelFee.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service Fee</Text>
              <Text style={styles.priceValue}>${prices.serviceFee.toFixed(2)}</Text>
            </View>
          </View>
        )}
        {!prices.ratesSet && (
          <Text style={styles.ratesNotSetNote}>This trainer hasn&apos;t set their rates yet.</Text>
        )}

        {/* Cancellation policy */}
        <View style={styles.cancellationPolicy}>
          <Ionicons name="information-circle" size={16} color={COLORS.gray} />
          <Text style={styles.cancellationText}>
            Free cancellation before trainer accepts •
            {selectedSessionType === 'virtual' && ' $15 fee after confirmed & paid'}
            {selectedSessionType === 'outdoor' && ' $25 fee after confirmed & paid'}
            {selectedSessionType === 'in_home' && ' $35 fee after confirmed & paid'}
          </Text>
        </View>

        {/* Send Request CTA */}
        <TouchableOpacity
          onPress={onSendRequest}
          disabled={disabled}
          style={[styles.bookButtonWrapper, disabled && { opacity: 0.55 }]}
          data-testid="book-session-btn"
        >
          <LinearGradient
            colors={disabled ? [COLORS.gray, COLORS.grayLight] : [COLORS.orangeHot, COLORS.orange]}
            style={styles.bookButton}
          >
            <View style={styles.bookButtonContent}>
              {booking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color={COLORS.white} />
                  <Text style={styles.bookButtonText}>
                    {outdoorMissing ? 'ADD MEETING LOCATION' : 'SEND REQUEST'}
                  </Text>
                </>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

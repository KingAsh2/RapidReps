import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Brand colors
const COLORS = {
  orange: '#FF7F00',
  orangeLight: '#FFA526',
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  grayLight: '#F5F6F8',
  success: '#00C853',
};

// Background image
const backgroundImage = require('../../assets/images/bg-battle-ropes.png');

export default function ConfirmBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isBooking, setIsBooking] = useState(false);

  const trainerName = String(params.trainerName || 'Your Trainer');
  const date = String(params.date || 'Today');
  const time = String(params.time || '10:00 AM');
  const duration = String(params.duration || '60');

  // Calculate price based on duration
  const getPriceForDuration = (mins: string) => {
    const minutes = parseInt(mins);
    if (minutes === 30) return 30;
    if (minutes === 45) return 45;
    if (minutes === 60) return 60;
    if (minutes === 90) return 90;
    return 60;
  };

  const sessionPrice = getPriceForDuration(duration);
  const serviceFee = Math.round(sessionPrice * 0.2);
  const totalPrice = sessionPrice + serviceFee;

  const handleConfirmBooking = async () => {
    setIsBooking(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsBooking(false);
      Alert.alert(
        'Booking Confirmed! 🎉',
        `Your training session with ${trainerName} has been booked for ${date} at ${time}.`,
        [
          {
            text: 'View Sessions',
            onPress: () => router.replace('/trainee/(tabs)/sessions'),
          },
          {
            text: 'Done',
            onPress: () => router.replace('/trainee/(tabs)/home'),
          },
        ]
      );
    }, 2000);
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(247, 147, 30, 0.9)', 'rgba(247, 147, 30, 0.85)', 'rgba(255, 165, 38, 0.8)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Booking Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="calendar-outline" size={28} color={COLORS.teal} />
              <Text style={styles.summaryTitle}>Session Details</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="person" size={20} color={COLORS.orange} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Trainer</Text>
                <Text style={styles.detailValue}>{trainerName}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar" size={20} color={COLORS.orange} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{date}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time" size={20} color={COLORS.orange} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{time}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="hourglass" size={20} color={COLORS.orange} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{duration} minutes</Text>
              </View>
            </View>
          </View>

          {/* Price Breakdown Card */}
          <View style={styles.priceCard}>
            <Text style={styles.priceTitle}>Price Breakdown</Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Session ({duration} min)</Text>
              <Text style={styles.priceValue}>${sessionPrice.toFixed(2)}</Text>
            </View>
            
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service Fee (20%)</Text>
              <Text style={styles.priceValue}>${serviceFee.toFixed(2)}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${totalPrice.toFixed(2)}</Text>
            </View>
          </View>

          {/* Cancellation Policy */}
          <View style={styles.policyCard}>
            <View style={styles.policyHeader}>
              <Ionicons name="information-circle" size={20} color={COLORS.teal} />
              <Text style={styles.policyTitle}>Cancellation Policy</Text>
            </View>
            <Text style={styles.policyText}>
              Free cancellation up to 24 hours before your session. Cancellations within 24 hours may be subject to a fee.
            </Text>
          </View>

          {/* Safety Info */}
          <View style={styles.safetyCard}>
            <View style={styles.safetyHeader}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
              <Text style={styles.safetyTitle}>Safety First</Text>
            </View>
            <Text style={styles.safetyText}>
              All trainers are background-checked and verified. Share your session status with trusted contacts for added safety.
            </Text>
          </View>
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmBooking}
            disabled={isBooking}
          >
            <LinearGradient
              colors={[COLORS.teal, '#18A09D']}
              style={styles.confirmButtonGradient}
            >
              {isBooking ? (
                <>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.confirmButtonText}>Booking...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
                  <Text style={styles.confirmButtonText}>Confirm & Pay ${totalPrice.toFixed(2)}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.secureText}>
            <Ionicons name="lock-closed" size={12} color={COLORS.gray} /> Secure payment powered by Stripe
          </Text>
        </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 14,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 127, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.navy,
  },
  priceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  priceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grayLight,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.teal,
  },
  policyCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy,
  },
  policyText: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
  },
  safetyCard: {
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  safetyText: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
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
  secureText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 12,
  },
});

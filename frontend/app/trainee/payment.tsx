import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { traineeAPI } from '../../src/services/api';

export default function PaymentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const formatCardNumber = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Add space every 4 digits
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.substring(0, 19); // Max 16 digits + 3 spaces
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const handlePayment = async () => {
    // Validate inputs
    if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
      Alert.alert('Invalid Card', 'Please enter a valid 16-digit card number');
      return;
    }

    if (!expiryDate || expiryDate.length !== 5) {
      Alert.alert('Invalid Expiry', 'Please enter expiry date in MM/YY format');
      return;
    }

    if (!cvv || cvv.length !== 3) {
      Alert.alert('Invalid CVV', 'Please enter a valid 3-digit CVV');
      return;
    }

    setProcessing(true);

    try {
      // Mock payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate random payment failure (20% chance for demo purposes)
      const shouldFail = Math.random() < 0.2;
      
      if (shouldFail) {
        throw new Error('Payment processing failed');
      }

      // Request virtual session (includes mock payment)
      const sessionResponse = await traineeAPI.requestVirtualSession(
        user?.id || '',
        30,
        'Virtual training session'
      );

      setPaymentSuccess(true);

      // Show success and navigate to session screen
      setTimeout(() => {
        router.replace({
          pathname: '/trainee/session-active',
          params: {
            sessionId: sessionResponse.sessionId,
            trainerId: sessionResponse.trainerId,
            trainerName: sessionResponse.trainerName,
            duration: sessionResponse.durationMinutes,
            zoomLink: sessionResponse.zoomMeetingLink,
          },
        });
      }, 1500);
    } catch (error: any) {
      console.error('Payment error:', error);
      setProcessing(false);
      
      // Handle payment failure
      if (error.message === 'Payment processing failed') {
        Alert.alert(
          'Payment Failed',
          'Payment could not be processed. Please check your card details and try again.',
          [
            {
              text: 'Retry',
              onPress: () => {
                // Reset states for retry
                setCardNumber('');
                setExpiryDate('');
                setCvv('');
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        // Handle no trainers available
        Alert.alert(
          'Session Unavailable',
          error.response?.data?.detail || 'No virtual trainers available at the moment. Please try again later.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    }
  };

  if (paymentSuccess) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={Colors.gradientOrangeStart}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={120} color={Colors.white} />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>Finding your trainer...</Text>
          <ActivityIndicator size="large" color={Colors.white} style={styles.loader} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={Colors.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>$18.00</Text>
          <Text style={styles.amountSubtext}>for 30 minutes virtual session</Text>
        </View>

        {/* Payment Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Payment Details</Text>

          {/* Card Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Card Number</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="card-outline" size={20} color={Colors.navy} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={Colors.textLight}
                value={cardNumber}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                keyboardType="numeric"
                maxLength={19}
              />
            </View>
          </View>

          {/* Expiry and CVV */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.inputLabel}>Expiry Date</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={20} color={Colors.navy} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="MM/YY"
                  placeholderTextColor={Colors.textLight}
                  value={expiryDate}
                  onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.inputLabel}>CVV</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.navy} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  placeholderTextColor={Colors.textLight}
                  value={cvv}
                  onChangeText={setCvv}
                  keyboardType="numeric"
                  maxLength={3}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          {/* Mock Payment Notice */}
          <View style={styles.noticeContainer}>
            <Ionicons name="information-circle" size={20} color={Colors.secondary} />
            <Text style={styles.noticeText}>
              This is a demo payment. No real charges will be made.
            </Text>
          </View>
        </View>

        {/* Pay Button */}
        <Pressable
          onPress={handlePayment}
          disabled={processing}
          style={styles.payButton}
        >
          <LinearGradient
            colors={processing ? ['#CCCCCC', '#999999'] : [Colors.secondary, Colors.primary]}
            style={styles.payButtonGradient}
          >
            {processing ? (
              <>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.payButtonText}>Processing...</Text>
              </>
            ) : (
              <>
                <Ionicons name="lock-closed" size={20} color={Colors.white} />
                <Text style={styles.payButtonText}>Pay $18.00</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* Security Badge */}
        <View style={styles.securityBadge}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.secondary} />
          <Text style={styles.securityText}>Secured by RapidReps</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    borderWidth: 3,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.navy,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  amountCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.secondary,
    lineHeight: 48,
  },
  amountSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 24,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.navy,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.navy,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  payButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    borderRadius: 20,
    gap: 8,
  },
  payButtonText: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  successIconContainer: {
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
    opacity: 0.9,
  },
  loader: {
    marginTop: 32,
  },
});

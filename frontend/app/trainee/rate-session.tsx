import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { traineeAPI } from '../../src/services/api';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';

export default function RateSessionScreen() {
  const router = useRouter();
  const { sessionId, trainerId } = useLocalSearchParams();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }

    setSubmitting(true);
    try {
      await traineeAPI.createRating({
        sessionId: sessionId as string,
        traineeId: user?.id || '',
        trainerId: trainerId as string,
        rating,
        reviewText: reviewText.trim() || undefined,
      });

      Alert.alert('Success!', 'Thank you for your feedback!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={Colors.gradientTealStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Session</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>How was your workout?</Text>
            <Text style={styles.subtitle}>Your feedback helps trainers improve</Text>

            {/* Star Rating */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={48}
                    color={star <= rating ? Colors.warning : Colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {rating > 0 && (
              <Text style={styles.ratingText}>
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent!'}
              </Text>
            )}

            {/* Review Text */}
            <View style={styles.reviewSection}>
              <Text style={styles.label}>Share your experience (optional)</Text>
              <TextInput
                style={styles.textArea}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="What did you like? What could be improved?"
                placeholderTextColor={Colors.textLight}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || rating === 0}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={submitting || rating === 0 ? ['#CCCCCC', '#999999'] : Colors.gradientOrangeStart}
                style={styles.submitButton}
              >
                <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 32,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 32,
  },
  reviewSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.navy,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
});

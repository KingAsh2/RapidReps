import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { traineeAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

export default function SessionCompleteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  const sessionId = params.sessionId as string;
  const trainerId = params.trainerId as string;
  const trainerName = params.trainerName as string;
  const durationMinutes = parseInt(params.duration as string) || 30;

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStarPress = (star: number) => {
    setRating(star);
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    setSubmitting(true);

    try {
      await traineeAPI.createRating({
        sessionId,
        traineeId: user?.id,
        trainerId,
        rating,
        reviewText: review || undefined,
      });

      Alert.alert(
        'Thank You! 🎉',
        'Your feedback helps trainers improve their service.',
        [
          {
            text: 'Done',
            onPress: () => router.replace('/trainee/home'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      Alert.alert(
        'Error',
        'Failed to submit rating. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => setSubmitting(false),
          },
        ]
      );
    }
  };

  const handleSkip = () => {
    router.replace('/trainee/home');
  };

  const handleBookAnother = () => {
    router.replace('/trainee/home');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={Colors.gradientOrangeStart}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark-circle" size={100} color={Colors.success} />
          </View>
        </View>

        {/* Session Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Session Complete! 💪</Text>
          <Text style={styles.summarySubtitle}>Great work today!</Text>

          <View style={styles.summaryDetails}>
            <View style={styles.summaryRow}>
              <Ionicons name="person-outline" size={20} color={Colors.navy} />
              <Text style={styles.summaryText}>Trainer: {trainerName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name="time-outline" size={20} color={Colors.navy} />
              <Text style={styles.summaryText}>Duration: {durationMinutes} minutes</Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name="videocam-outline" size={20} color={Colors.navy} />
              <Text style={styles.summaryText}>Type: Virtual Training</Text>
            </View>
          </View>
        </View>

        {/* Rating Section */}
        <View style={styles.ratingCard}>
          <Text style={styles.ratingTitle}>Rate Your Experience</Text>
          <Text style={styles.ratingSubtitle}>How was your session with {trainerName}?</Text>

          {/* Star Rating */}
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => handleStarPress(star)}
                style={styles.starButton}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={48}
                  color={star <= rating ? Colors.warning : Colors.textLight}
                />
              </Pressable>
            ))}
          </View>

          {/* Rating Labels */}
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {rating === 1 && '⭐ Poor'}
              {rating === 2 && '⭐⭐ Fair'}
              {rating === 3 && '⭐⭐⭐ Good'}
              {rating === 4 && '⭐⭐⭐⭐ Very Good'}
              {rating === 5 && '⭐⭐⭐⭐⭐ Excellent!'}
            </Text>
          )}

          {/* Review Input */}
          <View style={styles.reviewContainer}>
            <Text style={styles.reviewLabel}>Add a review (optional)</Text>
            <View style={styles.reviewInputContainer}>
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience..."
                placeholderTextColor={Colors.textLight}
                value={review}
                onChangeText={setReview}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmitRating}
            disabled={submitting || rating === 0}
            style={styles.submitButton}
          >
            <LinearGradient
              colors={submitting || rating === 0 ? ['#CCCCCC', '#999999'] : [Colors.secondary, Colors.primary]}
              style={styles.submitButtonGradient}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Submitting...' : 'Submit Rating'}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Skip Button */}
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </Pressable>
        </View>

        {/* Book Another Session */}
        <Pressable onPress={handleBookAnother} style={styles.bookAnotherButton}>
          <View style={styles.bookAnotherContent}>
            <Ionicons name="add-circle-outline" size={24} color={Colors.white} />
            <Text style={styles.bookAnotherText}>Book Another Session</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.white,
    borderWidth: 4,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 24,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  summarySubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryDetails: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
  },
  ratingCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.navy,
    padding: 24,
    marginBottom: 24,
  },
  ratingTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  ratingSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 24,
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
  ratingLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  reviewContainer: {
    marginBottom: 24,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
    marginBottom: 8,
  },
  reviewInputContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.navy,
    padding: 12,
  },
  reviewInput: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.navy,
    minHeight: 80,
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  submitButtonGradient: {
    paddingVertical: 16,
    borderWidth: 4,
    borderColor: Colors.navy,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    textDecorationLine: 'underline',
  },
  bookAnotherButton: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 16,
  },
  bookAnotherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bookAnotherText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy,
  },
});

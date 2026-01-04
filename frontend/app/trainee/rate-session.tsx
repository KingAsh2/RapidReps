import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { traineeAPI } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  orangeLight: '#FF9F1C',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#8892b0',
  grayLight: '#E8ECF0',
  gold: '#FFD700',
  goldDark: '#FFA500',
};

export default function RateSessionScreen() {
  const router = useRouter();
  const { sessionId, trainerId } = useLocalSearchParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const starAnims = useRef([...Array(5)].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.spring(cardAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, 200);

    // Stagger star animations
    starAnims.forEach((anim, index) => {
      setTimeout(() => {
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }).start();
      }, 400 + (index * 100));
    });
  }, []);

  const handleStarPress = (star: number) => {
    setRating(star);
    // Bounce animation on selected star
    Animated.sequence([
      Animated.timing(starAnims[star - 1], { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(starAnims[star - 1], { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      showAlert({
        title: 'Rating Required',
        message: 'Please select a star rating',
        type: 'warning',
      });
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

      router.back();
    } catch (error: any) {
      showAlert({
        title: 'Submission Failed',
        message: error.response?.data?.detail || 'Failed to submit rating',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = () => {
    switch (rating) {
      case 1: return '😕 Poor';
      case 2: return '😐 Fair';
      case 3: return '🙂 Good';
      case 4: return '😊 Very Good';
      case 5: return '🔥 Excellent!';
      default: return '';
    }
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0],
  });

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.gold, COLORS.goldDark, COLORS.orange]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>RATE SESSION ⭐</Text>
          <View style={{ width: 44 }} />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: cardAnim,
                  transform: [{ translateY: cardTranslateY }],
                },
              ]}
            >
              <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.cardGradient}>
                <Text style={styles.title}>How was your workout?</Text>
                <Text style={styles.subtitle}>Your feedback helps trainers improve</Text>

                {/* Star Rating */}
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Animated.View
                      key={star}
                      style={{
                        transform: [{ scale: starAnims[star - 1] }],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => handleStarPress(star)}
                        style={styles.starButton}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={star <= rating ? 'star' : 'star-outline'}
                          size={48}
                          color={star <= rating ? COLORS.gold : COLORS.grayLight}
                        />
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>

                {rating > 0 && (
                  <View style={styles.ratingLabelContainer}>
                    <Text style={styles.ratingLabel}>{getRatingLabel()}</Text>
                  </View>
                )}

                {/* Review Text */}
                <View style={styles.reviewSection}>
                  <Text style={styles.label}>Share your experience (optional)</Text>
                  <TextInput
                    style={styles.textArea}
                    value={reviewText}
                    onChangeText={setReviewText}
                    placeholder="What did you like? What could be improved?"
                    placeholderTextColor={COLORS.gray}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting || rating === 0}
                  activeOpacity={0.9}
                  style={styles.submitWrapper}
                >
                  <LinearGradient
                    colors={
                      submitting || rating === 0
                        ? [COLORS.gray, COLORS.grayLight]
                        : [COLORS.orangeHot, COLORS.orange]
                    }
                    style={styles.submitButton}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
                        <Text style={styles.submitButtonText}>Submit Review</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  cardGradient: {
    padding: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 32,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  starButton: {
    padding: 4,
  },
  ratingLabelContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.orange,
  },
  reviewSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 10,
  },
  textArea: {
    backgroundColor: COLORS.grayLight,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.navy,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  submitWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.white,
  },
});

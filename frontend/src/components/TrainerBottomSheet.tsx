import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../utils/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_HEIGHT = 200;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.7;

const COLORS = {
  orange: '#FF6A00',
  orangeLight: '#FF9F1C',
  teal: '#00CED1',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  gray: '#5a6785',
  grayLight: '#F0F2F5',
  success: '#00D68F',
};

interface Trainer {
  id: string;
  name: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  distance?: number;
  eta?: string;
  price?: number;
  specialty?: string;
  isAvailable?: boolean;
}

interface TrainerBottomSheetProps {
  trainers: Trainer[];
  selectedTrainerId?: string;
  onSelectTrainer: (trainer: Trainer) => void;
  onBookTrainer: (trainer: Trainer) => void;
  isVisible: boolean;
}

export const TrainerBottomSheet: React.FC<TrainerBottomSheetProps> = ({
  trainers,
  selectedTrainerId,
  onSelectTrainer,
  onBookTrainer,
  isVisible,
}) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT - COLLAPSED_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  const lastGestureDy = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        translateY.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        translateY.setValue(gestureState.dy);
        lastGestureDy.current = gestureState.dy;
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        
        // Determine whether to expand or collapse based on velocity and position
        const shouldExpand = gestureState.dy < -50 || (gestureState.vy < -0.5);
        
        Animated.spring(translateY, {
          toValue: shouldExpand ? SCREEN_HEIGHT - EXPANDED_HEIGHT : SCREEN_HEIGHT - COLLAPSED_HEIGHT,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
        
        setIsExpanded(shouldExpand);
        haptic.light();
      },
    })
  ).current;

  useEffect(() => {
    if (!isVisible) {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - COLLAPSED_HEIGHT,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const selectedTrainer = trainers.find(t => t.id === selectedTrainerId);

  const renderTrainerCard = (trainer: Trainer, isSelected: boolean) => (
    <TouchableOpacity
      key={trainer.id}
      style={[styles.trainerCard, isSelected && styles.selectedCard]}
      onPress={() => {
        haptic.light();
        onSelectTrainer(trainer);
      }}
      data-testid={`trainer-card-${trainer.id}`}
    >
      <Image
        source={{ uri: trainer.photo || 'https://via.placeholder.com/60' }}
        style={styles.trainerPhoto}
      />
      <View style={styles.trainerInfo}>
        <Text style={styles.trainerName}>{trainer.name}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color={COLORS.orange} />
          <Text style={styles.ratingText}>{trainer.rating.toFixed(1)}</Text>
          <Text style={styles.reviewCount}>({trainer.reviewCount})</Text>
        </View>
        {trainer.specialty && (
          <Text style={styles.specialty}>{trainer.specialty}</Text>
        )}
      </View>
      <View style={styles.trainerMeta}>
        {trainer.eta && (
          <View style={styles.etaBadge}>
            <Ionicons name="time" size={12} color={COLORS.white} />
            <Text style={styles.etaText}>{trainer.eta}</Text>
          </View>
        )}
        {trainer.distance !== undefined && (
          <Text style={styles.distance}>{trainer.distance.toFixed(1)} mi</Text>
        )}
        {trainer.price && (
          <Text style={styles.price}>${trainer.price}/hr</Text>
        )}
      </View>
      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }] },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Handle bar */}
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {trainers.length} Trainer{trainers.length !== 1 ? 's' : ''} Nearby
        </Text>
        <Text style={styles.headerSubtitle}>
          {isExpanded ? 'Tap a trainer to select' : 'Swipe up to see all'}
        </Text>
      </View>

      {/* Selected Trainer Preview (collapsed state) */}
      {!isExpanded && selectedTrainer && (
        <View style={styles.selectedPreview}>
          {renderTrainerCard(selectedTrainer, true)}
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => {
              haptic.success();
              onBookTrainer(selectedTrainer);
            }}
            data-testid="book-trainer-btn"
          >
            <LinearGradient
              colors={[COLORS.orange, COLORS.orangeLight]}
              style={styles.bookGradient}
            >
              <Text style={styles.bookButtonText}>Book Now</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Trainer List (expanded state) */}
      {isExpanded && (
        <ScrollView
          style={styles.trainerList}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {trainers.map(trainer => renderTrainerCard(trainer, trainer.id === selectedTrainerId))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Book Button (expanded state) */}
      {isExpanded && selectedTrainer && (
        <View style={styles.floatingBookButton}>
          <TouchableOpacity
            onPress={() => {
              haptic.success();
              onBookTrainer(selectedTrainer);
            }}
            data-testid="book-trainer-expanded-btn"
          >
            <LinearGradient
              colors={[COLORS.orange, COLORS.orangeLight]}
              style={styles.floatingBookGradient}
            >
              <Text style={styles.bookButtonText}>
                Book {selectedTrainer.name.split(' ')[0]}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: EXPANDED_HEIGHT,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.grayLight,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  selectedPreview: {
    padding: 16,
  },
  trainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: COLORS.orange,
    backgroundColor: 'rgba(255, 106, 0, 0.05)',
  },
  trainerPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.grayLight,
  },
  trainerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.navy,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navy,
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: 2,
  },
  specialty: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  trainerMeta: {
    alignItems: 'flex-end',
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.teal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  etaText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  distance: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.orange,
    marginTop: 2,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  bookButton: {
    marginTop: 8,
  },
  bookGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  trainerList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  floatingBookButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  floatingBookGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
  },
});

export default TrainerBottomSheet;

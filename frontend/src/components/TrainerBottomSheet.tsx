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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../utils/haptics';
import { TrainerAvatar } from './TrainerAvatar';
// iter106ax: Ladder-inspired typography for card meta.
import { LADDER, LADDER_FONTS } from '../theme/ladder';

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
      {/* iter106v: unified TrainerAvatar — same orange/brand ring + subtle
          pulse as the map pin and Available Now card. */}
      <View style={styles.trainerPhoto}>
        <TrainerAvatar
          uri={trainer.photo}
          initials={(trainer.name || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
          ringColor={(trainer as any).accentColor || '#FF5F1F'}
          size={60}
          pulse
        />
      </View>
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

      {/* Header — iter117: premium row with the first trainer's photo, a
          status dot, count + subtext, and a circular arrow CTA. Tapping the
          row expands the list. */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          haptic.light();
          const nextExpanded = !isExpanded;
          Animated.spring(translateY, {
            toValue: nextExpanded ? SCREEN_HEIGHT - EXPANDED_HEIGHT : SCREEN_HEIGHT - COLLAPSED_HEIGHT,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          setIsExpanded(nextExpanded);
        }}
        style={styles.header}
        data-testid="trainer-bottom-sheet-header"
      >
        {trainers.length > 0 ? (
          <View style={styles.headerAvatarWrap}>
            <TrainerAvatar
              uri={trainers[0].photo}
              initials={(trainers[0].name || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
              ringColor={(trainers[0] as any).accentColor || COLORS.orange}
              size={54}
              pulse
            />
            <View style={styles.headerStatusDot} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {trainers.length} Trainer{trainers.length !== 1 ? 's' : ''} Nearby
          </Text>
          <Text style={styles.headerSubtitle}>
            {isExpanded ? 'Tap a trainer to select' : 'Swipe up to see all'}
          </Text>
        </View>
        <View style={styles.headerArrow}>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </View>
      </TouchableOpacity>

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
    backgroundColor: '#141929',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 4,
  },
  headerAvatarWrap: {
    position: 'relative',
  },
  headerStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: '#0A0E1A',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
    fontWeight: '600',
  },
  headerArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPreview: {
    padding: 16,
  },
  trainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LADDER.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LADDER.borderSubtle,
  },
  selectedCard: {
    borderColor: LADDER.borderFocus,
    backgroundColor: '#1F1A15',
  },
  trainerPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  trainerInfo: {
    flex: 1,
    marginLeft: 14,
  },
  trainerName: {
    fontFamily: LADDER_FONTS.serifDisplay,
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: -0.3,
    color: LADDER.textPrimary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontFamily: LADDER_FONTS.sansSemibold,
    fontSize: 12,
    color: LADDER.textPrimary,
    marginLeft: 4,
  },
  reviewCount: {
    fontFamily: LADDER_FONTS.sans,
    fontSize: 12,
    color: LADDER.textTertiary,
    marginLeft: 3,
  },
  specialty: {
    fontFamily: LADDER_FONTS.sansSemibold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: LADDER.textSecondary,
    marginTop: 4,
  },
  trainerMeta: {
    alignItems: 'flex-end',
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LADDER.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  etaText: {
    fontFamily: LADDER_FONTS.sansBold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  distance: {
    fontFamily: LADDER_FONTS.sans,
    fontSize: 11,
    color: LADDER.textTertiary,
    marginTop: 6,
  },
  price: {
    fontFamily: LADDER_FONTS.sansBlack,
    fontSize: 16,
    letterSpacing: -0.3,
    color: LADDER.textPrimary,
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

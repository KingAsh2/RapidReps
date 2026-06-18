import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Animated,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { UserAvatar } from './UserAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProfilePreviewProps {
  visible: boolean;
  user: {
    id?: string;
    fullName?: string;
    avatarUrl?: string;
    role?: string;
    specialties?: string[];
    averageRating?: number;
    totalSessionsCompleted?: number;
    bio?: string;
    isAvailable?: boolean;
  } | null;
  onClose: () => void;
  onViewProfile: () => void;
}

export const ProfilePreviewCard: React.FC<ProfilePreviewProps> = ({
  visible,
  user,
  onClose,
  onViewProfile,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!user) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} data-testid="profile-preview-overlay">
        {/* iter96b: wrap card in TouchableWithoutFeedback so taps on the card
            don't bubble up to the overlay (which would dismiss before navigating). */}
        <TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
          <LinearGradient colors={['#1A2035', '#141929']} style={styles.cardGradient}>
            {/* Accent glow */}
            <View style={styles.glowOrb} />
            
            {/* Avatar — unified pulsing brand ring */}
            <View style={styles.avatarContainer}>
              <UserAvatar user={user} size={88} ring />
              {user.isAvailable && (
                <View style={styles.activeDot} />
              )}
            </View>

            {/* Info */}
            <Text style={styles.name} numberOfLines={1} data-testid="profile-preview-name">
              {user.fullName || 'User'}
            </Text>
            <Text style={styles.role}>
              {user.role === 'trainer' ? 'Personal Trainer' : 'Trainee'}
            </Text>

            {/* Stats Row */}
            {user.role === 'trainer' && (
              <View style={styles.statsRow}>
                {user.averageRating != null && user.averageRating > 0 && (
                  <View style={styles.statItem}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.statText}>{user.averageRating.toFixed(1)}</Text>
                  </View>
                )}
                {user.totalSessionsCompleted != null && user.totalSessionsCompleted > 0 && (
                  <View style={styles.statItem}>
                    <Ionicons name="fitness" size={14} color="#FF6A00" />
                    <Text style={styles.statText}>{user.totalSessionsCompleted} sessions</Text>
                  </View>
                )}
              </View>
            )}

            {/* Specialties */}
            {user.specialties && user.specialties.length > 0 && (
              <View style={styles.tagsRow}>
                {user.specialties.slice(0, 3).map((spec, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{spec}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Bio snippet */}
            {user.bio && (
              <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>
            )}

            {/* View Full Profile */}
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={onViewProfile}
              data-testid="profile-preview-view-btn"
            >
              <LinearGradient colors={['#FF6A00', '#FF9F1C']} style={styles.viewBtnGradient}>
                <Text style={styles.viewBtnText}>View Full Profile</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  card: {
    width: SCREEN_WIDTH - 60,
    maxWidth: 340,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardGradient: {
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255,106,0,0.3)',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00D68F',
    borderWidth: 3,
    borderColor: '#141929',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: 'rgba(255,106,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.2)',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6A00',
  },
  bio: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  viewBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  viewBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  viewBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

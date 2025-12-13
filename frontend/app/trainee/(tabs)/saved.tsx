import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useAlert } from '../../../src/contexts/AlertContext';
import { traineeAPI } from '../../../src/services/api';
import { traineeAPI } from '../../../src/services/api';

export default function SavedTrainersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedTrainers, setSavedTrainers] = useState<any[]>([]);

  useEffect(() => {
    loadSavedTrainers();
  }, []);

  const loadSavedTrainers = async () => {
    try {
      setLoading(true);
      // Mock data for now - in production, this would fetch from API
      const mockSavedTrainers: any[] = [];
      setSavedTrainers(mockSavedTrainers);
    } catch (error) {
      console.error('Error loading saved trainers:', error);
      showAlert({
        title: 'Loading Failed',
        message: 'Could not load your saved trainers. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSavedTrainers();
  };

  const handleRemoveFavorite = (trainerId: string) => {
    showAlert({
      title: 'Remove from Saved?',
      message: 'This trainer will be removed from your saved list.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSavedTrainers(savedTrainers.filter(t => t.id !== trainerId));
            showAlert({
              title: 'Removed',
              message: 'Trainer removed from your saved list.',
              type: 'info',
            });
          },
        },
      ],
    });
  };

  const renderTrainer = (trainer: any) => {
    return (
      <TouchableOpacity
        key={trainer.id}
        style={styles.trainerCard}
        onPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.id}`)}
        activeOpacity={0.7}
      >
        {/* Trainer Avatar */}
        {trainer.profilePhoto ? (
          <Image source={{ uri: trainer.profilePhoto }} style={styles.trainerAvatar} />
        ) : (
          <View style={styles.trainerAvatarPlaceholder}>
            <Ionicons name="person" size={40} color={Colors.textLight} />
          </View>
        )}

        {/* Trainer Info */}
        <View style={styles.trainerInfo}>
          <View style={styles.trainerHeader}>
            <Text style={styles.trainerName}>{trainer.name}</Text>
            {trainer.isVerified && (
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            )}
          </View>
          
          <View style={styles.trainerMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={14} color={Colors.warning} />
              <Text style={styles.metaText}>{trainer.rating?.toFixed(1) || 'New'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="fitness" size={14} color={Colors.secondary} />
              <Text style={styles.metaText}>{trainer.specialties?.[0] || 'General'}</Text>
            </View>
          </View>

          <Text style={styles.trainerBio} numberOfLines={2}>
            {trainer.bio || 'Professional fitness trainer'}
          </Text>
        </View>

        {/* Remove Button */}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={(e) => {
            e.stopPropagation();
            handleRemoveFavorite(trainer.id);
          }}
        >
          <Ionicons name="heart" size={24} color={Colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading saved trainers...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={Colors.gradientTealStart}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Saved Trainers</Text>
            <Text style={styles.headerSubtitle}>
              {savedTrainers.length} trainer{savedTrainers.length !== 1 ? 's' : ''} saved
            </Text>
          </View>
          <View style={styles.heartIcon}>
            <Ionicons name="heart" size={32} color={Colors.white} />
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {savedTrainers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="heart-outline" size={80} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>No Saved Trainers Yet</Text>
            <Text style={styles.emptyText}>
              Browse trainers and tap the heart icon to save your favorites for quick access!
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push('/trainee/(tabs)/home')}
            >
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.browseButtonGradient}
              >
                <Ionicons name="search" size={20} color={Colors.white} />
                <Text style={styles.browseButtonText}>Browse Trainers</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {savedTrainers.map(renderTrainer)}
            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textLight,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  heartIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  trainerCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  trainerAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: Colors.navy,
    marginRight: 12,
  },
  trainerAvatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trainerInfo: {
    flex: 1,
  },
  trainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  trainerName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.navy,
  },
  trainerMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  trainerBio: {
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 18,
  },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.white,
    borderWidth: 3,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
    marginBottom: 32,
  },
  browseButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.navy,
  },
  browseButtonGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.white,
  },
});

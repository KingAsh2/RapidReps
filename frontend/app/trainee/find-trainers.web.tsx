import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { traineeAPI } from '../../src/services/api';

const COLORS = {
  teal: '#1FB8B4',
  tealDark: '#0D8B88',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  white: '#FFFFFF',
  gray: '#8892b0',
  success: '#00D68F',
};

interface NearbyTrainer {
  id: string;
  trainerId: string;
  fullName: string;
  avatarUrl?: string;
  distanceMiles: number;
  etaMinutes: number;
  averageRating: number;
  ratePerMinuteCents: number;
  trainingStyles: string[];
}

// Web fallback - shows message to use mobile app
export default function FindTrainersWebFallback() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [trainers, setTrainers] = useState<NearbyTrainer[]>([]);

  useEffect(() => {
    loadTrainers();
  }, []);

  const loadTrainers = async () => {
    try {
      // Use LA coordinates for demo
      const response = await traineeAPI.getNearbyTrainers(34.0522, -118.2437, 25);
      setTrainers(response.trainers || []);
    } catch (error) {
      console.error('Error loading trainers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.navy, COLORS.navyLight]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.navy, COLORS.navyLight]} style={StyleSheet.absoluteFill} />
      
      <SafeAreaView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Trainers</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Map Placeholder */}
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={64} color={COLORS.orange} />
          <Text style={styles.mapPlaceholderTitle}>Map View</Text>
          <Text style={styles.mapPlaceholderText}>
            Open in Expo Go on your phone to see the interactive map with trainer locations
          </Text>
        </View>

        {/* Trainer Count */}
        <View style={styles.countBadge}>
          <Ionicons name="people" size={18} color={COLORS.white} />
          <Text style={styles.countText}>{trainers.length} trainers available</Text>
        </View>

        {/* Trainer List */}
        <ScrollView style={styles.trainerList} showsVerticalScrollIndicator={false}>
          {trainers.map((trainer) => (
            <TouchableOpacity
              key={trainer.id}
              style={styles.trainerCard}
              onPress={() => router.push(`/trainee/trainer-detail?trainerId=${trainer.trainerId}`)}
            >
              <View style={styles.trainerAvatar}>
                {trainer.avatarUrl ? (
                  <Image source={{ uri: trainer.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{trainer.fullName.charAt(0)}</Text>
                  </LinearGradient>
                )}
              </View>
              <View style={styles.trainerInfo}>
                <Text style={styles.trainerName}>{trainer.fullName}</Text>
                <View style={styles.trainerMeta}>
                  <Ionicons name="star" size={14} color={COLORS.orange} />
                  <Text style={styles.metaText}>{trainer.averageRating.toFixed(1)}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{trainer.distanceMiles.toFixed(1)} mi</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{trainer.etaMinutes} min</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  content: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  mapPlaceholder: {
    alignItems: 'center',
    padding: 32,
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  mapPlaceholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: 12,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  trainerList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  trainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  trainerAvatar: {
    marginRight: 14,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  trainerInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  trainerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 4,
  },
  metaDot: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginHorizontal: 6,
  },
});

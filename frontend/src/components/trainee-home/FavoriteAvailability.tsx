import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// iter106as: unified avatar disc.
import { UserAvatar } from '../UserAvatar';

interface Props {
  trainers: any[];
  onTrainerPress: (trainerId: string) => void;
}

export const FavoriteAvailability = React.memo(({ trainers, onTrainerPress }: Props) => (
  <View style={styles.container} data-testid="fav-availability-section">
    <Text style={styles.label}>Your Trainers</Text>
    {trainers.slice(0, 3).map((t: any) => (
      <TouchableOpacity
        key={t.trainerId}
        style={styles.card}
        onPress={() => onTrainerPress(t.trainerId)}
        data-testid={`fav-trainer-${t.trainerId}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          {/* iter106as: unified avatar disc */}
          <UserAvatar
            size={44}
            style={styles.photo as any}
            user={{
              avatarUrl: t.trainerPhoto,
              fullName: t.trainerName,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{t.trainerName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {t.isLiveNow ? (
                <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE NOW</Text></View>
              ) : t.isAvailable ? (
                <Text style={{ fontSize: 13, color: '#00C853', fontWeight: '700' }}>Available</Text>
              ) : (
                <Text style={{ fontSize: 13, color: '#5a6785', fontWeight: '600' }}>Offline</Text>
              )}
              {t.averageRating > 0 && (
                <Text style={{ fontSize: 13, color: '#5a6785' }}>
                  <Ionicons name="star" size={10} color="#FFB800" /> {t.averageRating.toFixed(1)}
                </Text>
              )}
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#5a6785" />
      </TouchableOpacity>
    ))}
  </View>
));

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#141929', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  photo: { width: 42, height: 42, borderRadius: 21 },
  name: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  liveBadge: { backgroundColor: '#FF4757', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  liveBadgeText: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
});

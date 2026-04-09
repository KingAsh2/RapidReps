import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  recentTrainers: any[];
  onTrainerPress: (trainerId: string) => void;
}

export const QuickBookSection = ({ recentTrainers, onTrainerPress }: Props) => (
  <View style={styles.container} data-testid="quick-book-section">
    <Text style={styles.label}>Quick Book</Text>
    <Text style={styles.hint}>Tap a trainer to book again</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 16 }}>
      {recentTrainers.map((t: any) => (
        <TouchableOpacity
          key={t.trainerId}
          style={styles.card}
          onPress={() => onTrainerPress(t.trainerId)}
          data-testid={`quick-book-${t.trainerId}`}
          accessibilityLabel={`Book ${t.trainerName}, ${t.sessionCount} previous sessions`}
          accessibilityRole="button"
        >
          {t.trainerPhoto ? (
            <Image source={{ uri: t.trainerPhoto }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, { backgroundColor: '#1a2a5e', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          )}
          {t.isAvailable && <View style={styles.liveDot} />}
          <Text style={styles.name} numberOfLines={1}>{t.trainerName?.split(' ')[0]}</Text>
          <Text style={styles.meta}>{t.sessionCount} sessions</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  hint: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 14 },
  card: { alignItems: 'center', width: 84, gap: 6 },
  photo: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#FF7F00' },
  name: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  meta: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  liveDot: {
    position: 'absolute', top: 0, right: 8,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#00C853', borderWidth: 2.5, borderColor: '#fff',
  },
});

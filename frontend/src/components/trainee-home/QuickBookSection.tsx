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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
      {recentTrainers.map((t: any) => (
        <TouchableOpacity
          key={t.trainerId}
          style={styles.card}
          onPress={() => onTrainerPress(t.trainerId)}
          data-testid={`quick-book-${t.trainerId}`}
        >
          {t.trainerPhoto ? (
            <Image source={{ uri: t.trainerPhoto }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, { backgroundColor: '#FF7F00', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={22} color="#fff" />
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
  label: { fontSize: 16, fontWeight: '800', color: '#1a2a5e', marginBottom: 12 },
  card: { alignItems: 'center', width: 80, gap: 6 },
  photo: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#FF7F00' },
  name: { fontSize: 12, fontWeight: '700', color: '#1a2a5e', textAlign: 'center' },
  meta: { fontSize: 10, color: '#8892b0' },
  liveDot: {
    position: 'absolute', top: 0, right: 8,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#00C853', borderWidth: 2.5, borderColor: '#fff',
  },
});

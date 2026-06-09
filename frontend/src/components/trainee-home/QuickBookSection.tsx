import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { TrainerAvatar } from '../TrainerAvatar';

interface Props {
  recentTrainers: any[];
  onTrainerPress: (trainerId: string) => void;
}

// iter106n: use shared TrainerAvatar so Quick Book, NearbyTrainers map,
// Available Now strip, and EnRouteMap all render an identical circular
// avatar with a brand-color ring + subtle pulse.
const initialsOf = (name: string) => (name || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export const QuickBookSection = React.memo(({ recentTrainers, onTrainerPress }: Props) => (
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
          <View style={styles.avatarWrap}>
            <TrainerAvatar
              uri={t.trainerPhoto}
              initials={initialsOf(t.trainerName)}
              ringColor={t.accentColor || '#FF5F1F'}
              size={60}
              pulse={!!t.isAvailable}
            />
            {t.isAvailable && <View style={styles.liveDot} />}
          </View>
          <Text style={styles.name} numberOfLines={1}>{t.trainerName?.split(' ')[0]}</Text>
          <Text style={styles.meta}>{t.sessionCount} sessions</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
));
QuickBookSection.displayName = 'QuickBookSection';

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  hint: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 14 },
  card: { alignItems: 'center', width: 84, gap: 6 },
  avatarWrap: { position: 'relative' },
  name: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  meta: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  liveDot: {
    position: 'absolute', top: 6, right: 6,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#00C853', borderWidth: 2.5, borderColor: '#0A0E14',
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Web fallback - map is not available on web
export default function NearbyTrainersMap() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="map-outline" size={48} color="#F7931E" />
        <Text style={styles.title}>Map View</Text>
        <Text style={styles.subtitle}>Available on mobile app only</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: '#1a2a5e',
    overflow: 'hidden',
  },
  content: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const COLORS = {
  orange: '#FF7F00',
  teal: '#1FB8B4',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#8892b0',
  success: '#00C853',
};

const backgroundImage = require('../../../assets/images/bg-spin-class.png');

export default function TrainerSessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/sessions/trainer`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient
        colors={['rgba(247, 147, 30, 0.92)', 'rgba(255, 127, 0, 0.88)']}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Sessions</Text>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadSessions} />
          }
        >
          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyTitle}>No Sessions Yet</Text>
              <Text style={styles.emptyText}>Your upcoming and past sessions will appear here.</Text>
            </View>
          ) : (
            sessions.map((session: any, index: number) => (
              <View key={index} style={styles.sessionCard}>
                <Text style={styles.sessionType}>{session.sessionType}</Text>
                <Text style={styles.sessionDate}>{session.scheduledDate}</Text>
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
  },
  content: { flex: 1, paddingHorizontal: 16 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  sessionCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sessionType: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy,
  },
  sessionDate: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
});

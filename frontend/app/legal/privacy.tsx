import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PRIVACY_SECTIONS, LEGAL_EFFECTIVE_DATE, type LegalSection } from '../../src/legal/content';

const COLORS = { white: '#FFFFFF' };

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0E1A', '#0D1117', '#141929']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="privacy-back-button">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PRIVACY POLICY</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data-testid="privacy-scroll"
        >
          <View style={styles.card}>
            <LinearGradient colors={['#141929', '#1A2035']} style={styles.cardGradient}>
              <Text style={styles.updated}>Last updated: {LEGAL_EFFECTIVE_DATE}</Text>
              {PRIVACY_SECTIONS.map((s: LegalSection) => (
                <Section key={s.title} title={s.title} body={s.body} />
              ))}
            </LinearGradient>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  cardGradient: { padding: 24 },
  updated: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 20 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  body: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.72)', lineHeight: 22 },
});

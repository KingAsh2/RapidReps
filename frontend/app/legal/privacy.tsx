import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Brand colors
const COLORS = {
  teal: '#1FB8B4',
  tealLight: '#22C1C3',
  orange: '#F7931E',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: '#8892b0',
};

export default function PrivacyScreen() {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.navy, '#2a3a6e', COLORS.teal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PRIVACY POLICY</Text>
          <View style={{ width: 44 }} />
        </View>
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <LinearGradient colors={[COLORS.white, COLORS.offWhite]} style={styles.cardGradient}>
              <Text style={styles.updated}>Last updated: {new Date().toLocaleDateString()}</Text>

              <Section title="1. Data we collect">
                Account info (name, email, phone), profile content (photos, bio), location (for matching nearby users), session and payment info, device info, and usage logs.
              </Section>

              <Section title="2. How we use data">
                To connect trainees with trainers, process payments, display reviews, improve the app, and send transactional or promotional communications.
              </Section>

              <Section title="3. How we share data">
                Trainers and trainees see limited profile info to book sessions. Our payment provider processes payments. We may disclose data if required by law.
              </Section>

              <Section title="4. Your choices">
                You can update or delete your account in the app. Contact support to request data export or deletion.
              </Section>

              <Section title="5. Security">
                We use standard security measures but no platform is 100% secure.
              </Section>

              <Section title="6. Children">
                RapidReps is not intended for users under 18. We do not knowingly collect data from minors.
              </Section>

              <Section title="7. Contact">
                For questions: privacy@rapidreps.app
              </Section>
            </LinearGradient>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  cardGradient: {
    padding: 24,
  },
  updated: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
    lineHeight: 22,
  },
});

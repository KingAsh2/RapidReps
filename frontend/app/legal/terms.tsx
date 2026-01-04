import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/utils/colors';

export default function TermsScreen() {
  return (
    <LinearGradient colors={[Colors.background, Colors.surface]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updated}>Last updated: {new Date().toLocaleDateString()}</Text>

        <Section title="1. What RapidReps is">
          RapidReps is a marketplace that connects trainees with independent trainers for in‑person and virtual fitness services.
          RapidReps is not a fitness provider and does not guarantee outcomes.
        </Section>

        <Section title="2. Accounts">
          You must provide accurate information and keep your account secure.
          We may suspend accounts that violate these terms or applicable laws.
        </Section>

        <Section title="3. Payments and fees">
          Trainees pay for services through the app. Trainers receive payouts through our payment provider.
          RapidReps may charge a platform/service fee and other disclosed fees (e.g., booking or convenience fees).
          Fees are shown before you confirm payment.
        </Section>

        <Section title="4. Cancellations and refunds">
          Cancellation rules are shown in the app and may vary by trainer and session type.
          Refund eligibility depends on session status and payment provider policies.
        </Section>

        <Section title="5. User content and conduct">
          Users may upload photos/videos and message other users. You are responsible for your content.
          Prohibited content includes harassment, hate, sexual content involving minors, threats, and illegal activity.
        </Section>

        <Section title="6. Reporting and blocking">
          RapidReps provides in‑app tools to report or block users. We may review reports and take action including removal.
        </Section>

        <Section title="7. Contact">
          For support: support@rapidreps.app (replace with your real support email/URL before publishing).
        </Section>
      </ScrollView>
    </LinearGradient>
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
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  updated: { color: Colors.textSecondary, marginBottom: 18 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  body: { color: Colors.textSecondary, lineHeight: 20 },
});

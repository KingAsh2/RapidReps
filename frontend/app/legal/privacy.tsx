import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/utils/colors';

export default function PrivacyScreen() {
  return (
    <LinearGradient colors={[Colors.background, Colors.surface]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: {new Date().toLocaleDateString()}</Text>

        <Section title="1. Data we collect">
          Account details (name, email, phone), profile content (photos/videos), messages you send, and approximate location (if you enable it).
          Payment details are handled by our payment provider; we do not store full card numbers.
        </Section>

        <Section title="2. How we use data">
          To create and manage accounts, match users, enable messaging, process bookings/payments, prevent fraud, and improve the app.
        </Section>

        <Section title="3. Location">
          If you allow location access, we use it to show nearby trainers/trainees and improve matching. You can disable location in device settings.
        </Section>

        <Section title="4. Sharing">
          We share necessary information with service providers (e.g., payments, hosting) to operate RapidReps.
          We may share information when required by law or to protect users and the platform.
        </Section>

        <Section title="5. Your choices">
          You can update your profile, control permissions, block/report users, and request account deletion in the app.
        </Section>

        <Section title="6. Contact">
          Privacy questions: privacy@rapidreps.app (replace with your real email/URL before publishing).
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

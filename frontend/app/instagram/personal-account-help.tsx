/**
 * Personal-account help screen — shown when a user tries to link a Personal
 * Instagram account. Instructs them to convert to Creator (free) and deep-links
 * to the IG settings page.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';

const STEPS = [
  {
    n: 1,
    title: 'Open Instagram',
    body: 'Tap the button below to jump straight to your IG account settings.',
  },
  {
    n: 2,
    title: 'Switch to a Creator account',
    body: 'In Settings → Account type and tools → "Switch to professional account" → choose Creator. It is free and takes ~30 seconds.',
  },
  {
    n: 3,
    title: 'Come back and link',
    body: 'Return to RapidReps and tap "Link Instagram" again. We will detect the new account type automatically.',
  },
];

const openInstagramSettings = () => {
  // IG's "switch account" deep link
  const url = Platform.OS === 'ios'
    ? 'instagram://app'
    : 'https://www.instagram.com/accounts/professional/?role=creator';
  Linking.openURL(url).catch(() => {
    Linking.openURL('https://help.instagram.com/502981923235522');
  });
};

export default function InstagramPersonalAccountHelp() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Almost there</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <LinearGradient
          colors={['#833ab4', '#fd1d1d', '#fcb045']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroIcon}
        >
          <Ionicons name="logo-instagram" size={40} color="#FFFFFF" />
        </LinearGradient>

        <Text style={styles.title}>Convert to a Creator account</Text>
        <Text style={styles.subtitle}>
          Instagram only lets apps display posts from <Text style={styles.bold}>Business</Text> or{' '}
          <Text style={styles.bold}>Creator</Text> accounts. Personal accounts can&#39;t be linked.
          Good news: switching is free and reversible.
        </Text>

        {STEPS.map((s) => (
          <View key={s.n} style={styles.stepCard}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{s.n}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={openInstagramSettings}
          style={styles.openBtnWrap}
          data-testid="open-instagram-settings-btn"
        >
          <LinearGradient
            colors={['#833ab4', '#fd1d1d', '#fcb045']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.openBtn}
          >
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.openText}>Open Instagram Settings</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://help.instagram.com/502981923235522')}
          style={styles.helpLink}
        >
          <Text style={styles.helpText}>Read Instagram&#39;s official guide →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0E1A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  body: { padding: 24, alignItems: 'center' },
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  bold: { color: '#FF7F00', fontWeight: '800' },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#141929',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,127,0,0.15)',
    borderWidth: 1.5,
    borderColor: '#FF7F00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: { color: '#FF7F00', fontSize: 14, fontWeight: '800' },
  stepTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  stepBody: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 19 },
  openBtnWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  openText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  helpLink: { marginTop: 16, paddingVertical: 8 },
  helpText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
});

/**
 * Trainer Payout Connect screen (iter95) — Stripe Connect placeholder.
 *
 * Zelle was fully removed. For now this is a status screen explaining that
 * payouts are reconciled manually by the admin team via Stripe. Stripe Connect
 * onboarding will replace this with a Stripe-hosted onboarding link in a future
 * iteration.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import RapidBg from '../../src/components/RapidBg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const C = {
  bg: '#06080F',
  bgCard: '#0E121C',
  border: 'rgba(255,255,255,0.08)',
  orange: '#FF7A00',
  orangeGlow: '#FF9B2F',
  text: '#FFFFFF',
  textMuted: '#7C8295',
  textSec: '#C6CBD9',
};

export default function ConnectBankScreen() {
  const router = useRouter();
  return (
    <RapidBg variant="trainer-connect-bank" style={{ flex: 1 }}>
    <SafeAreaView style={s.container}>
      <LinearGradient colors={['rgba(10,14,26,0.85)', 'rgba(20,25,41,0.82)']} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="connect-bank-back">
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payouts</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.heroIconWrap}>
          <Ionicons name="card" size={56} color={C.orange} />
        </View>
        <Text style={s.h1}>Stripe Payouts</Text>
        <Text style={s.sub}>
          Your earnings are tracked in real time. RapidReps reconciles payouts
          manually via Stripe based on completed sessions and your tier split.
        </Text>

        <View style={s.infoCard}>
          <Text style={s.infoLabel}>HOW IT WORKS</Text>
          <View style={s.row}>
            <View style={s.bullet}><Text style={s.bulletNum}>1</Text></View>
            <Text style={s.bulletText}>
              You earn your tier % (75/80/85) of every completed session.
            </Text>
          </View>
          <View style={s.row}>
            <View style={s.bullet}><Text style={s.bulletNum}>2</Text></View>
            <Text style={s.bulletText}>
              The Earnings tab shows your real-time balance owed.
            </Text>
          </View>
          <View style={s.row}>
            <View style={s.bullet}><Text style={s.bulletNum}>3</Text></View>
            <Text style={s.bulletText}>
              Admin processes weekly Stripe payouts to your registered account.
            </Text>
          </View>
        </View>

        <View style={s.comingSoon}>
          <Ionicons name="rocket-outline" size={20} color={C.orangeGlow} />
          <Text style={s.comingSoonText}>
            Stripe Connect (self-serve payout setup) is coming soon.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
    </RapidBg>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  scroll: { padding: 22, paddingBottom: 60, alignItems: 'center' },
  heroIconWrap: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,122,0,0.10)', borderColor: 'rgba(255,122,0,0.4)', borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginTop: 14, marginBottom: 18, shadowColor: C.orange, shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  h1: { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 10 },
  sub: { color: C.textSec, fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  infoCard: { backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 20, marginTop: 28, alignSelf: 'stretch' },
  infoLabel: { color: C.orangeGlow, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  bullet: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,122,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,122,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  bulletNum: { color: C.orange, fontWeight: '900', fontSize: 13 },
  bulletText: { color: C.textSec, fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
  comingSoon: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,155,47,0.10)', borderRadius: 12, padding: 14, gap: 10, marginTop: 22, alignSelf: 'stretch' },
  comingSoonText: { color: C.text, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
});

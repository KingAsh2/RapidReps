/**
 * Trainer Payout Settings (iter106ae)
 *
 * Stripe charges the trainee → funds land in the platform (admin) Stripe
 * balance. The admin then sends each trainer their share **off-platform**
 * via the trainer's preferred method (Zelle / PayPal / Venmo / CashApp).
 *
 * This screen lets the trainer:
 *   1. Pick which method admin should use.
 *   2. Enter the matching handle (email / phone / @username / $cashtag).
 *
 * Saves to `POST /api/trainer/payout-info`. Once saved the trainer shows up
 * in the admin's "Pending Payouts" tab and can receive funds.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import RapidBg from '../../src/components/RapidBg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const C = {
  bg: '#06080F',
  bgCard: '#0E121C',
  border: 'rgba(255,255,255,0.08)',
  orange: '#FF7A00',
  orangeGlow: '#FF9B2F',
  text: '#FFFFFF',
  textMuted: '#7C8295',
  textSec: '#C6CBD9',
  success: '#00C853',
};

type Method = 'zelle' | 'paypal' | 'venmo' | 'cashapp';

const METHODS: { id: Method; label: string; icon: any; brand: string; placeholder: string; hint: string }[] = [
  { id: 'zelle',   label: 'Zelle',    icon: 'flash',          brand: '#6D1ED4', placeholder: 'email or phone',      hint: 'The email or US phone tied to your Zelle.' },
  { id: 'paypal',  label: 'PayPal',   icon: 'logo-paypal',    brand: '#003087', placeholder: 'paypal.me/yourname or email', hint: 'Your PayPal email or paypal.me link.' },
  { id: 'venmo',   label: 'Venmo',    icon: 'cash-outline',   brand: '#3D95CE', placeholder: '@your-venmo',         hint: 'Your @Venmo username (including the @).' },
  { id: 'cashapp', label: 'Cash App', icon: 'logo-usd',       brand: '#00D632', placeholder: '$yourcashtag',        hint: 'Your $Cashtag (including the $).' },
];

export default function PayoutSettingsScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('zelle');
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const res = await axios.get(`${API_URL}/api/trainer/payout-info`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.payoutMethod) setMethod(res.data.payoutMethod);
        if (res.data?.payoutHandle) setHandle(res.data.payoutHandle);
        setIsSetup(!!res.data?.isSetup);
      } catch (_) {
        // First-time setup → leave defaults.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    const cleanHandle = handle.trim();
    if (!cleanHandle) {
      toast.error('Please enter your payout handle.');
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.post(
        `${API_URL}/api/trainer/payout-info`,
        { payoutMethod: method, payoutHandle: cleanHandle },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      haptic.success();
      setIsSetup(true);
      toast.success(`Saved — admin will send funds via ${METHODS.find(m => m.id === method)?.label}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save payout info.');
    } finally {
      setSaving(false);
    }
  };

  const activeMethod = METHODS.find(m => m.id === method)!;

  return (
    <RapidBg variant="trainer-connect-bank" style={{ flex: 1 }}>
      <SafeAreaView style={s.container}>
        <LinearGradient colors={['rgba(10,14,26,0.85)', 'rgba(20,25,41,0.82)']} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="payout-settings-back">
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Payout Setup</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.heroIconWrap}>
            <Ionicons name="wallet" size={48} color={C.orange} />
          </View>
          <Text style={s.h1}>Where should we send your earnings?</Text>
          <Text style={s.sub}>
            Trainees pay via Stripe → funds land with RapidReps → we send your 80% take-home directly to the account below.
          </Text>

          {isSetup && (
            <View style={s.successBanner} data-testid="payout-setup-banner">
              <Ionicons name="checkmark-circle" size={18} color={C.success} />
              <Text style={s.successText}>Payouts are enabled. Update anytime.</Text>
            </View>
          )}

          <Text style={s.sectionLabel}>METHOD</Text>
          <View style={s.methodGrid}>
            {METHODS.map(m => {
              const active = m.id === method;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[s.methodCard, active && { borderColor: m.brand, backgroundColor: `${m.brand}1A` }]}
                  onPress={() => { haptic.light(); setMethod(m.id); }}
                  data-testid={`payout-method-${m.id}`}
                >
                  <View style={[s.methodIcon, { backgroundColor: m.brand }]}>
                    <Ionicons name={m.icon} size={20} color="#FFF" />
                  </View>
                  <Text style={s.methodLabel}>{m.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={16} color={m.brand} style={{ marginTop: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.sectionLabel}>{activeMethod.label.toUpperCase()} HANDLE</Text>
          <View style={s.inputWrap}>
            <Ionicons name={activeMethod.icon} size={18} color={activeMethod.brand} />
            <TextInput
              style={s.input}
              placeholder={activeMethod.placeholder}
              placeholderTextColor={C.textMuted}
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={activeMethod.id === 'zelle' ? 'email-address' : 'default'}
              data-testid="payout-handle-input"
            />
          </View>
          <Text style={s.hint}>{activeMethod.hint}</Text>

          <TouchableOpacity
            onPress={onSave}
            disabled={saving || loading}
            style={[s.saveBtn, (saving || loading) && { opacity: 0.6 }]}
            data-testid="payout-save-btn"
          >
            <LinearGradient colors={['#FF6A00', '#FF9F1C']} style={s.saveBtnGradient}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="save" size={18} color="#FFF" />
                  <Text style={s.saveBtnText}>Save Payout Method</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.infoCard}>
            <Text style={s.infoLabel}>HOW IT WORKS</Text>
            <View style={s.row}>
              <View style={s.bullet}><Text style={s.bulletNum}>1</Text></View>
              <Text style={s.bulletText}>Client pays via Stripe (card / Apple Pay / Google Pay).</Text>
            </View>
            <View style={s.row}>
              <View style={s.bullet}><Text style={s.bulletNum}>2</Text></View>
              <Text style={s.bulletText}>Funds land in the RapidReps Stripe account.</Text>
            </View>
            <View style={s.row}>
              <View style={s.bullet}><Text style={s.bulletNum}>3</Text></View>
              <Text style={s.bulletText}>Admin sends your 80% (or tier-specific %) to the handle above.</Text>
            </View>
            <View style={s.row}>
              <View style={s.bullet}><Text style={s.bulletNum}>4</Text></View>
              <Text style={s.bulletText}>Minimum payout: <Text style={{ fontWeight: '800', color: C.text }}>$35</Text>. You&apos;re notified once it goes out.</Text>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </RapidBg>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 60 },
  heroIconWrap: {
    alignSelf: 'center', width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,122,0,0.12)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,122,0,0.3)',
  },
  h1: { color: C.text, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  sub: { color: C.textSec, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,200,83,0.12)', borderColor: 'rgba(0,200,83,0.35)',
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  successText: { color: C.success, fontWeight: '700', fontSize: 13 },
  sectionLabel: { color: C.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 12, marginBottom: 10 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  methodCard: {
    width: '48%',
    borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(20,25,41,0.6)',
    borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center',
  },
  methodIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  methodLabel: { color: C.text, fontSize: 14, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(20,25,41,0.6)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  input: { flex: 1, color: C.text, fontSize: 15, fontWeight: '600' },
  hint: { color: C.textMuted, fontSize: 12, marginTop: 6 },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 18 },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  saveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  infoCard: {
    marginTop: 28, padding: 18,
    backgroundColor: 'rgba(20,25,41,0.65)', borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
  },
  infoLabel: { color: C.orange, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  bullet: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,122,0,0.18)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,122,0,0.4)',
  },
  bulletNum: { color: C.orange, fontWeight: '900', fontSize: 12 },
  bulletText: { color: C.textSec, fontSize: 13, flex: 1, lineHeight: 19 },
});

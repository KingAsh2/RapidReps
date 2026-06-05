/**
 * Trainer "Set Rates" screen (iter93) — tier-aware version.
 *
 * Replaces the legacy single-rate input flow. Trainers can now only set
 * rates AFTER an admin has assigned them a tier during verification.
 *
 * - Reads tier + caps from GET /api/trainer/tier-rates
 * - Live preview of take-home, customer total per rate
 * - Client + server validation against tier caps
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RapidBg from '../../src/components/RapidBg';
import { api } from '../../src/services/api';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import {
  TrainerTier, Modality, Duration, calculatePricing, formatCents, TIER_MATRIX, validateRateCents,
} from '../../src/utils/pricing';

interface RateState {
  inPerson30: string; inPerson45: string; inPerson60: string; inPerson90: string;
  virtual30: string; virtual45: string; virtual60: string; virtual90: string;
}

const EMPTY_RATES: RateState = {
  inPerson30: '', inPerson45: '', inPerson60: '', inPerson90: '',
  virtual30: '', virtual45: '', virtual60: '', virtual90: '',
};

export default function SetRatesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tier, setTier] = useState<TrainerTier | null>(null);
  const [rates, setRates] = useState<RateState>(EMPTY_RATES);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/trainer/tier-rates');
      setTier(data.tier);
      const tr = data.tierRates || {};
      setRates({
        inPerson30: tr.inPerson30Cents ? String(tr.inPerson30Cents / 100) : '',
        inPerson45: tr.inPerson45Cents ? String(tr.inPerson45Cents / 100) : '',
        inPerson60: tr.inPerson60Cents ? String(tr.inPerson60Cents / 100) : '',
        inPerson90: tr.inPerson90Cents ? String(tr.inPerson90Cents / 100) : '',
        virtual30: tr.virtual30Cents ? String(tr.virtual30Cents / 100) : '',
        virtual45: tr.virtual45Cents ? String(tr.virtual45Cents / 100) : '',
        virtual60: tr.virtual60Cents ? String(tr.virtual60Cents / 100) : '',
        virtual90: tr.virtual90Cents ? String(tr.virtual90Cents / 100) : '',
      });
    } catch (e: any) {
      toast.error('Failed to load rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRate = (key: keyof RateState, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if ((cleaned.match(/\./g) || []).length > 1) return;
    setRates(prev => ({ ...prev, [key]: cleaned }));
  };

  const handleSave = async () => {
    if (!tier) return;
    const dollarsToCents = (s: string) => Math.round(parseFloat(s || '0') * 100);
    const payload: Record<string, number> = {};
    const errors: string[] = [];
    const fieldMap: Array<[keyof RateState, string, Modality, Duration]> = [
      ['inPerson30', 'inPerson30Cents', 'in_person', 30],
      ['inPerson45', 'inPerson45Cents', 'in_person', 45 as Duration],
      ['inPerson60', 'inPerson60Cents', 'in_person', 60],
      ['inPerson90', 'inPerson90Cents', 'in_person', 90],
      ['virtual30', 'virtual30Cents', 'virtual', 30],
      ['virtual45', 'virtual45Cents', 'virtual', 45 as Duration],
      ['virtual60', 'virtual60Cents', 'virtual', 60],
      ['virtual90', 'virtual90Cents', 'virtual', 90],
    ];
    for (const [k, apiKey, modality, duration] of fieldMap) {
      const v = rates[k];
      if (!v || v === '') continue;
      const cents = dollarsToCents(v);
      const { ok, error } = validateRateCents(tier, modality, duration, cents);
      if (!ok) errors.push(`${apiKey}: ${error}`);
      else payload[apiKey] = cents;
    }
    if (errors.length) { toast.error(errors[0]); return; }
    if (!Object.keys(payload).length) { toast.error('Enter at least one rate.'); return; }

    haptic.medium();
    setSaving(true);
    try {
      await api.post('/trainer/tier-rates', payload);
      haptic.success();
      toast.success('Rates saved!');
    } catch (e: any) {
      haptic.error();
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={s.loader}><ActivityIndicator size="large" color="#FF7A00" /></SafeAreaView>;
  }

  if (!tier) {
    return (
      <SafeAreaView style={s.container}>
        <LinearGradient colors={['#0A0E1A', '#141929']} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="set-rates-back">
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Set Your Rates</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={s.notReadyWrap}>
          <Ionicons name="time-outline" size={56} color="#FF7A00" />
          <Text style={s.notReadyTitle}>Awaiting Tier Assignment</Text>
          <Text style={s.notReadySub}>
            An admin will assign your tier (New / Certified / Specialty) during verification.
            Once approved, you'll be able to set your rates here within tier caps.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const tierCfg = TIER_MATRIX[tier];

  const renderRateRow = (
    key: keyof RateState,
    modality: Modality,
    duration: Duration,
    label: string,
  ) => {
    const cap = tierCfg[modality].rate_caps_cents[duration];
    const v = parseFloat(rates[key] || '0');
    const cents = Math.round(v * 100);
    const overCap = cents > cap;
    const breakdown = !overCap && cents > 0 ? calculatePricing(tier, modality, duration, cents) : null;
    return (
      <View key={key} style={[s.rateRow, overCap && s.rateRowError]}>
        <View style={{ flex: 1 }}>
          <Text style={s.rateLabel}>{label}</Text>
          <Text style={s.capHint}>Cap: {formatCents(cap)}</Text>
        </View>
        <View style={s.inputWrap}>
          <Text style={s.dollarSign}>$</Text>
          <TextInput
            style={s.input}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#666"
            value={rates[key]}
            onChangeText={(t) => updateRate(key, t)}
            data-testid={`rate-input-${key}`}
          />
        </View>
        {breakdown ? (
          <View style={s.previewBox}>
            {/* iter96b (#22): trainer only sees their take-home; customer total is hidden */}
            <Text style={s.previewLine}>You: {formatCents(breakdown.trainer_take_home_cents)}</Text>
          </View>
        ) : overCap ? (
          <Text style={s.errorBadge}>over cap</Text>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={s.container}>
        <LinearGradient colors={['#0A0E1A', '#141929']} style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="set-rates-back">
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Set Your Rates</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.tierBadge}>
            <Text style={s.tierBadgeLabel}>YOUR TIER</Text>
            <Text style={s.tierBadgeName}>{tierCfg.label}</Text>
            <Text style={s.tierBadgeSplit}>
              {tierCfg.trainer_percent}% take-home · {tierCfg.commission_percent}% commission
            </Text>
          </View>

          <Text style={s.sectionHeader}>In-Person Sessions</Text>
          {renderRateRow('inPerson30', 'in_person', 30, '30 minutes')}
          {renderRateRow('inPerson45', 'in_person', 45 as Duration, '45 minutes')}
          {renderRateRow('inPerson60', 'in_person', 60, '60 minutes')}
          {renderRateRow('inPerson90', 'in_person', 90, '90 minutes')}

          <Text style={s.sectionHeader}>Virtual Sessions</Text>
          {renderRateRow('virtual30', 'virtual', 30, '30 minutes')}
          {renderRateRow('virtual45', 'virtual', 45 as Duration, '45 minutes')}
          {renderRateRow('virtual60', 'virtual', 60, '60 minutes')}
          {renderRateRow('virtual90', 'virtual', 90, '90 minutes')}

          <Text style={s.disclaimer}>
            {/* iter96b (#22 + #23): hide customer-facing fee math from trainer.
                Customer is charged a flat $2.99 service fee on top of your rate. */}
            Leave a field blank to skip that session length. Your take-home shown above.
          </Text>

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} data-testid="set-rates-save">
            <LinearGradient colors={['#FF6A00', '#FF9B2F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveBtnGrad}>
              {saving ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Ionicons name="save" size={20} color="#FFF" />
                  <Text style={s.saveBtnText}>Save Rates</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  loader: { flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  scroll: { padding: 18, paddingBottom: 60 },
  tierBadge: { backgroundColor: 'rgba(255,122,0,0.12)', borderColor: 'rgba(255,122,0,0.4)', borderWidth: 1.4, borderRadius: 18, padding: 16, marginBottom: 20 },
  tierBadgeLabel: { color: '#FF7A00', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  tierBadgeName: { color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 4 },
  tierBadgeSplit: { color: '#AAA', fontSize: 13, fontWeight: '600', marginTop: 6 },
  sectionHeader: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  rateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  rateRowError: { borderColor: '#FF4444' },
  rateLabel: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  capHint: { color: '#888', fontSize: 12, marginTop: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2030', borderRadius: 10, paddingHorizontal: 10, width: 92, height: 42 },
  dollarSign: { color: '#AAA', fontSize: 16, fontWeight: '700' },
  input: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '800', marginLeft: 4 },
  previewBox: { width: 100 },
  previewLine: { color: '#FF9B2F', fontSize: 12, fontWeight: '900' },
  previewLineMuted: { color: '#888', fontSize: 11, marginTop: 2 },
  errorBadge: { color: '#FF4444', fontSize: 11, fontWeight: '700', width: 100, textAlign: 'right' },
  disclaimer: { color: '#888', fontSize: 12, marginTop: 14, lineHeight: 18 },
  saveBtn: { marginTop: 22, borderRadius: 28, overflow: 'hidden' },
  saveBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  notReadyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  notReadyTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  notReadySub: { color: '#AAA', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 22, marginTop: 10 },
});

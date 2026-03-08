import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Switch, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { trainerAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';

const COLORS = {
  teal: '#1a2a5e',
  tealDark: '#0D8B88',
  orange: '#F7931E',
  orangeHot: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F0F2F5',
  success: '#2ECC71',
};

export default function SetRatesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offersInPerson, setOffersInPerson] = useState(true);
  const [offersVirtual, setOffersVirtual] = useState(false);
  const [offersInHome, setOffersInHome] = useState(false);
  const [outdoorRate, setOutdoorRate] = useState('40');
  const [virtualRate, setVirtualRate] = useState('30');
  const [inHomeRate, setInHomeRate] = useState('60');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCurrentRates();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const loadCurrentRates = async () => {
    try {
      const profile = await trainerAPI.getMyProfile();
      if (profile) {
        setOffersInPerson(profile.offersInPerson ?? true);
        setOffersVirtual(profile.offersVirtual ?? false);
        setOffersInHome(profile.offersInHome ?? false);
        setOutdoorRate(String((profile.outdoorRateCents || 4000) / 100));
        setVirtualRate(String((profile.virtualRateCents || 3000) / 100));
        setInHomeRate(String((profile.inHomeRateCents || 6000) / 100));
      }
    } catch (e) {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await trainerAPI.setRates({
        offersInPerson,
        offersVirtual,
        offersInHome,
        outdoorRateCents: Math.round(parseFloat(outdoorRate) * 100),
        virtualRateCents: Math.round(parseFloat(virtualRate) * 100),
        inHomeRateCents: Math.round(parseFloat(inHomeRate) * 100),
      });
      showAlert({ title: 'Success', message: 'Your rates have been updated!', type: 'success' });
      router.back();
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.response?.data?.detail || 'Failed to save rates', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const calcEarnings = (rate: string) => {
    const hourly = parseFloat(rate) || 0;
    return (hourly * 0.80).toFixed(2);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['rgba(247, 147, 30, 0.88)', 'rgba(247, 147, 30, 0.80)', 'rgba(255, 165, 38, 0.75)']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="rates-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SET YOUR RATES</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.subtitle}>Set your hourly rates per session type. You earn 80% of each session.</Text>

            {/* Outdoor / In-Person */}
            <View style={styles.rateCard}>
              <View style={styles.rateHeader}>
                <View style={styles.rateIconRow}>
                  <Ionicons name="fitness" size={24} color={COLORS.orange} />
                  <Text style={styles.rateLabel}>Outdoor / In-Person</Text>
                </View>
                <Switch
                  value={offersInPerson}
                  onValueChange={setOffersInPerson}
                  trackColor={{ false: '#555', true: COLORS.teal }}
                  thumbColor={COLORS.white}
                />
              </View>
              {offersInPerson && (
                <View style={styles.rateInputRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={outdoorRate}
                    onChangeText={setOutdoorRate}
                    keyboardType="numeric"
                    data-testid="outdoor-rate-input"
                  />
                  <Text style={styles.perHour}>/hr</Text>
                  <View style={styles.earningsTag}>
                    <Text style={styles.earningsText}>You earn ${calcEarnings(outdoorRate)}/hr</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Virtual */}
            <View style={styles.rateCard}>
              <View style={styles.rateHeader}>
                <View style={styles.rateIconRow}>
                  <Ionicons name="videocam" size={24} color={COLORS.teal} />
                  <Text style={styles.rateLabel}>Virtual</Text>
                </View>
                <Switch
                  value={offersVirtual}
                  onValueChange={setOffersVirtual}
                  trackColor={{ false: '#555', true: COLORS.teal }}
                  thumbColor={COLORS.white}
                />
              </View>
              {offersVirtual && (
                <View style={styles.rateInputRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={virtualRate}
                    onChangeText={setVirtualRate}
                    keyboardType="numeric"
                    data-testid="virtual-rate-input"
                  />
                  <Text style={styles.perHour}>/hr</Text>
                  <View style={styles.earningsTag}>
                    <Text style={styles.earningsText}>You earn ${calcEarnings(virtualRate)}/hr</Text>
                  </View>
                </View>
              )}
            </View>

            {/* At Home */}
            <View style={styles.rateCard}>
              <View style={styles.rateHeader}>
                <View style={styles.rateIconRow}>
                  <Ionicons name="home" size={24} color={COLORS.orangeHot} />
                  <Text style={styles.rateLabel}>At Home</Text>
                </View>
                <Switch
                  value={offersInHome}
                  onValueChange={setOffersInHome}
                  trackColor={{ false: '#555', true: COLORS.teal }}
                  thumbColor={COLORS.white}
                />
              </View>
              {offersInHome && (
                <View style={styles.rateInputRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={inHomeRate}
                    onChangeText={setInHomeRate}
                    keyboardType="numeric"
                    data-testid="inhome-rate-input"
                  />
                  <Text style={styles.perHour}>/hr</Text>
                  <View style={styles.earningsTag}>
                    <Text style={styles.earningsText}>You earn ${calcEarnings(inHomeRate)}/hr</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Pricing Info */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={COLORS.teal} />
              <Text style={styles.infoText}>
                You receive 80% of the session rate. RapidReps retains 20% + a $2 service fee per session.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
              data-testid="save-rates-btn"
            >
              <LinearGradient colors={[COLORS.teal, COLORS.tealDark]} style={styles.saveGradient}>
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.saveText}>Save Rates</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 24, lineHeight: 20 },
  rateCard: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16,
    padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  rateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rateIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rateLabel: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  rateInputRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 6,
  },
  dollarSign: { fontSize: 24, fontWeight: '800', color: COLORS.orange },
  rateInput: {
    fontSize: 28, fontWeight: '800', color: COLORS.white,
    borderBottomWidth: 2, borderBottomColor: COLORS.teal,
    paddingVertical: 4, paddingHorizontal: 4, minWidth: 70, textAlign: 'center',
  },
  perHour: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginLeft: 2 },
  earningsTag: {
    backgroundColor: 'rgba(46,204,113,0.2)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto',
  },
  earningsText: { fontSize: 13, fontWeight: '700', color: COLORS.success },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(31,184,180,0.1)', borderRadius: 12,
    padding: 14, marginTop: 8, marginBottom: 24,
  },
  infoText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1, lineHeight: 18 },
  saveButton: { marginBottom: 40 },
  saveGradient: {
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  saveText: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
});

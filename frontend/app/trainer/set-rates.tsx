import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Switch, Animated, ActivityIndicator, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { trainerAPI } from '../../src/services/api';
import { useAlert } from '../../src/contexts/AlertContext';
import { goBack } from '../../src/utils/navigation';

const backgroundImage = require('../../assets/images/bg-plank-ropes.png');

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
  // Per-duration pricing
  const [outdoor30, setOutdoor30] = useState('25');
  const [outdoor60, setOutdoor60] = useState('45');
  const [outdoor90, setOutdoor90] = useState('60');
  const [virtual30, setVirtual30] = useState('20');
  const [virtual60, setVirtual60] = useState('35');
  const [virtual90, setVirtual90] = useState('50');
  const [inHome30, setInHome30] = useState('35');
  const [inHome60, setInHome60] = useState('60');
  const [inHome90, setInHome90] = useState('85');
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
        // Load per-duration rates if available, otherwise calculate from hourly
        const hourlyOutdoor = (profile.outdoorRateCents || 4000) / 100;
        const hourlyVirtual = (profile.virtualRateCents || 3000) / 100;
        const hourlyInHome = (profile.inHomeRateCents || 6000) / 100;
        setOutdoor30(String((profile.outdoor30Cents || hourlyOutdoor * 50) / 100));
        setOutdoor60(String((profile.outdoor60Cents || hourlyOutdoor * 100) / 100));
        setOutdoor90(String((profile.outdoor90Cents || hourlyOutdoor * 140) / 100));
        setVirtual30(String((profile.virtual30Cents || hourlyVirtual * 50) / 100));
        setVirtual60(String((profile.virtual60Cents || hourlyVirtual * 100) / 100));
        setVirtual90(String((profile.virtual90Cents || hourlyVirtual * 140) / 100));
        setInHome30(String((profile.inHome30Cents || hourlyInHome * 50) / 100));
        setInHome60(String((profile.inHome60Cents || hourlyInHome * 100) / 100));
        setInHome90(String((profile.inHome90Cents || hourlyInHome * 140) / 100));
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
        // Legacy hourly rates (use 60min rate for backward compatibility)
        outdoorRateCents: Math.round(parseFloat(outdoor60) * 100),
        virtualRateCents: Math.round(parseFloat(virtual60) * 100),
        inHomeRateCents: Math.round(parseFloat(inHome60) * 100),
        // Per-duration rates
        outdoor30Cents: Math.round(parseFloat(outdoor30) * 100),
        outdoor60Cents: Math.round(parseFloat(outdoor60) * 100),
        outdoor90Cents: Math.round(parseFloat(outdoor90) * 100),
        virtual30Cents: Math.round(parseFloat(virtual30) * 100),
        virtual60Cents: Math.round(parseFloat(virtual60) * 100),
        virtual90Cents: Math.round(parseFloat(virtual90) * 100),
        inHome30Cents: Math.round(parseFloat(inHome30) * 100),
        inHome60Cents: Math.round(parseFloat(inHome60) * 100),
        inHome90Cents: Math.round(parseFloat(inHome90) * 100),
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
    const amount = parseFloat(rate) || 0;
    return (amount * 0.80).toFixed(0);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={'#FF6A00'} />
      </View>
    );
  }

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(10, 14, 26, 0.92)', 'rgba(17, 24, 39, 0.88)']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBack('/trainer/(tabs)/home')} style={styles.backBtn} data-testid="rates-back-btn">
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
                  trackColor={{ false: '#555', true: '#FF6A00' }}
                  thumbColor={COLORS.white}
                />
              </View>
              {offersInPerson && (
                <View style={styles.durationBreakdown}>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>30 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={outdoor30} onChangeText={setOutdoor30} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(outdoor30)}</Text>
                  </View>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>60 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={outdoor60} onChangeText={setOutdoor60} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(outdoor60)}</Text>
                  </View>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>90 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={outdoor90} onChangeText={setOutdoor90} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(outdoor90)}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Virtual */}
            <View style={styles.rateCard}>
              <View style={styles.rateHeader}>
                <View style={styles.rateIconRow}>
                  <Ionicons name="videocam" size={24} color={'#FF6A00'} />
                  <Text style={styles.rateLabel}>Virtual</Text>
                </View>
                <Switch
                  value={offersVirtual}
                  onValueChange={setOffersVirtual}
                  trackColor={{ false: '#555', true: '#FF6A00' }}
                  thumbColor={COLORS.white}
                />
              </View>
              {offersVirtual && (
                <View style={styles.durationBreakdown}>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>30 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={virtual30} onChangeText={setVirtual30} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(virtual30)}</Text>
                  </View>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>60 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={virtual60} onChangeText={setVirtual60} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(virtual60)}</Text>
                  </View>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>90 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={virtual90} onChangeText={setVirtual90} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(virtual90)}</Text>
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
                  trackColor={{ false: '#555', true: '#FF6A00' }}
                  thumbColor={COLORS.white}
                />
              </View>
              {offersInHome && (
                <View style={styles.durationBreakdown}>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>30 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={inHome30} onChangeText={setInHome30} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(inHome30)}</Text>
                  </View>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>60 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={inHome60} onChangeText={setInHome60} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(inHome60)}</Text>
                  </View>
                  <View style={styles.durationItemEditable}>
                    <Text style={styles.durationLabel}>90 min</Text>
                    <View style={styles.durationInputRow}>
                      <Text style={styles.durationDollar}>$</Text>
                      <TextInput style={styles.durationInput} value={inHome90} onChangeText={setInHome90} keyboardType="numeric" />
                    </View>
                    <Text style={styles.earningsSmall}>earn ${calcEarnings(inHome90)}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Pricing Info */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={'#FF6A00'} />
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
              <LinearGradient colors={['#FF6A00', '#FF6A00'Dark]} style={styles.saveGradient}>
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
    </ImageBackground>
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
  dollarSign: { fontSize: 24, fontWeight: '800', color: '#FF6A00' },
  rateInput: {
    fontSize: 28, fontWeight: '800', color: COLORS.white,
    borderBottomWidth: 2, borderBottomColor: '#FF6A00',
    paddingVertical: 4, paddingHorizontal: 4, minWidth: 70, textAlign: 'center',
  },
  perHour: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginLeft: 2 },
  earningsTag: {
    backgroundColor: 'rgba(46,204,113,0.2)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto',
  },
  earningsText: { fontSize: 13, fontWeight: '700', color: COLORS.success },
  durationBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  durationItem: {
    alignItems: 'center',
    flex: 1,
  },
  durationLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
    fontWeight: '600',
  },
  durationPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  durationItemEditable: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  durationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationDollar: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6A00',
  },
  durationInput: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    minWidth: 50,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 2,
  },
  earningsSmall: {
    fontSize: 12,
    color: '#00E676',
    fontWeight: '700',
    marginTop: 4,
  },
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

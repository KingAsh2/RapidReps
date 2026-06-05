import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ImageBackground,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import RapidBg from '../../src/components/RapidBg';

const COLORS = {
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  orange: '#F7931E',
  white: '#FFFFFF',
  gray: '#5a6785',
  success: '#00C853',
  error: '#FF4757',
};

const backgroundImage = require('../../assets/images/bg-gym-blue.png');

const SAFETY_TIPS = [
  { icon: 'location', title: 'Share Your Location', desc: 'Always let someone know where your training session is taking place.' },
  { icon: 'people', title: 'Train in Public', desc: 'For first sessions, choose well-lit public areas like parks or gyms.' },
  { icon: 'call', title: 'Emergency Contacts', desc: 'Keep your emergency contacts updated and easily accessible.' },
  { icon: 'shield-checkmark', title: 'Verified Trainers', desc: 'Only book sessions with verified trainers who have passed our background checks.' },
  { icon: 'videocam', title: 'Virtual Option', desc: 'If unsure, try a virtual session first before meeting in person.' },
  { icon: 'flag', title: 'Report Concerns', desc: 'Report any suspicious behavior or safety concerns immediately.' },
];

export default function SafetyCenterScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(26,42,94,0.96)', 'rgba(26,42,94,0.92)']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="safety-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Safety Center</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Hero Banner */}
          <RapidBg variant="trainee-safety-center" style={styles.heroBanner}>
            <Ionicons name="shield-checkmark" size={48} color={COLORS.orange} />
            <Text style={styles.heroTitle}>Your Safety Matters</Text>
            <Text style={styles.heroSub}>RapidReps is committed to providing a safe training environment for everyone.</Text>
          </RapidBg>

          {/* Emergency Actions */}
          <Text style={styles.sectionTitle}>Emergency Actions</Text>
          <View style={styles.emergencyRow}>
            <TouchableOpacity
              style={[styles.emergencyBtn, { backgroundColor: COLORS.error }]}
              onPress={() => Linking.openURL('tel:911')}
              data-testid="call-911-btn"
            >
              <Ionicons name="call" size={22} color={COLORS.white} />
              <Text style={styles.emergencyBtnText}>Call 911</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emergencyBtn, { backgroundColor: COLORS.orange }]}
              onPress={() => router.push('/trainee/report-issue')}
              data-testid="report-issue-btn"
            >
              <Ionicons name="flag" size={22} color={COLORS.white} />
              <Text style={styles.emergencyBtnText}>Report Issue</Text>
            </TouchableOpacity>
          </View>

          {/* Safety Tips */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.sectionTitle}>Safety Tips</Text>
          {SAFETY_TIPS.map((tip, idx) => (
            <View key={idx} style={styles.tipCard} data-testid={`safety-tip-${idx}`}>
              <View style={styles.tipIcon}>
                <Ionicons name={tip.icon as any} size={22} color={'#FFFFFF'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDesc}>{tip.desc}</Text>
              </View>
            </View>
          ))}

          {/* Share Session Feature */}
          <View style={styles.shareCard}>
            <Ionicons name="share-social" size={28} color={COLORS.orange} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.shareTitle}>Share Your Session</Text>
              <Text style={styles.shareSub}>Share your session details with a friend or family member so they know where you are.</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroBanner: { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 24, gap: 10 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.92)', textAlign: 'center', lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white, marginBottom: 14, marginTop: 8 },
  emergencyRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  emergencyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14 },
  emergencyBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  tipCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(10,14,26,0.78)', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  tipIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,106,0,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,106,0,0.35)' },
  tipTitle: { fontSize: 15, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  tipDesc: { fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 18 },
  shareCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(247,147,30,0.22)', borderRadius: 14, padding: 18,
    marginTop: 16, borderWidth: 1, borderColor: 'rgba(247,147,30,0.5)',
  },
  shareTitle: { fontSize: 15, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  shareSub: { fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 18 },
});

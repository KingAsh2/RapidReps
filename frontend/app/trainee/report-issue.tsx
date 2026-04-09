import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ImageBackground,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { toast } from '../../src/utils/toast';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COLORS = {
  navy: '#1a2a5e',
  navyLight: '#2a3a6e',
  orange: '#F7931E',
  white: '#FFFFFF',
  gray: '#5a6785',
  error: '#FF4757',
};

const backgroundImage = require('../../assets/images/bg-gym-blue.png');

const ISSUE_TYPES = [
  { id: 'safety', label: 'Safety Concern', icon: 'shield' },
  { id: 'behavior', label: 'Inappropriate Behavior', icon: 'warning' },
  { id: 'payment', label: 'Payment Issue', icon: 'card' },
  { id: 'quality', label: 'Session Quality', icon: 'star-half' },
  { id: 'technical', label: 'Technical Problem', icon: 'bug' },
  { id: 'other', label: 'Other', icon: 'chatbox-ellipses' },
];

export default function ReportIssueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionId = params.sessionId as string;
  const trainerName = params.trainerName as string;

  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSubmit = async () => {
    if (!issueType) { toast.error('Please select an issue type'); return; }
    if (!description.trim()) { toast.error('Please describe the issue'); return; }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await axios.post(`${API_URL}/api/safety/report`, {
        reportedUserId: sessionId || 'general',
        reason: issueType,
        context: description.trim(),
        contentType: 'session',
        contentId: sessionId || null,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Report submitted. We will review it shortly.');
      router.back();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(26,42,94,0.96)', 'rgba(26,42,94,0.92)']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="report-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report an Issue</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {trainerName && (
            <Text style={styles.context}>Regarding session with {trainerName}</Text>
          )}

          <Text style={styles.label}>What type of issue?</Text>
          <View style={styles.typesGrid}>
            {ISSUE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeCard, issueType === type.id && styles.typeCardActive]}
                onPress={() => setIssueType(type.id)}
                data-testid={`issue-type-${type.id}`}
              >
                <Ionicons name={type.icon as any} size={22} color={issueType === type.id ? COLORS.white : COLORS.gray} />
                <Text style={[styles.typeLabel, issueType === type.id && styles.typeLabelActive]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Describe the issue</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Please provide as much detail as possible..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            data-testid="report-description-input"
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={styles.submitBtn}
            data-testid="submit-report-btn"
          >
            <LinearGradient colors={[COLORS.orange, '#FF9F43']} style={styles.submitBtnGradient}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="send" size={20} color={COLORS.white} />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            All reports are reviewed within 24 hours. For emergencies, please call 911 immediately.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  context: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginBottom: 12, marginTop: 8 },
  typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeCard: {
    width: '47%' as any,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  typeCardActive: { backgroundColor: COLORS.navy, borderColor: COLORS.orange },
  typeLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', flex: 1 },
  typeLabelActive: { color: COLORS.white },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 16,
    fontSize: 14, color: COLORS.white, minHeight: 140, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  submitBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  submitBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  disclaimer: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 18 },
});

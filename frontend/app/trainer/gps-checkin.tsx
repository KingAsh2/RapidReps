import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAlert } from '../../src/contexts/AlertContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const api = axios.create({ baseURL: `${API_URL}/api` });

const COLORS = {
  orange: '#FF6A00', success: '#00C853', error: '#FF4757',
  warning: '#FFA502', navy: '#0A0E1A', navyLight: '#141929',
  white: '#FFFFFF', gray: '#5a6785',
};

interface Props {
  sessionId: string;
  isTrainer: boolean;
  onCheckinComplete?: () => void;
}

export default function GpsCheckinCard({ sessionId, isTrainer, onCheckinComplete }: Props) {
  const { token } = useAuth();
  const toast = useAlert();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [checkinResult, setCheckinResult] = useState<any>(null);

  const getHeaders = async () => {
    const t = token || await AsyncStorage.getItem('auth_token');
    return { Authorization: `Bearer ${t}` };
  };

  const fetchStatus = async () => {
    try {
      const headers = await getHeaders();
      const res = await api.get(`/sessions/${sessionId}/checkin-status`, { headers });
      setStatus(res.data);
    } catch (e) { console.error('Failed to fetch checkin status', e); }
  };

  useEffect(() => { fetchStatus(); }, [sessionId]);

  const handleCheckin = async () => {
    setLoading(true);
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        toast.error('Location permission required for check-in');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      // iter106av G9: reject a check-in when device GPS is too noisy.
      // A ±500m accuracy circle can false-positive an out-of-range check-in.
      const acc = location.coords.accuracy ?? undefined;
      if (typeof acc === 'number' && acc > 100) {
        toast.error(`GPS signal too weak (±${Math.round(acc)}m). Move outside or near a window and retry.`);
        setLoading(false);
        return;
      }

      const headers = await getHeaders();
      const res = await api.post(`/sessions/${sessionId}/gps-checkin`, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: acc,
      }, { headers });

      setCheckinResult(res.data);
      fetchStatus();

      if (res.data.withinRadius) {
        toast.success('Check-in successful! You are at the location.');
      } else {
        toast.error(`You are ${res.data.distanceMiles} miles away (limit: ${res.data.radiusLimitMiles} mi)`);
      }

      if (res.data.bothPartiesConfirmed) {
        onCheckinComplete?.();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Check-in failed');
    } finally { setLoading(false); }
  };

  const handleNoShowAction = async (action: string) => {
    try {
      const headers = await getHeaders();
      await api.post(`/sessions/${sessionId}/no-show-action`, { action }, { headers });
      toast.success(action === 'cancel' ? 'Session cancelled (no-show)' : action === 'proceed' ? 'Session started' : 'Waiting...');
      fetchStatus();
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Action failed'); }
  };

  const myConfirmed = isTrainer ? status?.trainerConfirmed : status?.traineeConfirmed;
  const otherConfirmed = isTrainer ? status?.traineeConfirmed : status?.trainerConfirmed;

  return (
    <View style={st.card} data-testid="gps-checkin-card">
      <View style={st.header}>
        <Ionicons name="location" size={20} color={COLORS.orange} />
        <Text style={st.title}>GPS Check-in</Text>
      </View>

      {/* Status indicators */}
      <View style={st.statusRow}>
        <View style={st.statusItem}>
          <Ionicons name={myConfirmed ? 'checkmark-circle' : 'ellipse-outline'} size={18}
            color={myConfirmed ? COLORS.success : COLORS.gray} />
          <Text style={st.statusText}>You: {myConfirmed ? 'Confirmed' : 'Not checked in'}</Text>
        </View>
        <View style={st.statusItem}>
          <Ionicons name={otherConfirmed ? 'checkmark-circle' : 'ellipse-outline'} size={18}
            color={otherConfirmed ? COLORS.success : COLORS.gray} />
          <Text style={st.statusText}>{isTrainer ? 'Trainee' : 'Trainer'}: {otherConfirmed ? 'Confirmed' : 'Waiting'}</Text>
        </View>
      </View>

      {/* Check-in button */}
      {!myConfirmed && (
        <TouchableOpacity onPress={handleCheckin} style={st.checkinBtn} disabled={loading} data-testid="gps-checkin-btn">
          {loading ? <ActivityIndicator color={COLORS.white} /> : (
            <>
              <Ionicons name="navigate" size={18} color={COLORS.white} />
              <Text style={st.checkinText}>Check In Now</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Check-in result */}
      {checkinResult && (
        <View style={[st.resultBox, { borderColor: checkinResult.withinRadius ? COLORS.success : COLORS.error }]}>
          <Ionicons name={checkinResult.withinRadius ? 'checkmark-circle' : 'alert-circle'}
            size={16} color={checkinResult.withinRadius ? COLORS.success : COLORS.error} />
          <Text style={[st.resultText, { color: checkinResult.withinRadius ? COLORS.success : COLORS.error }]}>
            {checkinResult.withinRadius
              ? `Confirmed (${checkinResult.distanceMiles} mi from location)`
              : `Too far: ${checkinResult.distanceMiles} mi (limit: ${checkinResult.radiusLimitMiles} mi)`}
          </Text>
        </View>
      )}

      {/* Both confirmed */}
      {status?.bothConfirmed && (
        <View style={[st.resultBox, { borderColor: COLORS.success, backgroundColor: 'rgba(0,200,83,0.08)' }]}>
          <Ionicons name="checkmark-done-circle" size={18} color={COLORS.success} />
          <Text style={[st.resultText, { color: COLORS.success }]}>Both parties confirmed — ready to start!</Text>
        </View>
      )}

      {/* Trainer no-show controls */}
      {isTrainer && !otherConfirmed && myConfirmed && (
        <View style={st.noShowSection}>
          <Text style={st.noShowLabel}>Trainee hasn't checked in. What would you like to do?</Text>
          <View style={st.noShowActions}>
            <TouchableOpacity onPress={() => handleNoShowAction('wait')} style={[st.noShowBtn, { backgroundColor: COLORS.warning }]} data-testid="noshow-wait-btn">
              <Text style={st.noShowBtnText}>Wait</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleNoShowAction('proceed')} style={[st.noShowBtn, { backgroundColor: COLORS.success }]} data-testid="noshow-proceed-btn">
              <Text style={st.noShowBtnText}>Proceed</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleNoShowAction('cancel')} style={[st.noShowBtn, { backgroundColor: COLORS.error }]} data-testid="noshow-cancel-btn">
              <Text style={st.noShowBtnText}>No-Show</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Radius info */}
      <Text style={st.radiusInfo}>
        <Ionicons name="radio-outline" size={12} color={COLORS.gray} /> Radius: {status?.radiusMiles || 5} miles
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  statusRow: { gap: 8, marginBottom: 12 },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
  checkinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.orange, paddingVertical: 14, borderRadius: 12, marginBottom: 8 },
  checkinText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  resultBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  resultText: { fontSize: 13, fontWeight: '600', flex: 1 },
  noShowSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  noShowLabel: { fontSize: 13, color: COLORS.warning, fontWeight: '600', marginBottom: 10 },
  noShowActions: { flexDirection: 'row', gap: 8 },
  noShowBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  noShowBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  radiusInfo: { fontSize: 11, color: COLORS.gray, marginTop: 10, textAlign: 'center' },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface VirtualRequest {
  requestId: string;
  traineeName: string;
  createdAt: string;
}

export default function TrainerVirtualRequestScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<VirtualRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchRequests = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/api/virtual/pending`, { headers });
      setRequests(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async (requestId: string) => {
    setAccepting(requestId);
    try {
      const headers = await getAuthHeader();
      const res = await axios.post(`${API_URL}/api/virtual/accept/${requestId}`, {}, { headers });
      if (res.data.success) {
        setRequests(prev => prev.filter(r => r.requestId !== requestId));
      }
    } catch {
      // ignore
    } finally {
      setAccepting(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/api/virtual/reject/${requestId}`, {}, { headers });
      setRequests(prev => prev.filter(r => r.requestId !== requestId));
    } catch {
      // ignore
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const renderItem = ({ item }: { item: VirtualRequest }) => (
    <View style={s.card} data-testid={`virtual-request-${item.requestId}`}>
      <View style={s.cardHeader}>
        <View style={s.avatar}>
          <Ionicons name="person" size={24} color={Colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.traineeName}>{item.traineeName}</Text>
          <Text style={s.sessionType}>Virtual Live Session</Text>
        </View>
        <Text style={s.timeAgo}>{timeAgo(item.createdAt)}</Text>
      </View>

      <View style={s.startInfo}>
        <Ionicons name="time" size={16} color={Colors.orange} />
        <Text style={s.startText}>Start: Now</Text>
      </View>

      <View style={s.btnRow}>
        <Pressable
          onPress={() => handleReject(item.requestId)}
          style={s.rejectBtn}
          data-testid={`reject-${item.requestId}`}
        >
          <Ionicons name="close" size={18} color={Colors.error} />
          <Text style={s.rejectText}>Reject</Text>
        </Pressable>
        <Pressable
          onPress={() => handleAccept(item.requestId)}
          disabled={accepting === item.requestId}
          style={s.acceptBtnWrap}
          data-testid={`accept-${item.requestId}`}
        >
          <LinearGradient colors={[Colors.teal, '#0D8B88']} style={s.acceptBtn}>
            {accepting === item.requestId ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={Colors.white} />
                <Text style={s.acceptText}>Accept</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.navy} />
        </Pressable>
        <Text style={s.headerTitle}>Virtual Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.teal} />
        </View>
      ) : requests.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="videocam-off-outline" size={48} color={Colors.gray} />
          <Text style={s.emptyTitle}>No Pending Requests</Text>
          <Text style={s.emptySub}>Virtual session requests will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.requestId}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, gap: 14 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy, marginTop: 16 },
  emptySub: { fontSize: 14, fontWeight: '500', color: Colors.gray, marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(31,184,180,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  traineeName: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  sessionType: { fontSize: 12, fontWeight: '600', color: Colors.gray, marginTop: 2 },
  timeAgo: { fontSize: 11, fontWeight: '600', color: Colors.gray },
  startInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,127,0,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 14,
  },
  startText: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  btnRow: { flexDirection: 'row', gap: 12 },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.error,
  },
  rejectText: { fontSize: 14, fontWeight: '800', color: Colors.error },
  acceptBtnWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  acceptText: { fontSize: 14, fontWeight: '800', color: Colors.white },
});

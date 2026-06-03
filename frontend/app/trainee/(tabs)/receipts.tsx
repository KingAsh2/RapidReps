import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const backgroundImage = require('../../../assets/images/bg-battle-ropes.png');

const COLORS = {
  orange: '#FF6A00',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
  zellePurple: '#635BFF',
};

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const getSessionIcon = (type: string) => {
  const icons: Record<string, string> = { virtual: 'videocam', outdoor: 'sunny', in_home: 'home', trainee_home: 'location' };
  return (icons[type] || 'fitness') as any;
};

export default function TraineeReceiptsTab() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  const loadReceipts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await axios.get(`${API_URL}/api/trainee/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReceipts(res.data.receipts || []);
      setTotal(res.data.total || 0);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  const renderReceipt = ({ item }: { item: any }) => {
    const date = item.date ? new Date(item.date) : null;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/trainee/receipt?sessionId=${item.sessionId}`)}
        activeOpacity={0.7}
        data-testid={`trainee-receipt-card-${item.receiptNumber}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name={getSessionIcon(item.sessionType)} size={20} color={COLORS.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.trainerName}>{item.trainerName}</Text>
            <Text style={styles.receiptNum}>{item.receiptNumber}</Text>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.amountText}>{formatCents(item.totalCents)}</Text>
            <View style={styles.paidBadge}>
              <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
              <Text style={styles.paidText}>PAID</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerChip}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.gray} />
            <Text style={styles.footerText}>{date ? date.toLocaleDateString() : 'N/A'}</Text>
          </View>
          <View style={styles.footerChip}>
            <Ionicons name="time-outline" size={13} color={COLORS.gray} />
            <Text style={styles.footerText}>{item.durationMinutes} min</Text>
          </View>
          <View style={styles.downloadChip}>
            <Ionicons name="document-text" size={13} color={COLORS.zellePurple} />
            <Text style={styles.downloadText}>View PDF</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
      <LinearGradient colors={['rgba(26,42,94,0.96)', 'rgba(26,42,94,0.92)']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Receipts</Text>
            <Text style={styles.headerSub}>{total} payment{total !== 1 ? 's' : ''} verified</Text>
          </View>
          <View style={styles.zelleTag}>
            <Ionicons name="card" size={14} color={COLORS.zellePurple} />
            <Text style={styles.zelleTagText}>Stripe</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.orange} /></View>
        ) : receipts.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={48} color={COLORS.gray} /></View>
            <Text style={styles.emptyTitle}>No Receipts Yet</Text>
            <Text style={styles.emptySub}>Receipts will appear here after your payments are verified by admin.</Text>
          </View>
        ) : (
          <FlatList
            data={receipts}
            keyExtractor={(item) => item.sessionId}
            renderItem={renderReceipt}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadReceipts(true)} tintColor={COLORS.orange} />}
            showsVerticalScrollIndicator={false}
            data-testid="trainee-receipts-list"
          />
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  zelleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8F4FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  zelleTagText: { fontSize: 13, fontWeight: '700', color: COLORS.zellePurple },
  card: { backgroundColor: '#141929', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,106,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  trainerName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  receiptNum: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: '500' },
  amountBox: { alignItems: 'flex-end' },
  amountText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  paidText: { fontSize: 10, fontWeight: '800', color: COLORS.success, letterSpacing: 0.5 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F1F5' },
  footerChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  downloadChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', backgroundColor: '#F8F4FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  downloadText: { fontSize: 12, fontWeight: '700', color: COLORS.zellePurple },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 8 },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
});

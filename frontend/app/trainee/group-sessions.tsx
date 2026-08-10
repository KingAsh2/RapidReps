import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { groupSessionAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { haptic } from '../../src/utils/haptics';
import { goBack } from '../../src/utils/navigation';
import { ScreenHeader } from '../../src/components/ScreenShell';
import { InfoTip } from '../../src/components/InfoTip';

const COLORS = { orange: '#FF6A00', teal: '#1a2a5e', navy: '#1a2a5e', white: '#FFFFFF', gray: '#8a95b0', success: '#00D26A' };

export default function GroupSessionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await groupSessionAPI.list('upcoming');
      setSessions(data.sessions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleJoin = async (id: string) => {
    try {
      const res = await groupSessionAPI.join(id);
      load(); // Refresh
    } catch (e: any) {
      console.error(e?.response?.data?.detail);
    }
  };

  const renderSession = ({ item }: { item: any }) => (
    <View style={styles.card} data-testid={`group-session-${item.id}`}>
      <View style={styles.cardHeader}>
        <View style={styles.tagBadge}>
          <Ionicons name="people" size={14} color={COLORS.white} />
          <Text style={styles.tagText}>{item.participantCount}/{item.capacity}</Text>
        </View>
        <Text style={styles.price}>${(item.pricePerPersonCents / 100).toFixed(2)}/person</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.desc}>{item.description}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar" size={14} color={'#FF6A00'} />
          <Text style={styles.metaText}>{new Date(item.dateTime).toLocaleDateString()}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time" size={14} color={'#FF6A00'} />
          <Text style={styles.metaText}>{item.durationMinutes} min</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location" size={14} color={'#FF6A00'} />
          <Text style={styles.metaText}>{item.location || item.sessionType}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.trainerName}>by {item.trainerName}</Text>
        {item.isJoined ? (
          <View style={styles.joinedBadge}><Text style={styles.joinedText}>Joined</Text></View>
        ) : item.spotsRemaining > 0 ? (
          <TouchableOpacity onPress={() => handleJoin(item.id)} style={styles.joinBtn} data-testid={`join-group-${item.id}`}>
            <Text style={styles.joinBtnText}>Join ({item.spotsRemaining} spots)</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.fullBadge}><Text style={styles.fullText}>Full</Text></View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['rgba(20, 25, 41, 0.95)', 'rgba(20, 25, 41, 0.90)']} style={StyleSheet.absoluteFillObject} />
      {/* iter102n Wave 3: unified ScreenHeader */}
      <ScreenHeader
        title="Group Workouts"
        onBack={() => goBack('/trainee/(tabs)/home')}
        testID="trainee-group-sessions-header"
        right={
          <InfoTip
            title="Group Workouts"
            text="Boot camp blasts near you — trainers post short-notice group sessions (park HIIT, sunset yoga, boxing circuits) and ping every trainee in the area. Tap a session to join, meet other athletes, and get a killer group workout."
            color="rgba(255,255,255,0.75)"
            size={20}
            testID="group-sessions-info-tip"
          />
        }
      />
      <FlatList
        data={sessions}
        renderItem={renderSession}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={'#FF6A00'} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>No group sessions scheduled yet. Check back soon!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,210,106,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 13, fontWeight: '700', color: '#00D26A' },
  price: { fontSize: 16, fontWeight: '800', color: '#FFB347' },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  desc: { fontSize: 13, color: '#b0bbd0', marginBottom: 12, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#b0bbd0' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trainerName: { fontSize: 13, color: '#b0bbd0' },
  joinBtn: { backgroundColor: '#0A0E1A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  joinBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  joinedBadge: { backgroundColor: 'rgba(0,210,106,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  joinedText: { fontSize: 13, fontWeight: '700', color: COLORS.success },
  fullBadge: { backgroundColor: 'rgba(255,71,87,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  fullText: { fontSize: 13, fontWeight: '700', color: '#FF4757' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
});

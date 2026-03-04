import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { notificationsAPI } from '../src/services/api';
import { Colors } from '../src/utils/colors';
import { toast } from '../src/utils/toast';

const PREF_ITEMS: { key: string; label: string; description: string; icon: string }[] = [
  { key: 'pushEnabled', label: 'Push Notifications', description: 'Receive push notifications on your device', icon: 'notifications' },
  { key: 'session_requested', label: 'Session Requests', description: 'When a trainee books a session with you', icon: 'calendar' },
  { key: 'session_accepted', label: 'Session Accepted', description: 'When your trainer accepts your booking', icon: 'checkmark-circle' },
  { key: 'session_declined', label: 'Session Declined', description: 'When a trainer declines your session', icon: 'close-circle' },
  { key: 'session_ended', label: 'Session Complete', description: 'When your training session ends', icon: 'flag' },
  { key: 'session_reminder', label: 'Session Reminders', description: '30-minute heads up before your session', icon: 'alarm' },
  { key: 'rate_reminder', label: 'Rate Reminders', description: 'Reminder to rate after your session', icon: 'star' },
  { key: 'payment_released', label: 'Payment Alerts', description: 'When session payment is released', icon: 'cash' },
  { key: 'new_message', label: 'New Messages', description: 'When you receive a new chat message', icon: 'chatbubble' },
  { key: 'streak_warning', label: 'Streak Warnings', description: 'Alert when your streak is about to break', icon: 'flame' },
  { key: 'boost_expiring', label: 'Boost Expiry', description: 'When your visibility boost is ending', icon: 'rocket' },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const data = await notificationsAPI.getPreferences();
      setPrefs(data);
    } catch {
      toast.error( 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const togglePref = (key: string) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationsAPI.updatePreferences(prefs);
      toast.success( 'Your notification preferences have been updated.');
    } catch {
      toast.error( 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="notif-prefs-back-btn">
          <Ionicons name="arrow-back" size={26} color={Colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} data-testid="notif-prefs-save-btn">
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionHeader}>General</Text>
        {PREF_ITEMS.filter((i) => i.key === 'pushEnabled').map((item) => (
          <View key={item.key} style={styles.prefRow}>
            <View style={styles.prefIcon}>
              <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
            </View>
            <View style={styles.prefText}>
              <Text style={styles.prefLabel}>{item.label}</Text>
              <Text style={styles.prefDesc}>{item.description}</Text>
            </View>
            <Switch
              value={prefs[item.key] ?? true}
              onValueChange={() => togglePref(item.key)}
              trackColor={{ false: '#E0E0E0', true: Colors.primary + '60' }}
              thumbColor={prefs[item.key] ? Colors.primary : '#CCC'}
              data-testid={`toggle-${item.key}`}
            />
          </View>
        ))}

        <Text style={styles.sectionHeader}>Sessions</Text>
        {PREF_ITEMS.filter((i) =>
          ['session_requested', 'session_accepted', 'session_declined', 'session_ended', 'session_reminder', 'rate_reminder'].includes(i.key)
        ).map((item) => (
          <View key={item.key} style={[styles.prefRow, !prefs.pushEnabled && styles.disabledRow]}>
            <View style={styles.prefIcon}>
              <Ionicons name={item.icon as any} size={20} color={prefs.pushEnabled ? Colors.navy : Colors.grayLight} />
            </View>
            <View style={styles.prefText}>
              <Text style={[styles.prefLabel, !prefs.pushEnabled && styles.disabledText]}>{item.label}</Text>
              <Text style={styles.prefDesc}>{item.description}</Text>
            </View>
            <Switch
              value={(prefs[item.key] ?? true) && (prefs.pushEnabled ?? true)}
              onValueChange={() => togglePref(item.key)}
              disabled={!prefs.pushEnabled}
              trackColor={{ false: '#E0E0E0', true: Colors.primary + '60' }}
              thumbColor={(prefs[item.key] && prefs.pushEnabled) ? Colors.primary : '#CCC'}
            />
          </View>
        ))}

        <Text style={styles.sectionHeader}>Other</Text>
        {PREF_ITEMS.filter((i) =>
          ['payment_released', 'new_message', 'streak_warning', 'boost_expiring'].includes(i.key)
        ).map((item) => (
          <View key={item.key} style={[styles.prefRow, !prefs.pushEnabled && styles.disabledRow]}>
            <View style={styles.prefIcon}>
              <Ionicons name={item.icon as any} size={20} color={prefs.pushEnabled ? Colors.navy : Colors.grayLight} />
            </View>
            <View style={styles.prefText}>
              <Text style={[styles.prefLabel, !prefs.pushEnabled && styles.disabledText]}>{item.label}</Text>
              <Text style={styles.prefDesc}>{item.description}</Text>
            </View>
            <Switch
              value={(prefs[item.key] ?? true) && (prefs.pushEnabled ?? true)}
              onValueChange={() => togglePref(item.key)}
              disabled={!prefs.pushEnabled}
              trackColor={{ false: '#E0E0E0', true: Colors.primary + '60' }}
              thumbColor={(prefs[item.key] && prefs.pushEnabled) ? Colors.primary : '#CCC'}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.navy },
  saveText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  disabledRow: { opacity: 0.5 },
  prefIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prefText: { flex: 1 },
  prefLabel: { fontSize: 15, fontWeight: '600', color: Colors.navy },
  prefDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  disabledText: { color: Colors.grayLight },
});

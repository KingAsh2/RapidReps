import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Modal, TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { corporateAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { DS } from '../../src/theme/designSystem';

type Tab = 'overview' | 'invites' | 'employees';

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function CorporateDashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ companyId?: string }>();
  const companyId = String(params.companyId || '');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const [company, setCompany] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Top-up modal
  const [topupVisible, setTopupVisible] = useState(false);
  const [topupAmount, setTopupAmount] = useState('500');
  const [topupBusy, setTopupBusy] = useState(false);

  // Create-invite modal
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteMaxUses, setInviteMaxUses] = useState('25');
  const [inviteAllowance, setInviteAllowance] = useState('200');
  const [inviteBusy, setInviteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const [c, u, i, e] = await Promise.all([
        corporateAPI.getCompany(companyId),
        corporateAPI.usage(companyId),
        corporateAPI.listInvites(companyId),
        corporateAPI.listEmployees(companyId),
      ]);
      setCompany(c);
      setUsage(u);
      setInvites(i);
      setEmployees(e);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to load company';
      toast.error('Load failed', typeof msg === 'string' ? msg : 'Try again');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const handleTopup = async () => {
    const dollars = parseFloat(topupAmount);
    if (!isFinite(dollars) || dollars <= 0) {
      toast.error('Invalid amount', 'Enter a positive dollar amount');
      return;
    }
    setTopupBusy(true);
    try {
      const updated = await corporateAPI.topupCreditPool(companyId, Math.round(dollars * 100), 'Manual top-up');
      setCompany(updated);
      haptic.success();
      toast.success('Top-up confirmed', `Pool is now ${formatCents(updated.creditPoolCents)}`);
      setTopupVisible(false);
      load();
    } catch (e: any) {
      toast.error('Top-up failed', e?.response?.data?.detail || 'Try again');
    } finally {
      setTopupBusy(false);
    }
  };

  const handleCreateInvite = async () => {
    const maxUses = parseInt(inviteMaxUses, 10);
    const allowanceDollars = parseFloat(inviteAllowance);
    if (!maxUses || maxUses < 1) { toast.error('Invalid', 'Max uses must be ≥ 1'); return; }
    if (!isFinite(allowanceDollars) || allowanceDollars < 0) { toast.error('Invalid', 'Allowance must be ≥ 0'); return; }
    setInviteBusy(true);
    try {
      await corporateAPI.createInvite(companyId, {
        maxUses,
        creditAllowanceCents: Math.round(allowanceDollars * 100),
        expiresInDays: 30,
      });
      haptic.success();
      toast.success('Invite created', 'Share the code with your team');
      setInviteVisible(false);
      load();
    } catch (e: any) {
      toast.error('Failed', e?.response?.data?.detail || 'Could not create invite');
    } finally {
      setInviteBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
        <View style={styles.center}><ActivityIndicator color={DS.colors.orange} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!company) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
        <View style={styles.center}>
          <Text style={DS.text.body}>Company not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const remaining = usage?.remainingPoolCents || 0;
  const allocated = usage?.allocatedAllowanceCents || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="corp-dash-back">
          <Ionicons name="chevron-back" size={28} color={DS.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <Text style={styles.companyName} numberOfLines={1}>{company.name}</Text>
          <Text style={styles.companySlug}>rapidreps.com/c/{company.slug}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['overview', 'invites', 'employees'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            data-testid={`corp-dash-tab-${t}`}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={DS.colors.orange} />}
      >
        {tab === 'overview' && (
          <View>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>CREDIT POOL</Text>
              <Text style={styles.heroAmount}>{formatCents(company.creditPoolCents)}</Text>
              <Text style={styles.heroHint}>{formatCents(remaining)} remaining · {formatCents(usage?.totalSpentCents || 0)} spent</Text>
              <TouchableOpacity
                style={styles.heroCta}
                onPress={() => setTopupVisible(true)}
                data-testid="corp-dash-topup-btn"
              >
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={styles.heroCtaText}>Add Funds</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{usage?.employees || 0}</Text>
                <Text style={styles.statLabel}>EMPLOYEES</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatCents(allocated)}</Text>
                <Text style={styles.statLabel}>ALLOCATED</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{invites.filter(i => i.usedCount < i.maxUses).length}</Text>
                <Text style={styles.statLabel}>OPEN CODES</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.linkCard}
              onPress={() => router.push(`/corporate/c/${company.slug}`)}
              data-testid="corp-dash-view-landing-btn"
            >
              <Ionicons name="globe-outline" size={24} color={DS.colors.orange} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={DS.text.bodyStrong}>View public landing page</Text>
                <Text style={DS.text.caption}>Share with your team and partners</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={DS.colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {tab === 'invites' && (
          <View>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => setInviteVisible(true)}
              data-testid="corp-dash-create-invite-btn"
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createBtnText}>Generate Invite Code</Text>
            </TouchableOpacity>

            {invites.length === 0 ? (
              <Text style={styles.emptyText}>No invites yet. Create one to onboard your team.</Text>
            ) : invites.map(inv => {
              const exhausted = inv.usedCount >= inv.maxUses;
              return (
                <View key={inv.id} style={styles.inviteCard} data-testid={`corp-invite-${inv.code}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inviteCode}>{inv.code}</Text>
                    <Text style={DS.text.caption}>
                      {formatCents(inv.creditAllowanceCents)} per employee · {inv.usedCount}/{inv.maxUses} used
                    </Text>
                  </View>
                  <View style={[styles.statusPill, exhausted ? styles.statusUsed : styles.statusActive]}>
                    <Text style={[styles.statusPillText, { color: exhausted ? DS.colors.textMuted : DS.colors.success }]}>
                      {exhausted ? 'USED' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {tab === 'employees' && (
          <View>
            {employees.length === 0 ? (
              <Text style={styles.emptyText}>No employees enrolled yet.</Text>
            ) : employees.map(m => (
              <View key={m.id} style={styles.empCard} data-testid={`corp-employee-${m.id}`}>
                <View style={styles.empAvatar}>
                  <Ionicons name="person" size={22} color={DS.colors.textPrimary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={DS.text.bodyStrong}>{m.user?.fullName || 'Employee'}</Text>
                  <Text style={DS.text.caption}>{m.user?.email}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.empAllowance}>{formatCents(m.creditAllowanceCents)}</Text>
                  <Text style={DS.text.helper}>{formatCents(m.creditUsedCents)} used</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Top-up Modal */}
      <Modal visible={topupVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <View style={styles.modalSheet}>
            <Text style={DS.text.h2}>Add Funds</Text>
            <Text style={[DS.text.body, { marginVertical: 8 }]}>Top up your credit pool (USD).</Text>
            <TextInput
              data-testid="corp-topup-amount"
              style={styles.modalInput}
              value={topupAmount}
              onChangeText={setTopupAmount}
              keyboardType="decimal-pad"
              placeholder="500"
              placeholderTextColor={DS.colors.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setTopupVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, topupBusy && { opacity: 0.5 }]}
                onPress={handleTopup}
                disabled={topupBusy}
                data-testid="corp-topup-confirm"
              >
                {topupBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Add Funds</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Invite Modal */}
      <Modal visible={inviteVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <View style={styles.modalSheet}>
            <Text style={DS.text.h2}>Generate Invite Code</Text>
            <Text style={[DS.text.body, { marginVertical: 8 }]}>Each employee redeems the code once.</Text>
            <Text style={DS.text.label}>Max Uses</Text>
            <TextInput
              data-testid="corp-invite-maxuses"
              style={styles.modalInput}
              value={inviteMaxUses}
              onChangeText={setInviteMaxUses}
              keyboardType="number-pad"
            />
            <Text style={[DS.text.label, { marginTop: 12 }]}>Credit per employee (USD)</Text>
            <TextInput
              data-testid="corp-invite-allowance"
              style={styles.modalInput}
              value={inviteAllowance}
              onChangeText={setInviteAllowance}
              keyboardType="decimal-pad"
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setInviteVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, inviteBusy && { opacity: 0.5 }]}
                onPress={handleCreateInvite}
                disabled={inviteBusy}
                data-testid="corp-invite-confirm"
              >
                {inviteBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Generate</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: DS.spacing.lg, paddingVertical: DS.spacing.md,
  },
  companyName: { ...DS.text.h3 },
  companySlug: { ...DS.text.helper },
  tabs: {
    flexDirection: 'row', paddingHorizontal: DS.spacing.lg,
    borderBottomWidth: 1, borderBottomColor: DS.colors.border,
  },
  tab: {
    flex: 1, paddingVertical: DS.spacing.md, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: DS.colors.orange },
  tabLabel: { ...DS.text.label, color: DS.colors.textMuted },
  tabLabelActive: { color: DS.colors.textPrimary },
  scrollContent: { padding: DS.spacing.lg, paddingBottom: 80 },

  heroCard: {
    backgroundColor: DS.colors.bgRaised, borderRadius: DS.radii.card,
    borderWidth: 1, borderColor: DS.colors.borderAccent,
    padding: DS.spacing.xl, marginBottom: DS.spacing.lg,
    ...DS.shadows.card,
  },
  heroLabel: { ...DS.text.label, marginBottom: 4 },
  heroAmount: { fontSize: 38, fontWeight: '900', color: DS.colors.orange, marginBottom: 4 },
  heroHint: { ...DS.text.caption, marginBottom: DS.spacing.md },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: DS.colors.orange, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: DS.radii.pill, gap: 6,
  },
  heroCtaText: { color: '#fff', fontWeight: '800' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: DS.spacing.lg },
  statCard: {
    flex: 1, backgroundColor: DS.colors.bgRaised,
    borderRadius: DS.radii.card, padding: DS.spacing.md,
    borderWidth: 1, borderColor: DS.colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '900', color: DS.colors.textPrimary },
  statLabel: { ...DS.text.label, marginTop: 2 },

  linkCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DS.colors.bgRaised, borderRadius: DS.radii.card,
    padding: DS.spacing.lg, borderWidth: 1, borderColor: DS.colors.border,
  },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: DS.colors.orange, paddingVertical: DS.spacing.md,
    borderRadius: DS.radii.card, marginBottom: DS.spacing.lg, gap: 6,
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  inviteCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DS.colors.bgRaised, borderRadius: DS.radii.card,
    padding: DS.spacing.lg, marginBottom: DS.spacing.md,
    borderWidth: 1, borderColor: DS.colors.border,
  },
  inviteCode: { fontSize: 18, fontWeight: '900', letterSpacing: 2, color: DS.colors.textPrimary, marginBottom: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: DS.radii.pill },
  statusActive: { backgroundColor: 'rgba(34,197,94,0.15)' },
  statusUsed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  statusPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  empCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DS.colors.bgRaised, borderRadius: DS.radii.card,
    padding: DS.spacing.lg, marginBottom: DS.spacing.md,
    borderWidth: 1, borderColor: DS.colors.border,
  },
  empAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: DS.colors.bgRaised2,
    alignItems: 'center', justifyContent: 'center',
  },
  empAllowance: { ...DS.text.bodyStrong, color: DS.colors.orange },

  emptyText: { ...DS.text.body, textAlign: 'center', marginVertical: 40 },

  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: DS.overlay.scrim },
  modalSheet: {
    backgroundColor: DS.colors.bgRaised, padding: DS.spacing['2xl'],
    borderTopLeftRadius: DS.radii.xl, borderTopRightRadius: DS.radii.xl,
    borderTopWidth: 1, borderColor: DS.colors.borderStrong,
  },
  modalInput: {
    backgroundColor: DS.colors.bg, borderWidth: 1, borderColor: DS.colors.borderStrong,
    borderRadius: DS.radii.input, padding: DS.spacing.md, fontSize: 18,
    color: DS.colors.textPrimary, marginTop: 4,
  },
  modalCancel: {
    flex: 1, paddingVertical: DS.spacing.md, alignItems: 'center',
    borderRadius: DS.radii.card, backgroundColor: DS.colors.surface,
  },
  modalCancelText: { color: DS.colors.textSecondary, fontWeight: '700' },
  modalConfirm: {
    flex: 1, paddingVertical: DS.spacing.md, alignItems: 'center',
    borderRadius: DS.radii.card, backgroundColor: DS.colors.orange,
  },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { corporateAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { DS } from '../../src/theme/designSystem';
import FloatingOrangeBg from '../../src/components/FloatingOrangeBg';

/**
 * Corporate entry point.
 *  - Unauthenticated → push to public landing pattern (signup).
 *  - Authenticated user who admins a company → jump to dashboard.
 *  - Authenticated user enrolled as employee → show their company card.
 *  - Otherwise → show options (signup / redeem code).
 */
export default function CorporateIndexScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ membership: any; company: any } | null>(null);
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const myData = await corporateAPI.myCompany();
        setMe(myData);
      } catch { /* ignore */ }
      try {
        // If the user is a company admin we can find the company via list endpoint
        // (only platform admins can list-all; others get 403 silently).
        const list = await corporateAPI.listCompanies();
        const owned = list.find((c: any) => (c.adminUserIds || []).includes(user.id));
        if (owned) setMyCompanyId(owned.id);
      } catch { /* not platform admin */ }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
        <View style={styles.center}><ActivityIndicator size="large" color={DS.colors.orange} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
      <FloatingOrangeBg density={6} intensity={0.3} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="corp-idx-back">
          <Ionicons name="chevron-back" size={28} color={DS.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.iconBubble}>
          <Ionicons name="business" size={42} color={DS.colors.orange} />
        </View>
        <Text style={styles.title}>RapidReps for Teams</Text>
        <Text style={styles.subtitle}>
          Help your team train smarter. Subsidize sessions, track wellness, build retention.
        </Text>

        {me?.company ? (
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => router.push(`/corporate/c/${me.company.slug}`)}
            data-testid="corp-idx-mycompany-btn"
          >
            <Ionicons name="briefcase" size={28} color={DS.colors.orange} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={DS.text.bodyStrong}>{me.company.name}</Text>
              <Text style={DS.text.caption}>You're enrolled · ${((me.membership?.creditAllowanceCents || 0) / 100).toFixed(0)} allowance</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={DS.colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {myCompanyId ? (
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => router.push({ pathname: '/corporate/dashboard', params: { companyId: myCompanyId } })}
            data-testid="corp-idx-dashboard-btn"
          >
            <Ionicons name="speedometer" size={28} color={DS.colors.orange} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={DS.text.bodyStrong}>Open Company Dashboard</Text>
              <Text style={DS.text.caption}>Manage credit pool, invites, employees</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={DS.colors.textMuted} />
          </TouchableOpacity>
        ) : null}
        {/* iter106ao: "Sign up your company" card removed per App Store Guideline 3.1.1.
            Employers now sign up via https://rapidreps.com/for-teams (web) and their
            employees continue to redeem invite codes here in the app. */}

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => router.push('/corporate/redeem')}
          data-testid="corp-idx-redeem-btn"
        >
          <Ionicons name="key" size={28} color={DS.colors.orange} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={DS.text.bodyStrong}>I have an invite code</Text>
            <Text style={DS.text.caption}>Redeem your employer's wellness credit</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={DS.colors.textMuted} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: DS.spacing.lg, paddingTop: DS.spacing.md },
  body: { paddingHorizontal: DS.spacing['2xl'], paddingTop: DS.spacing.xl },
  iconBubble: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: DS.colors.orangeSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.spacing.xl, alignSelf: 'center',
  },
  title: { ...DS.text.h1, textAlign: 'center', marginBottom: DS.spacing.md },
  subtitle: { ...DS.text.body, textAlign: 'center', marginBottom: DS.spacing['3xl'] },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DS.colors.bgRaised, borderRadius: DS.radii.card,
    padding: DS.spacing.lg, borderWidth: 1, borderColor: DS.colors.border,
    marginBottom: DS.spacing.md,
  },
});

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { corporateAPI } from '../../src/services/api';
import { toast } from '../../src/utils/toast';
import { haptic } from '../../src/utils/haptics';
import { DS } from '../../src/theme/designSystem';

const SLUG_RE = /^[a-z0-9-]{3,40}$/;

export default function CorporateSignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [tagline, setTagline] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim() || !email.trim()) {
      toast.error('Missing fields', 'Name, slug and contact email are required');
      return;
    }
    if (!SLUG_RE.test(slug.trim().toLowerCase())) {
      toast.error('Invalid slug', 'Use 3-40 lowercase letters, numbers, or hyphens');
      return;
    }
    setLoading(true);
    try {
      const company = await corporateAPI.createCompany({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        contactEmail: email.trim(),
        brandTagline: tagline.trim() || undefined,
      });
      haptic.success();
      toast.success('Company created', `Welcome to RapidReps for ${company.name}`);
      router.replace({ pathname: '/corporate/dashboard', params: { companyId: company.id } });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Could not create company';
      const text = typeof msg === 'string' ? msg : 'Validation failed';
      toast.error('Signup failed', text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[DS.colors.bg, DS.colors.bgRaised]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} data-testid="corp-signup-back">
              <Ionicons name="chevron-back" size={28} color={DS.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.iconBubble}>
              <Ionicons name="briefcase" size={42} color={DS.colors.orange} />
            </View>
            <Text style={styles.title}>Corporate Wellness</Text>
            <Text style={styles.subtitle}>
              Subsidize world-class personal training for your team. Top up a pool, invite employees,
              track usage — all in one dashboard.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Company Name</Text>
              <TextInput
                data-testid="corp-signup-name"
                style={styles.input}
                placeholder="Acme Corp"
                placeholderTextColor={DS.colors.textMuted}
                value={name}
                onChangeText={setName}
                maxLength={120}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>URL Slug</Text>
              <TextInput
                data-testid="corp-signup-slug"
                style={styles.input}
                placeholder="acme-corp"
                placeholderTextColor={DS.colors.textMuted}
                value={slug}
                onChangeText={(t) => setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                autoCapitalize="none"
                maxLength={40}
              />
              <Text style={styles.hint}>Your branded landing page: rapidreps.com/c/{slug || 'your-slug'}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>HR Contact Email</Text>
              <TextInput
                data-testid="corp-signup-email"
                style={styles.input}
                placeholder="wellness@acme.com"
                placeholderTextColor={DS.colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Tagline (optional)</Text>
              <TextInput
                data-testid="corp-signup-tagline"
                style={styles.input}
                placeholder="Move. Together."
                placeholderTextColor={DS.colors.textMuted}
                value={tagline}
                onChangeText={setTagline}
                maxLength={200}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryCta, loading && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={loading}
              data-testid="corp-signup-submit-btn"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryCtaText}>Create Company</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.bg },
  header: { paddingHorizontal: DS.spacing.lg, paddingTop: DS.spacing.md },
  body: { paddingHorizontal: DS.spacing['2xl'], paddingTop: DS.spacing.xl, paddingBottom: DS.spacing['4xl'] },
  iconBubble: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: DS.colors.orangeSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: DS.spacing.xl, alignSelf: 'center',
  },
  title: { ...DS.text.h1, textAlign: 'center', marginBottom: DS.spacing.md },
  subtitle: { ...DS.text.body, textAlign: 'center', marginBottom: DS.spacing['2xl'] },
  field: { marginBottom: DS.spacing.lg },
  label: { ...DS.text.label, marginBottom: DS.spacing.sm },
  input: {
    width: '100%', backgroundColor: DS.colors.bgRaised,
    borderWidth: 1, borderColor: DS.colors.borderStrong,
    borderRadius: DS.radii.input,
    paddingHorizontal: DS.spacing.lg, paddingVertical: DS.spacing.md,
    fontSize: 16, color: DS.colors.textPrimary,
  },
  hint: { ...DS.text.helper, marginTop: DS.spacing.xs },
  primaryCta: {
    marginTop: DS.spacing.lg, backgroundColor: DS.colors.orange,
    paddingVertical: DS.spacing.lg, borderRadius: DS.radii.card,
    alignItems: 'center', ...DS.shadows.orangeGlow,
  },
  primaryCtaText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.4 },
});

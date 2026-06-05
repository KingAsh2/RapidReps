/**
 * iter102i — "Why am I hidden?" diagnostic card
 *
 * Renders on the trainer home screen so any trainer can see, in one tap, the 5
 * visibility gates that determine whether they appear in trainees' Nearby /
 * Map / Swipe surfaces. Data comes from GET /api/trainer/visibility-status.
 *
 * The card collapses to a compact pill when everything is green ("✓ Visible
 * to nearby trainees") and expands automatically when at least one gate fails.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { trainerAPI } from '../services/api';

type Gate = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
  value?: any;
  isInformational?: boolean;
};

type Status = { visible: boolean; gates: Gate[]; summary: string };

interface Props {
  refreshKey?: number;            // bump to force a refetch
  onFixVerification?: () => void; // CTA when verified gate fails
  onFixAvailability?: () => void; // CTA when available gate fails
  onOpenEditProfile?: () => void; // CTA for travel radius (informational)
}

export const VisibilityStatusCard: React.FC<Props> = ({
  refreshKey = 0,
  onFixVerification,
  onFixAvailability,
  onOpenEditProfile,
}) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await trainerAPI.getVisibilityStatus();
      setStatus(s);
      // Auto-expand when something is wrong
      if (!s.visible) setExpanded(true);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) {
    return (
      <View style={styles.loadingCard} data-testid="visibility-card-loading">
        <ActivityIndicator color="#FF6A00" />
      </View>
    );
  }
  if (!status) return null;

  const ctaFor = (gate: Gate) => {
    if (gate.id === 'available') return onFixAvailability;
    if (gate.id === 'verified' || gate.id === 'listable') return onFixVerification;
    if (gate.id === 'travel_radius') return onOpenEditProfile;
    return undefined;
  };

  return (
    <View style={styles.wrap} data-testid="visibility-status-card">
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded((v) => !v)}
        data-testid="visibility-card-toggle"
      >
        <LinearGradient
          colors={status.visible
            ? ['rgba(46,204,113,0.18)', 'rgba(46,204,113,0.08)']
            : ['rgba(255,106,0,0.22)', 'rgba(255,106,0,0.08)']}
          style={styles.header}
        >
          <View style={[styles.statusDot, { backgroundColor: status.visible ? '#2ECC71' : '#FF6A00' }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {status.visible ? 'Visible to nearby trainees' : 'Why am I hidden?'}
            </Text>
            <Text style={styles.subtitle}>{status.summary}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="rgba(255,255,255,0.6)"
          />
        </LinearGradient>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.body}>
          {status.gates.map((g) => {
            const cta = ctaFor(g);
            return (
              <View key={g.id} style={styles.gate} data-testid={`visibility-gate-${g.id}`}>
                <View style={[
                  styles.gateIcon,
                  { backgroundColor: g.pass ? 'rgba(46,204,113,0.18)' : 'rgba(231,76,60,0.18)' },
                ]}>
                  <Ionicons
                    name={g.pass ? 'checkmark' : (g.isInformational ? 'information' : 'close')}
                    size={14}
                    color={g.pass ? '#2ECC71' : (g.isInformational ? '#FF9F1C' : '#E74C3C')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gateLabel}>{g.label}</Text>
                  <Text style={styles.gateDetail}>{g.detail}</Text>
                  {cta && (!g.pass || g.isInformational) ? (
                    <TouchableOpacity
                      onPress={cta}
                      style={styles.gateCta}
                      data-testid={`visibility-gate-cta-${g.id}`}
                    >
                      <Text style={styles.gateCtaText}>
                        {g.id === 'available' ? 'Go to home →' :
                         g.id === 'verified' || g.id === 'listable' ? 'Open verification →' :
                         'Edit travel radius →'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(20,25,41,0.7)',
  },
  loadingCard: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(20,25,41,0.6)',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  title: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
    backgroundColor: 'rgba(8,11,22,0.55)',
  },
  gate: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  gateIcon: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  gateLabel: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  gateDetail: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2, lineHeight: 16 },
  gateCta: { marginTop: 6 },
  gateCtaText: { color: '#FF9F1C', fontSize: 11, fontWeight: '700' },
});

export default VisibilityStatusCard;

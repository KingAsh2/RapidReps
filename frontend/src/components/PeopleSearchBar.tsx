/**
 * PeopleSearchBar — uniform search component used by both
 * Trainee (to find trainers) & Trainer (to find trainees).
 *
 * Search by name, email, or phone number. Bypasses proximity.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  Keyboard,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { referralAPI } from '../services/api';
import { toast } from '../utils/toast';
import { haptic } from '../utils/haptics';

export interface PersonResult {
  id?: string;
  userId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  profilePhoto?: string;
  avatarUrl?: string;
  distance?: number | null;
  averageRating?: number;
  locationAddress?: string;
  trainingStyles?: string[];
  fitnessLevel?: string;
}

interface PeopleSearchBarProps {
  placeholder: string;          // e.g. "Search trainers by name, email, or phone"
  onSearch: (q: string) => Promise<PersonResult[]>;
  onSelectResult: (person: PersonResult) => void;
  emptyHint?: string;           // shown above results when no query
  resultBadgeLabel?: string;    // e.g. "TRAINER" / "TRAINEE"
  testIDPrefix?: string;
  /** When true, no-results state shows an "Invite to RapidReps" CTA that opens
   *  native Share / SMS / Email with the current user's referral code. */
  enableInvite?: boolean;
  /** What kind of person the inviter is looking for — used in the share message. */
  inviteAudience?: 'trainer' | 'trainee';
}

// ── Helpers to detect input type ──
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const looksLikePhone = (s: string) => /^[+\d][\d\s\-().]{6,}$/.test(s.trim()) && /\d/.test(s);

const buildInviteMessage = (audience: 'trainer' | 'trainee', referralCode: string | null) => {
  const role = audience === 'trainer' ? 'trainer' : 'workout partner';
  const codePart = referralCode
    ? `Use my code ${referralCode} when you sign up and we BOTH get $5 off our first session.`
    : 'Sign up now and book your first session.';
  return `Hey! I'm using RapidReps to book sessions with my ${role}. ${codePart} Download here: https://rapidreps.app`;
};

export const PeopleSearchBar: React.FC<PeopleSearchBarProps> = ({
  placeholder,
  onSearch,
  onSelectResult,
  emptyHint,
  resultBadgeLabel = 'PROFILE',
  testIDPrefix = 'people-search',
  enableInvite = false,
  inviteAudience = 'trainer',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Lazy-load referral code on first render when invite is enabled
  useEffect(() => {
    if (!enableInvite) return;
    let cancelled = false;
    referralAPI
      .getMyCode()
      .then((data) => {
        if (!cancelled) setReferralCode(data?.referralCode || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enableInvite]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await onSearch(trimmed);
        setResults(r);
        setHasSearched(true);
      } catch {
        setResults([]);
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, onSearch]);

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    Keyboard.dismiss();
  };

  const handleInvite = async () => {
    const q = query.trim();
    const message = buildInviteMessage(inviteAudience, referralCode);
    setInviting(true);
    let channel: 'sms' | 'email' | 'share' = 'share';
    let success = false;
    try {
      // Smart deep-link by detected query type
      if (looksLikeEmail(q)) {
        const subject = encodeURIComponent('Join me on RapidReps');
        const body = encodeURIComponent(message);
        const url = `mailto:${encodeURIComponent(q)}?subject=${subject}&body=${body}`;
        const canOpen = await Linking.canOpenURL(url).catch(() => false);
        if (canOpen) {
          await Linking.openURL(url);
          channel = 'email';
          success = true;
        }
      } else if (looksLikePhone(q)) {
        const cleanPhone = q.replace(/[^\d+]/g, '');
        const sep = Platform.OS === 'ios' ? '&' : '?';
        const url = `sms:${cleanPhone}${sep}body=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(url).catch(() => false);
        if (canOpen) {
          await Linking.openURL(url);
          channel = 'sms';
          success = true;
        }
      }
      // Fallback — native share sheet
      if (!success) {
        const result = await Share.share({ message });
        channel = 'share';
        // iOS returns action='sharedAction' if user actually shared
        success = (result as any)?.action === 'sharedAction' || (result as any)?.action !== 'dismissedAction';
      }

      if (success) {
        haptic.success();
        toast.success(`Invite sent via ${channel === 'sms' ? 'SMS' : channel === 'email' ? 'email' : 'share'} — they get $5 off, you do too`);
        // Fire-and-forget analytics — never block UX
        referralAPI
          .trackInvite({ channel, audience: inviteAudience, targetQuery: q })
          .catch(() => {});
      }
    } catch {
      // user cancelled or share failed — silent
    } finally {
      setInviting(false);
    }
  };

  const isEmail = looksLikeEmail(query);
  const isPhone = !isEmail && looksLikePhone(query);
  const inviteCtaLabel = isEmail
    ? `Email invite to "${query.trim()}"`
    : isPhone
    ? `Text invite to "${query.trim()}"`
    : 'Invite a friend to RapidReps';

  return (
    <View style={styles.container} data-testid={`${testIDPrefix}-container`}>
      {/* Search input — uniform navy card w/ orange accents */}
      <LinearGradient
        colors={['#141929', '#1A2035']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.searchCard}
      >
        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color="#FF7F00" />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.45)"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            data-testid={`${testIDPrefix}-input`}
          />
          {loading ? (
            <ActivityIndicator size="small" color="#FF7F00" />
          ) : query.length > 0 ? (
            <TouchableOpacity
              onPress={clearQuery}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              data-testid={`${testIDPrefix}-clear-btn`}
            >
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          ) : null}
        </View>
        {emptyHint && !query && (
          <Text style={styles.hint}>{emptyHint}</Text>
        )}
      </LinearGradient>

      {/* Results */}
      {hasSearched && query.length > 0 && (
        <View style={styles.resultsContainer} data-testid={`${testIDPrefix}-results`}>
          {results.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={32} color="rgba(255,255,255,0.35)" />
              <Text style={styles.emptyText}>No results for &quot;{query}&quot;</Text>
              <Text style={styles.emptySubText}>Try a different name, email, or phone</Text>

              {enableInvite && (
                <TouchableOpacity
                  onPress={handleInvite}
                  disabled={inviting}
                  activeOpacity={0.85}
                  style={styles.inviteBtnWrap}
                  data-testid={`${testIDPrefix}-invite-btn`}
                >
                  <LinearGradient
                    colors={['#FF6A00', '#FF9F1C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.inviteBtn}
                  >
                    {inviting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons
                        name={isEmail ? 'mail' : isPhone ? 'chatbubble-ellipses' : 'gift'}
                        size={16}
                        color="#FFFFFF"
                      />
                    )}
                    <Text style={styles.inviteBtnText} numberOfLines={1}>
                      {inviteCtaLabel}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {enableInvite && referralCode && (
                <Text style={styles.inviteRewardText}>
                  You both get $5 off when they sign up with code{' '}
                  <Text style={styles.inviteRewardCode}>{referralCode}</Text>
                </Text>
              )}
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
            >
              {results.map((p, idx) => {
                const id = p.userId || p.id || `result-${idx}`;
                const photo = p.profilePhoto || p.avatarUrl;
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.resultRow}
                    onPress={() => {
                      Keyboard.dismiss();
                      onSelectResult(p);
                    }}
                    data-testid={`${testIDPrefix}-result-${idx}`}
                  >
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={20} color="#FF7F00" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {p.fullName || 'Unknown'}
                      </Text>
                      <View style={styles.metaRow}>
                        {p.distance != null && (
                          <View style={styles.metaPill}>
                            <Ionicons name="location" size={11} color="#FF7F00" />
                            <Text style={styles.metaText}>{p.distance.toFixed(1)} mi</Text>
                          </View>
                        )}
                        {p.averageRating != null && p.averageRating > 0 && (
                          <View style={styles.metaPill}>
                            <Ionicons name="star" size={11} color="#FFD700" />
                            <Text style={styles.metaText}>{p.averageRating.toFixed(1)}</Text>
                          </View>
                        )}
                        {p.email && (
                          <Text style={styles.emailText} numberOfLines={1}>{p.email}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{resultBadgeLabel}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.45)" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  searchCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 6,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  resultsContainer: {
    marginTop: 8,
    backgroundColor: '#141929',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(255,127,0,0.4)',
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,127,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,127,0,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF7F00',
  },
  emailText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: 'rgba(255,127,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,127,0,0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF7F00',
    letterSpacing: 0.5,
  },
  // ── Invite-to-RapidReps CTA (empty state) ──
  inviteBtnWrap: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF6A00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxWidth: 280,
  },
  inviteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  inviteRewardText: {
    marginTop: 10,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  inviteRewardCode: {
    color: '#FF9F1C',
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default PeopleSearchBar;

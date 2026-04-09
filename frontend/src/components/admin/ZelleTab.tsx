import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, s, formatCents } from './AdminShared';

interface Props {
  zelleSettings: { zelleEmail: string; zellePhone: string };
  pendingPayments: any[];
  onUpdateSettings: (email: string, phone: string) => Promise<void>;
  onVerifyPayment: (sessionId: string) => Promise<void>;
  verifyingId: string | null;
  saving: boolean;
}

export const ZelleTab = ({
  zelleSettings, pendingPayments, onUpdateSettings, onVerifyPayment, verifyingId, saving,
}: Props) => {
  const [email, setEmail] = useState(zelleSettings.zelleEmail);
  const [phone, setPhone] = useState(zelleSettings.zellePhone);

  return (
    <View>
      {/* Platform Zelle Settings */}
      <Text style={s.sectionTitle}>Platform Zelle Settings</Text>
      <View style={s.statCard} data-testid="zelle-settings-card">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#6D1ED4', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="send" size={20} color={C.white} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>Zelle Payment Info</Text>
            <Text style={{ fontSize: 12, color: C.gray }}>Trainees will see this when making payments</Text>
          </View>
        </View>

        <Text style={s.inputLabel}>Zelle Email</Text>
        <TextInput
          style={[s.textInput, { marginBottom: 12 }]}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor="#aaa"
          keyboardType="email-address"
          autoCapitalize="none"
          data-testid="zelle-settings-email"
        />

        <Text style={s.inputLabel}>Zelle Phone</Text>
        <TextInput
          style={[s.textInput, { marginBottom: 16 }]}
          value={phone}
          onChangeText={setPhone}
          placeholder="(555) 555-5555"
          placeholderTextColor="#aaa"
          keyboardType="phone-pad"
          data-testid="zelle-settings-phone"
        />

        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: '#6D1ED4', justifyContent: 'center' }]}
          onPress={() => onUpdateSettings(email, phone)}
          disabled={saving}
          data-testid="save-zelle-settings-btn"
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={C.white} />
              <Text style={s.actionBtnText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Pending Zelle Payments */}
      <Text style={[s.sectionTitle, { marginTop: 24 }]}>
        Pending Payments ({pendingPayments.length})
      </Text>
      {pendingPayments.length === 0 ? (
        <View style={[s.statCard, { alignItems: 'center', paddingVertical: 30 }]}>
          <Ionicons name="checkmark-circle" size={40} color={C.success} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 10 }}>All caught up!</Text>
          <Text style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>No pending Zelle payments to verify.</Text>
        </View>
      ) : (
        pendingPayments.map((p: any) => (
          <View
            key={p.sessionId}
            style={[s.userCard, { borderLeftWidth: 3, borderLeftColor: '#6D1ED4' }]}
            data-testid={`pending-zelle-${p.sessionId}`}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>{p.traineeName}</Text>
                <View style={{ backgroundColor: `${C.orange}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.orange }}>{p.sessionType?.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 13, color: C.gray }}>{p.traineeEmail}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>{formatCents(p.amountCents)}</Text>
                {p.senderName ? <Text style={{ fontSize: 13, color: '#6D1ED4', fontWeight: '600' }}>From: {p.senderName}</Text> : null}
              </View>
              {p.notes ? (
                <Text style={{ fontSize: 12, color: C.gray, fontStyle: 'italic', marginTop: 4 }}>Note: {p.notes}</Text>
              ) : null}
              <Text style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>
                Sent: {new Date(p.sentAt).toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: '#6D1ED4',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 10,
                minWidth: 80,
                alignItems: 'center',
              }}
              onPress={() => {
                Alert.alert(
                  'Verify Payment',
                  `Confirm ${formatCents(p.amountCents)} Zelle payment from ${p.traineeName}? This will activate the session.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Verify', onPress: () => onVerifyPayment(p.sessionId) },
                  ]
                );
              }}
              disabled={verifyingId === p.sessionId}
              data-testid={`verify-zelle-${p.sessionId}`}
            >
              {verifyingId === p.sessionId ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Text style={{ color: C.white, fontWeight: '800', fontSize: 14 }}>Verify</Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
};

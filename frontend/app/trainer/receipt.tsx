import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { toast } from '../../src/utils/toast';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const backgroundImage = require('../../assets/images/bg-battle-ropes.jpg');

const COLORS = {
  orange: '#FF6A00',
  teal: '#1a2a5e',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F5F6F8',
  success: '#00C853',
  accent: '#635BFF',
};

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const getSessionLabel = (type: string) => {
  const labels: Record<string, string> = {
    virtual: 'Virtual Session',
    outdoor: 'Outdoor Session',
    in_home: 'In-Home Session',
    trainee_home: 'At Trainee Home',
  };
  return labels[type] || type;
};

export default function TrainerReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionId = String(params.sessionId || '');
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');

  useEffect(() => {
    if (sessionId) loadReceipt();
    loadLogo();
  }, [sessionId]);

  const loadLogo = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/receipt-logo`);
      setLogoBase64(res.data.logo || '');
    } catch { /* fallback to text logo */ }
  };

  const loadReceipt = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const res = await axios.get(`${API_URL}/api/receipts/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReceipt(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!receipt) return;
    setGenerating(true);
    try {
      const html = buildReceiptHTML(receipt, logoBase64);
      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Receipt ${receipt.receiptNumber}` });
      } else {
        toast.success('PDF saved');
      }
    } catch (err: any) {
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(26,42,94,0.95)', 'rgba(26,42,94,0.90)']} style={StyleSheet.absoluteFill} />
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.orange} /></View>
      </ImageBackground>
    );
  }

  if (!receipt) {
    return (
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(26,42,94,0.95)', 'rgba(26,42,94,0.90)']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color={COLORS.white} /></TouchableOpacity>
            <Text style={styles.headerTitle}>Receipt</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.center}><Text style={{ color: COLORS.white, fontSize: 16 }}>Receipt not found</Text></View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  const isPaid = receipt.paymentStatus === 'verified';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground source={backgroundImage} style={styles.container} resizeMode="cover">
        <LinearGradient colors={['rgba(26,42,94,0.95)', 'rgba(26,42,94,0.90)']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="trainer-receipt-back-btn">
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Receipt</Text>
            <TouchableOpacity onPress={generatePDF} disabled={generating} style={styles.shareBtn} data-testid="trainer-share-receipt-btn">
              {generating ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="share-outline" size={22} color={COLORS.white} />}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.receiptCard} data-testid="trainer-receipt-card">
              <View style={styles.brandSection}>
                <Image
                  source={require('../../assets/images/rapidreps-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                  data-testid="trainer-receipt-logo"
                />
                <Text style={styles.brandName}>RapidReps</Text>
                <Text style={styles.brandSubtitle}>Payment Receipt</Text>
              </View>

              <View style={styles.receiptMeta}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Receipt #</Text>
                  <Text style={styles.metaValue} data-testid="trainer-receipt-number">{receipt.receiptNumber}</Text>
                </View>
                <View style={[styles.metaCol, { alignItems: 'flex-end' }]}>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={styles.metaValue}>{new Date(receipt.date).toLocaleDateString()}</Text>
                </View>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: isPaid ? `${COLORS.success}15` : `${COLORS.orange}15` }]}>
                <Ionicons name={isPaid ? 'checkmark-circle' : 'time'} size={18} color={isPaid ? COLORS.success : COLORS.orange} />
                <Text style={[styles.statusText, { color: isPaid ? COLORS.success : COLORS.orange }]}>
                  {isPaid ? 'PAID' : receipt.paymentStatus?.toUpperCase() || 'PENDING'}
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>SESSION DETAILS</Text>
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={16} color={COLORS.gray} />
                <Text style={styles.detailText}>{new Date(receipt.date).toLocaleString()}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="fitness" size={16} color={COLORS.gray} />
                <Text style={styles.detailText}>{getSessionLabel(receipt.sessionType)} - {receipt.durationMinutes} min</Text>
              </View>
              {receipt.location ? (
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={16} color={COLORS.gray} />
                  <Text style={styles.detailText}>{receipt.location}</Text>
                </View>
              ) : null}

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>PARTICIPANTS</Text>
              <View style={styles.partyRow}>
                <View style={styles.partyCol}>
                  <Text style={styles.partyLabel}>Trainee</Text>
                  <Text style={styles.partyName}>{receipt.traineeName}</Text>
                  <Text style={styles.partyEmail}>{receipt.traineeEmail}</Text>
                </View>
                <View style={styles.partyCol}>
                  <Text style={styles.partyLabel}>Trainer</Text>
                  <Text style={styles.partyName}>{receipt.trainerName}</Text>
                  <Text style={styles.partyEmail}>{receipt.trainerEmail}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>YOUR EARNINGS</Text>
              <View style={styles.lineItem}>
                <Text style={styles.lineLabel}>Session Fee</Text>
                <Text style={styles.lineValue}>{formatCents(receipt.totalCents)}</Text>
              </View>
              <View style={styles.lineItem}>
                <Text style={styles.lineSubLabel}>Your Earnings ({receipt.trainerPercent}%)</Text>
                <Text style={[styles.lineSubValue, { color: COLORS.success, fontWeight: '700' }]}>{formatCents(receipt.trainerPayoutCents)}</Text>
              </View>
              <View style={styles.lineItem}>
                <Text style={styles.lineSubLabel}>Platform Fee ({receipt.platformPercent}%)</Text>
                <Text style={styles.lineSubValue}>{formatCents(receipt.platformFeeCents)}</Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>YOUR PAYOUT</Text>
                <Text style={styles.totalValue}>{formatCents(receipt.trainerPayoutCents)}</Text>
              </View>

              <View style={styles.paymentMethodBox}>
                <Ionicons name="send" size={18} color={COLORS.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentMethodText}>Paid via {receipt.paymentMethod}</Text>
                  {receipt.paymentVerifiedAt ? (
                    <Text style={styles.paymentMethodSub}>Verified: {new Date(receipt.paymentVerifiedAt).toLocaleString()}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Thank you for training with RapidReps!</Text>
                <Text style={styles.footerNote}>This receipt is generated automatically. For questions, contact support.</Text>
              </View>
            </View>

            <TouchableOpacity onPress={generatePDF} disabled={generating} style={styles.pdfBtn} data-testid="trainer-download-pdf-btn">
              <LinearGradient colors={['#0A0E1A', '#141929']} style={styles.pdfBtnGradient}>
                {generating ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="document-text" size={20} color={COLORS.white} />
                    <Text style={styles.pdfBtnText}>Download / Share PDF</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

function buildReceiptHTML(receipt: any, logoBase64: string = ''): string {
  const isPaid = receipt.paymentStatus === 'verified';
  const logoImg = logoBase64
    ? `<img src="data:image/png;base64,${logoBase64}" style="width:80px;height:80px;border-radius:14px;margin-bottom:10px;" />`
    : `<div class="brand-icon">R</div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1a2a5e; background: #f8f9fc; padding: 40px; }
    .receipt { background: #fff; border-radius: 16px; padding: 40px; max-width: 560px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .brand { text-align: center; margin-bottom: 30px; }
    .brand-icon { display: inline-block; width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #FF6A00, #FF8C33); line-height: 56px; text-align: center; font-size: 28px; color: #fff; margin-bottom: 10px; }
    .brand-name { font-size: 28px; font-weight: 900; color: #1a2a5e; letter-spacing: -0.5px; }
    .brand-sub { font-size: 14px; color: #8a95b0; margin-top: 4px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .meta-label { font-size: 11px; color: #8a95b0; text-transform: uppercase; letter-spacing: 1px; }
    .meta-value { font-size: 15px; font-weight: 700; color: #1a2a5e; margin-top: 4px; }
    .status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 13px; margin-bottom: 20px; }
    .status.paid { background: #E8F5E9; color: #00C853; }
    .status.pending { background: #FFF3E0; color: #FF6A00; }
    .divider { border-top: 1px solid #E8ECF0; margin: 20px 0; }
    .section-label { font-size: 11px; font-weight: 700; color: #8a95b0; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
    .detail-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; color: #1a2a5e; }
    .party-row { display: flex; gap: 20px; }
    .party-col { flex: 1; }
    .party-label { font-size: 11px; color: #8a95b0; text-transform: uppercase; }
    .party-name { font-size: 15px; font-weight: 700; color: #1a2a5e; margin-top: 4px; }
    .party-email { font-size: 13px; color: #8a95b0; }
    .line-item { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .line-label { font-size: 14px; color: #1a2a5e; font-weight: 600; }
    .line-sub { font-size: 13px; color: #8a95b0; }
    .line-value { font-size: 14px; color: #1a2a5e; font-weight: 600; }
    .total-row { display: flex; justify-content: space-between; align-items: center; background: #E8F5E9; border-radius: 10px; padding: 14px 16px; margin-top: 12px; }
    .total-label { font-size: 16px; font-weight: 800; color: #1a2a5e; }
    .total-value { font-size: 24px; font-weight: 900; color: #00C853; }
    .payment-method { display: flex; align-items: center; gap: 10px; background: #F8F4FF; border-radius: 10px; padding: 12px 16px; margin-top: 16px; }
    .payment-text { font-size: 14px; font-weight: 700; color: #6D1ED4; }
    .payment-sub { font-size: 12px; color: #8a95b0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E8ECF0; }
    .footer-text { font-size: 14px; font-weight: 600; color: #1a2a5e; }
    .footer-note { font-size: 12px; color: #8a95b0; margin-top: 6px; }
  </style></head><body>
  <div class="receipt">
    <div class="brand">
      ${logoImg}
      <div class="brand-name">RapidReps</div>
      <div class="brand-sub">Trainer Earnings Receipt</div>
    </div>
    <div class="meta-row">
      <div class="meta-col"><div class="meta-label">Receipt #</div><div class="meta-value">${receipt.receiptNumber}</div></div>
      <div class="meta-col" style="text-align:right"><div class="meta-label">Date</div><div class="meta-value">${new Date(receipt.date).toLocaleDateString()}</div></div>
    </div>
    <div class="status ${isPaid ? 'paid' : 'pending'}">${isPaid ? 'PAID' : (receipt.paymentStatus || 'PENDING').toUpperCase()}</div>
    <div class="divider"></div>
    <div class="section-label">Session Details</div>
    <div class="detail-row">${new Date(receipt.date).toLocaleString()}</div>
    <div class="detail-row">${receipt.sessionType ? receipt.sessionType.charAt(0).toUpperCase() + receipt.sessionType.slice(1) : ''} Session - ${receipt.durationMinutes} min</div>
    ${receipt.location ? `<div class="detail-row">${receipt.location}</div>` : ''}
    <div class="divider"></div>
    <div class="section-label">Participants</div>
    <div class="party-row">
      <div class="party-col"><div class="party-label">Trainee</div><div class="party-name">${receipt.traineeName}</div><div class="party-email">${receipt.traineeEmail}</div></div>
      <div class="party-col"><div class="party-label">Trainer</div><div class="party-name">${receipt.trainerName}</div><div class="party-email">${receipt.trainerEmail}</div></div>
    </div>
    <div class="divider"></div>
    <div class="section-label">Earnings Breakdown</div>
    <div class="line-item"><span class="line-label">Session Fee</span><span class="line-value">$${(receipt.totalCents / 100).toFixed(2)}</span></div>
    <div class="line-item"><span class="line-sub">Your Earnings (${receipt.trainerPercent}%)</span><span style="color:#00C853;font-weight:700;font-size:13px;">$${(receipt.trainerPayoutCents / 100).toFixed(2)}</span></div>
    <div class="line-item"><span class="line-sub">Platform Fee (${receipt.platformPercent}%)</span><span class="line-sub">$${(receipt.platformFeeCents / 100).toFixed(2)}</span></div>
    <div class="total-row"><span class="total-label">YOUR PAYOUT</span><span class="total-value">$${(receipt.trainerPayoutCents / 100).toFixed(2)}</span></div>
    <div class="payment-method">
      <span class="payment-text">Paid via ${receipt.paymentMethod}</span>
      ${receipt.paymentVerifiedAt ? `<span class="payment-sub">Verified: ${new Date(receipt.paymentVerifiedAt).toLocaleString()}</span>` : ''}
    </div>
    <div class="footer">
      <div class="footer-text">Thank you for training with RapidReps!</div>
      <div class="footer-note">This receipt is generated automatically. For questions, contact support.</div>
    </div>
  </div>
  </body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  shareBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  receiptCard: { backgroundColor: '#141929', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6 },
  brandSection: { alignItems: 'center', marginBottom: 24 },
  logoImage: { width: 80, height: 80, borderRadius: 16, marginBottom: 10 },
  brandName: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  brandSubtitle: { fontSize: 14, color: '#8a95b0', marginTop: 4 },
  receiptMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metaCol: {},
  metaLabel: { fontSize: 11, color: '#8a95b0', textTransform: 'uppercase', letterSpacing: 1 },
  metaValue: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#8a95b0', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detailText: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  partyRow: { flexDirection: 'row', gap: 20 },
  partyCol: { flex: 1 },
  partyLabel: { fontSize: 11, color: '#8a95b0', textTransform: 'uppercase' },
  partyName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 4 },
  partyEmail: { fontSize: 13, color: '#8a95b0' },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineLabel: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  lineSubLabel: { fontSize: 13, color: '#8a95b0' },
  lineValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  lineSubValue: { fontSize: 13, color: '#8a95b0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, marginTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  totalValue: { fontSize: 24, fontWeight: '900', color: COLORS.success },
  paymentMethodBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F4FF', borderRadius: 10, padding: 12, marginTop: 16 },
  paymentMethodText: { fontSize: 14, fontWeight: '700', color: COLORS.accent },
  paymentMethodSub: { fontSize: 12, color: '#8a95b0', marginTop: 2 },
  footer: { alignItems: 'center', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E8ECF0' },
  footerText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  footerNote: { fontSize: 12, color: '#8a95b0', marginTop: 6, textAlign: 'center' },
  pdfBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 16 },
  pdfBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
  pdfBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
});

/**
 * Instagram OAuth deep-link callback handler.
 * Receives `rapidreps://instagram-callback?code=...&state=...`
 * Parses params and calls /api/instagram/oauth/callback.
 *
 * In practice this screen rarely renders — `WebBrowser.openAuthSessionAsync`
 * returns the URL directly and InstagramSection handles it. This route exists
 * as a fallback for cold-start deep links.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { instagramAPI } from '../src/services/api';
import { toast } from '../src/utils/toast';

export default function InstagramCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const finish = async () => {
      if (params.error) {
        setStatus('error');
        setErrorMessage('Instagram authorization was cancelled');
        return;
      }
      const code = params.code;
      const state = params.state;
      if (!code || !state) {
        setStatus('error');
        setErrorMessage('Missing authorization code or state');
        return;
      }
      try {
        const r = await instagramAPI.oauthCallback(String(code), String(state));
        setStatus('success');
        toast.success(`@${r.username} linked!`);
        setTimeout(() => router.replace('/instagram/curator'), 800);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        if (detail && typeof detail === 'object' && detail.code === 'PERSONAL_ACCOUNT_NOT_SUPPORTED') {
          router.replace('/instagram/personal-account-help');
          return;
        }
        setStatus('error');
        setErrorMessage(
          typeof detail === 'string' ? detail : 'Failed to link Instagram',
        );
      }
    };
    finish();
  }, [params.code, params.state, params.error]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.center}>
        {status === 'pending' && (
          <>
            <ActivityIndicator size="large" color="#FF7F00" />
            <Text style={styles.text}>Linking Instagram…</Text>
          </>
        )}
        {status === 'success' && (
          <>
            <Ionicons name="checkmark-circle" size={48} color="#21D07A" />
            <Text style={styles.text}>Instagram linked!</Text>
          </>
        )}
        {status === 'error' && (
          <>
            <Ionicons name="close-circle" size={48} color="#FF4757" />
            <Text style={styles.text}>{errorMessage || 'Could not link Instagram'}</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
              <Text style={styles.btnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0E1A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 14 },
  text: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  btn: {
    marginTop: 20,
    backgroundColor: '#FF7F00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#FFFFFF', fontWeight: '800' },
});

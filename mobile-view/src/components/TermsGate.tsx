import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { colors } from '../theme/colors';
import LogoutButton from './LogoutButton';

/** Logins that are not employees do not accept the employee terms. */
const NO_TERMS_ROLES = new Set(['Vendor', 'Partner', 'Franchise']);

/**
 * Terms & Conditions at every sign-in: the employee must tick the box and continue before using
 * the app. Acceptance (date and time) is saved on the server; signing in again asks again.
 */
export default function TermsGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const exempt = !user || NO_TERMS_ROLES.has(String(user.role || ''));
  const [state, setState] = useState<'checking' | 'needed' | 'done'>(exempt ? 'done' : 'checking');
  const [terms, setTerms] = useState<{ version: string; text: string } | null>(null);
  const [ticked, setTicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    if (exempt) return setState('done');
    try {
      const me: any = await apiService.get('/auth/me');
      const accepted = me?.termsAcceptedAt ? new Date(me.termsAcceptedAt).getTime() : 0;
      const signedIn = me?.lastLogin ? new Date(me.lastLogin).getTime() : 0;
      if (accepted && accepted >= signedIn) return setState('done');
      const t: any = await apiService.get('/auth/terms');
      setTerms({ version: String(t?.version || ''), text: String(t?.text || '') });
      setState('needed');
    } catch {
      // Never lock the app out when the server can't answer.
      setState('done');
    }
  }, [exempt]);

  useEffect(() => {
    setTicked(false);
    void check();
  }, [check, user?._id]);

  const accept = async () => {
    if (!ticked) return setError('Tick the box to accept the Terms & Conditions.');
    setSaving(true);
    setError('');
    try {
      await apiService.post('/auth/accept-terms', { accepted: true, version: terms?.version, platform: Platform.OS });
      setState('done');
    } catch (e: any) {
      setError(e?.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (state === 'done') return <>{children}</>;
  if (state === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Terms & Conditions</Text>
          <Text style={styles.subtitle}>Read and accept to continue</Text>
        </View>
        <LogoutButton />
      </View>
      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={styles.text}>{terms?.text}</Text>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkRow} onPress={() => { setTicked((v) => !v); setError(''); }} activeOpacity={0.8}>
          <Ionicons name={ticked ? 'checkbox' : 'square-outline'} size={26} color={ticked ? colors.primaryDark : colors.textTertiary} />
          <Text style={styles.checkText}>I have read and accept the Terms & Conditions</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, (!ticked || saving) && styles.buttonOff]}
          onPress={accept}
          disabled={!ticked || saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Accept & Continue</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  body: { flex: 1 },
  text: { fontSize: 14, lineHeight: 21, color: colors.textPrimary },
  footer: { padding: 16, paddingBottom: 28, backgroundColor: colors.backgroundLight, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  checkText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  error: { color: colors.error, marginBottom: 8 },
  button: { backgroundColor: colors.primaryDark, borderRadius: 10, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

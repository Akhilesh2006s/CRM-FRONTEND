import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';

export default function SettingsSMSScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isAdmin } = getRoleFlags(user);
  const [senderId, setSenderId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const data = await apiService.get<{ senderId?: string; apiKey?: string; template?: string }>(
          '/settings/sms'
        );
        setSenderId(data.senderId || '');
        setApiKey(data.apiKey || '');
        setTemplate(data.template || '');
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load SMS settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const handleSave = async () => {
    if (!senderId.trim() || !apiKey.trim()) {
      Alert.alert('Error', 'Sender ID and API Key are required.');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.put('/settings/sms', { senderId, apiKey, template });
      Alert.alert('Success', 'SMS settings saved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save SMS settings');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <ScreenShell title="SMS Settings">
        <View style={styles.denied}>
          <Text style={styles.deniedText}>Admin privileges required for SMS settings.</Text>
          <WebButton title="Go back" onPress={() => navigation.goBack()} variant="outline" />
        </View>
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title="SMS Settings" loading>{null}</ScreenShell>
    );
  }

  return (
    <ScreenShell noScroll title="SMS Settings">
      <View style={styles.page}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>SMS gateway</Text>
          <Text style={styles.label}>Sender ID *</Text>
          <WebInput style={styles.input} value={senderId} onChangeText={setSenderId} placeholder="Enter sender ID" />
          <Text style={styles.label}>API Key *</Text>
          <WebInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="Enter SMS API key"
            secureTextEntry
          />
          <Text style={styles.label}>Default Template</Text>
          <WebInput
            style={[styles.input, styles.textArea]}
            value={template}
            onChangeText={setTemplate}
            placeholder="Enter default SMS template"
            multiline
          />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <WebButton title={submitting ? 'Saving…' : 'Save settings'} onPress={handleSave} loading={submitting} disabled={submitting} />
          <WebButton title="Cancel" onPress={() => navigation.goBack()} variant="outline" disabled={submitting} />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 16 },
  section: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {},
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    backgroundColor: colors.backgroundLight,
  },
  denied: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  deniedText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
});

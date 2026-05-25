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
      <ScreenShell title="SMS Settings" loading />
    );
  }

  return (
    <ScreenShell noScroll title="SMS Settings">
      <View style={styles.page}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
  content: { padding: 20, gap: 8, paddingBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  input: {
    ...typography.body.medium,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  denied: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  deniedText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center' },
});

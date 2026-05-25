import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';

type BackupSettings = {
  notificationEmail?: string;
  schedule?: string;
  lastRunAt?: string;
};

export default function SettingsBackupScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isAdmin } = getRoleFlags(user);
  const [email, setEmail] = useState('');
  const [schedule, setSchedule] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const data = await apiService.get<BackupSettings>('/settings/backup');
        setEmail(data.notificationEmail || '');
        setSchedule(data.schedule || '');
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load backup settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const handleSave = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please provide an email for backup notifications.');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.put('/settings/backup', {
        notificationEmail: email.trim(),
        schedule: schedule.trim(),
      });
      Alert.alert('Success', 'Backup settings saved.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save backup settings');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunBackup = async () => {
    setRunning(true);
    try {
      await apiService.post('/settings/backup/run', {});
      Alert.alert('Success', 'Backup started. Check notification email when complete.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to run backup');
    } finally {
      setRunning(false);
    }
  };

  if (!isAdmin) {
    return (
      <ScreenShell title="Backup Settings">
        <View style={styles.denied}>
          <Text style={styles.deniedText}>Admin privileges required for database backup.</Text>
          <WebButton title="Go back" onPress={() => navigation.goBack()} variant="outline" />
        </View>
      </ScreenShell>
    );
  }

  if (loading) {
    return <ScreenShell title="Backup Settings" loading />;
  }

  return (
    <ScreenShell noScroll title="Backup Settings">
      <View style={styles.page}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Notification Email *</Text>
          <WebInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.label}>Schedule</Text>
          <WebInput
            style={styles.input}
            value={schedule}
            onChangeText={setSchedule}
            placeholder="e.g. Daily at 10:00 AM"
          />
        </ScrollView>
        <View style={styles.footer}>
          <WebButton
            title={submitting ? 'Saving…' : 'Save settings'}
            onPress={handleSave}
            loading={submitting}
            disabled={submitting || running}
          />
          <WebButton
            title={running ? 'Running…' : 'Run backup now'}
            onPress={handleRunBackup}
            variant="outline"
            loading={running}
            disabled={submitting || running}
          />
          <WebButton title="Cancel" onPress={() => navigation.goBack()} variant="outline" disabled={submitting || running} />
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

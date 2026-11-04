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
    return <ScreenShell title="Backup Settings" loading>{null}</ScreenShell>;
  }

  return (
    <ScreenShell noScroll title="Backup Settings">
      <View style={styles.page}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup</Text>
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
          </View>
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

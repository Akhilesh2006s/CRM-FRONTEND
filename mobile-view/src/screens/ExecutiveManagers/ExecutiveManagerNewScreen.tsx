import React, { useState } from 'react';
import { Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';

export default function ExecutiveManagerNewScreen({ navigation }: any) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    department: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setErrorMessage('Full name and email are required');
      return;
    }
    const phoneError = phoneDigitsError(form.phone, false);
    if (phoneError) {
      setErrorMessage(phoneError);
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await apiService.post('/executive-managers/create', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.trim() || undefined,
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
      });
      Alert.alert('Success', 'Executive Manager created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create Executive Manager');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title="Create Executive Manager">
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <PageSection title="Personal">
        <WebLabel>Full name *</WebLabel>
        <WebInput
          placeholder="Manager name"
          value={form.name}
          onChangeText={(v) => setField('name', v)}
        />
        <WebLabel>Department</WebLabel>
        <WebInput
          placeholder="Department"
          value={form.department}
          onChangeText={(v) => setField('department', v)}
        />
      </PageSection>
      <PageSection title="Contact">
        <WebLabel>Email *</WebLabel>
        <WebInput
          placeholder="email@company.com"
          value={form.email}
          onChangeText={(v) => setField('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <WebLabel>Phone</WebLabel>
        <WebInput
          placeholder="10 to 15 digits"
          value={form.phone}
          onChangeText={(v) => setField('phone', sanitizePhoneDigits(v))}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </PageSection>
      <PageSection title="Login">
        <WebLabel>Password</WebLabel>
        <WebInput
          placeholder="Password"
          value={form.password}
          onChangeText={(v) => setField('password', v)}
          secureTextEntry
        />
        <Text style={styles.help}>Leave empty to use the default: Password123</Text>
      </PageSection>
      <WebButton
        title={submitting ? 'Creating…' : 'Create Manager'}
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
      />
      <WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 13,
    color: colors.error,
    backgroundColor: colors.errorLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  help: { fontSize: 13, color: colors.textTertiary, marginTop: -8 },
});

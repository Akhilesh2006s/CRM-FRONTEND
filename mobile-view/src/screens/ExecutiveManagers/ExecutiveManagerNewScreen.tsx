import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
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
      <PageSection title="Manager details">
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <WebInput
          placeholder="Manager name *"
          value={form.name}
          onChangeText={(v) => setField('name', v)}
        />
        <WebInput
          placeholder="email@company.com *"
          value={form.email}
          onChangeText={(v) => setField('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <WebInput
          placeholder="Password (default: Password123)"
          value={form.password}
          onChangeText={(v) => setField('password', v)}
          secureTextEntry
        />
        <WebInput
          placeholder="10 to 15 digits"
          value={form.phone}
          onChangeText={(v) => setField('phone', sanitizePhoneDigits(v))}
          keyboardType="phone-pad"
          maxLength={15}
        />
        <WebInput
          placeholder="Department"
          value={form.department}
          onChangeText={(v) => setField('department', v)}
        />
        <View style={styles.actions}>
          <WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} />
          <WebButton
            title={submitting ? 'Creating…' : 'Create Manager'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
          />
        </View>
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.body.small,
    color: colors.error,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

import DateField from '../../ui/DateField';
export default function ExpenseEditScreen({ navigation, route }: any) {
  const { id } = route.params;
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: '',
    description: '',
    date: '',
    pendingMonth: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadExpense();
  }, [id]);

  const loadExpense = async () => {
    try {
      setLoading(true);
      const data = await apiService.get(`/expenses/${id}`);
      setForm({
        title: data.title || '',
        amount: data.amount ? data.amount.toString() : '',
        category: data.category || '',
        description: data.description || '',
        date: data.date ? new Date(data.date).toISOString().split('T')[0] : '',
        pendingMonth: data.pendingMonth || 'none',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load expense');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.amount.trim() || !form.category.trim() || !form.date.trim()) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.put(`/expenses/${id}`, {
        title: form.title,
        amount: parseFloat(form.amount),
        category: form.category,
        description: form.description || undefined,
        date: form.date,
        pendingMonth: form.pendingMonth && form.pendingMonth !== 'none' ? form.pendingMonth : undefined,
      });
      Alert.alert('Success', 'Expense updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update expense');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading expense...</Text>
      </View>
    );
  }

  return (
    <ScreenShell
      title="Edit Expense"
      loading={loading}
    >
<PageSection title="Expense">
        <FormField label="Title *" value={form.title} onChangeText={(text: string) => setForm((f) => ({ ...f, title: text }))} />
        <FormField
          label="Amount *"
          value={form.amount}
          onChangeText={(text: string) => setForm((f) => ({ ...f, amount: text }))}
          keyboardType="decimal-pad"
        />
        <FormField label="Category *" value={form.category} onChangeText={(text: string) => setForm((f) => ({ ...f, category: text }))} />
        <Text style={styles.label}>Date *</Text>
        <DateField placeholder="Date *" value={form.date} onChange={(text: string) => setForm((f) => ({ ...f, date: text }))} />
        <View style={{ height: 14 }} />
        <FormField
          label="Pending Month"
          value={form.pendingMonth}
          onChangeText={(text: string) => setForm((f) => ({ ...f, pendingMonth: text }))}
          placeholder="e.g. January"
        />
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Description</Text>
          <WebInput
            style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
            value={form.description}
            onChangeText={(text: string) => setForm((f) => ({ ...f, description: text }))}
            placeholder="Enter description" multiline
          />
        </View>
      </PageSection>
      <WebButton title={submitting ? 'Saving…' : 'Save Changes'} onPress={handleSubmit} loading={submitting} disabled={submitting} />
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder} keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textSecondary },
  fieldContainer: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 0,
  },
});

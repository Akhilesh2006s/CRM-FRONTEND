import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

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
<ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <FormField label="Title *" value={form.title} onChangeText={(text: string) => setForm((f) => ({ ...f, title: text }))} />
        <FormField
          label="Amount *"
          value={form.amount}
          onChangeText={(text: string) => setForm((f) => ({ ...f, amount: text }))}
          keyboardType="decimal-pad"
        />
        <FormField label="Category *" value={form.category} onChangeText={(text: string) => setForm((f) => ({ ...f, category: text }))} />
        <FormField label="Date *" value={form.date} onChangeText={(text: string) => setForm((f) => ({ ...f, date: text }))} placeholder="YYYY-MM-DD" />
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
        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
          </TouchableOpacity>
      </ScrollView>
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
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary },
  submitButton: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
});



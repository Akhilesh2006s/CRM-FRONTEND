import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

const roles = [
  'Executive', 'Trainer', 'Trainer Manager', 'Finance Manager', 'HR Manager', 'HR Executive', 'Coordinator', 'Senior Coordinator',
  'Manager', 'Executive Manager', 'Warehouse Executive', 'Warehouse Manager', 'Admin', 'Super Admin',
];

export default function EmployeeEditScreen({ navigation, route }: any) {
  const id = route.params?.id as string;
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    mobile: '',
    role: 'Executive',
    department: '',
    cluster: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const emp = await apiService.get<any>(`/employees/${id}`);
        setForm({
          name: emp.name || '',
          email: emp.email || '',
          phone: emp.phone && emp.phone !== '0' ? emp.phone : '',
          mobile: emp.mobile || emp.phone || '',
          role: emp.role || 'Executive',
          department: emp.department || '',
          cluster: emp.cluster || '',
        });
      } catch (e: any) {
        setErrorMessage(e.message || 'Failed to load employee');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!form.name?.trim() || !form.email?.trim() || !form.mobile?.trim()) {
      setErrorMessage('Name, email, and mobile are required');
      return;
    }
    if (form.role === 'Executive' && !form.cluster?.trim()) {
      setErrorMessage('Cluster is required for Executive role');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone || form.mobile,
        mobile: form.mobile,
        role: form.role,
        department: form.department || undefined,
        cluster: form.cluster || undefined,
      };
      if (form.role !== 'Executive') delete payload.cluster;
      await apiService.put(`/employees/${id}`, payload);
      navigation.navigate('EmployeesActive');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenShell title={`Edit ${form.role}`} loading>
        <View />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={`Edit ${form.role}`}>
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <FormField label="Name *" value={form.name} onChangeText={(t: string) => setForm((f) => ({ ...f, name: t }))} />
        <FormField label="Email *" value={form.email} onChangeText={(t: string) => setForm((f) => ({ ...f, email: t }))} keyboardType="email-address" />
        <FormField label="Mobile *" value={form.mobile} onChangeText={(t: string) => setForm((f) => ({ ...f, mobile: t }))} keyboardType="phone-pad" />
        <FormField label="Phone (optional)" value={form.phone} onChangeText={(t: string) => setForm((f) => ({ ...f, phone: t }))} keyboardType="phone-pad" />
        <WebSelect label="Role *" value={form.role} onValueChange={(role) => setForm((f) => ({ ...f, role }))} items={roles.map((role) => ({ label: role, value: role }))} />
        <FormField label="Department" value={form.department} onChangeText={(t: string) => setForm((f) => ({ ...f, department: t }))} />
        <FormField label="Cluster" value={form.cluster} onChangeText={(t: string) => setForm((f) => ({ ...f, cluster: t }))} />
        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.textLight} /> : <Text style={styles.submitText}>Save Changes</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={submitting}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, keyboardType }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary },
  submitButton: { marginTop: 16, backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.textLight, fontWeight: '600' },
  cancelButton: { marginTop: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundLight, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: colors.textPrimary, fontWeight: '600' },
  errorText: { color: colors.error, marginBottom: 12 },
});

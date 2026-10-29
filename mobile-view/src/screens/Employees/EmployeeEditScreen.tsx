import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import { bankDetailsError, bankDetailsFromEmployee, bankDetailsPayload, emptyBankDetails } from '../../utils/bankDetails';

const roles = [
  'Executive', 'Trainer', 'Finance Manager', 'Finance Executive', 'HR Manager', 'HR Executive', 'Coordinator', 'Senior Coordinator',
  'Manager', 'Executive Manager', 'Regional Manager', 'Regional Head', 'National Head', 'Warehouse Executive', 'Warehouse Manager', 'Admin', 'Super Admin',
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
    ...emptyBankDetails(),
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const emp = await apiService.get(`/employees/${id}`);
        setForm({
          name: emp.name || '',
          email: emp.email || '',
          phone: emp.phone && emp.phone !== '0' ? emp.phone : '',
          mobile: emp.mobile || emp.phone || '',
          role: emp.role || 'Executive',
          department: emp.department || '',
          cluster: emp.cluster || '',
          ...bankDetailsFromEmployee(emp),
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
    const mobileError = phoneDigitsError(form.mobile, true) || phoneDigitsError(form.phone, false);
    if (mobileError) {
      setErrorMessage(mobileError);
      return;
    }
    if (form.role === 'Executive' && !form.cluster?.trim()) {
      setErrorMessage('Cluster is required for Executive role');
      return;
    }
    const bankError = bankDetailsError(form);
    if (bankError) {
      setErrorMessage(bankError);
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
        ...bankDetailsPayload(form),
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
        <FormField label="Mobile *" value={form.mobile} onChangeText={(t: string) => setForm((f) => ({ ...f, mobile: sanitizePhoneDigits(t) }))} keyboardType="phone-pad" maxLength={15} placeholder="10 to 15 digits" />
        <FormField label="Phone (optional)" value={form.phone} onChangeText={(t: string) => setForm((f) => ({ ...f, phone: sanitizePhoneDigits(t) }))} keyboardType="phone-pad" maxLength={15} placeholder="10 to 15 digits" />
        <WebSelect label="Role *" value={form.role} onValueChange={(role) => setForm((f) => ({ ...f, role }))} items={roles.map((role) => ({ label: role, value: role }))} />
        <FormField label="Department" value={form.department} onChangeText={(t: string) => setForm((f) => ({ ...f, department: t }))} />
        <FormField label="Cluster" value={form.cluster} onChangeText={(t: string) => setForm((f) => ({ ...f, cluster: t }))} />
        <Text style={styles.sectionTitle}>Bank details (expenses and advances are paid here)</Text>
        <FormField label="Account holder name" value={form.bankAccountHolderName} onChangeText={(t: string) => setForm((f) => ({ ...f, bankAccountHolderName: t }))} placeholder="As in the bank account" />
        <FormField label="Bank account number" value={form.bankAccountNumber} onChangeText={(t: string) => setForm((f) => ({ ...f, bankAccountNumber: t.replace(/\D/g, '') }))} placeholder="6 to 20 digits" keyboardType="number-pad" maxLength={20} />
        <FormField label="IFSC" value={form.bankIfsc} onChangeText={(t: string) => setForm((f) => ({ ...f, bankIfsc: t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() }))} placeholder="e.g. SBIN0001234" maxLength={11} />
        <FormField label="Bank name" value={form.bankName} onChangeText={(t: string) => setForm((f) => ({ ...f, bankName: t }))} placeholder="e.g. State Bank of India" />
        <FormField label="Branch" value={form.bankBranch} onChangeText={(t: string) => setForm((f) => ({ ...f, bankBranch: t }))} placeholder="Branch name" />
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

function FormField({ label, value, onChangeText, keyboardType, maxLength, placeholder }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType} maxLength={maxLength} placeholder={placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  sectionTitle: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  input: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary },
  submitButton: { marginTop: 16, backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.textLight, fontWeight: '600' },
  cancelButton: { marginTop: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundLight, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: colors.textPrimary, fontWeight: '600' },
  errorText: { color: colors.error, marginBottom: 12 },
});

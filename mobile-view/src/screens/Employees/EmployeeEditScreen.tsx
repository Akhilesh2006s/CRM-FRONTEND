import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import EmployeeTaggingPicker, { supportsEmployeeTagging } from '../../components/EmployeeTaggingPicker';

const roles = [
  'Executive', 'Trainer', 'Finance Manager', 'Coordinator', 'Senior Coordinator',
  'Manager', 'Executive Manager', 'Warehouse Executive', 'Warehouse Manager', 'Admin', 'Super Admin',
];

export default function EmployeeEditScreen({ navigation, route }: any) {
  const id = route.params?.id as string;
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    phone: '',
    mobile: '',
    address1: '',
    state: '',
    zone: '',
    cluster: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Executive',
    taggedEmployeeIds: [] as string[],
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
        const parts = (emp.name || '').trim().split(/\s+/);
        setForm({
          firstName: emp.firstName || parts[0] || '',
          lastName: emp.lastName || parts.slice(1).join(' ') || '',
          empCode: emp.empCode || '',
          email: emp.email || '',
          phone: emp.phone && emp.phone !== '0' ? emp.phone : '',
          mobile: emp.mobile || emp.phone || '',
          address1: emp.address1 || '',
          state: emp.state || '',
          zone: emp.zone || '',
          cluster: emp.cluster || '',
          district: emp.district || '',
          city: emp.city || '',
          pincode: emp.pincode || '',
          role: emp.role || 'Executive',
          taggedEmployeeIds: (emp.taggedEmployeeIds || []).map((x: any) => String(x._id || x)),
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
    if (!form.firstName?.trim() || !form.email?.trim() || !form.mobile?.trim()) {
      setErrorMessage('First name, email, and mobile are required');
      return;
    }
    if (form.role === 'Executive' && !form.cluster?.trim()) {
      setErrorMessage('Cluster is required for Executive role');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        ...form,
        name: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone || form.mobile,
        mobile: form.mobile,
      };
      if (form.role !== 'Executive') delete payload.cluster;
      if (!supportsEmployeeTagging(form.role)) delete payload.taggedEmployeeIds;
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
        <FormField label="First Name *" value={form.firstName} onChangeText={(t: string) => setForm((f) => ({ ...f, firstName: t }))} />
        <FormField label="Last Name" value={form.lastName} onChangeText={(t: string) => setForm((f) => ({ ...f, lastName: t }))} />
        <FormField label="Emp ID / Code" value={form.empCode} onChangeText={(t: string) => setForm((f) => ({ ...f, empCode: t }))} />
        <FormField label="Email *" value={form.email} onChangeText={(t: string) => setForm((f) => ({ ...f, email: t }))} keyboardType="email-address" />
        <FormField label="Mobile *" value={form.mobile} onChangeText={(t: string) => setForm((f) => ({ ...f, mobile: t }))} keyboardType="phone-pad" />
        <FormField label="Phone" value={form.phone} onChangeText={(t: string) => setForm((f) => ({ ...f, phone: t }))} keyboardType="phone-pad" />
        <FormField label="Address" value={form.address1} onChangeText={(t: string) => setForm((f) => ({ ...f, address1: t }))} />
        <FormField label="Pincode" value={form.pincode} onChangeText={(t: string) => setForm((f) => ({ ...f, pincode: t }))} keyboardType="number-pad" />
        <FormField label="Zone *" value={form.zone} onChangeText={(t: string) => setForm((f) => ({ ...f, zone: t }))} />
        {form.role === 'Executive' && (
          <FormField label="Cluster *" value={form.cluster} onChangeText={(t: string) => setForm((f) => ({ ...f, cluster: t }))} />
        )}
        <FormField label="State *" value={form.state} onChangeText={(t: string) => setForm((f) => ({ ...f, state: t }))} />
        <FormField label="District" value={form.district} onChangeText={(t: string) => setForm((f) => ({ ...f, district: t }))} />
        <FormField label="City" value={form.city} onChangeText={(t: string) => setForm((f) => ({ ...f, city: t }))} />
        <Text style={styles.label}>Role *</Text>
        <View style={styles.roleContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.roleOption, form.role === role && styles.roleOptionSelected]}
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  role,
                  taggedEmployeeIds: supportsEmployeeTagging(role) ? f.taggedEmployeeIds : [],
                }))
              }
            >
              <Text style={[styles.roleOptionText, form.role === role && styles.roleOptionTextSelected]}>{role}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <EmployeeTaggingPicker
          role={form.role}
          selectedIds={form.taggedEmployeeIds}
          onChange={(taggedEmployeeIds) => setForm((f) => ({ ...f, taggedEmployeeIds }))}
          excludeId={id}
        />
        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.textLight} /> : <Text style={styles.submitText}>Save Changes</Text>}
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
  roleContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  roleOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  roleOptionSelected: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  roleOptionText: { ...typography.body.small, color: colors.textPrimary },
  roleOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  submitButton: { marginTop: 16, backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.textLight, fontWeight: '600' },
  errorText: { color: colors.error, marginBottom: 12 },
});

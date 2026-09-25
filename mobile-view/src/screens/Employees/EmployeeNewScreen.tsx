import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import EmployeeTaggingPicker, { supportsEmployeeTagging } from '../../components/EmployeeTaggingPicker';

export default function EmployeeNewScreen({ navigation }: any) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    password: '',
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
  const [submitting, setSubmitting] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({});
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const roles = [
    'Executive', 'Trainer', 'Trainer Manager', 'Finance Manager', 'HR Manager', 'HR Executive', 'Coordinator', 'Senior Coordinator',
    'Manager', 'Executive Manager', 'Warehouse Executive', 'Warehouse Manager', 'Admin', 'Super Admin',
  ];

  const scrollRef = useRef<ScrollView>(null);
  const clustersForZone = clustersByZone[form.zone] || [];

  useEffect(() => {
    const loadZonesAndClusters = async () => {
      try {
        const [pairsRaw, zonesRaw] = await Promise.all([
          apiService.get<{ zone?: string; cluster?: string }[]>('/zones-clusters').catch(() => []),
          apiService.get<{ name?: string }[]>('/zones').catch(() => []),
        ]);
        const pairs = Array.isArray(pairsRaw) ? pairsRaw : [];
        const zoneDocs = Array.isArray(zonesRaw) ? zonesRaw : [];

        const zoneMap: Record<string, string[]> = {};
        pairs.forEach((zc) => {
          const zone = (zc.zone || '').trim();
          if (!zone) return;
          if (!zoneMap[zone]) zoneMap[zone] = [];
          const cl = (zc.cluster || '').trim();
          if (cl && !zoneMap[zone].includes(cl)) zoneMap[zone].push(cl);
        });

        const zoneNamesFromApi = zoneDocs.map((z) => (z.name || '').trim()).filter(Boolean);
        const allZones = [...new Set([...Object.keys(zoneMap), ...zoneNamesFromApi])].sort((a, b) =>
          a.localeCompare(b),
        );

        setZones(allZones);
        setClustersByZone(zoneMap);
      } catch {
        setZones([]);
        setClustersByZone({});
      }
    };
    loadZonesAndClusters();
  }, []);

  const sanitizeDigits = (value: string, maxDigits = 10) =>
    String(value || '').replace(/\D/g, '').slice(0, maxDigits);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handlePhoneChange = (value: string) => {
    setForm((f) => ({ ...f, phone: sanitizeDigits(value, 10) }));
  };

  const handleMobileChange = (value: string) => {
    setForm((f) => ({ ...f, mobile: sanitizeDigits(value, 10) }));
  };

  const handlePincodeChange = async (value: string) => {
    const pincode = value.replace(/\D/g, '').slice(0, 6);
    setForm((current) => ({ ...current, pincode }));
    if (pincode.length !== 6) return;

    setLoadingPincode(true);
    try {
      const location = await apiService.get<any>(`/location/resolve?pincode=${pincode}`);
      setForm((current) => ({
        ...current,
        city: location.city || location.town || current.city,
        district: location.district || current.district,
        state: location.state || current.state,
        zone: location.zone || current.zone,
        cluster: location.cluster || (location.zone ? '' : current.cluster),
      }));
    } catch {
      // Keep the fields editable when this pincode has no configured mapping.
    } finally {
      setLoadingPincode(false);
    }
  };

  const handleSubmit = async () => {
    clearMessages();
    if (!form.firstName?.trim()) {
      setErrorMessage('First Name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.email?.trim()) {
      setErrorMessage('Email is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.mobile?.trim()) {
      setErrorMessage('Mobile is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      setErrorMessage('Enter a valid 10-digit mobile number.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    // Phone is optional, but if entered it must be exactly 10 digits
    if (form.phone.trim() && form.phone.length !== 10) {
      setErrorMessage('Phone must be a 10-digit number.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.password?.trim()) {
      setErrorMessage('Password is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const locationFields: Array<[string, string]> = [
      ['Pincode', form.pincode],
      ['State', form.state],
      ['Zone', form.zone],
      ['Cluster', form.cluster],
      ['District', form.district],
      ['City', form.city],
      ['User type', form.role],
    ];
    const missingLocationField = locationFields.find(([, value]) => !value?.trim());
    if (missingLocationField) {
      setErrorMessage(`${missingLocationField[0]} is required`);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.pincode.length !== 6) {
      setErrorMessage('Pincode must contain 6 digits');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        ...form,
        phone: form.phone.trim() || undefined,
        name: `${form.firstName} ${form.lastName}`.trim() || form.firstName || form.lastName || 'Executive',
      };
      if (!supportsEmployeeTagging(form.role)) {
        delete payload.taggedEmployeeIds;
      }
      await apiService.post('/employees/create', payload);
      setSuccessMessage('Employee created successfully.');
      setErrorMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Failed to create employee';
      setErrorMessage(msg);
      setSuccessMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="New Employee"
    >
<ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.viewEmployeesButton}
              onPress={() => navigation.navigate('EmployeesActive')}
            >
              <Text style={styles.viewEmployeesButtonText}>View Employees</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={clearMessages} style={styles.dismissError}>
              <Text style={styles.dismissErrorText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>Personal Data</Text>
        <FormField label="First Name *" value={form.firstName} onChangeText={(text: string) => setForm((f) => ({ ...f, firstName: text }))} placeholder="First Name" />
        <FormField label="Last Name" value={form.lastName} onChangeText={(text: string) => setForm((f) => ({ ...f, lastName: text }))} placeholder="Last Name" />
        <FormField label="Emp ID / Code" value={form.empCode} onChangeText={(text: string) => setForm((f) => ({ ...f, empCode: text }))} placeholder="Employee ID / Code" />
        <FormField label="Email Id *" value={form.email} onChangeText={(text: string) => setForm((f) => ({ ...f, email: text }))} placeholder="Email" keyboardType="email-address" />
        <FormField label="Phone" value={form.phone} onChangeText={handlePhoneChange} placeholder="10-digit phone (optional)" keyboardType="phone-pad" maxLength={10} />
        <FormField label="Mobile *" value={form.mobile} onChangeText={handleMobileChange} placeholder="10-digit mobile" keyboardType="phone-pad" maxLength={10} />
        <View style={styles.textAreaContainer}>
          <Text style={styles.label}>Address 1</Text>
          <WebInput style={styles.textArea} value={form.address1} onChangeText={(text: string) => setForm((f) => ({ ...f, address1: text }))} placeholder="Address 1" multiline numberOfLines={3} />
        </View>
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Location & User Type</Text>
        <FormField label="Pincode *" value={form.pincode} onChangeText={handlePincodeChange} placeholder="6-digit pincode" keyboardType="number-pad" />
        {loadingPincode ? <Text style={styles.lookupText}>Looking up location…</Text> : null}
        <FormField label="State *" value={form.state} onChangeText={(text: string) => setForm((f) => ({ ...f, state: text }))} placeholder="Enter Employee State" />
        <WebSelect
          label="Zone *"
          value={form.zone}
          onValueChange={(zone) => setForm((f) => ({ ...f, zone, cluster: '' }))}
          placeholder="Select Zone"
          items={zones.map((zone) => ({ label: zone, value: zone }))}
        />
        <WebSelect
          label="Cluster *"
          value={form.cluster}
          onValueChange={(cluster) => setForm((f) => ({ ...f, cluster }))}
          placeholder={
            !form.zone
              ? 'Select zone first'
              : clustersForZone.length === 0
                ? 'No clusters linked to this zone'
                : 'Select Employee Cluster'
          }
          disabled={!form.zone || clustersForZone.length === 0}
          items={clustersForZone.map((cluster) => ({ label: cluster, value: cluster }))}
        />
        {form.zone && clustersForZone.length === 0 ? (
          <Text style={styles.lookupText}>
            No clusters linked to this zone. Add links under Employees → Zones.
          </Text>
        ) : null}
        <FormField label="District *" value={form.district} onChangeText={(text: string) => setForm((f) => ({ ...f, district: text }))} placeholder="Enter Employee District" />
        <FormField label="City *" value={form.city} onChangeText={(text: string) => setForm((f) => ({ ...f, city: text }))} placeholder="City" />
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>User Type *</Text>
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
        </View>
        <EmployeeTaggingPicker
          role={form.role}
          selectedIds={form.taggedEmployeeIds}
          onChange={(taggedEmployeeIds) => setForm((f) => ({ ...f, taggedEmployeeIds }))}
        />
        <FormField label="Password *" value={form.password} onChangeText={(text: string) => setForm((f) => ({ ...f, password: text }))} placeholder="Password" secureTextEntry />
        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.textLight} />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, maxLength }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 16, marginTop: 8 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary },
  textAreaContainer: { marginBottom: 16 },
  textArea: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  roleContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border },
  roleOptionSelected: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  roleOptionText: { ...typography.body.medium, color: colors.textPrimary },
  roleOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  successIcon: { fontSize: 24, color: '#10B981', marginBottom: 8, fontWeight: 'bold' },
  successText: { ...typography.body.medium, color: '#065F46', fontWeight: '600', marginBottom: 12 },
  viewEmployeesButton: { alignSelf: 'flex-start', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  viewEmployeesButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorIcon: { fontSize: 24, color: '#EF4444', marginBottom: 8, fontWeight: 'bold' },
  errorText: { ...typography.body.medium, color: '#991B1B', marginBottom: 12 },
  dismissError: { alignSelf: 'flex-start' },
  dismissErrorText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },
  lookupText: { ...typography.body.small, color: colors.textSecondary, marginTop: -8, marginBottom: 12 },
  submitButton: { marginTop: 24, borderRadius: 12, backgroundColor: colors.primary, paddingVertical: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import EmployeeTaggingPicker, { supportsEmployeeTagging } from '../../components/EmployeeTaggingPicker';

/** User types, same values / labels as web app/dashboard/employees/new/page.tsx */
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Executive', label: 'BDE' },
  { value: 'Trainer', label: 'Trainer' },
  { value: 'Finance Manager', label: 'Finance Manager' },
  { value: 'HR Manager', label: 'HR Manager' },
  { value: 'HR Executive', label: 'HR Executive' },
  { value: 'Coordinator', label: 'Coordinator' },
  { value: 'Senior Coordinator', label: 'Senior Coordinator' },
  { value: 'Manager', label: 'Product Manager' },
  { value: 'Executive Manager', label: 'Zonal Manager' },
  { value: 'Regional Manager', label: 'Regional Manager' },
  { value: 'Regional Head', label: 'Regional Head' },
  { value: 'National Head', label: 'National Head' },
  { value: 'Warehouse Executive', label: 'Warehouse Executive' },
  { value: 'Warehouse Manager', label: 'Warehouse Manager' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Office Team', label: 'Office Team' },
  { value: 'Super Admin', label: 'Super Admin' },
];

const ONBOARDING_ITEMS = [
  'App Training',
  'Account Session',
  'Product Training',
  'Visiting cards',
  'Id cards',
  'Sim',
  'Training Manuals',
  'Marketing Kit (BDE)',
  'Laptop',
  'Others',
];

const REFERENCE_RELATIONS = ['Wife', 'Husband', 'Brother', 'Sister', 'Father', 'Mother'];

const MULTI_ZONE_ROLES = ['Executive Manager', 'Trainer', 'Coordinator', 'Senior Coordinator'];
const isSingleZoneRole = (role: string) => ['Executive', 'Sales BDE', 'Employee', 'BDE'].includes(role);
const roleUsesZones = (role: string) => isSingleZoneRole(role) || MULTI_ZONE_ROLES.includes(role);
const roleRequiresZones = (role: string) => isSingleZoneRole(role) || ['Trainer', 'Coordinator', 'Senior Coordinator'].includes(role);

type Reference = { relation: string; name: string; mobile: string; aadhaarUrl: string };
type Product = { _id: string; productName: string };
type EmployeeOption = { _id: string; name: string; role: string; assignedProductIds?: Array<string | { _id?: string }> };
type UploadKind = 'aadhaar' | 'location' | 'passport' | 'reference-aadhaar';

const todayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

export default function EmployeeNewScreen({ navigation }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    password: '',
    phone: '',
    mobile: '',
    permanentAddress: '',
    temporaryAddress: '',
    state: '',
    zone: '',
    zones: [] as string[],
    cluster: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Executive',
    designation: '',
    taggedEmployeeIds: [] as string[],
    dateOfBirth: '',
    dateOfJoining: '',
    yearlySalary: '',
    monthlyTakeHome: '',
    hasEmployeeRelationship: null as boolean | null,
    employeeRelationshipDetails: { fullName: '', relationship: '', department: '', designation: '' },
    references: [
      { relation: '', name: '', mobile: '', aadhaarUrl: '' },
      { relation: '', name: '', mobile: '', aadhaarUrl: '' },
    ] as Reference[],
    aadhaarUrl: '',
    locationPhotoUrl: '',
    passportPhotoUrl: '',
    onboardingChecklist: [] as string[],
    onboardingOtherNote: '',
    trainerProducts: [] as string[],
    verticalManagerId: '',
  });
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({});
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const clustersForZone = clustersByZone[form.zone] || [];
  const singleZone = isSingleZoneRole(form.role);
  const usesZones = roleUsesZones(form.role);

  useEffect(() => {
    const loadZonesAndClusters = async () => {
      try {
        const [pairsRaw, zonesRaw] = await Promise.all([
          apiService.get('/zones-clusters').catch(() => []),
          apiService.get('/zones').catch(() => []),
        ]);
        const pairs: { zone?: string; cluster?: string }[] = Array.isArray(pairsRaw) ? pairsRaw : [];
        const zoneDocs: { name?: string }[] = Array.isArray(zonesRaw) ? zonesRaw : [];
        const zoneMap: Record<string, string[]> = {};
        pairs.forEach((zc) => {
          const zone = (zc.zone || '').trim();
          if (!zone) return;
          if (!zoneMap[zone]) zoneMap[zone] = [];
          const cl = (zc.cluster || '').trim();
          if (cl && !zoneMap[zone].includes(cl)) zoneMap[zone].push(cl);
        });
        const zoneNamesFromApi = zoneDocs.map((z) => (z.name || '').trim()).filter(Boolean);
        setZones([...new Set([...Object.keys(zoneMap), ...zoneNamesFromApi])].sort((a, b) => a.localeCompare(b)));
        setClustersByZone(zoneMap);
      } catch {
        setZones([]);
        setClustersByZone({});
      }
    };
    loadZonesAndClusters();
    apiService
      .get('/products/active')
      .then((d: any) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]));
    apiService
      .get('/employees?isActive=true')
      .then((d: any) => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => setEmployees([]));
  }, []);

  // Trainer: Product Heads (role Manager) that own every selected product.
  const eligibleProductHeads = useMemo(() => {
    const heads = employees.filter((e) => e.role === 'Manager');
    const selectedIds = products.filter((p) => form.trainerProducts.includes(p.productName)).map((p) => p._id);
    if (!selectedIds.length) return heads;
    return heads.filter((head) => {
      const assigned = new Set(
        (head.assignedProductIds || []).map((v) => (typeof v === 'string' ? v : String(v?._id || '')))
      );
      return selectedIds.every((id) => assigned.has(id));
    });
  }, [employees, products, form.trainerProducts]);

  const sanitizeDigits = (value: string, maxDigits = 15) => String(value || '').replace(/\D/g, '').slice(0, maxDigits);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const fail = (msg: string) => {
    setErrorMessage(msg);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handlePincodeChange = async (value: string) => {
    const pincode = value.replace(/\D/g, '').slice(0, 6);
    setForm((current) => ({ ...current, pincode }));
    if (pincode.length !== 6) return;
    setLoadingPincode(true);
    try {
      const location: any = await apiService.get(`/location/resolve?pincode=${pincode}`);
      setForm((current) => {
        const zone = location.zone || current.zone;
        return {
          ...current,
          city: location.city || location.town || current.city,
          district: location.district || current.district,
          state: location.state || current.state,
          zone,
          zones: !roleUsesZones(current.role)
            ? current.zones
            : isSingleZoneRole(current.role)
              ? zone
                ? [zone]
                : []
              : zone && !current.zones.includes(zone)
                ? [...current.zones, zone]
                : current.zones,
          cluster: location.cluster || (location.zone ? '' : current.cluster),
        };
      });
    } catch {
      // Keep the fields editable when this pincode has no configured mapping.
    } finally {
      setLoadingPincode(false);
    }
  };

  const setReference = (idx: number, patch: Partial<Reference>) =>
    setForm((f) => {
      const references = [...f.references];
      references[idx] = { ...references[idx], ...patch };
      return { ...f, references };
    });

  const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  /** Pick a PDF and POST it to /employees/upload (fields `file` + `kind`), returning the stored URL. */
  const uploadPdf = async (kind: UploadKind, key: string, onUrl: (url: string) => void) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = asset.name || 'document.pdf';
      if (asset.mimeType && asset.mimeType !== 'application/pdf' && !name.toLowerCase().endsWith('.pdf')) {
        fail('Only PDF files are allowed.');
        return;
      }
      setUploading(key);
      setErrorMessage(null);
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const blob = (asset as any).file || (await fetch(asset.uri).then((r) => r.blob()));
        fd.append('file', blob, name);
      } else {
        fd.append('file', { uri: asset.uri, name, type: 'application/pdf' } as any);
      }
      fd.append('kind', kind);
      const data = await apiService.upload('/employees/upload', fd);
      if (!data?.url) throw new Error('Upload failed');
      onUrl(data.url);
    } catch (e: any) {
      fail(e?.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    clearMessages();
    const temporaryAddress = sameAsPermanent ? form.permanentAddress : form.temporaryAddress;
    if (!form.firstName?.trim()) return fail('First Name is required');
    if (!form.email?.trim()) return fail('Email is required');
    if (!form.mobile.trim()) return fail('Employee mobile number is required.');
    if (!/^\d{10,15}$/.test(form.mobile)) return fail('Enter a mobile number with 10 to 15 digits.');
    if (!form.phone.trim()) return fail('Company contact number is required.');
    if (!/^\d{10,15}$/.test(form.phone)) return fail('Company contact number must be 10 to 15 digits.');
    if (form.phone === form.mobile) return fail('Official contact number and personal mobile number cannot be the same.');
    if (form.hasEmployeeRelationship === null) return fail('Select Yes or No for the employee relationship declaration');
    if (form.hasEmployeeRelationship) {
      const r = form.employeeRelationshipDetails;
      if (!r.fullName.trim() || !r.relationship.trim() || !r.department.trim() || !r.designation.trim()) {
        return fail('Enter the full name, relationship, department, and designation of the employee connection');
      }
    }
    if (!form.dateOfBirth) return fail('Date of birth is required');
    if (!isIsoDate(form.dateOfBirth)) return fail('Date of birth must be in YYYY-MM-DD format');
    if (form.dateOfBirth > todayDate()) return fail('Date of birth cannot be a future date');
    if (!form.dateOfJoining) return fail('Date of joining is required');
    if (!isIsoDate(form.dateOfJoining)) return fail('Date of joining must be in YYYY-MM-DD format');
    if (form.dateOfJoining > todayDate()) return fail('Date of joining cannot be a future date');
    const ctc = Number(form.yearlySalary);
    if (!(ctc > 0)) return fail('CTC (per year) is required');
    const takeHome = form.monthlyTakeHome.trim() === '' ? 0 : Number(form.monthlyTakeHome);
    if (!Number.isFinite(takeHome) || takeHome < 0) return fail('Monthly take-home must be a valid amount');
    if (!form.passportPhotoUrl.trim()) return fail('Passport size photo PDF is required');
    if (form.role === 'Office Team' && !form.designation.trim()) return fail('Enter the designation');

    const selectedZones = !usesZones
      ? []
      : singleZone
        ? form.zone.trim()
          ? [form.zone.trim()]
          : []
        : form.zones.map((z) => z.trim()).filter(Boolean);
    if (roleRequiresZones(form.role) && selectedZones.length === 0) {
      return fail(singleZone ? 'Zone is required for BDE' : 'Select at least one zone');
    }
    if (singleZone && !form.cluster?.trim()) return fail('Cluster is required for BDE role');

    for (let i = 0; i < 2; i++) {
      const ref = form.references[i];
      if (!REFERENCE_RELATIONS.includes(ref.relation)) {
        return fail(`Reference ${i + 1}: select relationship (Wife, Husband, Brother, Sister, Father, or Mother)`);
      }
      if (!ref.name.trim()) return fail(`Reference ${i + 1}: name is required`);
      if (!/^\d{10,15}$/.test(ref.mobile)) return fail(`Reference ${i + 1}: enter a mobile number with 10 to 15 digits`);
      if (!ref.aadhaarUrl.trim()) return fail(`Reference ${i + 1}: Aadhaar PDF is required`);
    }
    if (form.references[0].mobile === form.references[1].mobile) {
      return fail('Reference 1 and Reference 2 cannot have the same mobile number');
    }
    if (!form.permanentAddress.trim()) return fail('Permanent address is required');
    if (!temporaryAddress.trim()) return fail('Temporary address is required');
    if (!form.aadhaarUrl.trim()) return fail('Aadhaar upload is required');
    if (!form.locationPhotoUrl.trim()) return fail('Location upload is required');
    if (form.role === 'Manager' && !productId) return fail('Select the product for this Product Manager');
    if (form.role === 'Trainer') {
      if (!form.trainerProducts.length) return fail('Select at least one product for this Trainer');
      if (!form.verticalManagerId) return fail('Select the Product Head for this Trainer');
    }
    if (form.onboardingChecklist.length < 2) return fail('Select at least two onboarding checklist items');
    if (!form.pincode || form.pincode.length !== 6) return fail('Pincode must contain 6 digits');

    setSubmitting(true);
    try {
      const payload: any = {
        ...form,
        temporaryAddress,
        address1: temporaryAddress,
        zone: selectedZones[0] || '',
        zones: selectedZones,
        name: `${form.firstName} ${form.lastName}`.trim() || form.firstName || 'Executive',
        yearlySalary: ctc,
        monthlyTakeHome: takeHome,
        password: form.password.trim() || undefined,
        empCode: form.empCode.trim() || undefined,
      };
      if (form.role !== 'Executive') delete payload.cluster;
      if (!supportsEmployeeTagging(form.role)) delete payload.taggedEmployeeIds;
      if (form.role === 'Manager') payload.assignedProductIds = [productId];
      if (form.role !== 'Trainer') {
        delete payload.trainerProducts;
        delete payload.verticalManagerId;
      }
      await apiService.post('/employees/create', payload);
      const role = user?.role;
      setSuccessMessage(
        role === 'Super Admin'
          ? 'Employee added.'
          : role === 'HR Executive' || role === 'HR Manager'
            ? 'Employee saved. Their Vertical Head will complete background verification before HR final approval.'
            : 'Employee saved. The Vertical Head must approve before HR final approval.'
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      fail(error.response?.data?.message || error.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const UploadRow = ({ label, url, kind, uploadKey, onUrl }: { label: string; url: string; kind: UploadKind; uploadKey: string; onUrl: (u: string) => void }) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.uploadButton} onPress={() => uploadPdf(kind, uploadKey, onUrl)} disabled={!!uploading}>
        <Text style={styles.uploadButtonText} numberOfLines={1}>
          {uploading === uploadKey ? 'Uploading…' : url ? `Uploaded: ${url.split('/').pop()}` : 'Choose PDF'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const Check = ({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.checkRow} onPress={onPress}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? colors.primary : colors.textMuted} />
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenShell title="New Employee" noScroll>
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.viewEmployeesButton}
              onPress={() => navigation.navigate(user?.role === 'Super Admin' ? 'EmployeesActive' : 'EmployeeVerification')}
            >
              <Text style={styles.viewEmployeesButtonText}>
                {user?.role === 'Super Admin' ? 'View Employees' : 'View Verification Queue'}
              </Text>
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
        <FormField label="First Name *" value={form.firstName} onChangeText={(t: string) => setForm((f) => ({ ...f, firstName: t }))} placeholder="First Name" />
        <FormField label="Last Name" value={form.lastName} onChangeText={(t: string) => setForm((f) => ({ ...f, lastName: t }))} placeholder="Last Name" />
        <FormField label="Emp ID / Code" value={form.empCode} onChangeText={(t: string) => setForm((f) => ({ ...f, empCode: t }))} placeholder="Auto-assigned if left blank" />
        <FormField label="Email Id *" value={form.email} onChangeText={(t: string) => setForm((f) => ({ ...f, email: t }))} placeholder="Email" keyboardType="email-address" />
        <FormField label="Company contact number *" value={form.phone} onChangeText={(v: string) => setForm((f) => ({ ...f, phone: sanitizeDigits(v) }))} placeholder="10 to 15 digits" keyboardType="phone-pad" maxLength={15} />
        <FormField label="Personal mobile *" value={form.mobile} onChangeText={(v: string) => setForm((f) => ({ ...f, mobile: sanitizeDigits(v) }))} placeholder="10 to 15 digits" keyboardType="phone-pad" maxLength={15} />
        <FormField label="Date of birth * (YYYY-MM-DD)" value={form.dateOfBirth} onChangeText={(t: string) => setForm((f) => ({ ...f, dateOfBirth: t.trim() }))} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
        <FormField label="Date of joining * (YYYY-MM-DD)" value={form.dateOfJoining} onChangeText={(t: string) => setForm((f) => ({ ...f, dateOfJoining: t.trim() }))} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
        <FormField label="CTC (₹ per year) *" value={form.yearlySalary} onChangeText={(t: string) => setForm((f) => ({ ...f, yearlySalary: t.replace(/[^\d.]/g, '') }))} placeholder="e.g. 300000" keyboardType="decimal-pad" />
        {Number(form.yearlySalary) > 0 ? (
          <Text style={styles.lookupText}>₹{Math.round(Number(form.yearlySalary) / 12).toLocaleString('en-IN')} per month</Text>
        ) : null}
        <FormField label="Monthly take-home (₹)" value={form.monthlyTakeHome} onChangeText={(t: string) => setForm((f) => ({ ...f, monthlyTakeHome: t.replace(/[^\d.]/g, '') }))} placeholder="Optional" keyboardType="decimal-pad" />

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Is any relative / friend working in the company? *</Text>
          <View style={styles.roleContainer}>
            {[
              { label: 'Yes', value: true },
              { label: 'No', value: false },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.roleOption, form.hasEmployeeRelationship === opt.value && styles.roleOptionSelected]}
                onPress={() =>
                  setForm((f) => ({
                    ...f,
                    hasEmployeeRelationship: opt.value,
                    ...(opt.value ? {} : { employeeRelationshipDetails: { fullName: '', relationship: '', department: '', designation: '' } }),
                  }))
                }
              >
                <Text style={[styles.roleOptionText, form.hasEmployeeRelationship === opt.value && styles.roleOptionTextSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {form.hasEmployeeRelationship ? (
          <>
            {(['fullName', 'relationship', 'department', 'designation'] as const).map((key) => (
              <FormField
                key={key}
                label={`${{ fullName: 'Full name', relationship: 'Relationship', department: 'Department', designation: 'Designation' }[key]} *`}
                value={form.employeeRelationshipDetails[key]}
                onChangeText={(t: string) =>
                  setForm((f) => ({ ...f, employeeRelationshipDetails: { ...f.employeeRelationshipDetails, [key]: t } }))
                }
              />
            ))}
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Address & KYC</Text>
        <View style={styles.textAreaContainer}>
          <Text style={styles.label}>Permanent address *</Text>
          <WebInput
            style={styles.textArea}
            value={form.permanentAddress}
            onChangeText={(t: string) => setForm((f) => ({ ...f, permanentAddress: t }))}
            placeholder="Permanent address"
            multiline
            numberOfLines={3}
          />
        </View>
        <Check checked={sameAsPermanent} label="Temporary address same as permanent" onPress={() => setSameAsPermanent((v) => !v)} />
        <View style={styles.textAreaContainer}>
          <Text style={styles.label}>Temporary address *</Text>
          <WebInput
            style={styles.textArea}
            value={sameAsPermanent ? form.permanentAddress : form.temporaryAddress}
            editable={!sameAsPermanent}
            onChangeText={(t: string) => setForm((f) => ({ ...f, temporaryAddress: t }))}
            placeholder="Temporary address"
            multiline
            numberOfLines={3}
          />
        </View>
        <UploadRow label="Aadhaar upload * (PDF)" url={form.aadhaarUrl} kind="aadhaar" uploadKey="aadhaar" onUrl={(u) => setForm((f) => ({ ...f, aadhaarUrl: u }))} />
        <UploadRow label="Location upload * (PDF)" url={form.locationPhotoUrl} kind="location" uploadKey="location" onUrl={(u) => setForm((f) => ({ ...f, locationPhotoUrl: u }))} />
        <UploadRow label="Passport size photo * (PDF)" url={form.passportPhotoUrl} kind="passport" uploadKey="passport" onUrl={(u) => setForm((f) => ({ ...f, passportPhotoUrl: u }))} />

        {[0, 1].map((idx) => (
          <View key={idx} style={styles.refCard}>
            <Text style={styles.refTitle}>Reference {idx + 1}</Text>
            <WebSelect
              label="Relationship *"
              value={form.references[idx].relation}
              placeholder="Select relationship"
              onValueChange={(v) => setReference(idx, { relation: v })}
              items={REFERENCE_RELATIONS.map((r) => ({ label: r, value: r }))}
            />
            <FormField label="Name *" value={form.references[idx].name} onChangeText={(t: string) => setReference(idx, { name: t })} />
            <FormField label="Mobile *" value={form.references[idx].mobile} onChangeText={(t: string) => setReference(idx, { mobile: sanitizeDigits(t) })} keyboardType="phone-pad" maxLength={15} />
            <UploadRow
              label="Aadhaar upload * (PDF)"
              url={form.references[idx].aadhaarUrl}
              kind="reference-aadhaar"
              uploadKey={`ref-${idx}`}
              onUrl={(u) => setReference(idx, { aadhaarUrl: u })}
            />
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Location & User Type</Text>
        <FormField label="Pincode *" value={form.pincode} onChangeText={handlePincodeChange} placeholder="6-digit pincode" keyboardType="number-pad" />
        {loadingPincode ? <Text style={styles.lookupText}>Looking up location…</Text> : null}
        <FormField label="State" value={form.state} onChangeText={(t: string) => setForm((f) => ({ ...f, state: t }))} placeholder="Employee State" />
        <FormField label="District" value={form.district} onChangeText={(t: string) => setForm((f) => ({ ...f, district: t }))} placeholder="Employee District" />
        <FormField label="City" value={form.city} onChangeText={(t: string) => setForm((f) => ({ ...f, city: t }))} placeholder="City" />

        <WebSelect
          label="User Type *"
          value={form.role}
          onValueChange={(role) => {
            if (!role) return;
            if (role !== 'Manager') setProductId('');
            setForm((f) => {
              const single = isSingleZoneRole(role);
              const nextZones = !roleUsesZones(role) ? [] : single ? (f.zone ? [f.zone] : []) : f.zones;
              return {
                ...f,
                role,
                zones: nextZones,
                zone: roleUsesZones(role) ? nextZones[0] || '' : '',
                cluster: single ? f.cluster : '',
                trainerProducts: role === 'Trainer' ? f.trainerProducts : [],
                verticalManagerId: role === 'Trainer' ? f.verticalManagerId : '',
                taggedEmployeeIds: supportsEmployeeTagging(role) ? f.taggedEmployeeIds : [],
              };
            });
          }}
          items={ROLE_OPTIONS}
        />
        {form.role === 'Office Team' ? (
          <FormField label="Designation *" value={form.designation} onChangeText={(t: string) => setForm((f) => ({ ...f, designation: t }))} placeholder="Enter designation" />
        ) : null}

        {!usesZones ? null : singleZone ? (
          <>
            <WebSelect
              label="BDE Zone *"
              value={form.zone}
              onValueChange={(zone) => setForm((f) => ({ ...f, zone, zones: zone ? [zone] : [], cluster: '' }))}
              placeholder="Select Zone"
              items={zones.map((zone) => ({ label: zone, value: zone }))}
            />
            <WebSelect
              label="Cluster *"
              value={form.cluster}
              onValueChange={(cluster) => setForm((f) => ({ ...f, cluster }))}
              placeholder={!form.zone ? 'Select zone first' : clustersForZone.length === 0 ? 'No clusters linked to this zone' : 'Select Employee Cluster'}
              disabled={!form.zone || clustersForZone.length === 0}
              items={clustersForZone.map((cluster) => ({ label: cluster, value: cluster }))}
            />
          </>
        ) : (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>{form.role === 'Executive Manager' ? 'Zones (optional)' : 'Zones *'}</Text>
            <View style={styles.listBox}>
              {zones.length === 0 ? <Text style={styles.lookupText}>No zones configured.</Text> : null}
              {zones.map((z) => (
                <Check
                  key={z}
                  checked={form.zones.includes(z)}
                  label={z}
                  onPress={() =>
                    setForm((f) => {
                      const next = toggleIn(f.zones, z);
                      return { ...f, zones: next, zone: next[0] || '' };
                    })
                  }
                />
              ))}
            </View>
          </View>
        )}

        {form.role === 'Manager' ? (
          <WebSelect
            label="Product *"
            value={productId}
            onValueChange={setProductId}
            placeholder="Select product"
            items={products.map((p) => ({ label: p.productName, value: p._id }))}
          />
        ) : null}

        {form.role === 'Trainer' ? (
          <>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Trainer products *</Text>
              <View style={styles.listBox}>
                {products.map((p) => (
                  <Check
                    key={p._id}
                    checked={form.trainerProducts.includes(p.productName)}
                    label={p.productName}
                    onPress={() => setForm((f) => ({ ...f, trainerProducts: toggleIn(f.trainerProducts, p.productName), verticalManagerId: '' }))}
                  />
                ))}
              </View>
            </View>
            <WebSelect
              label="Product Head *"
              value={form.verticalManagerId}
              onValueChange={(v) => setForm((f) => ({ ...f, verticalManagerId: v }))}
              placeholder={eligibleProductHeads.length ? 'Select Product Head' : 'No Product Head owns all selected products'}
              items={eligibleProductHeads.map((h) => ({ label: h.name, value: h._id }))}
            />
          </>
        ) : null}

        <EmployeeTaggingPicker
          role={form.role}
          selectedIds={form.taggedEmployeeIds}
          onChange={(taggedEmployeeIds) => setForm((f) => ({ ...f, taggedEmployeeIds }))}
        />

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Onboarding checklist * (select at least two)</Text>
          <View style={styles.listBox}>
            {ONBOARDING_ITEMS.map((item) => (
              <Check
                key={item}
                checked={form.onboardingChecklist.includes(item)}
                label={item}
                onPress={() => setForm((f) => ({ ...f, onboardingChecklist: toggleIn(f.onboardingChecklist, item) }))}
              />
            ))}
          </View>
        </View>
        {form.onboardingChecklist.includes('Others') ? (
          <FormField label="Other onboarding note" value={form.onboardingOtherNote} onChangeText={(t: string) => setForm((f) => ({ ...f, onboardingOtherNote: t }))} />
        ) : null}

        <FormField label="Password" value={form.password} onChangeText={(t: string) => setForm((f) => ({ ...f, password: t }))} placeholder="Default password if left blank" secureTextEntry />
        <TouchableOpacity style={[styles.submitButton, (submitting || !!uploading) && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting || !!uploading}>
          {submitting ? <ActivityIndicator color={colors.textLight} /> : <Text style={styles.submitButtonText}>Submit</Text>}
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
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 16, marginTop: 8 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary, marginBottom: 0 },
  textAreaContainer: { marginBottom: 16 },
  textArea: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top', marginBottom: 0 },
  roleContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border },
  roleOptionSelected: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  roleOptionText: { ...typography.body.medium, color: colors.textPrimary },
  roleOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  uploadButton: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundLight, alignItems: 'center' },
  uploadButtonText: { ...typography.body.medium, color: colors.primary },
  refCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: colors.backgroundMuted },
  refTitle: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  listBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, backgroundColor: colors.backgroundLight },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  checkLabel: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  successBanner: { backgroundColor: '#D1FAE5', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#10B981' },
  successIcon: { fontSize: 24, color: '#10B981', marginBottom: 8, fontWeight: 'bold' },
  successText: { ...typography.body.medium, color: '#065F46', fontWeight: '600', marginBottom: 12 },
  viewEmployeesButton: { alignSelf: 'flex-start', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  viewEmployeesButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#EF4444' },
  errorIcon: { fontSize: 24, color: '#EF4444', marginBottom: 8, fontWeight: 'bold' },
  errorText: { ...typography.body.medium, color: '#991B1B', marginBottom: 12 },
  dismissError: { alignSelf: 'flex-start' },
  dismissErrorText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },
  lookupText: { ...typography.body.small, color: colors.textSecondary, marginTop: -8, marginBottom: 12 },
  submitButton: { marginTop: 24, borderRadius: 12, backgroundColor: colors.primary, paddingVertical: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
});

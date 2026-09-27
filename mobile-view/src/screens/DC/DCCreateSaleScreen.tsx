/**
 * Clients & DC → Create Sale. Matches web `/dashboard/dc/create`.
 * Separate from DCCreate (Raise DC) so leftover dealId params cannot hide this form.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { navigateRoot } from '../../navigation/navigationRef';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const SCHOOL_TYPES = ['New', 'Existing'].map((t) => ({
  label: t,
  value: t,
}));
const DEAL_STATUS_OPTIONS = [
  { label: 'Saved', value: 'saved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
];
const SCHOOL_CODE_ALLOWED = /^[A-Za-z0-9_-]+$/;

type SaleProduct = {
  name: string;
  checked: boolean;
  price: number;
  quantity: number;
  strength: number;
};

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value?: string) {
  if (!value) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function DateField({
  label,
  value,
  onChange,
  showPicker,
  setShowPicker,
  minimumDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  minimumDate?: Date;
}) {
  const minYmd = minimumDate ? toYmd(minimumDate) : undefined;
  const pickerValue = (() => {
    const parsed = parseYmd(value);
    if (minimumDate && parsed < minimumDate) return minimumDate;
    return parsed;
  })();

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement('input', {
          type: 'date',
          value: value || '',
          min: minYmd,
          onChange: (e: any) => {
            const next = e.target.value || '';
            if (minYmd && next && next < minYmd) return;
            onChange(next);
          },
          style: {
            width: '100%',
            padding: 12,
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            fontSize: 16,
            backgroundColor: '#fff',
            color: '#1E293B',
            boxSizing: 'border-box',
          },
        })}
      </View>
    );
  }

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
        <Text style={[styles.dateText, !value && styles.placeholderText]}>
          {value || 'Tap to pick date'}
        </Text>
        <Text>📅</Text>
      </TouchableOpacity>
      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={(event, d) => {
            setShowPicker(false);
            if (event.type === 'set' && d) onChange(toYmd(d));
          }}
        />
      ) : null}
      {showPicker && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity
            style={styles.datePickerOverlay}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          />
          <View style={styles.datePickerBox}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              onChange={(_, d) => {
                if (d) onChange(toYmd(d));
              }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function validateSchoolCode(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = String(raw || '').trim();
  if (!value) return { ok: false, message: 'School Code is required' };
  if (!SCHOOL_CODE_ALLOWED.test(value)) {
    return { ok: false, message: 'School code contains invalid characters.' };
  }
  return { ok: true, value };
}

export default function DCCreateSaleScreen({ navigation }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    school_type: '',
    school_name: '',
    school_code: '',
    contact_person: '',
    contact_mobile: '',
    email: '',
    contact_person2: '',
    contact_mobile2: '',
    location: '',
    address: '',
    pincode: '',
    state: '',
    city: '',
    region: '',
    area: '',
    lead_status: 'pending',
    zone: '',
    cluster: '',
    branches: '',
    strength: '',
    average_fee: '',
    remarks: '',
    follow_up_date: '',
    assigned_to: '',
  });
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [areas, setAreas] = useState<{ name: string; district?: string; block?: string; branchType?: string }[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSchoolCode, setCheckingSchoolCode] = useState(false);
  const [schoolCodeError, setSchoolCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);

  const setField = (name: string, value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (name === 'school_code' && schoolCodeError) setSchoolCodeError(null);
  };

  const handlePincodeChange = async (pincode: string) => {
    const cleanPincode = pincode.replace(/\D/g, '').slice(0, 6);
    setForm((f) => ({
      ...f,
      pincode: cleanPincode,
      area: cleanPincode.length < 6 ? '' : f.area,
    }));
    setPincodeError(null);

    if (cleanPincode.length === 6) {
      setLoadingPincode(true);
      try {
        const response = await apiService.get<any>(`/location/get-town?pincode=${cleanPincode}`);
        if (response?.success && response.town) {
          setForm((f) => ({
            ...f,
            city: response.district || '',
            state: response.state || '',
            region: response.region || response.town || '',
            location: f.location || response.town || '',
            area: '',
          }));
          if (Array.isArray(response.postOffices) && response.postOffices.length > 0) {
            setAreas(
              response.postOffices
                .map((po: any) => ({
                  name: String(po.Name || po.name || '').trim(),
                  district: po.District || po.district || '',
                  block: po.Block || po.block,
                  branchType: po.BranchType || po.branchType,
                }))
                .filter((a: { name: string }) => a.name),
            );
          } else {
            setAreas([{ name: response.town, district: response.district || '' }]);
          }
        } else {
          setAreas([]);
          setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }));
          setPincodeError(response?.message || 'Could not find this pincode. Enter location manually.');
        }
      } catch (err: any) {
        setAreas([]);
        setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }));
        setPincodeError(err?.message || 'Pincode lookup failed. Enter location manually.');
      } finally {
        setLoadingPincode(false);
      }
    } else {
      setAreas([]);
      setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }));
    }
  };

  const checkSchoolCodeUnique = async (rawCode: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    const format = validateSchoolCode(rawCode);
    if (!format.ok) {
      setSchoolCodeError(format.message);
      return { ok: false, message: format.message };
    }
    const code = format.value;
    setCheckingSchoolCode(true);
    try {
      const schools = await apiService.get('/schools');
      const list = Array.isArray(schools) ? schools : (schools as any)?.data || [];
      const exists = list.some(
        (s: any) =>
          String(s.schoolCode || s.school_code || '')
            .trim()
            .toLowerCase() === code.toLowerCase(),
      );
      if (exists) {
        const message = 'School Code already exists. Please enter a unique School Code.';
        setSchoolCodeError(message);
        return { ok: false, message };
      }
      setSchoolCodeError(null);
      return { ok: true };
    } catch {
      // Backend create still enforces uniqueness
      setSchoolCodeError(null);
      return { ok: true };
    } finally {
      setCheckingSchoolCode(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/products/active').catch(() => apiService.get('/products'));
        const list = Array.isArray(data) ? data : data?.data || data?.products || [];
        const names = list
          .map((p: any) => p.productName || p.name || p.product)
          .filter(Boolean);
        setProducts(names.map((name: string) => ({ name, checked: false, price: 0, quantity: 1, strength: 0 })));
      } catch {
        setProducts([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingEmployees(true);
      try {
        const data = await apiService.get('/employees?isActive=true&role=Executive');
        const list = Array.isArray(data) ? data : data?.data || [];
        setEmployees(
          list
            .map((u: any) => ({ _id: u._id || u.id, name: u.name || 'Unknown' }))
            .filter((e: { name: string }) => e.name !== 'Unknown'),
        );
      } catch {
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    })();
  }, []);

  const updateProduct = (index: number, patch: Partial<SaleProduct>) => {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!form.school_name.trim() || !form.contact_person.trim() || !form.contact_mobile.trim()) {
      setError('School name, contact person, and mobile are required');
      return;
    }
    const email = form.email.trim();
    if (!email) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!form.contact_person2.trim()) {
      setError('Contact Person 2 is required');
      return;
    }
    const mobile2 = form.contact_mobile2.replace(/\D/g, '');
    const mobile1 = form.contact_mobile.replace(/\D/g, '');
    if (mobile1.length < 10 || mobile1.length > 15 || mobile2.length < 10 || mobile2.length > 15) {
      setError('Enter a phone number with 10 to 15 digits');
      return;
    }
    const pincode = form.pincode.replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6) {
      setPincodeError('Valid 6-digit pincode is required');
      setError('Valid 6-digit pincode is required');
      return;
    }
    if (!form.address.trim()) {
      setError('Address is required');
      return;
    }
    if (!form.assigned_to) {
      setError('Please assign the deal to an executive. DC will not be created without assignment.');
      return;
    }
    if (form.follow_up_date) {
      const selected = parseYmd(form.follow_up_date);
      selected.setHours(0, 0, 0, 0);
      if (selected < startOfToday()) {
        setError('Follow-up date cannot be in the past');
        return;
      }
    }
    if (!String(form.branches).trim() || Number(form.branches) <= 0) {
      setError('No. of Branches is required');
      return;
    }
    if (!String(form.average_fee).trim() || Number(form.average_fee) <= 0) {
      setError('Average School Fee is required');
      return;
    }
    if (!String(form.strength).trim() || Number(form.strength) <= 0) {
      setError('School strength (students) is required');
      return;
    }
    if (!form.remarks.trim()) {
      setError('Remarks is required');
      return;
    }
    const selectedProducts = products
      .filter((p) => p.checked)
      .map((p) => ({
        product_name: p.name,
        quantity: p.quantity || 1,
        unit_price: p.price || 0,
        strength: p.strength || 0,
      }));
    if (selectedProducts.length === 0) {
      setError('Please select at least one product.');
      return;
    }

    setSubmitting(true);
    try {
      const followUp = form.follow_up_date
        ? new Date(form.follow_up_date + 'T00:00:00Z').toISOString()
        : undefined;
      await apiService.post('/dc-orders/create', {
        school_name: form.school_name.trim(),
        school_type: form.school_type || undefined,
        contact_person: form.contact_person.trim(),
        contact_mobile: form.contact_mobile.trim(),
        contact_person2: form.contact_person2.trim(),
        contact_mobile2: mobile2,
        location: form.location,
        address: form.address.trim(),
        pincode,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        zone: form.zone,
        cluster: form.cluster || undefined,
        status: form.lead_status || 'pending',
        branches: Number(form.branches),
        strength: Number(form.strength),
        average_fee: Number(form.average_fee),
        remarks: form.remarks.trim(),
        email,
        products: selectedProducts,
        follow_up_date: followUp,
        assigned_to: form.assigned_to,
      });
      setSuccess('Deal created successfully. DC entry has been created — submit PO from EMP DC / Admin DCs.');
      const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';
      setTimeout(() => {
        navigateRoot(isAdmin ? 'DCAdminMy' : 'DCEmp');
      }, 900);
    } catch (e: any) {
      const msg = e?.message || 'Failed to create deal';
      setError(msg);
      if (/school code already exists/i.test(msg)) {
        setSchoolCodeError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Create Deal (Sale)"
      subtitle="Creating a deal automatically generates a DC. Submit PO from My DCs."
    >
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}
      {success ? <MessageBanner type="success" message={success} onDismiss={() => setSuccess(null)} /> : null}

      <Text style={styles.label}>School name *</Text>
      <WebInput
        placeholder="School name"
        value={form.school_name}
        onChangeText={(v) => setField('school_name', v)}
      />
      <Text style={styles.label}>School code</Text>
      <WebInput
        value="Assigned automatically from the pincode, zone, and cluster"
        editable={false}
      />
      <WebSelect
        label="School Type"
        value={form.school_type}
        onValueChange={(v) => setField('school_type', v)}
        items={SCHOOL_TYPES}
        placeholder="Select Type"
      />
      <Text style={styles.label}>Contact person *</Text>
      <WebInput
        placeholder="Contact person"
        value={form.contact_person}
        onChangeText={(v) => setField('contact_person', v)}
      />
      <Text style={styles.label}>Contact mobile *</Text>
      <WebInput
        placeholder="10 to 15 digits"
        value={form.contact_mobile}
        onChangeText={(v) => setField('contact_mobile', v.replace(/\D/g, '').slice(0, 15))}
        keyboardType="phone-pad"
        maxLength={15}
      />
      <Text style={styles.label}>Email *</Text>
      <WebInput
        placeholder="Enter email address"
        value={form.email}
        onChangeText={(v) => setField('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Text style={styles.label}>Contact Person 2 *</Text>
      <WebInput
        placeholder="Contact Person 2"
        value={form.contact_person2}
        onChangeText={(v) => setField('contact_person2', v)}
      />
      <Text style={styles.label}>Contact Mobile 2 *</Text>
      <WebInput
        placeholder="10 to 15 digits"
        value={form.contact_mobile2}
        onChangeText={(v) => setField('contact_mobile2', v.replace(/\D/g, '').slice(0, 15))}
        keyboardType="phone-pad"
        maxLength={15}
      />
      <Text style={styles.label}>Location/Town</Text>
      <WebInput
        placeholder="Location/Town"
        value={form.location}
        onChangeText={(v) => setField('location', v)}
      />
      <Text style={styles.label}>Pincode *</Text>
      <WebInput
        placeholder="Enter 6-digit pincode"
        value={form.pincode}
        onChangeText={handlePincodeChange}
        keyboardType="number-pad"
        maxLength={6}
        style={pincodeError ? styles.inputError : undefined}
      />
      {loadingPincode ? (
        <Text style={styles.checkingText}>Loading location details...</Text>
      ) : pincodeError ? (
        <Text style={styles.fieldError}>{pincodeError}</Text>
      ) : null}
      <Text style={styles.label}>State</Text>
      <WebInput
        placeholder="Auto-filled from pincode"
        value={form.state}
        onChangeText={(v) => setField('state', v)}
      />
      <Text style={styles.label}>District</Text>
      <WebInput
        placeholder="Auto-filled from pincode"
        value={form.city}
        onChangeText={(v) => setField('city', v)}
      />
      <Text style={styles.label}>City/Town</Text>
      <WebInput
        placeholder="Auto-filled from pincode"
        value={form.region}
        onChangeText={(v) => setField('region', v)}
      />
      <WebSelect
        label="Area / Locality"
        value={form.area}
        onValueChange={(v) => setField('area', v)}
        items={areas.map((a) => ({
          label: `${a.name}${a.block ? ` - ${a.block}` : ''}${a.branchType ? ` (${a.branchType})` : ''}`.trim(),
          value: a.name,
        }))}
        placeholder={areas.length === 0 ? 'Enter pincode first' : 'Select exact area'}
        disabled={areas.length === 0}
      />
      <Text style={styles.label}>Address *</Text>
      <WebInput
        placeholder="Address"
        value={form.address}
        onChangeText={(v) => setField('address', v)}
        multiline
        style={{ minHeight: 72 }}
      />

      <Text style={styles.sectionTitle}>Products *</Text>
      <Text style={styles.hint}>Check products to enter Price, Quantity, and Strength.</Text>
      {products.length === 0 ? (
        <Text style={styles.hint}>No products found. Add products in Settings first.</Text>
      ) : (
        products.map((product, index) => (
          <View key={product.name} style={styles.saleProductRow}>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => updateProduct(index, { checked: !product.checked })}
            >
              <View style={[styles.checkbox, product.checked && styles.checkboxOn]}>
                {product.checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.productName}>{product.name}</Text>
            </TouchableOpacity>
            {product.checked ? (
              <View style={styles.productFields}>
                <View style={styles.productField}>
                  <Text style={styles.label}>Price (₹)</Text>
                  <WebInput
                    placeholder="0"
                    value={product.price ? String(product.price) : ''}
                    onChangeText={(v) => updateProduct(index, { price: Number(v) || 0 })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.productField}>
                  <Text style={styles.label}>Quantity</Text>
                  <WebInput
                    placeholder="1"
                    value={String(product.quantity || '')}
                    onChangeText={(v) => updateProduct(index, { quantity: Math.max(1, Number(v) || 1) })}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.productField}>
                  <Text style={styles.label}>Strength</Text>
                  <WebInput
                    placeholder="0"
                    value={product.strength ? String(product.strength) : ''}
                    onChangeText={(v) => updateProduct(index, { strength: Number(v) || 0 })}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            ) : null}
          </View>
        ))
      )}

      <WebSelect
        label="Lead Status"
        value={form.lead_status}
        onValueChange={(v) => setField('lead_status', v)}
        items={DEAL_STATUS_OPTIONS}
      />
      <Text style={styles.label}>Zone *</Text>
      <WebInput placeholder="Zone" value={form.zone} onChangeText={(v) => setField('zone', v)} />
      <Text style={styles.label}>Cluster *</Text>
      <WebInput placeholder="Cluster" value={form.cluster} onChangeText={(v) => setField('cluster', v)} />
      <Text style={styles.label}>No. of Branches *</Text>
      <WebInput
        placeholder="No. of Branches"
        value={form.branches}
        onChangeText={(v) => setField('branches', v)}
        keyboardType="number-pad"
      />
      <Text style={styles.label}>Average School Fee *</Text>
      <WebInput
        placeholder="Average School Fee"
        value={form.average_fee}
        onChangeText={(v) => setField('average_fee', v)}
        keyboardType="number-pad"
      />
      <WebSelect
        label="Assign to (Executive) *"
        value={form.assigned_to}
        onValueChange={(v) => setField('assigned_to', v)}
        items={employees.map((e) => ({ label: e.name, value: e._id }))}
        placeholder={
          loadingEmployees
            ? 'Loading employees...'
            : employees.length === 0
              ? 'No employees found'
              : 'Select executive *'
        }
      />
      {employees.length === 0 && !loadingEmployees ? (
        <Text style={styles.errorText}>Create employees first in Users / Employees → New Employee</Text>
      ) : null}
      <Text style={styles.label}>School strength (students) *</Text>
      <WebInput
        placeholder="School strength (students)"
        value={form.strength}
        onChangeText={(v) => setField('strength', v)}
        keyboardType="number-pad"
      />
      <DateField
        label="Follow-up date"
        value={form.follow_up_date}
        onChange={(v) => setField('follow_up_date', v)}
        showPicker={showFollowUpPicker}
        setShowPicker={setShowFollowUpPicker}
        minimumDate={startOfToday()}
      />
      <Text style={styles.label}>Remarks *</Text>
      <WebInput
        placeholder="Remarks"
        value={form.remarks}
        onChangeText={(v) => setField('remarks', v)}
        multiline
        style={{ minHeight: 72 }}
      />
      <WebButton
        title={submitting ? 'Creating Deal...' : 'Create Deal'}
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
      />
      <WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} disabled={submitting} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  fieldError: { ...typography.body.small, color: colors.error, marginBottom: 10, marginTop: -4 },
  checkingText: { ...typography.body.small, color: '#2563EB', marginBottom: 10, marginTop: -4 },
  inputError: { borderColor: colors.error },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginTop: 8, marginBottom: 8 },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  errorText: { ...typography.body.small, color: colors.error, marginBottom: 12 },
  saleProductRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.backgroundLight,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  productName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  productFields: { marginTop: 10, gap: 4 },
  productField: { flex: 1 },
  fieldContainer: { marginBottom: 14 },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  placeholderText: { color: colors.textSecondary },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  datePickerBox: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: { ...typography.heading.h3, color: colors.textPrimary },
  doneText: { ...typography.label.medium, color: colors.primary, fontWeight: '600' },
});

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
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

import { ymdToDmy } from '../../utils/dateFormat';
// Existing schools continue through next year's PO, not Create Sale (same as web).
const SCHOOL_TYPES = ['New'].map((t) => ({
  label: t,
  value: t,
}));
const DEAL_STATUS_OPTIONS = [
  { label: 'Saved', value: 'saved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
];
const SCHOOL_CODE_ALLOWED = /^[A-Za-z0-9_-]+$/;

type RenewalOption = 'renewed' | 'not_renewed' | 'cross_sale';
type SaleProduct = {
  name: string;
  checked: boolean;
  price: number;
  quantity: number;
  strength: number;
  /** Existing school only. */
  renewal?: RenewalOption;
};

const RENEWAL_OPTIONS: { value: RenewalOption; label: string }[] = [
  { value: 'renewed', label: 'Renewed' },
  { value: 'not_renewed', label: 'Not renewed' },
  { value: 'cross_sale', label: 'Cross sale' },
];

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
        <WebLabel>{label}</WebLabel>
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
            borderRadius: 10,
            border: '1px solid #DCE3EC',
            fontSize: 15,
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
      <WebLabel>{label}</WebLabel>
      <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
        <Text style={[styles.dateText, !value && styles.placeholderText]}>
          {ymdToDmy(value) || 'Tap to pick date'}
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
    school_type: 'New',
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
    cluster: '',
    clusterId: '',
    branches: '',
    strength: '',
    average_fee: '',
    remarks: '',
    follow_up_date: '',
  });
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [clusters, setClusters] = useState<{ _id: string; name: string; zone: string }[]>([]);
  // The employee's own cluster is fixed (not editable); only logins without a cluster pick one.
  const [clusterLocked, setClusterLocked] = useState(false);
  const [areas, setAreas] = useState<{ name: string; district?: string; block?: string; branchType?: string }[]>([]);
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
        const response: any = await apiService.get(`/location/get-town?pincode=${cleanPincode}`);
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


  // Cluster pick list (all zones). The zone is taken from the chosen cluster on the server.
  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/clusters');
        const list = Array.isArray(data) ? data : data?.data || [];
        const mapped = list
          .map((c: any) => ({ _id: String(c._id || ''), name: String(c.name || ''), zone: String(c.zoneId?.name || '') }))
          .filter((c: { name: string }) => c.name);
        setClusters(mapped);
        // The BDE's own cluster is filled in and cannot be changed.
        try {
          const me: any = await apiService.get('/auth/me');
          const mine = String(me?.cluster || '').trim().toLowerCase();
          const own =
            mapped.find((c: { name: string }) => mine && c.name.trim().toLowerCase() === mine) ||
            (() => {
              const inZone = mapped.filter((c: { zone: string }) => me?.zone && c.zone === me.zone);
              return inZone.length === 1 ? inZone[0] : undefined;
            })();
          if (own) {
            setForm((f) => ({ ...f, clusterId: own._id, cluster: own.name }));
            setClusterLocked(true);
          }
        } catch {
          // no default; the BDE picks it
        }
      } catch {
        setClusters([]);
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
    if (!form.cluster.trim()) {
      setError('Select the cluster.');
      return;
    }
    if (!form.follow_up_date) {
      setError('Follow-up Date is required.');
      return;
    }
    {
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
    const existing = form.school_type === 'Existing';
    const optionOf = (p: SaleProduct): RenewalOption => (existing ? p.renewal || 'renewed' : 'cross_sale');
    const notRenewed = products.filter((p) => p.checked && existing && optionOf(p) === 'not_renewed').map((p) => p.name);
    const selectedProducts = products
      .filter((p) => p.checked && !(existing && optionOf(p) === 'not_renewed'))
      .map((p) => ({
        product_name: p.name,
        quantity: p.quantity || 1,
        unit_price: p.price || 0,
        strength: p.strength || 0,
        ...(existing ? { sale_type: optionOf(p) === 'cross_sale' ? 'cross_sale' : 'renewal' } : {}),
      }));
    if (selectedProducts.length === 0) {
      setError(notRenewed.length ? 'Mark at least one product as Renewed or Cross sale.' : 'Please select at least one product.');
      return;
    }

    setSubmitting(true);
    try {
      const followUp = new Date(form.follow_up_date + 'T00:00:00Z').toISOString();
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
        cluster: form.cluster || undefined,
        clusterId: form.clusterId || undefined,
        status: form.lead_status || 'pending',
        branches: Number(form.branches),
        strength: Number(form.strength),
        average_fee: Number(form.average_fee),
        remarks: form.remarks.trim(),
        email,
        products: selectedProducts,
        not_renewed_products: notRenewed,
        follow_up_date: followUp,
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
    >
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}
      {success ? <MessageBanner type="success" message={success} onDismiss={() => setSuccess(null)} /> : null}

      <PageSection title="School">
      <WebLabel>School name *</WebLabel>
      <WebInput
        placeholder="School name"
        value={form.school_name}
        onChangeText={(v) => setField('school_name', v)}
      />
      <WebLabel>School code</WebLabel>
      <View style={styles.autoBox}>
        <Text style={styles.autoValue}>Auto-generated</Text>
        <Text style={styles.autoNote}>Created when the deal is saved, from the pincode and cluster.</Text>
      </View>
      <WebSelect
        label="School Type"
        value={form.school_type}
        onValueChange={(v) => setField('school_type', v)}
        items={SCHOOL_TYPES}
        placeholder="Select Type"
      />
      </PageSection>

      <PageSection title="Contacts">
      <WebLabel>Contact person *</WebLabel>
      <WebInput
        placeholder="Contact person"
        value={form.contact_person}
        onChangeText={(v) => setField('contact_person', v)}
      />
      <WebLabel>Contact mobile *</WebLabel>
      <WebInput
        placeholder="10 to 15 digits"
        value={form.contact_mobile}
        onChangeText={(v) => setField('contact_mobile', v.replace(/\D/g, '').slice(0, 15))}
        keyboardType="phone-pad"
        maxLength={15}
      />
      <WebLabel>Email *</WebLabel>
      <WebInput
        placeholder="Enter email address"
        value={form.email}
        onChangeText={(v) => setField('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <WebLabel>Contact Person 2 *</WebLabel>
      <WebInput
        placeholder="Contact Person 2"
        value={form.contact_person2}
        onChangeText={(v) => setField('contact_person2', v)}
      />
      <WebLabel>Contact Mobile 2 *</WebLabel>
      <WebInput
        placeholder="10 to 15 digits"
        value={form.contact_mobile2}
        onChangeText={(v) => setField('contact_mobile2', v.replace(/\D/g, '').slice(0, 15))}
        keyboardType="phone-pad"
        maxLength={15}
      />
      </PageSection>

      <PageSection title="Location">
      <WebLabel>Location/Town</WebLabel>
      <WebInput
        placeholder="Location/Town"
        value={form.location}
        onChangeText={(v) => setField('location', v)}
      />
      <WebLabel>Pincode *</WebLabel>
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
      <WebLabel>State</WebLabel>
      <WebInput
        placeholder="Auto-filled from pincode"
        value={form.state}
        onChangeText={(v) => setField('state', v)}
      />
      <WebLabel>District</WebLabel>
      <WebInput
        placeholder="Auto-filled from pincode"
        value={form.city}
        onChangeText={(v) => setField('city', v)}
      />
      <WebLabel>City/Town</WebLabel>
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
      <WebLabel>Address *</WebLabel>
      <WebInput
        placeholder="Address"
        value={form.address}
        onChangeText={(v) => setField('address', v)}
        multiline
        style={{ minHeight: 72 }}
      />

      </PageSection>

      <PageSection title="Products *">
      <Text style={styles.hint}>Tick a product to enter price, quantity and strength.</Text>
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
            {product.checked && form.school_type === 'Existing' ? (
              <View style={styles.renewalRow}>
                {RENEWAL_OPTIONS.map((o) => {
                  const on = (product.renewal || 'renewed') === o.value;
                  return (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.renewalChip, on && styles.renewalChipOn]}
                      onPress={() => updateProduct(index, { renewal: o.value })}
                    >
                      <Text style={[styles.renewalChipText, on && styles.renewalChipTextOn]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            {product.checked && !(form.school_type === 'Existing' && product.renewal === 'not_renewed') ? (
              <View style={styles.productFields}>
                <View style={styles.productField}>
                  <WebLabel>Price (₹)</WebLabel>
                  <WebInput
                    placeholder="0"
                    value={product.price ? String(product.price) : ''}
                    onChangeText={(v) => updateProduct(index, { price: Number(v) || 0 })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.productField}>
                  <WebLabel>Quantity</WebLabel>
                  <WebInput
                    placeholder="1"
                    value={String(product.quantity || '')}
                    onChangeText={(v) => updateProduct(index, { quantity: Math.max(1, Number(v) || 1) })}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.productField}>
                  <WebLabel>Strength</WebLabel>
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

      </PageSection>

      <PageSection title="Deal details">
      <WebSelect
        label="Deal Status"
        value={form.lead_status}
        onValueChange={(v) => setField('lead_status', v)}
        items={DEAL_STATUS_OPTIONS}
      />
      {clusterLocked ? (
        <>
          <WebLabel>Cluster</WebLabel>
          <WebInput value={form.cluster} editable={false} />
        </>
      ) : clusters.length > 0 ? (
        <WebSelect
          label="Cluster *"
          value={form.clusterId}
          onValueChange={(v) => {
            const picked = clusters.find((c) => c._id === v);
            setForm((f) => ({ ...f, clusterId: v, cluster: picked?.name || '' }));
          }}
          items={clusters.map((c) => ({ label: c.zone ? `${c.name} (${c.zone})` : c.name, value: c._id }))}
          placeholder="Select cluster"
        />
      ) : (
        <>
          <WebLabel>Cluster *</WebLabel>
          <WebInput placeholder="Cluster" value={form.cluster} onChangeText={(v) => setField('cluster', v)} />
        </>
      )}
      <WebLabel>No. of Branches *</WebLabel>
      <WebInput
        placeholder="No. of Branches"
        value={form.branches}
        onChangeText={(v) => setField('branches', v)}
        keyboardType="number-pad"
      />
      <WebLabel>Average School Fee *</WebLabel>
      <WebInput
        placeholder="Average School Fee"
        value={form.average_fee}
        onChangeText={(v) => setField('average_fee', v)}
        keyboardType="number-pad"
      />
      <WebLabel>School strength (students) *</WebLabel>
      <WebInput
        placeholder="School strength (students)"
        value={form.strength}
        onChangeText={(v) => setField('strength', v)}
        keyboardType="number-pad"
      />
      <DateField
        label="Follow-up date *"
        value={form.follow_up_date}
        onChange={(v) => setField('follow_up_date', v)}
        showPicker={showFollowUpPicker}
        setShowPicker={setShowFollowUpPicker}
        minimumDate={startOfToday()}
      />
      <WebLabel>Remarks *</WebLabel>
      <WebInput
        placeholder="Remarks"
        value={form.remarks}
        onChangeText={(v) => setField('remarks', v)}
        multiline
        style={{ minHeight: 72 }}
      />
      </PageSection>

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
  renewalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  renewalChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#E0F2FE' },
  renewalChipOn: { backgroundColor: '#0284C7' },
  renewalChipText: { fontSize: 13, color: '#0369A1', fontWeight: '600' },
  renewalChipTextOn: { color: '#fff' },
  fieldError: { fontSize: 13, color: colors.error, marginBottom: 12, marginTop: -8 },
  checkingText: { fontSize: 13, color: colors.primaryDark, marginBottom: 12, marginTop: -8 },
  inputError: { borderColor: colors.error },
  hint: { fontSize: 13, color: colors.textTertiary, marginBottom: 12 },
  errorText: { ...typography.body.small, color: colors.error, marginBottom: 12 },
  autoBox: {
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundMuted,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  autoValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  autoNote: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  saleProductRow: {
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },
  checkboxOn: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  productName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  productFields: { marginTop: 12, flexDirection: 'row', gap: 8 },
  productField: { flex: 1 },
  fieldContainer: { marginBottom: 14 },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  dateText: { fontSize: 15, color: colors.textPrimary },
  placeholderText: { color: colors.textMuted },
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
  datePickerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  doneText: { fontSize: 15, color: colors.primaryDark, fontWeight: '600' },
});

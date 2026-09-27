/**
 * Raise DC screen (admin) - full form aligned with navbar-landing closed sales Raise DC.
 * Load deal, employees, products; Lead Info, Assign Employee *, DC Details, Products table; Submit to Senior Coordinator.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import { useAuth } from '../../context/AuthContext';
import { navigateRoot } from '../../navigation/navigationRef';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import {
  applyCatalogDefaultsToRow,
  findCatalogProduct,
  getCatalogProductNames,
  getProductCategoryOptions,
  getProductLevelsOptions,
  getProductSpecsOptions,
  getProductSubjectsOptions,
  mapSourceToRaiseDcRow,
} from '../../utils/productCatalog';

type ProductRow = {
  id: string;
  product: string;
  class: string;
  category: string;
  productCategory?: string;
  specs: string;
  subject?: string;
  strength: number;
  level: string;
  term: string;
};

const DEFAULT_ROW: Omit<ProductRow, 'id'> = {
  product: 'Abacus',
  class: '1',
  category: 'new Students',
  specs: 'Regular',
  strength: 0,
  level: 'L1',
  term: 'Term 1',
};

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const CATEGORY_OPTIONS = [
  'NA',
  'Training Mterial',
  'new Students',
  'Old Students',
  'Excess',
  'Exchange',
  'Shortage',
  'Excess-OldStudents',
  'Excess NewStudents',
];
const DC_CATEGORIES = ['Term 1', 'Term 2', 'Term 3', 'Full Year'];
const TERMS = ['Term 1', 'Term 2', 'Both'];

const normalizeCategoryForDropdown = (raw: any, fallback: string) => {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return fallback;
  if (v === 'New Students') return 'new Students';
  if (v === 'Existing Students') return 'Old Students';
  if (v === 'Both') return 'NA';
  if (v === 'New School') return 'new Students';
  if (v === 'Existing School') return 'Old Students';
  return CATEGORY_OPTIONS.includes(v) ? v : fallback;
};

const resolveProductRowsSource = (data: any) => {
  const dcReq = data?.dcRequestData || {};
  const pe = data?.pendingEdit || {};
  const candidates = [dcReq.productDetails, pe.productDetails, pe.products, data?.products];
  return candidates.find((arr) => Array.isArray(arr) && arr.length > 0) as any[] | undefined;
};

const SCHOOL_TYPES = ['New', 'Existing'].map((t) => ({
  label: t,
  value: t,
}));
const DEAL_STATUS_OPTIONS = [
  { label: 'Saved', value: 'saved' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
];

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value?: string) {
  if (!value) return new Date();
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
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
        <Text style={[styles.dateText, !value && styles.placeholderText]}>{value || 'Tap to pick date'}</Text>
        <Text style={styles.calendarIcon}>📅</Text>
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

type SaleProduct = {
  name: string;
  checked: boolean;
  price: number;
  quantity: number;
  strength: number;
};

/** Matches web `/dashboard/dc/create` — used from Clients & DC → Create Sale. */
function CreateSaleForm({ navigation }: { navigation: any }) {
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
    lead_status: 'pending',
    zone: '',
    branches: '',
    strength: '',
    average_fee: '',
    remarks: '',
    follow_up_date: '',
    assigned_to: '',
  });
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [schoolCodeError, setSchoolCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);

  const setField = (name: string, value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (name === 'school_code') setSchoolCodeError(null);
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
    const mobileError = phoneDigitsError(form.contact_mobile, true) || phoneDigitsError(form.contact_mobile2, false);
    if (mobileError) {
      setError(mobileError);
      return;
    }
    const code = form.school_code.trim();
    if (!code) {
      setSchoolCodeError('School Code is required');
      setError('School Code is required');
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      setSchoolCodeError('School code contains invalid characters.');
      setError('School code contains invalid characters.');
      return;
    }
    if (!form.assigned_to) {
      setError('Please assign the deal to an executive. DC will not be created without assignment.');
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
          const msg = 'School Code already exists. Please enter a unique School Code.';
          setSchoolCodeError(msg);
          setError(msg);
          setSubmitting(false);
          return;
        }
      } catch {
        /* backend enforces uniqueness */
      }

      const followUp = form.follow_up_date
        ? new Date(form.follow_up_date + 'T00:00:00Z').toISOString()
        : undefined;
      await apiService.post('/dc-orders/create', {
        school_name: form.school_name.trim(),
        school_code: code,
        school_type: form.school_type || undefined,
        contact_person: form.contact_person.trim(),
        contact_mobile: form.contact_mobile.trim(),
        contact_person2: form.contact_person2 || undefined,
        contact_mobile2: form.contact_mobile2 || undefined,
        location: form.location,
        address: form.address || undefined,
        zone: form.zone,
        status: form.lead_status || 'pending',
        branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        remarks: form.remarks,
        email: form.email,
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
      if (/school code already exists/i.test(msg)) setSchoolCodeError(msg);
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

      <WebInput
        placeholder="School name *"
        value={form.school_name}
        onChangeText={(v) => setField('school_name', v)}
      />
      <WebInput
        placeholder="School Code *"
        value={form.school_code}
        onChangeText={(v) => setField('school_code', v)}
        autoCapitalize="characters"
      />
      {schoolCodeError ? <Text style={styles.errorText}>{schoolCodeError}</Text> : null}
      <WebSelect
        label="School Type"
        value={form.school_type}
        onValueChange={(v) => setField('school_type', v)}
        items={SCHOOL_TYPES}
        placeholder="Select Type"
      />
      <WebInput
        placeholder="Contact person *"
        value={form.contact_person}
        onChangeText={(v) => setField('contact_person', v)}
      />
      <WebInput
        placeholder="Contact mobile *"
        value={form.contact_mobile}
        onChangeText={(v) => setField('contact_mobile', sanitizePhoneDigits(v))}
        keyboardType="phone-pad"
      />
      <WebInput
        placeholder="Email"
        value={form.email}
        onChangeText={(v) => setField('email', v)}
        keyboardType="email-address"
      />
      <WebInput
        placeholder="Contact Person 2"
        value={form.contact_person2}
        onChangeText={(v) => setField('contact_person2', v)}
      />
      <WebInput
        placeholder="Contact Mobile 2"
        value={form.contact_mobile2}
        onChangeText={(v) => setField('contact_mobile2', sanitizePhoneDigits(v))}
        keyboardType="phone-pad"
      />
      <WebInput
        placeholder="Location/Town"
        value={form.location}
        onChangeText={(v) => setField('location', v)}
      />
      <WebInput
        placeholder="Address"
        value={form.address}
        onChangeText={(v) => setField('address', v)}
        multiline
        style={{ minHeight: 72 }}
      />

      <Text style={styles.sectionTitle}>Products *</Text>
      <Text style={styles.mandatoryNote}>Check products to enter Price, Quantity, and Strength.</Text>
      {products.length === 0 ? (
        <Text style={styles.mandatoryNote}>No products found. Add products in Settings first.</Text>
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
      <WebInput placeholder="Zone" value={form.zone} onChangeText={(v) => setField('zone', v)} />
      <WebInput
        placeholder="No. of Branches"
        value={form.branches}
        onChangeText={(v) => setField('branches', v)}
        keyboardType="number-pad"
      />
      <WebInput
        placeholder="Average School Fee *"
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
      />
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

export default function DCCreateScreen({ navigation, route }: any) {
  const dealId = route?.params?.dealId as string | undefined;
  const mode = (route?.params?.mode as 'raise' | 'update' | undefined) || 'raise';
  if (!dealId) {
    return <CreateSaleForm navigation={navigation} />;
  }
  return <RaiseDCForm navigation={navigation} dealId={dealId} mode={mode} />;
}

function RaiseDCForm({
  navigation,
  dealId,
  mode = 'raise',
}: {
  navigation: any;
  dealId: string;
  mode?: 'raise' | 'update';
}) {
  const isUpdateMode = mode === 'update';
  const scrollRef = useRef<ScrollView>(null);
  const { user } = useAuth();

  const [deal, setDeal] = useState<any>(null);
  const [isLead, setIsLead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingDC, setExistingDC] = useState<any>(null);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [contactPerson2, setContactPerson2] = useState('');
  const [contactMobile2, setContactMobile2] = useState('');
  const [dcDate, setDcDate] = useState('');
  const [showDcDatePicker, setShowDcDatePicker] = useState(false);
  const [dcCategory, setDcCategory] = useState('');
  const [dcRemarks, setDcRemarks] = useState('');
  const [dcNotes, setDcNotes] = useState('');
  const [productRows, setProductRows] = useState<ProductRow[]>([
    { ...DEFAULT_ROW, id: '1' },
  ]);

  useEffect(() => {
    if (!dealId) {
      setLoading(false);
      setErrorMessage('No deal selected');
      return;
    }
    (async () => {
      const [, catalog] = await Promise.all([loadEmployees(), loadProducts()]);
      await loadDeal(catalog);
    })();
  }, [dealId]);

  const loadDeal = async (catalogProducts: any[]) => {
    try {
      setLoading(true);
      if (!isUpdateMode) {
        setContactPerson2('');
        setContactMobile2('');
        setDcDate('');
        setDcCategory('');
        setDcRemarks('');
        setDcNotes('');
      }
      let data: any;
      try {
        data = await apiService.get(`/dc-orders/${dealId}`);
        setIsLead(false);
      } catch {
        data = await apiService.get(`/leads/${dealId}`);
        setIsLead(true);
      }
      setDeal(data);
      const pe = data?.pendingEdit || {};
      const dcReq = data?.dcRequestData || {};
      // Contact details are carried from the sale; all other new Raise DC
      // details must be entered deliberately.
      setContactPerson2(pe.contact_person2 || dcReq.contact_person2 || data?.contact_person2 || '');
      setContactMobile2(pe.contact_mobile2 || dcReq.contact_mobile2 || data?.contact_mobile2 || '');
      if (isUpdateMode) {
        if (dcReq.dcDate) {
          const loaded = String(dcReq.dcDate).split('T')[0];
          const todayYmd = toYmd(startOfToday());
          setDcDate(loaded >= todayYmd ? loaded : todayYmd);
        }
        if (dcReq.dcCategory) setDcCategory(dcReq.dcCategory);
        if (dcReq.dcRemarks) setDcRemarks(dcReq.dcRemarks);
        if (dcReq.dcNotes) setDcNotes(String(dcReq.dcNotes));
      }
      if (data?.assigned_to) {
        const id = typeof data.assigned_to === 'object' ? data.assigned_to._id : data.assigned_to;
        if (id) setSelectedEmployeeId(id);
      }

      // Prefer linked DC document when updating from Saved DC (same as web Update DC modal).
      let linkedDC: any = null;
      try {
        const dcsRes = await apiService.get(`/dc?dcOrderId=${dealId}`);
        const dcs = Array.isArray(dcsRes) ? dcsRes : dcsRes?.data || [];
        if (dcs.length > 0) {
          const active = dcs.filter((d: any) => d.status !== 'scheduled_for_later');
          const pool = active.length > 0 ? active : dcs;
          const preferred = pool.filter((d: any) =>
            ['created', 'po_submitted', 'pending_dc'].includes(String(d.status || '')),
          );
          const ranked = (preferred.length > 0 ? preferred : pool).slice().sort((a: any, b: any) => {
            return (
              new Date(b.updatedAt || b.createdAt || 0).getTime() -
              new Date(a.updatedAt || a.createdAt || 0).getTime()
            );
          });
          linkedDC = ranked[0] || dcs[0];
          setExistingDC(linkedDC);
          try {
            const fullDC = await apiService.get(`/dc/${linkedDC._id}`);
            linkedDC = fullDC || linkedDC;
            setExistingDC(linkedDC);
            if (isUpdateMode) {
              if (fullDC?.dcDate) {
                const loaded = String(fullDC.dcDate).split('T')[0];
                const todayYmd = toYmd(startOfToday());
                setDcDate(loaded >= todayYmd ? loaded : todayYmd);
              }
              if (fullDC?.dcCategory) setDcCategory(fullDC.dcCategory);
              if (fullDC?.dcRemarks) setDcRemarks(fullDC.dcRemarks || '');
              if (fullDC?.dcNotes) setDcNotes(fullDC.dcNotes || '');
            }
          } catch {
            /* keep list DC */
          }
        }
      } catch {
        setExistingDC(null);
      }

      const categoryFallback =
        data.school_type === 'Existing' ? 'Old Students' : 'new Students';
      const rowSource =
        (Array.isArray(linkedDC?.productDetails) && linkedDC.productDetails.length > 0
          ? linkedDC.productDetails
          : null) || resolveProductRowsSource(data);
      if (rowSource?.length) {
        setProductRows(
          rowSource.map((p: any, idx: number) =>
            mapSourceToRaiseDcRow(p, catalogProducts, categoryFallback, CATEGORY_OPTIONS, idx),
          ),
        );
      } else if (catalogProducts.length) {
        setProductRows([
          mapSourceToRaiseDcRow(
            { product: getCatalogProductNames(catalogProducts)[0], class: '1', strength: 0 },
            catalogProducts,
            categoryFallback,
            CATEGORY_OPTIONS,
            0,
          ),
        ]);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to load deal');
      setDeal(null);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await apiService.get('/employees?isActive=true');
      const list = Array.isArray(data) ? data : data?.data || [];
      setEmployees(list.map((e: any) => ({ _id: e._id, name: e.name || 'Unknown' })));
    } catch {
      setEmployees([]);
    }
  };

  const loadProducts = async (): Promise<any[]> => {
    try {
      let data: any = await apiService.get('/products/active').catch(() => apiService.get('/products'));
      const list = Array.isArray(data) ? data : data?.data || data?.products || [];
      setProducts(list);
      return list;
    } catch {
      setProducts([]);
      return [];
    }
  };

  const getProductLevels = (productName: string): string[] =>
    getProductLevelsOptions(products, productName);

  const getProductSpecs = (productName: string): string[] =>
    getProductSpecsOptions(products, productName);

  const getProductSubjects = (productName: string): string[] =>
    getProductSubjectsOptions(products, productName);

  const getProductCategories = (productName: string): string[] =>
    getProductCategoryOptions(products, productName);

  const getProductNames = (): string[] => getCatalogProductNames(products);

  const applyProductDefaults = (row: ProductRow, productName: string): ProductRow => {
    const catalogEntry = findCatalogProduct(products, productName);
    const canonicalName = catalogEntry?.productName || productName;
    return applyCatalogDefaultsToRow(
      { ...row, product: canonicalName },
      products,
    ) as ProductRow;
  };

  const updateProductRow = (id: string, field: keyof ProductRow, value: any) => {
    setProductRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'product') {
          return applyProductDefaults({ ...r, product: value, strength: r.strength }, value);
        }
        return { ...r, [field]: value };
      }),
    );
  };

  const removeProductRow = (id: string) => {
    setProductRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const addProductRow = () => {
    const names = getProductNames();
    const productName = names[0] || DEFAULT_ROW.product;
    const base: ProductRow = {
      ...DEFAULT_ROW,
      id: String(Date.now()),
      product: productName,
      category:
        deal?.school_type === 'Existing' ? 'Old Students' : DEFAULT_ROW.category,
    };
    setProductRows((prev) => [...prev, applyProductDefaults(base, productName)]);
  };

  const canApproveDC =
    user?.role === 'Super Admin' ||
    user?.role === 'Admin' ||
    user?.role === 'Coordinator';

  const grandTotalQty = productRows.reduce((s, r) => s + (Number(r.strength) || 0), 0);

  const getAssignedToName = () => {
    const assignedTo = deal?.assigned_to;
    if (!assignedTo) return '';
    if (typeof assignedTo === 'object' && assignedTo?.name) return String(assignedTo.name);
    const id = typeof assignedTo === 'object' ? assignedTo?._id : assignedTo;
    if (id) {
      const emp = employees.find((e) => String(e._id) === String(id));
      return emp?.name || '';
    }
    return '';
  };

  const getTown = () => {
    const location = String(deal?.location || '').trim();
    if (location) return location;
    const address = String(deal?.address || '').trim();
    return address.split(',')[0]?.trim() || '';
  };

  const transportName =
    deal?.pendingEdit?.transport_name || deal?.transport_name || deal?.dcRequestData?.transport_name || '';
  const transportLocation =
    deal?.pendingEdit?.transport_location ||
    deal?.transport_location ||
    deal?.dcRequestData?.transport_location ||
    '';
  const transportationLandmark =
    deal?.pendingEdit?.transportation_landmark ||
    deal?.transportation_landmark ||
    deal?.dcRequestData?.transportation_landmark ||
    '';
  const transportPincode =
    deal?.pendingEdit?.pincode || deal?.pincode || deal?.dcRequestData?.pincode || '';

  const assignedToName = getAssignedToName();

  const raiseDcSubtitle = isUpdateMode
    ? 'Update DC details and submit to Senior Coordinator'
    : deal?.status === 'dc_requested'
      ? 'Review DC request from employee. You can accept it (to update later) or send to Senior Coordinator.'
      : deal?.status === 'dc_accepted'
        ? 'Update DC details. You can save changes or submit to Senior Coordinator.'
        : 'Fill in DC details and submit to Senior Coordinator.';

  const screenTitle = isUpdateMode
    ? 'Update DC'
    : `Raise DC${deal?.school_name ? ` - ${deal.school_name}` : ''}`;

  const buildProductDetails = () =>
    productRows.map((row) => ({
      product: row.product,
      class: row.class || '1',
      category: row.category || 'new Students',
      productCategory: row.productCategory || undefined,
      specs: row.specs || 'Regular',
      subject: row.subject || undefined,
      strength: Number(row.strength) || 0,
      quantity: Number(row.strength) || 0,
      level: row.level || 'L1',
      term: row.term || 'Term 1',
    }));

  const getAssignedEmployeeId = () =>
    selectedEmployeeId ||
    (typeof deal?.assigned_to === 'object' ? deal?.assigned_to?._id : deal?.assigned_to) ||
    '';

  const validate = (opts?: { forSave?: boolean }): boolean => {
    if (!selectedEmployeeId.trim() && !deal?.assigned_to) {
      setErrorMessage('Assigned To * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (!isUpdateMode) {
      if (!contactPerson2.trim()) {
        setErrorMessage('Contact Person 2 * is required');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
      if (!contactMobile2.trim()) {
        setErrorMessage('Contact Mobile 2 * is required');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
      const mobile2Error = phoneDigitsError(contactMobile2, true);
      if (mobile2Error) {
        setErrorMessage(mobile2Error);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
    }
    if (!opts?.forSave) {
      if (!dcDate.trim()) {
        setErrorMessage('DC Date * is required');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
      if (dcDate.trim() < toYmd(startOfToday())) {
        setErrorMessage('DC Date cannot be in the past');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
      if (!dcCategory.trim()) {
        setErrorMessage('DC Category * is required');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
      if (!dcRemarks.trim()) {
        setErrorMessage('DC Remarks * is required');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return false;
      }
    }
    if (productRows.length === 0) {
      setErrorMessage('Add at least one product row');
      return false;
    }
    const invalid = productRows.some(
      (r) => !r.product?.trim() || (r.strength ?? 0) <= 0
    );
    if (invalid) {
      setErrorMessage('Product and Quantity (Strength) * are required for all rows');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleSaveDC = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validate({ forSave: true })) return;

    setSaving(true);
    try {
      const productDetails = buildProductDetails();
      const requestedQuantity = productDetails.reduce((s, p) => s + (p.strength || 0), 0) || 1;
      const assignedEmployeeId = getAssignedEmployeeId();
      const raisePayload: any = {
        dcOrderId: dealId,
        dcDate: dcDate || undefined,
        dcCategory: dcCategory || undefined,
        dcRemarks: dcRemarks || undefined,
        dcNotes: dcNotes || undefined,
        employeeId: assignedEmployeeId || undefined,
        productDetails,
        requestedQuantity,
        status: 'created',
      };

      if (existingDC?._id) {
        await apiService.put(`/dc/${existingDC._id}`, raisePayload);
      } else {
        const created = await apiService.post('/dc/raise', raisePayload);
        setExistingDC(created);
      }

      if (!isLead) {
        await apiService.put(`/dc-orders/${dealId}`, {
          status: 'dc_approved',
          workflowStage: 'ClosedSales',
          dcRequestData: {
            dcDate,
            dcRemarks,
            dcCategory,
            dcNotes,
            requestedQuantity,
            productDetails,
            employeeId: assignedEmployeeId,
          },
        });
      }

      setSuccessMessage(
        existingDC
          ? 'DC updated and saved. It will stay in Saved DC.'
          : 'DC saved. It will stay in Saved DC.',
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => {
        if (!navigateRoot('DCSaved')) navigation.navigate('DCSaved');
      }, 700);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to save DC');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    Alert.alert(
      'Print',
      [
        deal?.school_name || 'School',
        `Code: ${deal?.dc_code || deal?.school_code || '-'}`,
        `Executive: ${assignedToName || '-'}`,
        `Products: ${productRows.map((r) => `${r.product} - ${r.strength}`).join(', ') || '-'}`,
        `DC Date: ${dcDate || '-'}`,
        `Category: ${dcCategory || '-'}`,
        `Remarks: ${dcRemarks || '-'}`,
      ].join('\n'),
    );
  };

  const handleAcceptDC = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validate()) return;

    setAccepting(true);
    try {
      const productDetails = buildProductDetails();
      const requestedQuantity = productDetails.reduce((s, p) => s + (p.strength || 0), 0) || 1;
      const assignedEmployeeId = getAssignedEmployeeId();

      if (!isLead) {
        await apiService.put(`/dc-orders/${dealId}`, {
          contact_person2: contactPerson2.trim(),
          contact_mobile2: contactMobile2.trim(),
        });
      }

      await apiService.post('/dc/raise', {
        dcOrderId: dealId,
        dcDate: dcDate || undefined,
        dcRemarks: dcRemarks || undefined,
        dcCategory: dcCategory || undefined,
        contact_person2: contactPerson2.trim(),
        contact_mobile2: contactMobile2.trim(),
        employeeId: assignedEmployeeId,
        productDetails,
        requestedQuantity,
      });

      if (!isLead) {
        // Saved DC page loads GET /dc-orders?status=dc_approved (not My Clients `saved`).
        await apiService.put(`/dc-orders/${dealId}`, {
          status: 'dc_approved',
          workflowStage: 'ClosedSales',
          contact_person2: contactPerson2.trim(),
          contact_mobile2: contactMobile2.trim(),
          dcRequestData: {
            dcDate,
            dcRemarks,
            dcCategory,
            contact_person2: contactPerson2.trim(),
            contact_mobile2: contactMobile2.trim(),
            requestedQuantity,
            productDetails,
            employeeId: assignedEmployeeId,
          },
        });
      }

      setDeal((prev: any) => (prev ? { ...prev, status: 'dc_approved' } : prev));
      setSuccessMessage('DC request accepted! Opening Saved DC…');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => {
        // Closed Sales → Raise DC Accept lands on Saved DC List (dc_approved).
        if (!navigateRoot('DCSaved')) {
          navigation.navigate('DCSaved');
        }
      }, 600);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to accept DC');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setAccepting(false);
    }
  };

  const handleSubmitToSeniorCoordinator = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const productDetails = buildProductDetails();

      const terms = productDetails.map((p) => p.term || 'Term 1');
      const hasTerm2 = terms.some((t) => t === 'Term 2');
      const hasTerm1OrBoth = terms.some((t) => t === 'Term 1' || t === 'Both');
      const hasBothTerms = hasTerm2 && hasTerm1OrBoth;

      const requestedQuantity = productDetails.reduce((s, p) => s + (p.strength || 0), 0) || 1;
      const assignedEmployeeId = getAssignedEmployeeId();
      if (!isLead) {
        await apiService.put(`/dc-orders/${dealId}`, {
          contact_person2: contactPerson2.trim(),
          contact_mobile2: contactMobile2.trim(),
        });
      }

      await apiService.post('/dc/raise', {
        dcOrderId: dealId,
        dcDate: dcDate || undefined,
        dcRemarks: dcRemarks || undefined,
        dcCategory: dcCategory || undefined,
        dcNotes: dcNotes || undefined,
        contact_person2: contactPerson2.trim(),
        contact_mobile2: contactMobile2.trim(),
        employeeId: assignedEmployeeId,
        productDetails,
        requestedQuantity,
        status: hasTerm2 && !hasTerm1OrBoth ? 'scheduled_for_later' : 'pending_dc',
      });

      if (!isLead) {
        await apiService.put(`/dc-orders/${dealId}`, { status: 'dc_sent_to_senior' });
      }

      setSuccessMessage(hasBothTerms ? 'DC split: Term 1 → Pending DC, Term 2 → Term-Wise DC.' : 'DC raised and sent to Senior Coordinator.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => {
        if (isUpdateMode) {
          if (!navigateRoot('DCSaved')) navigation.navigate('DCSaved');
        } else {
          navigation.goBack();
        }
      }, 1500);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to raise DC');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!deal && !loading) {
    return (
    <ScreenShell
      title={isUpdateMode ? 'Update DC' : 'Raise DC'}
      loading={loading}
    >
<View style={styles.errorBlock}>
          <Text style={styles.errorText}>{errorMessage || 'Deal not found'}</Text>
        </View>
    </ScreenShell>
  );
  }

  return (
    <ScreenShell
      title={screenTitle}
      subtitle={raiseDcSubtitle}
      noScroll
    >
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage && (
          <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        {/* Lead Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lead Information</Text>
          <FormField label="School Type" value={deal?.school_type || '-'} editable={false} />
          <FormField label="School Name" value={deal?.school_name || '-'} editable={false} />
          <FormField
            label="School Code"
            value={deal?.school_code || deal?.dc_code || '-'}
            editable={false}
          />
          <FormField label="Contact Person Name" value={deal?.contact_person || '-'} editable={false} />
          <FormField label="Contact Mobile" value={deal?.contact_mobile || '-'} editable={false} />
          {assignedToName ? (
            <FormField label="Assigned To" value={assignedToName} editable={false} />
          ) : (
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Assigned To *</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                  style={styles.picker}
                >
                  <Picker.Item label="Select Employee *" value="" />
                  {employees.map((emp) => (
                    <Picker.Item key={emp._id} label={emp.name} value={emp._id} />
                  ))}
                </Picker>
              </View>
            </View>
          )}
        </View>

        {/* More Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Information</Text>
          <FormField label="Town" value={getTown() || '-'} editable={false} />
          <FormField
            label="Address"
            value={deal?.address || deal?.location || '-'}
            editable={false}
            multiline
          />
          <FormField label="Zone" value={deal?.zone || '-'} editable={false} />
          <FormField label="Cluster" value={deal?.cluster || '-'} editable={false} />
          <FormField label="Remarks" value={deal?.remarks || '-'} editable={false} multiline />
        </View>

        {!isUpdateMode ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery and Address</Text>
            <Text style={styles.sectionSubtitle}>Transport details for this order</Text>
            <FormField label="Transport Name" value={transportName || '-'} editable={false} />
            <FormField label="Transport Location" value={transportLocation || '-'} editable={false} />
            <FormField
              label="Transportation Landmark"
              value={transportationLandmark || '-'}
              editable={false}
            />
            <FormField label="Pincode" value={transportPincode || '-'} editable={false} />
          </View>
        ) : null}

        {/* Products & Quantities — editable table (Raise DC & Update DC) */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Products & Quantities</Text>
              <Text style={styles.sectionSubtitle}>Product details and quantities</Text>
            </View>
            <TouchableOpacity style={styles.addProductBtn} onPress={addProductRow}>
              <Text style={styles.addProductBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
            <View style={[styles.tableWrap, styles.tableWrapEditable]}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colProduct]}>Product</Text>
                <Text style={[styles.th, styles.colClass]}>Class</Text>
                <Text style={[styles.th, styles.colCategory]}>Category</Text>
                <Text style={[styles.th, styles.colProductCategory]}>Product Category</Text>
                <Text style={[styles.th, styles.colSpecs]}>Specs</Text>
                <Text style={[styles.th, styles.colSubject]}>Subject</Text>
                <Text style={[styles.th, styles.colQty]}>Quantity</Text>
                <Text style={[styles.th, styles.colLevel]}>Level</Text>
                <Text style={[styles.th, styles.colTerm]}>Term</Text>
                <Text style={[styles.th, styles.colAction]}>Action</Text>
              </View>
              {productRows.map((row) => {
                const productOpts = getProductNames();
                const levelOpts = getProductLevels(row.product);
                const specOpts = getProductSpecs(row.product);
                const subjectOpts = getProductSubjects(row.product);
                const skuOpts = getProductCategories(row.product);
                const productList = (
                  productOpts.includes(row.product) ? productOpts : [row.product, ...productOpts]
                ).filter(Boolean);

                return (
                  <View key={row.id} style={styles.tableRow}>
                    <View style={[styles.cell, styles.colProduct]}>
                      <Picker
                        selectedValue={row.product}
                        onValueChange={(v) => updateProductRow(row.id, 'product', v)}
                        style={styles.cellPicker}
                        {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                      >
                        {productList.map((p) => (
                          <Picker.Item key={p} label={p} value={p} />
                        ))}
                      </Picker>
                    </View>
                    <View style={[styles.cell, styles.colClass]}>
                      <Picker
                        selectedValue={row.class}
                        onValueChange={(v) => updateProductRow(row.id, 'class', v)}
                        style={styles.cellPicker}
                        {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                      >
                        {CLASSES.map((c) => (
                          <Picker.Item key={c} label={c} value={c} />
                        ))}
                      </Picker>
                    </View>
                    <View style={[styles.cell, styles.colCategory]}>
                      <Picker
                        selectedValue={row.category}
                        onValueChange={(v) => updateProductRow(row.id, 'category', v)}
                        style={styles.cellPicker}
                        {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <Picker.Item key={c} label={c} value={c} />
                        ))}
                      </Picker>
                    </View>
                    <View style={[styles.cell, styles.colProductCategory]}>
                      {skuOpts.length > 0 ? (
                        <Picker
                          selectedValue={row.productCategory || skuOpts[0]}
                          onValueChange={(v) => updateProductRow(row.id, 'productCategory', v)}
                          style={styles.cellPicker}
                          {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                        >
                          {skuOpts.map((c) => (
                            <Picker.Item key={c} label={c} value={c} />
                          ))}
                        </Picker>
                      ) : (
                        <Text style={styles.cellPlain} numberOfLines={1}>
                          {row.productCategory?.trim() || '-'}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.cell, styles.colSpecs]}>
                      {specOpts.length > 0 ? (
                        <Picker
                          selectedValue={row.specs || specOpts[0]}
                          onValueChange={(v) => updateProductRow(row.id, 'specs', v)}
                          style={styles.cellPicker}
                          {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                        >
                          {specOpts.map((s) => (
                            <Picker.Item key={s} label={s} value={s} />
                          ))}
                        </Picker>
                      ) : (
                        <Text style={styles.cellPlain} numberOfLines={1}>
                          {row.specs?.trim() || '-'}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.cell, styles.colSubject]}>
                      {subjectOpts.length > 0 ? (
                        <Picker
                          selectedValue={row.subject || subjectOpts[0]}
                          onValueChange={(v) => updateProductRow(row.id, 'subject', v)}
                          style={styles.cellPicker}
                          {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                        >
                          {subjectOpts.map((s) => (
                            <Picker.Item key={s} label={s} value={s} />
                          ))}
                        </Picker>
                      ) : (
                        <Text style={styles.cellPlain} numberOfLines={1}>
                          {row.subject?.trim() || '-'}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.cell, styles.colQty]}>
                      <WebInput
                        style={styles.cellInput}
                        value={row.strength ? String(row.strength) : ''}
                        onChangeText={(v) => updateProductRow(row.id, 'strength', Number(v) || 0)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                    <View style={[styles.cell, styles.colLevel]}>
                      {levelOpts.length > 0 ? (
                        <Picker
                          selectedValue={row.level || levelOpts[0]}
                          onValueChange={(v) => updateProductRow(row.id, 'level', v)}
                          style={styles.cellPicker}
                          {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                        >
                          {levelOpts.map((l) => (
                            <Picker.Item key={l} label={l} value={l} />
                          ))}
                        </Picker>
                      ) : (
                        <WebInput
                          style={styles.cellInput}
                          value={row.level || ''}
                          onChangeText={(v) => updateProductRow(row.id, 'level', v)}
                          placeholder="Level"
                        />
                      )}
                    </View>
                    <View style={[styles.cell, styles.colTerm]}>
                      <Picker
                        selectedValue={row.term || 'Term 1'}
                        onValueChange={(v) => updateProductRow(row.id, 'term', v)}
                        style={styles.cellPicker}
                        {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                      >
                        {TERMS.map((t) => (
                          <Picker.Item key={t} label={t} value={t} />
                        ))}
                      </Picker>
                    </View>
                    <TouchableOpacity
                      style={[styles.cell, styles.colAction]}
                      onPress={() => removeProductRow(row.id)}
                    >
                      <Text style={styles.removeBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              <View style={styles.tableFooter}>
                <View style={[styles.footerLeadingSpacer, styles.footerLeadingSpacerEditable]} />
                <Text style={styles.footerLabel}>Grand Total:</Text>
                <Text style={styles.footerValue}>{grandTotalQty}</Text>
                <View style={styles.footerTrailingSpacer} />
              </View>
            </View>
          </ScrollView>
        </View>

        {/* DC Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DC Details</Text>
          {!isUpdateMode ? (
            <>
              <FormField
                label="Contact Person 2 *"
                value={contactPerson2}
                onChangeText={setContactPerson2}
                placeholder="Enter contact person 2"
              />
              <FormField
                label="Contact Mobile 2 *"
                value={contactMobile2}
                onChangeText={(text) => setContactMobile2(sanitizePhoneDigits(text))}
                placeholder="10 to 15 digits"
                maxLength={15}
                keyboardType="phone-pad"
              />
            </>
          ) : null}
          <DateField
            label="DC Date *"
            value={dcDate}
            onChange={setDcDate}
            showPicker={showDcDatePicker}
            setShowPicker={setShowDcDatePicker}
            minimumDate={startOfToday()}
          />
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>DC Category *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={dcCategory} onValueChange={setDcCategory} style={styles.picker}>
                <Picker.Item label="Select DC Category *" value="" />
                {(isUpdateMode ? ['Term 1', 'Term 2', 'Both'] : DC_CATEGORIES).map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>
          </View>
          <FormField
            label="DC Remarks *"
            value={dcRemarks}
            onChangeText={setDcRemarks}
            placeholder="Remarks"
          />
          {isUpdateMode ? (
            <FormField
              label="DC Notes"
              value={dcNotes}
              onChangeText={setDcNotes}
              placeholder="Notes (optional)"
              multiline
            />
          ) : null}
        </View>

        {/* Buttons */}
        {isUpdateMode ? (
          <View style={styles.updateActions}>
            <TouchableOpacity
              style={styles.updateSecondaryBtn}
              onPress={handlePrint}
              disabled={submitting || saving}
            >
              <Text style={styles.updateSecondaryBtnText}>Print</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.updateSecondaryBtn}
              onPress={handleSaveDC}
              disabled={submitting || saving}
            >
              <Text style={styles.updateSecondaryBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.updateSubmitBtn, (submitting || saving) && styles.submitButtonDisabled]}
              onPress={handleSubmitToSeniorCoordinator}
              disabled={submitting || saving}
            >
              <Text style={styles.updateSubmitBtnText} numberOfLines={1}>
                {submitting ? 'Submitting…' : 'Submit to Senior Coordinator'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
              disabled={submitting || accepting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            {canApproveDC ? (
              <TouchableOpacity
                style={[styles.acceptButton, (accepting || submitting) && styles.submitButtonDisabled]}
                onPress={handleAcceptDC}
                disabled={accepting || submitting}
              >
                <Text style={styles.acceptButtonText}>
                  {accepting
                    ? 'Processing…'
                    : deal?.status === 'dc_approved' || deal?.status === 'dc_accepted'
                      ? 'Update DC'
                      : 'Accept'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.submitButton, (submitting || accepting) && styles.submitButtonDisabled]}
              onPress={handleSubmitToSeniorCoordinator}
              disabled={submitting || accepting}
            >
              <Text style={styles.submitButtonText} numberOfLines={2}>
                {submitting ? 'Submitting…' : 'Submit to Senior Coordinator'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline = false,
  maxLength,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address';
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={[styles.input, !editable && styles.inputDisabled, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        maxLength={maxLength}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  errorBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { ...typography.body.medium, color: colors.error },
  mandatoryNote: { ...typography.body.small, color: colors.textSecondary, marginBottom: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 4 },
  sectionSubtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 0 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  fieldContainer: { marginBottom: 14 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.8 },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  pickerWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.backgroundLight },
  picker: { height: 48 },
  dateTouchable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  placeholderText: { color: colors.textSecondary },
  calendarIcon: { fontSize: 18 },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  datePickerBox: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 24 : 16 },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  datePickerTitle: { ...typography.heading.h3, color: colors.textPrimary },
  doneText: { ...typography.label.medium, color: colors.primary, fontWeight: '600' },
  tableScroll: { marginHorizontal: -20 },
  tableWrap: { minWidth: 980, paddingRight: 16 },
  tableWrapEditable: { minWidth: 1080 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
    alignItems: 'center',
  },
  th: {
    ...typography.label.small,
    color: '#1E3A5F',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: '#fff',
  },
  td: {
    ...typography.body.small,
    color: colors.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tdText: {
    ...typography.body.small,
    color: '#0F172A',
    paddingHorizontal: 4,
  },
  tdAlignCenter: { textAlign: 'center' },
  cell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  cellPicker: {
    width: '100%',
    height: 40,
    color: colors.textPrimary,
  },
  cellPlain: {
    ...typography.body.small,
    color: '#0F172A',
    paddingHorizontal: 4,
  },
  cellInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 13,
    minHeight: 36,
    marginBottom: 0,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  addProductBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addProductBtnText: {
    ...typography.label.medium,
    color: colors.textLight,
    fontWeight: '600',
  },
  colProduct: { width: 120 },
  colClass: { width: 72 },
  colCategory: { width: 130 },
  colProductCategory: { width: 130 },
  colSpecs: { width: 100 },
  colSubject: { width: 100 },
  colQty: { width: 80 },
  colLevel: { width: 100 },
  colTerm: { width: 100 },
  colAction: { width: 52, alignItems: 'center' },
  removeBtn: { fontSize: 18, color: '#DC2626', fontWeight: 'bold' },
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#E2E8F0',
    borderTopWidth: 2,
    borderTopColor: '#94A3B8',
  },
  footerLeadingSpacer: { width: 652 },
  footerLeadingSpacerEditable: { width: 652 },
  footerLabel: {
    ...typography.body.medium,
    fontWeight: '700',
    color: colors.textPrimary,
    width: 100,
    textAlign: 'right',
    paddingRight: 8,
  },
  footerValue: {
    ...typography.body.medium,
    fontWeight: '700',
    color: colors.textPrimary,
    width: 80,
    textAlign: 'center',
  },
  footerTrailingSpacer: { flex: 1 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  updateActions: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  updateSecondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.backgroundLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  updateSecondaryBtnText: {
    ...typography.label.medium,
    color: colors.textPrimary,
  },
  updateSubmitBtn: {
    borderRadius: 8,
    backgroundColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  updateSubmitBtnText: {
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
  },
  updateActionsLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cancelButton: {
    flexGrow: 1,
    flexBasis: 120,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '600', textAlign: 'center' },
  acceptButton: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#16A34A',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#15803D',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  submitButton: {
    flexGrow: 2,
    flexBasis: 180,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitGradient: { paddingVertical: 14, alignItems: 'center' },
  submitButtonText: {
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
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
});

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
import { useDcCatalog } from '../../hooks/useDcCatalog';
import { DcCategoryPicker } from '../../components/dc/DcCategoryPicker';
import { AbacusMaterialsSummary } from '../../components/dc/AbacusMaterials';
import {
  TransportDetailsSection,
  canEditTransportDetails,
  transportDetailsFromOrder,
} from '../../components/dc/TransportDetailsSection';
import { canonicalDcRowCategory, dcRowCategoryOrDefault } from '../../lib/crm/dcRowCategory';
import { withBilledTotals } from '../../lib/crm/dcPaymentDivisors';
import { splitDeliverableRows } from '../../lib/crm/deliverableStockRows';
import { isTermWiseDcRecord, resolveClosedSalesProductLines } from '../../components/dc/closedSalesLines';
import { CLOSE_LEAD_DESTINATION } from '../../lib/crm/closeLeadTermRouting';
import { resolveExistingProductTerm } from '../../lib/crm/productTerm';

type ProductRow = {
  id: string;
  itemType?: string;
  product: string;
  class: string;
  category: string;
  productCategory?: string;
  specs: string;
  subject?: string;
  // IIT assignment identity (class section, program, stream)
  section?: string;
  program?: string;
  stream?: string;
  quantity: number;
  strength: number;
  level: string;
  term: string;
  unit_price: number;
  price?: number;
};

const DEFAULT_ROW: Omit<ProductRow, 'id'> = {
  product: 'Abacus',
  class: '1',
  category: 'New Students',
  specs: '',
  quantity: 1,
  strength: 0,
  level: 'L1',
  term: 'Term 1',
  unit_price: 0,
};

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const DC_CATEGORIES = ['Term 1', 'Term 2', 'Term 3', 'Full Year'];
const TERMS = ['Term 1', 'Term 2', 'Both'];

const dcListFromResponse = (res: any): any[] =>
  Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];

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

  const catalog = useDcCatalog();
  const {
    productNames: availableProducts,
    getProductLevels,
    getProductSpecs,
    getProductSubjects,
    getProductCategories,
    hasProductSpecs,
    getCalculationType,
    getCatalogFallbackCount,
  } = catalog;
  const getDefaultLevel = (productName: string) => getProductLevels(productName)[0] || '';

  const [deal, setDeal] = useState<any>(null);
  const [isLead, setIsLead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingDC, setExistingDC] = useState<any>(null);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
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
    if (catalog.loading) return;
    loadEmployees();
    loadDeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, catalog.loading]);

  /** Map DcOrder / DC product lines into Closed Sales rows without mixing quantity and strength (web mapSourceProductToRow). */
  const mapSourceProductToRow = (p: any, idx: number): ProductRow => {
    const originalProduct = p.product_name || p.product || p.productName || 'Abacus';
    const skuCategories = getProductCategories(originalProduct);
    const normalizedSku = String(p.productCategory || p.category || '').trim();
    const matchedSku = skuCategories.includes(normalizedSku)
      ? normalizedSku
      : skuCategories.find((c) => c.toLowerCase() === normalizedSku.toLowerCase());
    const quantityNum =
      p.quantity !== undefined && p.quantity !== null && p.quantity !== '' ? Number(p.quantity) : 1;
    const strengthNum =
      p.strength !== undefined && p.strength !== null && p.strength !== '' ? Number(p.strength) : 0;
    return {
      id: String(idx + 1),
      product: originalProduct,
      class: p.class || '1',
      category: canonicalDcRowCategory(p.category) || 'New Students',
      productCategory: matchedSku || undefined,
      specs: p.specs || 'Regular',
      subject: p.subject || undefined,
      itemType: p.itemType || undefined,
      section: p.section || undefined,
      program: p.program || undefined,
      stream: p.stream || undefined,
      quantity: Number.isFinite(quantityNum) && quantityNum >= 0 ? quantityNum : 1,
      strength: Number.isFinite(strengthNum) && strengthNum >= 0 ? strengthNum : 0,
      // Specimen / related-item rows never get a default level.
      level: p.itemType ? p.level || '' : p.level || getDefaultLevel(originalProduct),
      term: resolveExistingProductTerm(p),
      unit_price: Number(p.unit_price) || Number(p.price) || 0,
    };
  };

  const loadDeal = async () => {
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
      setContactPerson2(pe.contact_person2 || dcReq.contact_person2 || data?.contact_person2 || '');
      setContactMobile2(pe.contact_mobile2 || dcReq.contact_mobile2 || data?.contact_mobile2 || '');
      // DC details the BDE entered with the request (web prefills from dcRequestData).
      if (dcReq.dcDate) {
        const loaded = String(dcReq.dcDate).split('T')[0];
        const todayYmd = toYmd(startOfToday());
        setDcDate(loaded >= todayYmd ? loaded : todayYmd);
      }
      if (dcReq.dcCategory) setDcCategory(dcReq.dcCategory);
      if (dcReq.dcRemarks) setDcRemarks(dcReq.dcRemarks);
      if (dcReq.dcNotes) setDcNotes(String(dcReq.dcNotes));
      if (data?.assigned_to) {
        const id = typeof data.assigned_to === 'object' ? data.assigned_to._id : data.assigned_to;
        if (id) setSelectedEmployeeId(id);
      }

      // My Clients DC for this order (never the Term-Wise DC) + Term-Wise sibling lines.
      let linkedDC: any = null;
      let siblingRows: any[] = [];
      try {
        const dcs = dcListFromResponse(await apiService.get(`/dc?dcOrderId=${encodeURIComponent(dealId)}`));
        siblingRows = dcs
          .filter((d: any) => isTermWiseDcRecord(d))
          .flatMap((d: any) => (Array.isArray(d.productDetails) ? d.productDetails : []));
        const pool = dcs.filter((d: any) => !isTermWiseDcRecord(d));
        if (pool.length > 0) {
          const preferred = pool.filter((d: any) =>
            ['created', 'po_submitted', 'pending_dc'].includes(String(d.status || '')),
          );
          const ranked = (preferred.length > 0 ? preferred : pool).slice().sort(
            (a: any, b: any) =>
              new Date(b.updatedAt || b.createdAt || 0).getTime() -
              new Date(a.updatedAt || a.createdAt || 0).getTime(),
          );
          linkedDC = ranked[0];
          try {
            const fullDC = await apiService.get(`/dc/${linkedDC._id}`);
            if (fullDC && !isTermWiseDcRecord(fullDC)) linkedDC = fullDC;
          } catch {
            /* keep list DC */
          }
          if (linkedDC?.dcDate) {
            const loaded = String(linkedDC.dcDate).split('T')[0];
            const todayYmd = toYmd(startOfToday());
            setDcDate(loaded >= todayYmd ? loaded : todayYmd);
          }
          if (linkedDC?.dcCategory) setDcCategory(linkedDC.dcCategory);
          if (linkedDC?.dcRemarks) setDcRemarks(linkedDC.dcRemarks || '');
          if (linkedDC?.dcNotes) setDcNotes(linkedDC.dcNotes || '');
        }
      } catch {
        linkedDC = null;
      }
      setExistingDC(linkedDC);

      const poProducts = resolveClosedSalesProductLines(data, linkedDC, siblingRows);
      if (poProducts.length > 0) {
        setProductRows(splitDeliverableRows(poProducts).map((p: any, idx: number) => mapSourceProductToRow(p, idx)));
      } else {
        setProductRows([{ ...DEFAULT_ROW, id: '1' }]);
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

  const getProductNames = (): string[] => availableProducts;

  /** Product change resets level / series / specs / deliverable to the product's catalogue defaults (web). */
  const applyProductDefaults = (row: ProductRow, productName: string): ProductRow => {
    const cats = getProductCategories(productName);
    const subjects = getProductSubjects(productName);
    return {
      ...row,
      product: productName,
      level: getDefaultLevel(productName),
      productCategory: cats.length ? cats[0] || '' : undefined,
      specs: getProductSpecs(productName)[0] || '',
      subject: subjects.length ? subjects[0] || '' : undefined,
    };
  };

  const updateProductRow = (id: string, field: keyof ProductRow, value: any) => {
    setProductRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'product') return applyProductDefaults(r, value);
        return { ...r, [field]: value };
      }),
    );
  };

  const removeProductRow = (id: string) => {
    setProductRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const addProductRow = () => {
    const productName = getProductNames()[0] || DEFAULT_ROW.product;
    const base: ProductRow = { ...DEFAULT_ROW, id: String(Date.now()), product: productName };
    setProductRows((prev) => [...prev, applyProductDefaults(base, productName)]);
  };

  // BDE requests the DC; Coordinator (or Super Admin) accepts it into Pending DC (web canRequestDC / canApproveDC).
  const canRequestDC = user?.role === 'Executive';
  const canApproveDC =
    user?.role === 'Super Admin' ||
    user?.role === 'Admin' ||
    user?.role === 'Coordinator';
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

  // Transport Name / Transport To / location / landmark / pincode (BDE's pending edit first, as before).
  const transportDetails = React.useMemo(() => transportDetailsFromOrder(deal), [deal]);

  const assignedToName = getAssignedToName();

  const raiseDcSubtitle = isUpdateMode
    ? 'Update DC details and submit to Senior Coordinator'
    : deal?.status === 'dc_requested'
      ? 'Review the DC request from the BDE. Accept sends it to Pending DC for the Senior Coordinator.'
      : 'Fill in DC details. Accept sends it to Pending DC for the Senior Coordinator.';

  const screenTitle = isUpdateMode
    ? 'Update DC'
    : `Raise DC${deal?.school_name ? ` - ${deal.school_name}` : ''}`;

  const grandTotalQty = productRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  /** DC rows as web Closed Sales sends them: billed totals (free rows ₹0), unit price, IIT identity, item type. */
  const buildProductDetails = () =>
    withBilledTotals(productRows as any[], getCalculationType, getCatalogFallbackCount).map((row: any) => ({
      product: row.product || '',
      class: row.class || '1',
      category: canonicalDcRowCategory(row.category) || 'New Students',
      productCategory: row.productCategory || undefined,
      specs: row.specs || 'Regular',
      subject: row.subject || undefined,
      itemType: row.itemType || undefined,
      section: row.section || undefined,
      program: row.program || undefined,
      stream: row.stream || undefined,
      strength: Number(row.strength) || 0,
      quantity: Number(row.quantity) || 0,
      level: row.itemType ? row.level || '' : row.level || getDefaultLevel(row.product || 'Abacus'),
      term: row.term || 'Term 1',
      unit_price: Number(row.unit_price) || Number(row.price) || 0,
      price: Number(row.unit_price) || Number(row.price) || 0,
      total: Number(row.total) || 0,
      closeLeadDestination: CLOSE_LEAD_DESTINATION.MY_CLIENT,
    }));

  const totalRequestedQuantity = () => productRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0) || 1;

  const getAssignedEmployeeId = () =>
    selectedEmployeeId ||
    (typeof deal?.assigned_to === 'object' ? deal?.assigned_to?._id : deal?.assigned_to) ||
    '';

  /** Contact Person 2 / Mobile 2 are mandatory on this Closed Sales form (web validateClosedSalesContact2). */
  const contact2Payload = () => ({
    contact_person2: contactPerson2.trim(),
    contact_mobile2: contactMobile2.trim(),
    validateClosedSalesContact2: true,
  });

  const fail = (message: string) => {
    setErrorMessage(message);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    return false;
  };

  /** DC Date + DC Category required; Remarks optional (web validateDcDetailsFields). */
  const validate = (opts?: { forSave?: boolean }): boolean => {
    if (!selectedEmployeeId.trim() && !deal?.assigned_to) return fail('Please assign an employee before submitting');
    if (!isUpdateMode) {
      if (!contactPerson2.trim()) return fail('Contact Person 2 is required.');
      if (!contactMobile2.trim()) return fail('Contact Mobile 2 is required.');
      const mobile2Error = phoneDigitsError(contactMobile2, true);
      if (mobile2Error) return fail(mobile2Error);
    }
    if (!opts?.forSave) {
      if (!dcDate.trim()) return fail('DC Date is required.');
      if (!dcCategory.trim()) return fail('DC Category is required.');
    }
    if (productRows.length === 0) return fail('Please add at least one product before accepting');
    setErrorMessage(null);
    return true;
  };

  /** Row checks before the DC is accepted (web handleSendToSeniorCoordinator). */
  const validateRows = (): boolean => {
    const invalidRows: string[] = [];
    productRows.forEach((row, idx) => {
      const n = idx + 1;
      if (!row.product || row.product.trim() === '') invalidRows.push(`Row ${n}: Product is required`);
      if (row.product && hasProductSpecs(row.product) && (!row.specs || row.specs.trim() === '')) {
        invalidRows.push(`Row ${n}: Specs is required`);
      }
      if (!row.quantity || Number(row.quantity) <= 0) invalidRows.push(`Row ${n}: Quantity must be greater than 0`);
      if (row.product && getProductLevels(row.product).length > 0 && (!row.level || row.level.trim() === '')) {
        invalidRows.push(`Row ${n}: Term / Level is required`);
      }
      if (!row.term || row.term.trim() === '') invalidRows.push(`Row ${n}: Term is required`);
    });
    if (invalidRows.length > 0) return fail('Please fill in all required fields:\n\n' + invalidRows.join('\n'));
    return true;
  };

  const handleSaveDC = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validate({ forSave: true })) return;

    setSaving(true);
    try {
      const productDetails = buildProductDetails();
      const requestedQuantity = totalRequestedQuantity();
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

      if (existingDC?._id && !isTermWiseDcRecord(existingDC)) {
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
        `Products: ${productRows.map((r) => `${r.product} - ${r.quantity}`).join(', ') || '-'}`,
        `DC Date: ${dcDate || '-'}`,
        `Category: ${dcCategory || '-'}`,
        `Remarks: ${dcRemarks || '-'}`,
      ].join('\n'),
    );
  };

  /** Executive requests the DC: stores the request on the DcOrder (web handleRequestDC). */
  const handleRequestDC = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validate()) return;
    const employeeId = getAssignedEmployeeId();
    if (!employeeId) {
      fail('Please assign an employee before requesting DC');
      return;
    }
    setRequesting(true);
    try {
      await apiService.put(`/dc-orders/${dealId}`, {
        status: 'dc_requested',
        dcRequestData: {
          dcDate: dcDate || undefined,
          dcRemarks: dcRemarks || undefined,
          dcCategory: dcCategory || undefined,
          requestedQuantity: totalRequestedQuantity(),
          productDetails: buildProductDetails(),
          employeeId,
        },
      });
      setSuccessMessage('DC request submitted successfully! The Coordinator will review and accept it.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => navigation.goBack(), 1200);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to submit DC request');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setRequesting(false);
    }
  };

  /**
   * Coordinator accepts the DC into Pending DC for the Senior Coordinator (web handleSendToSeniorCoordinator):
   * PUT /dc/:existingId {…, status:'pending_dc'} when a My Clients DC exists, else POST /dc/raise;
   * then PUT /dc-orders/:id {status:'dc_sent_to_senior'}.
   */
  const handleSubmitToSeniorCoordinator = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validate() || !validateRows()) return;

    setSubmitting(true);
    try {
      const dcRequestData = deal?.dcRequestData || {};
      const raisePayload: any = {
        dcOrderId: dealId,
        dcDate: String(dcDate).trim(),
        dcRemarks: dcRemarks.trim() || undefined,
        dcCategory: String(dcCategory).trim(),
        ...(dcNotes.trim() ? { dcNotes: dcNotes.trim() } : {}),
        requestedQuantity: totalRequestedQuantity(),
        productDetails: buildProductDetails(),
        status: 'pending_dc',
      };
      const employeeId = dcRequestData.employeeId || getAssignedEmployeeId();
      if (employeeId) raisePayload.employeeId = employeeId;

      // Shortage DC: only rows with a quantity, each carrying its shortage quantity (web).
      if (String(dcCategory || '').toLowerCase() === 'shortage') {
        raisePayload.dcType = 'shortage';
        raisePayload.parentDcId = existingDC?._id;
        raisePayload.productDetails = raisePayload.productDetails
          .filter((p: any) => Number(p.quantity || p.strength || 0) > 0)
          .map((p: any) => ({
            ...p,
            shortageQuantity: Number(p.quantity || p.strength || 0),
            deliveredQuantity: 0,
          }));
      }

      if (existingDC?._id && !isTermWiseDcRecord(existingDC)) {
        await apiService.put(`/dc/${existingDC._id}`, raisePayload);
      } else {
        await apiService.post('/dc/raise', raisePayload);
      }

      if (!isLead) {
        await apiService.put(`/dc-orders/${dealId}`, {
          status: 'dc_sent_to_senior',
          ...contact2Payload(),
        });
      }

      setSuccessMessage('DC accepted. It is now in Pending DC for the Senior Coordinator.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => {
        if (isUpdateMode) {
          if (!navigateRoot('DCSaved')) navigation.navigate('DCSaved');
        } else {
          navigation.goBack();
        }
      }, 1500);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to accept DC');
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
            <TransportDetailsSection
              dcOrderId={isLead ? undefined : deal?._id || dealId}
              details={transportDetails}
              canEdit={canEditTransportDetails(user?.role)}
              school={{ name: deal?.school_name, mobile: deal?.contact_mobile }}
              inputStyle={styles.input}
              disabledInputStyle={styles.inputDisabled}
              onSaved={(saved) =>
                setDeal((d: any) =>
                  d
                    ? { ...d, ...saved, pendingEdit: d.pendingEdit ? { ...d.pendingEdit, ...saved } : d.pendingEdit }
                    : d
                )
              }
            />
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
                <Text style={[styles.th, styles.colCategory]}>Enrollment Category</Text>
                <Text style={[styles.th, styles.colProductCategory]}>Series</Text>
                <Text style={[styles.th, styles.colSpecs]}>Specs</Text>
                <Text style={[styles.th, styles.colSubject]}>Deliverables</Text>
                <Text style={[styles.th, styles.colQty]}>Quantity</Text>
                <Text style={[styles.th, styles.colLevel]}>Term / Level</Text>
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
                        {(CLASSES.includes(row.class) || !row.class ? CLASSES : [row.class, ...CLASSES]).map((c) => (
                          <Picker.Item key={c} label={c} value={c} />
                        ))}
                      </Picker>
                    </View>
                    <View style={[styles.cell, styles.colCategory]}>
                      <DcCategoryPicker
                        value={dcRowCategoryOrDefault(row.category)}
                        onChange={(v) => updateProductRow(row.id, 'category', v)}
                      />
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
                        value={row.quantity ? String(row.quantity) : ''}
                        onChangeText={(v) => updateProductRow(row.id, 'quantity', Number(v.replace(/[^0-9]/g, '')) || 0)}
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
                          placeholder="Term / Level"
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
          <AbacusMaterialsSummary
            materials={deal?.abacusMaterials || deal?.dcRequestData?.abacusMaterials}
          />
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
            label="DC Remarks"
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
              disabled={submitting || requesting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            {canRequestDC && deal?.status !== 'dc_requested' && deal?.status !== 'dc_accepted' ? (
              <TouchableOpacity
                style={[styles.submitButton, (requesting || submitting) && styles.submitButtonDisabled]}
                onPress={handleRequestDC}
                disabled={requesting || submitting}
              >
                <Text style={styles.submitButtonText} numberOfLines={2}>
                  {requesting ? 'Submitting…' : 'Raise DC'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {canApproveDC ? (
              <TouchableOpacity
                style={[styles.acceptButton, (requesting || submitting) && styles.submitButtonDisabled]}
                onPress={handleSubmitToSeniorCoordinator}
                disabled={requesting || submitting}
              >
                <Text style={styles.acceptButtonText}>{submitting ? 'Accepting…' : 'Accept'}</Text>
              </TouchableOpacity>
            ) : null}
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

/**
 * Pending DC Open screen - form aligned with navbar-landing Pending DC "Open" view.
 * GET /dc/:id, GET /dc-orders/:id; Lead Info & More Info & Delivery (read-only);
 * DC Details editable; Products table; Save (PUT /dc/:id), Submit to Warehouse (POST /dc/:id/manager-request).
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
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import {
  applyCatalogDefaultsToRow,
  findCatalogProduct,
  getCatalogProductNames,
  getProductCategoryOptions,
  getProductLevelsOptions,
  getProductSpecsOptions,
  getProductSubjectsOptions,
} from '../../utils/productCatalog';

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

function resolveLineQty(p: { quantity?: unknown; strength?: unknown; qty?: unknown }) {
  for (const raw of [p.quantity, p.strength, p.qty]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  for (const raw of [p.quantity, p.strength, p.qty]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

const dash = (v?: string | null) => {
  const s = String(v || '').trim();
  return s || '-';
};

type DcOrderData = {
  _id?: string;
  school_name?: string;
  school_type?: string;
  dc_code?: string;
  contact_person?: string;
  contact_mobile?: string;
  email?: string;
  address?: string;
  location?: string;
  zone?: string;
  cluster?: string;
  remarks?: string;
  assigned_to?: { _id: string; name?: string } | string;
  transport_name?: string;
  transport_location?: string;
  transportation_landmark?: string;
  pincode?: string;
  products?: any[];
  dcRequestData?: { productDetails?: any[] };
  pendingEdit?: {
    transport_name?: string;
    transport_location?: string;
    transportation_landmark?: string;
    pincode?: string;
  };
};

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

function DateField({
  label,
  value,
  onChange,
  showPicker,
  setShowPicker,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
}) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement('input', {
          type: 'date',
          value: value || '',
          onChange: (e: any) => onChange(e.target.value || ''),
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
          value={parseYmd(value)}
          mode="date"
          display="default"
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
              value={parseYmd(value)}
              mode="date"
              display="spinner"
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

export default function DCPendingOpenScreen({ navigation, route }: any) {
  const dcId = route?.params?.dcId as string | undefined;
  const fromTermWise = route?.params?.fromTermWise === true;
  const scrollRef = useRef<ScrollView>(null);
  const { user } = useAuth();

  const [dc, setDc] = useState<any>(null);
  const [dcOrder, setDcOrder] = useState<DcOrderData | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // DC Details (editable)
  const [financeRemarks, setFinanceRemarks] = useState('');
  const [splApproval, setSplApproval] = useState('');
  const [dcDate, setDcDate] = useState('');
  const [showDcDatePicker, setShowDcDatePicker] = useState(false);
  const [dcRemarks, setDcRemarks] = useState('');
  const [dcCategory, setDcCategory] = useState('Term 1');
  const [dcNotes, setDcNotes] = useState('');
  const [smeRemarks, setSmeRemarks] = useState('');

  const [productRows, setProductRows] = useState<ProductRow[]>([]);

  const isSeniorCoordinator = user?.role === 'Senior Coordinator';
  const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';
  const isTermWiseDc = fromTermWise || dc?.status === 'scheduled_for_later';
  const canSubmitToWarehouse = !isTermWiseDc && (isSeniorCoordinator || isAdmin);

  useEffect(() => {
    if (fromTermWise && dcId) {
      (async () => {
        try {
          const fullDC = await apiService.get(`/dc/${dcId}`);
          const orderId =
            fullDC.dcOrderId && typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId._id
              ? fullDC.dcOrderId._id
              : typeof fullDC.dcOrderId === 'string'
                ? fullDC.dcOrderId
                : null;
          if (orderId) {
            navigation.replace('ClientEditPO', { orderId, dcId });
            return;
          }
        } catch {
          /* fall through to pending open */
        }
        loadData();
        loadProducts();
      })();
      return;
    }
    if (dcId) {
      loadData();
      loadProducts();
    } else {
      setLoading(false);
      setErrorMessage('No DC selected');
    }
  }, [dcId, fromTermWise]);

  const loadData = async () => {
    try {
      setLoading(true);
      const fullDC = await apiService.get(`/dc/${dcId}`);
      setDc(fullDC);

      setFinanceRemarks(fullDC.financeRemarks || '');
      setSplApproval(fullDC.splApproval || '');
      setDcDate(fullDC.dcDate ? new Date(fullDC.dcDate).toISOString().split('T')[0] : '');
      setDcRemarks(fullDC.dcRemarks || '');
      setDcCategory(fullDC.dcCategory || 'Term 1');
      setDcNotes(fullDC.dcNotes || '');
      setSmeRemarks(fullDC.smeRemarks || '');

      const orderId =
        fullDC.dcOrderId && typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId._id
          ? fullDC.dcOrderId._id
          : typeof fullDC.dcOrderId === 'string'
            ? fullDC.dcOrderId
            : null;
      let orderData: DcOrderData | null = null;
      if (orderId) {
        try {
          orderData = await apiService.get(`/dc-orders/${orderId}`);
          setDcOrder(orderData);
        } catch {
          setDcOrder(null);
        }
      } else {
        setDcOrder(null);
      }

      // Prefer this DC's productDetails; fall back to request snapshot / order products.
      const dcDetails = Array.isArray(fullDC.productDetails) ? fullDC.productDetails : [];
      const requestDetails = Array.isArray(orderData?.dcRequestData?.productDetails)
        ? orderData!.dcRequestData!.productDetails!
        : [];
      const orderProducts = Array.isArray(orderData?.products) ? orderData!.products! : [];
      const source =
        dcDetails.length > 0 ? dcDetails : requestDetails.length > 0 ? requestDetails : orderProducts;

      if (source.length > 0) {
        setProductRows(
          source.map((p: any, idx: number) => {
            const qty = resolveLineQty(p);
            return {
              id: String(idx + 1),
              product: p.product || p.productName || p.product_name || 'Abacus',
              class: p.class != null && String(p.class).trim() ? String(p.class) : '1',
              category: p.category || 'new Students',
              productCategory: p.productCategory || undefined,
              specs: p.specs || '',
              subject: p.subject,
              strength: qty > 0 ? qty : Number(fullDC.requestedQuantity) || 0,
              level: p.level || '',
              term: p.term || 'Term 1',
            };
          }),
        );
      } else {
        const rawProduct = fullDC.product || 'Abacus';
        setProductRows([
          {
            id: '1',
            product: rawProduct,
            class: '1',
            category: 'new Students',
            specs: 'Regular',
            strength: fullDC.requestedQuantity || 0,
            level: 'L1',
            term: 'Term 1',
          },
        ]);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to load DC');
      setDc(null);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await apiService.get('/products/active').catch(() => apiService.get('/products'));
      const list = Array.isArray(data) ? data : data?.data || data?.products || [];
      setProducts(list);
    } catch {
      setProducts([]);
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

  const validateDcDetails = (): boolean => {
    if (!financeRemarks.trim()) {
      setErrorMessage('Finance Remarks * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (!smeRemarks.trim()) {
      setErrorMessage('SME Remarks * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (!splApproval.trim()) {
      setErrorMessage('SPL Approval * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (!dcDate.trim()) {
      setErrorMessage('DC Date * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (!dcRemarks.trim()) {
      setErrorMessage('DC Remarks * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (!dcCategory.trim()) {
      setErrorMessage('DC Category * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    if (!dcNotes.trim()) {
      setErrorMessage('DC Notes * is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!dc) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!validateDcDetails()) return;

    setSaving(true);
    try {
      const totalQuantity = productRows.reduce((sum, row) => sum + (Number(row.strength) || 0), 0);
      const productDetails = productRows.map((row) => ({
        product: row.product,
        class: row.class || '1',
        category: row.category || 'new Students',
        productCategory: row.productCategory || undefined,
        productName: row.product,
        quantity: Number(row.strength) || 0,
        strength: Number(row.strength) || 0,
        level: row.level || '',
        specs: row.specs || '',
        subject: row.subject,
        term: row.term || 'Term 1',
      }));

      await apiService.put(`/dc/${dcId}`, {
        financeRemarks,
        splApproval,
        dcDate: dcDate || undefined,
        dcRemarks,
        dcCategory,
        dcNotes,
        smeRemarks,
        productDetails,
        requestedQuantity: totalQuantity || dc.requestedQuantity,
      });

      setSuccessMessage('DC saved successfully.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to save DC');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitToWarehouse = async () => {
    if (!dc) return;
    setErrorMessage(null);
    if (!validateDcDetails()) return;

    const totalQuantity = productRows.reduce((sum, row) => sum + (Number(row.strength) || 0), 0);
    if (totalQuantity <= 0) {
      setErrorMessage('Please add at least one product with quantity (Strength) > 0');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSubmitting(true);
    try {
      const productDetails = productRows.map((row) => ({
        product: row.product,
        class: row.class || '1',
        category: row.category || 'new Students',
        productCategory: row.productCategory || undefined,
        productName: row.product,
        quantity: Number(row.strength) || 0,
        strength: Number(row.strength) || 0,
        level: row.level || '',
        specs: row.specs || '',
        subject: row.subject,
        term: row.term || 'Term 1',
      }));

      await apiService.put(`/dc/${dcId}`, {
        financeRemarks,
        splApproval,
        dcDate: dcDate || undefined,
        dcRemarks,
        dcCategory,
        dcNotes,
        smeRemarks,
        productDetails,
        requestedQuantity: totalQuantity,
      });

      await apiService.post(`/dc/${dcId}/manager-request`, {
        requestedQuantity: totalQuantity,
        remarks: dcRemarks || smeRemarks || '',
      });

      setSuccessMessage('DC submitted to Warehouse successfully.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => navigation.goBack(), 1500);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to submit to Warehouse');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const getDCNumber = () => {
    if (!dc?.createdAt) return `DC-${(dc?._id || '').slice(-6)}`;
    const year = new Date(dc.createdAt).getFullYear();
    const shortYear = year.toString().slice(-2);
    const nextYear = (year + 1).toString().slice(-2);
    const id = (dc._id || '').slice(-4);
    return `${shortYear}-${nextYear}/${id}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading DC...</Text>
      </View>
    );
  }

  if (!dc && !loading) {
    return (
    <ScreenShell title="Pending DC - Open" loading={loading}>
<View style={styles.errorBlock}>
          <Text style={styles.errorText}>{errorMessage || 'DC not found'}</Text>
        </View>
    </ScreenShell>
  );
  }

  const order = dcOrder || (dc?.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null);
  const assignedName =
    order?.assigned_to && typeof order.assigned_to === 'object' && 'name' in order.assigned_to
      ? (order.assigned_to as { name?: string }).name
      : dc?.employeeId && typeof dc.employeeId === 'object' && 'name' in dc.employeeId
        ? (dc.employeeId as { name?: string }).name
        : '-';

  const shellTitle = isTermWiseDc
    ? `Edit PO${order?.school_name ? ` - ${order.school_name}` : ''}`
    : `Pending DC${order?.school_name ? ` - ${order.school_name}` : ''}`;

  return (
    <ScreenShell title={shellTitle} noScroll>
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage && (
          <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <View style={styles.dcMeta}>
          <Text style={styles.dcMetaText}>DC No: {getDCNumber()}</Text>
          {order && (
            <Text style={styles.dcMetaText}>
              Due: {(order as any).due_amount ?? 0} ({(order as any).due_percentage ?? 0}%)
            </Text>
          )}
        </View>

        {!isTermWiseDc && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lead Information</Text>
          <FormField label="School Type" value={order?.school_type || '-'} editable={false} />
          <FormField label="School Name" value={order?.school_name || dc?.customerName || '-'} editable={false} />
          <FormField label="School Code" value={order?.school_code || order?.dc_code || '-'} editable={false} />
          <FormField label="Contact Person" value={order?.contact_person || '-'} editable={false} />
          <FormField label="Contact Mobile" value={order?.contact_mobile || dc?.customerPhone || '-'} editable={false} />
          <FormField label="Assigned To" value={assignedName} editable={false} />
        </View>
        )}

        {!isTermWiseDc && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Information</Text>
          <FormField label="Town" value={order?.location || (order?.address || '').split(',')[0] || '-'} editable={false} />
          <FormField label="Address" value={order?.address || order?.location || dc?.customerAddress || '-'} editable={false} />
          <FormField label="Zone" value={order?.zone || '-'} editable={false} />
          <FormField label="Cluster" value={order?.cluster || '-'} editable={false} />
          <FormField label="Remarks" value={order?.remarks || '-'} editable={false} />
        </View>
        )}

        {!isTermWiseDc && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery and Address</Text>
          <FormField
            label="Transport Name"
            value={order?.pendingEdit?.transport_name || order?.transport_name || '-'}
            editable={false}
          />
          <FormField
            label="Transport Location"
            value={order?.pendingEdit?.transport_location || order?.transport_location || '-'}
            editable={false}
          />
          <FormField
            label="Transportation Landmark"
            value={order?.pendingEdit?.transportation_landmark || order?.transportation_landmark || '-'}
            editable={false}
          />
          <FormField label="Pincode" value={order?.pendingEdit?.pincode || order?.pincode || '-'} editable={false} />
        </View>
        )}

        {/* DC Details (editable) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DC Details</Text>
          <FormField label="Finance Remarks *" value={financeRemarks} onChangeText={setFinanceRemarks} placeholder="Finance Remarks" />
          <FormField label="SPL Approval *" value={splApproval} onChangeText={setSplApproval} placeholder="Special Approval" />
          <DateField
            label="DC Date *"
            value={dcDate}
            onChange={setDcDate}
            showPicker={showDcDatePicker}
            setShowPicker={setShowDcDatePicker}
          />
          <FormField label="DC Remarks *" value={dcRemarks} onChangeText={setDcRemarks} placeholder="DC Remarks" />
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>DC Category *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={dcCategory} onValueChange={setDcCategory} style={styles.picker}>
                <Picker.Item label="Select DC Category *" value="" />
                {DC_CATEGORIES.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>
          </View>
          <FormField label="DC Notes *" value={dcNotes} onChangeText={setDcNotes} placeholder="Notes" />
        </View>

        {/* Products & Quantities — same editable table as Raise / Update DC */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Products & Quantities</Text>
              <Text style={styles.sectionSubtitle}>Product details and quantities</Text>
            </View>
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
                <View style={styles.footerLeadingSpacer} />
                <Text style={styles.footerLabel}>Grand Total:</Text>
                <Text style={styles.footerValue}>
                  {productRows.reduce((sum, r) => sum + (Number(r.strength) || 0), 0)}
                </Text>
                <View style={styles.footerTrailingSpacer} />
              </View>
            </View>
          </ScrollView>
        </View>

        {(isSeniorCoordinator || isAdmin) && !isTermWiseDc && (
          <View style={styles.section}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>SME Remarks *</Text>
              <WebInput
                style={styles.input}
                value={smeRemarks}
                onChangeText={setSmeRemarks}
                placeholder="SME Remarks"
              />
            </View>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.textLight} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
          {canSubmitToWarehouse && (
            <TouchableOpacity
              style={[styles.warehouseButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmitToWarehouse}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textLight} size="small" />
              ) : (
                <Text style={styles.warehouseButtonText} numberOfLines={2}>
                  Submit to Warehouse
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
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
}: {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder} editable={editable}
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
  dcMeta: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  dcMetaText: { ...typography.body.small, color: colors.textSecondary },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 4 },
  sectionSubtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 0 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  fieldContainer: { marginBottom: 14 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.8 },
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
  buttonRow: { flexDirection: 'column', gap: 12, marginTop: 16, marginBottom: 24 },
  cancelButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    ...typography.label.medium,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  warehouseButton: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warehouseButtonText: {
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
});

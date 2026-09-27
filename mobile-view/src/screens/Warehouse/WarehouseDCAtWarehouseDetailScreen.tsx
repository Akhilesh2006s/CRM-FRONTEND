/**
 * DC At Warehouse — Update & Submit form.
 * Matches web `/dashboard/warehouse/dc-at-warehouse` process dialog:
 * contact/school, delivery, DC info, products with available/deliverable/remaining, Hold DC, Update & Submit.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import {
  findCatalogProduct,
  getProductSpecsOptions,
} from '../../utils/productCatalog';

const DC_CATEGORIES = ['Term 1', 'Term 2', 'Term 3', 'Full Year'];

/** Specs for display: hide legacy "Regular" default unless the product catalog lists it. */
function resolveDisplaySpecs(catalog: any[], productName: string, raw: any): string {
  const value = raw !== undefined && raw !== null ? String(raw).trim() : '';
  if (!value) return '';
  if (value === 'Regular') {
    const options = getProductSpecsOptions(catalog, productName);
    return options.includes('Regular') ? 'Regular' : '';
  }
  const entry = findCatalogProduct(catalog, productName);
  if (entry && !entry.hasSpecs) return '';
  return value;
}

type ProductRow = {
  product: string;
  class: string;
  category: string;
  specs: string;
  subject?: string;
  quantity: number;
  strength?: number;
  price?: number;
  total?: number;
  level?: string;
  availableQuantity?: number;
  deliverableQuantity?: number;
  remainingQuantity?: number;
};

type WarehouseItem = {
  productName?: string;
  category?: string;
  level?: string;
  specs?: string;
  subject?: string;
  currentStock?: number;
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

function errMsg(e: any, fallback: string) {
  return e?.response?.data?.message || e?.message || fallback;
}

function findInventoryItem(
  inventory: WarehouseItem[],
  productName: string,
  category?: string,
  level?: string,
  specs?: string,
  subject?: string
): WarehouseItem | null {
  const name = (productName || '').toLowerCase();
  const spec = (specs && specs.trim()) || 'Regular';
  const subj = subject && subject.trim() ? subject.trim() : undefined;
  const list = Array.isArray(inventory) ? inventory : [];
  const itemSpec = (item: WarehouseItem) => (item.specs && item.specs.trim()) || 'Regular';
  const itemSubj = (item: WarehouseItem) =>
    item.subject && item.subject.trim() ? item.subject.trim() : undefined;
  const base = (item: WarehouseItem) => item.productName?.toLowerCase() === name;

  const match = (pred: (item: WarehouseItem) => boolean) => list.find(pred) || null;

  if (subj) {
    return (
      match(
        (i) =>
          base(i) &&
          (i.category || '') === (category || '') &&
          (i.level || '') === (level || '') &&
          itemSpec(i) === spec &&
          itemSubj(i) === subj
      ) ||
      match((i) => base(i) && (i.level || '') === (level || '') && itemSpec(i) === spec && itemSubj(i) === subj) ||
      match((i) => base(i) && itemSpec(i) === spec && itemSubj(i) === subj) ||
      match(
        (i) =>
          base(i) &&
          (i.category || '') === (category || '') &&
          (i.level || '') === (level || '') &&
          itemSpec(i) === spec
      ) ||
      match((i) => base(i) && (i.category || '') === (category || '') && (i.level || '') === (level || '')) ||
      match((i) => base(i) && (i.category || '') === (category || '')) ||
      match(base)
    );
  }

  return (
    match(
      (i) =>
        base(i) &&
        (i.category || '') === (category || '') &&
        (i.level || '') === (level || '') &&
        itemSpec(i) === spec &&
        itemSubj(i) === undefined
    ) ||
    match(
      (i) =>
        base(i) &&
        (i.category || '') === (category || '') &&
        (i.level || '') === (level || '') &&
        itemSpec(i) === spec
    ) ||
    match((i) => base(i) && (i.category || '') === (category || '') && (i.level || '') === (level || '')) ||
    match((i) => base(i) && (i.category || '') === (category || '')) ||
    match(base)
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  if (Platform.OS === 'web') {
    return (
      <View style={styles.field}>
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
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateTouchable} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Text style={[styles.dateText, !value && styles.placeholder]}>{value || 'Tap to pick date'}</Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </TouchableOpacity>
      {show && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseYmd(value)}
          mode="date"
          display="default"
          onChange={(event, d) => {
            setShow(false);
            if (event.type === 'set' && d) onChange(toYmd(d));
          }}
        />
      ) : null}
      {show && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity style={styles.dateOverlay} activeOpacity={1} onPress={() => setShow(false)} />
          <View style={styles.dateBox}>
            <View style={styles.dateHeader}>
              <Text style={styles.dateTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setShow(false)}>
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline,
  required,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  required?: boolean;
  keyboardType?: any;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <WebInput
        style={[styles.input, !editable && styles.inputDisabled, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );
}

export default function WarehouseDCAtWarehouseDetailScreen({ navigation, route }: any) {
  const { id } = route.params;
  const { user } = useAuth();
  const role = user?.role || '';
  const isChecker = role === 'Warehouse Manager' || role === 'Admin' || role === 'Super Admin';
  const isMaker = role === 'Warehouse Executive' || role === 'Admin' || role === 'Super Admin';
  const [dc, setDc] = useState<any>(null);
  const [lrNo, setLrNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [holding, setHolding] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [contactPerson, setContactPerson] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [zone, setZone] = useState('');
  const [cluster, setCluster] = useState('');
  const [dcDate, setDcDate] = useState('');
  const [dcCategory, setDcCategory] = useState('Term 1');
  const [dcNotes, setDcNotes] = useState('');
  const [dcRemarks, setDcRemarks] = useState('');
  const [productRows, setProductRows] = useState<ProductRow[]>([]);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      const [inventoryRes, fullDC, catalogRes] = await Promise.all([
        apiService.get('/warehouse').catch(() => []),
        apiService.get(`/dc/${id}`),
        apiService.get('/products/active').catch(() => apiService.get('/products').catch(() => [])),
      ]);
      const inventory: WarehouseItem[] = Array.isArray(inventoryRes)
        ? inventoryRes
        : inventoryRes?.data || [];
      const catalog: any[] = Array.isArray(catalogRes)
        ? catalogRes
        : catalogRes?.data || catalogRes?.products || [];
      setDc(fullDC);
      let order: any =
        typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId ? fullDC.dcOrderId : {};

      // Ensure school_type is loaded from the deal (e.g. "New" from school create)
      const orderId =
        typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId?._id
          ? fullDC.dcOrderId._id
          : typeof fullDC.dcOrderId === 'string'
            ? fullDC.dcOrderId
            : null;
      if (orderId && !order.school_type) {
        try {
          const fullOrder = await apiService.get(`/dc-orders/${orderId}`);
          if (fullOrder) order = { ...order, ...fullOrder };
        } catch {
          /* keep populated order */
        }
      }

      setContactPerson(fullDC.contactPerson || order.contact_person || '');
      setContactMobile(fullDC.contactMobile || fullDC.customerPhone || order.contact_mobile || '');
      setSchoolType(
        String(
          order.school_type ||
            order.pendingEdit?.school_type ||
            fullDC.schoolType ||
            fullDC.school_type ||
            'New',
        ).trim(),
      );
      setSchoolAddress(order.address || order.location || '');
      setZone(fullDC.zone || order.zone || '');
      setCluster(fullDC.cluster || '');
      setDcDate(fullDC.dcDate ? toYmd(new Date(fullDC.dcDate)) : '');
      setDcRemarks(fullDC.dcRemarks || '');
      setDcCategory(fullDC.dcCategory || 'Term 1');
      setDcNotes(fullDC.dcNotes || '');
      setLrNo(fullDC.lrNo || '');
      setVehicleNo(fullDC.vehicleNo || '');

      if (Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        setProductRows(
          fullDC.productDetails.map((p: any) => {
            const productName = p.product || 'ABACUS';
            const specsValue = resolveDisplaySpecs(catalog, productName, p.specs);
            const subjectValue = p.subject || undefined;
            const inventoryItem = findInventoryItem(
              inventory,
              productName,
              p.category,
              p.level,
              specsValue,
              subjectValue
            );
            const qty = Number(p.quantity) || 0;
            const str = Number(p.strength) || 0;
            const requestedQty = Math.max(qty, str);
            const availableQty = inventoryItem
              ? Number(inventoryItem.currentStock) || 0
              : Number(p.availableQuantity) || 0;
            const deliverableQty =
              p.deliverableQuantity !== undefined && p.deliverableQuantity !== null
                ? Number(p.deliverableQuantity)
                : Math.min(requestedQty, availableQty);
            return {
              product: productName,
              class: p.class || 'NA',
              category: p.category || 'Training-Material',
              specs: specsValue,
              subject: subjectValue,
              quantity: requestedQty,
              availableQuantity: availableQty,
              deliverableQuantity: deliverableQty,
              remainingQuantity: availableQty - deliverableQty,
              strength: p.strength || 0,
              price: p.price || 0,
              total: p.total || 0,
              level: p.level || 'L1',
            };
          })
        );
      } else {
        const productName = fullDC.product || fullDC.productDetails?.[0]?.product || 'ABACUS';
        const inventoryItem = findInventoryItem(inventory, productName, 'Training-Material');
        const requestedQty = Number(fullDC.requestedQuantity) || 0;
        const availableQty = inventoryItem ? Number(inventoryItem.currentStock) || 0 : 0;
        const deliverableQty = Math.min(requestedQty, availableQty);
        setProductRows([
          {
            product: productName,
            class: 'NA',
            category: 'Training-Material',
            specs: '',
            quantity: requestedQty,
            availableQuantity: availableQty,
            deliverableQuantity: deliverableQty,
            remainingQuantity: availableQty - deliverableQty,
            strength: 0,
            level: 'L1',
          },
        ]);
      }
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to load DC details') });
    } finally {
      setLoading(false);
    }
  };

  const insufficientQuantity = useMemo(
    () => productRows.some((p) => (p.availableQuantity || 0) < (p.deliverableQuantity || 0)),
    [productRows]
  );

  const dcOrder = typeof dc?.dcOrderId === 'object' && dc?.dcOrderId ? dc.dcOrderId : {};
  const transportName = dcOrder.transport_name || dc?.transport || '';
  const transportLocation = dcOrder.transport_location || dc?.transportArea || '';
  const transportLandmark = dcOrder.transportation_landmark || '';
  const pincode = dcOrder.pincode || '';
  const executiveName = dc?.managerId?.name || dc?.employeeId?.name || '';
  const dcNo = dc?._id ? `DC-${String(dc._id).slice(-6)}` : '';

  const updateDeliverable = (idx: number, raw: string) => {
    const updated = [...productRows];
    const newDeliverableQty = Number(raw) || 0;
    const availableQty = updated[idx].availableQuantity || 0;
    updated[idx] = {
      ...updated[idx],
      deliverableQuantity: newDeliverableQty,
      remainingQuantity: availableQty >= newDeliverableQty ? availableQty - newDeliverableQty : 0,
    };
    setProductRows(updated);
  };

  const productPayload = (rows: ProductRow[]) =>
    rows.map((p) => ({
      product: p.product,
      class: p.class,
      category: p.category,
      specs: p.specs?.trim() || undefined,
      subject: p.subject || undefined,
      quantity: p.quantity,
      availableQuantity: p.availableQuantity,
      deliverableQuantity: p.deliverableQuantity,
      remainingQuantity: p.remainingQuantity,
      strength: p.strength,
      price: p.price,
      total: p.total,
      level: p.level,
    }));

  const totals = (rows: ProductRow[]) => {
    const requested = rows.reduce((sum, p) => sum + Math.max(p.quantity || 0, p.strength || 0), 0);
    const available = rows.reduce((sum, p) => sum + (p.availableQuantity || 0), 0);
    const deliverable = rows.reduce((sum, p) => sum + (p.deliverableQuantity || 0), 0);
    return { requested, available, deliverable };
  };

  const sharedBody = (rows: ProductRow[], extra: Record<string, any> = {}) => {
    const t = totals(rows);
    return {
      productDetails: productPayload(rows),
      requestedQuantity: t.requested,
      availableQuantity: t.available,
      deliverableQuantity: t.deliverable,
      dcDate: dcDate || undefined,
      dcRemarks: dcRemarks || undefined,
      dcCategory: dcCategory || undefined,
      dcNotes: dcNotes || undefined,
      contactPerson: contactPerson || undefined,
      contactMobile: contactMobile || undefined,
      zone: zone || undefined,
      cluster: cluster || undefined,
      remarks: dcRemarks || undefined,
      dcOrderId:
        dc?.dcOrderId && typeof dc.dcOrderId === 'object'
          ? { ...dc.dcOrderId, school_type: schoolType || undefined, address: schoolAddress || undefined }
          : dc?.dcOrderId,
      ...extra,
    };
  };

  const handleReturn = async () => {
    if (!returnRemarks.trim()) {
      setBanner({ type: 'error', message: 'Enter remarks before returning this DC for correction.' });
      return;
    }
    setProcessing(true);
    try {
      await apiService.post(`/dc/${id}/warehouse-return`, { remarks: returnRemarks.trim() });
      navigation.goBack();
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to return DC') });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateAndSubmit = async () => {
    const stage = dc?.warehouseStage || (dc?.status === 'sent_to_manager' ? 'awaiting_receipt' : '');
    if (stage === 'awaiting_receipt') {
      if (!isChecker) {
        setBanner({ type: 'error', message: 'The Warehouse Manager must accept this DC before it can be processed.' });
        return;
      }
      setProcessing(true);
      try {
        await apiService.post(`/dc/${id}/warehouse-accept`, {});
        navigation.goBack();
      } catch (e: any) {
        setBanner({ type: 'error', message: errMsg(e, 'Failed to accept DC') });
      } finally {
        setProcessing(false);
      }
      return;
    }
    if (!schoolType.trim()) {
      setBanner({ type: 'error', message: 'School Type is required. Please enter the school type before submitting.' });
      return;
    }
    const mobileError = phoneDigitsError(contactMobile, false);
    if (mobileError) {
      setBanner({ type: 'error', message: mobileError });
      return;
    }
    if (!dcDate.trim()) {
      setBanner({ type: 'error', message: 'DC Date is required. Please enter the DC date before submitting.' });
      return;
    }
    if (insufficientQuantity) {
      setBanner({
        type: 'error',
        message:
          'Enough quantity is not available. Available quantity is less than deliverable quantity for one or more products. Please adjust deliverable quantities or use the "Hold DC" button to put the DC on hold.',
      });
      return;
    }
    setProcessing(true);
    setBanner(null);
    try {
      const t = totals(productRows);
      const stage = dc?.warehouseStage || (dc?.status === 'warehouse_processing' ? 'accepted' : '');
      await apiService.put(`/dc/${id}`, sharedBody(productRows));
      if (stage === 'pending_approval' && isChecker) {
        await apiService.post(`/dc/${id}/warehouse-approve`, {
          availableQuantity: t.available,
          deliverableQuantity: t.deliverable,
          remarks: dcRemarks || undefined,
          productDetails: productPayload(productRows),
        });
        navigation.navigate('WarehouseCompletedDC');
        return;
      }
      if (!isMaker) {
        setBanner({ type: 'error', message: 'Only a Warehouse Executive can submit packing for approval.' });
        return;
      }
      if (!lrNo.trim()) {
        setBanner({ type: 'error', message: 'LR Number is required before submitting for manager approval.' });
        return;
      }
      await apiService.post(`/dc/${id}/warehouse-submit`, {
        ...sharedBody(productRows),
        lrNo: lrNo.trim(),
        vehicleNo: vehicleNo.trim() || undefined,
        bags: productRows.map((p, index) => ({
          bagNo: String(index + 1),
          product: p.product,
          productName: p.product,
          quantity: p.deliverableQuantity || p.quantity || 0,
          unit: 'pcs',
        })),
      });
      setBanner({ type: 'success', message: 'Submitted for Warehouse Manager approval.' });
      navigation.goBack();
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to process DC') });
    } finally {
      setProcessing(false);
    }
  };

  const handleHold = async () => {
    if (!schoolType.trim()) {
      setBanner({ type: 'error', message: 'School Type is required. Please enter the school type before putting the DC on hold.' });
      return;
    }
    if (!dcDate.trim()) {
      setBanner({ type: 'error', message: 'DC Date is required. Please enter the DC date before putting the DC on hold.' });
      return;
    }
    if (productRows.length === 0) {
      setBanner({ type: 'error', message: 'No products found. Please refresh the page.' });
      return;
    }
    setHolding(true);
    setBanner(null);
    try {
      const holdReason = dcRemarks
        ? `Insufficient quantity available. Remarks: ${dcRemarks}`
        : 'Insufficient quantity available.';
      await apiService.put(`/dc/${id}`, sharedBody(productRows, { status: 'hold', holdReason }));
      setBanner({ type: 'success', message: 'DC has been put on hold. It will appear in Hold DC page.' });
      setTimeout(() => navigation.navigate('WarehouseHoldDC'), 800);
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to put DC on hold') });
    } finally {
      setHolding(false);
    }
  };

  const requiredTotal = productRows.reduce((sum, row) => sum + (Number(row.strength) || Number(row.quantity) || 0), 0);
  const busy = processing || holding;

  return (
    <ScreenShell title="DC Form Update" subtitle="Update DC information and product quantities" loading={loading}>
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>School Information</Text>
        <Field label="Contact Person Name" value={contactPerson} onChangeText={setContactPerson} placeholder="Contact Person Name" />
        <Field
          label="Contact Mobile"
          value={contactMobile}
          onChangeText={(text) => setContactMobile(sanitizePhoneDigits(text))}
          placeholder="10 to 15 digits"
          keyboardType="phone-pad"
          maxLength={15}
        />
        <Field
          label="School Type *"
          value={schoolType}
          onChangeText={setSchoolType}
          placeholder="New"
        />
        <Field label="Executive" value={executiveName} editable={false} placeholder="Executive" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>More Information</Text>
        <Field
          label="School Address"
          value={schoolAddress}
          onChangeText={setSchoolAddress}
          placeholder="School Address"
          multiline
        />
        <Field label="Zone" value={zone} onChangeText={setZone} placeholder="Select Zone" />
        <Field label="Cluster" value={cluster || 'Select zone first'} editable={false} />
      </View>

      <View style={[styles.section, styles.deliverySection]}>
        <Text style={styles.sectionTitle}>Delivery & Address Information</Text>
        <Field label="Transport Name" value={transportName} editable={false} placeholder="Not provided" />
        <Field label="Transport Location" value={transportLocation} editable={false} placeholder="Not provided" />
        <Field label="Transport Landmark" value={transportLandmark} editable={false} placeholder="Not provided" />
        <Field label="Pincode" value={pincode} editable={false} placeholder="Not provided" />
      </View>

      <View style={[styles.section, styles.dcSection]}>
        <Text style={styles.sectionTitle}>DC Information Update</Text>
        <Text style={styles.dcNo}>DC No: {dcNo}</Text>
        <DateField label="DC Date *" value={dcDate} onChange={setDcDate} />
        <View style={styles.field}>
          <Text style={styles.label}>DC Category</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={dcCategory} onValueChange={setDcCategory} style={styles.picker}>
              {DC_CATEGORIES.map((c) => (
                <Picker.Item key={c} label={c} value={c} />
              ))}
            </Picker>
          </View>
        </View>
        <Field label="DC Notes" value={dcNotes} onChangeText={setDcNotes} placeholder="Notes" multiline />
        <Field label="DC Remarks" value={dcRemarks} onChangeText={setDcRemarks} placeholder="DC Remarks" multiline />
      </View>

      <View style={[styles.section, styles.dcSection]}>
        <Text style={styles.sectionTitle}>Products</Text>
        <Text style={styles.hint}>
          Available quantity is auto-filled from inventory and cannot be changed. Deliverable and remaining quantities are
          calculated automatically.
        </Text>
        {insufficientQuantity ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Warning: Enough quantity is not available. Available quantity is less than deliverable quantity for one or
              more products. Please adjust deliverable quantities or use the "Hold DC" button to put the DC on hold.
            </Text>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              {[
                'Product',
                'Class',
                'Category',
                'Specs',
                'Subject',
                'Required Quantity',
                'Level',
                'Available Qty',
                'Deliverable Qty',
                'Remaining Qty',
              ].map((h) => (
                <Text key={h} style={styles.th}>
                  {h}
                </Text>
              ))}
            </View>
            {productRows.length === 0 ? (
              <Text style={styles.emptyRow}>No products added</Text>
            ) : (
              productRows.map((row, idx) => {
                const remaining = row.remainingQuantity ?? 0;
                const remainingStyle =
                  remaining < 0 ? styles.remainingBad : remaining === 0 ? styles.remainingZero : styles.remainingOk;
                return (
                  <View key={`${row.product}-${idx}`} style={styles.tableRow}>
                    <Text style={styles.td}>{row.product}</Text>
                    <Text style={styles.td}>{row.class}</Text>
                    <Text style={styles.td}>{row.category}</Text>
                    <Text style={styles.td}>{row.specs?.trim() || '-'}</Text>
                    <Text style={styles.td}>{row.subject || '-'}</Text>
                    <Text style={[styles.td, styles.tdStrong]}>{row.quantity || 0}</Text>
                    <Text style={styles.td}>{row.level || '-'}</Text>
                    <Text style={styles.td}>{row.availableQuantity ?? 0}</Text>
                    <WebInput
                      style={[
                        styles.deliverableInput,
                        (row.availableQuantity || 0) < (row.deliverableQuantity || 0) && styles.deliverableBad,
                      ]}
                      value={String(row.deliverableQuantity ?? 0)}
                      onChangeText={(v) => updateDeliverable(idx, v)}
                      keyboardType="numeric"
                    />
                    <View style={[styles.remainingBox, remainingStyle]}>
                      <Text style={styles.remainingText}>{remaining}</Text>
                    </View>
                  </View>
                );
              })
            )}
            <View style={styles.tableFooter}>
              <Text style={styles.footerLabel}>Total:</Text>
              <Text style={styles.footerValue}>{requiredTotal}</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      <View style={[styles.section, styles.dcSection]}>
        <Text style={styles.sectionTitle}>LR & Dispatch</Text>
        <Field label="LR Number" value={lrNo} onChangeText={setLrNo} placeholder="LR number" />
        <Field label="Vehicle No" value={vehicleNo} onChangeText={setVehicleNo} placeholder="Vehicle number" />
        {isChecker && (dc?.warehouseStage === 'pending_approval') ? (
          <Field label="Return remarks" value={returnRemarks} onChangeText={setReturnRemarks} placeholder="Required to send back for correction" multiline />
        ) : null}
      </View>

      <View style={styles.buttonCol}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={busy}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.holdBtn, busy && styles.btnDisabled]}
          onPress={handleHold}
          disabled={busy || productRows.length === 0}
        >
          {holding ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Hold DC</Text>}
        </TouchableOpacity>
        {isChecker && dc?.warehouseStage === 'pending_approval' ? (
          <TouchableOpacity style={[styles.holdBtn, busy && styles.btnDisabled]} onPress={handleReturn} disabled={busy}>
            <Text style={styles.primaryText}>Return</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.submitBtn, (busy || (dc?.warehouseStage !== 'awaiting_receipt' && (insufficientQuantity || productRows.length === 0))) && styles.btnDisabled]}
          onPress={handleUpdateAndSubmit}
          disabled={busy || (dc?.warehouseStage !== 'awaiting_receipt' && (insufficientQuantity || productRows.length === 0))}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {dc?.warehouseStage === 'awaiting_receipt'
                ? 'Accept DC'
                : dc?.warehouseStage === 'pending_approval'
                  ? 'Approve'
                  : 'Submit for Approval'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

const COL = { width: 110, paddingHorizontal: 6 };
const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    borderTopColor: colors.primary,
    padding: 16,
    marginBottom: 16,
  },
  deliverySection: { borderTopColor: '#22C55E' },
  dcSection: { borderTopColor: colors.primary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  dcNo: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
  required: { color: colors.error },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputDisabled: { backgroundColor: colors.backgroundMuted },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    overflow: 'hidden',
  },
  picker: { height: 48 },
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
  dateText: { fontSize: 15, color: colors.textPrimary },
  placeholder: { color: colors.textMuted },
  calendarIcon: { fontSize: 18 },
  dateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  dateBox: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  doneText: { color: colors.primary, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { fontSize: 13, color: '#991B1B', lineHeight: 18, fontWeight: '600' },
  table: { minWidth: 1100 },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: colors.tableHeader,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  th: { ...COL, fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingVertical: 8 },
  td: { ...COL, fontSize: 13, color: colors.textPrimary },
  tdStrong: { fontWeight: '700' },
  emptyRow: { padding: 16, color: colors.textMuted },
  deliverableInput: {
    width: 98,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  deliverableBad: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' },
  remainingBox: {
    width: 98,
    marginHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  remainingOk: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  remainingZero: { backgroundColor: '#FEFCE8', borderColor: '#FDE047' },
  remainingBad: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  remainingText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 12,
    gap: 8,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  footerLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  footerValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  buttonCol: { gap: 12, marginTop: 8, marginBottom: 24 },
  cancelBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  holdBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  submitBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  btnDisabled: { opacity: 0.55 },
});

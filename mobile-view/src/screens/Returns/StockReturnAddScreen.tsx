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
  FlatList,
  Image,
  Platform,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService, getApiUrl } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';

const RETURN_TYPES = ['Damaged', 'Expired', 'Excess', 'Wrong item', 'Replacement'];
const RETURN_REASONS = ['Damaged', 'Expired', 'Excess', 'Wrong item', 'Replacement', 'Customer request', 'Quality issue', 'Other'];

function defaultFinYear(fromDate?: string) {
  const d = fromDate ? new Date(fromDate) : new Date();
  const y = d.getFullYear();
  return `${y}-${String(y + 1).slice(-2)}`;
}

function dcNoFrom(dc: any) {
  const dcId = String(dc._id || '');
  if (dc.createdAt) {
    const year = new Date(dc.createdAt).getFullYear();
    return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}/${dcId.slice(-4)}`;
  }
  return `DC-${dcId.slice(-6)}`;
}

function productQuantity(product: any): number {
  for (const value of [
    product?.deliveredQuantity,
    product?.deliverableQuantity,
    product?.quantity,
    product?.strength,
    product?.qty,
    product?.requestedQuantity,
  ]) {
    const quantity = Number(value);
    if (Number.isFinite(quantity) && quantity > 0) return quantity;
  }
  return 0;
}

function productUnitPrice(product: any): number {
  const prices = [product?.unit_price, product?.unitPrice, product?.price];
  const positivePrice = prices.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  if (positivePrice !== undefined) return Number(positivePrice);
  // Older DC records can have an empty unit-price field while still retaining
  // the line total. Recover the original price from that total when possible.
  const total = Number(product?.total ?? product?.totalAmount ?? product?.amount);
  const quantity = productQuantity(product);
  if (Number.isFinite(total) && total > 0 && quantity > 0) return total / quantity;
  const storedPrice = prices.find((value) => Number.isFinite(Number(value)));
  return storedPrice === undefined ? 0 : Number(storedPrice);
}

function loadCompletedDcOptions(dcs: any[]) {
  return dcs
    .map((dc) => mapCompletedDcToOption(dc))
    .filter(Boolean);
}

function normalizeDcProducts(dc: any, order: any | null) {
  const productDetails = Array.isArray(dc?.productDetails) ? dc.productDetails : [];
  const fromDetails = productDetails
    .map((p: any) => ({
      product_name: String(p.product || p.productName || p.product_name || '').trim(),
      quantity: productQuantity(p),
      unit_price: productUnitPrice(p),
    }))
    .filter((p: { product_name: string }) => p.product_name);

  if (fromDetails.length > 0) return fromDetails;

  const orderProducts = Array.isArray(order?.products)
    ? order.products
        .map((p: any) => ({
          product_name: String(p.product_name || p.product || '').trim(),
          quantity: productQuantity(p),
          unit_price: productUnitPrice(p),
        }))
        .filter((p: { product_name: string }) => p.product_name)
    : [];

  if (orderProducts.length > 0) return orderProducts;

  if (dc?.product) {
    return [
      {
        product_name: String(dc.product).trim(),
        quantity: productQuantity(dc),
        unit_price: 0,
      },
    ];
  }

  return [];
}

function mapCompletedDcToOption(dc: any) {
  const order = dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null;
  const linkedDcOrderId = order?._id
    ? String(order._id)
    : typeof dc.dcOrderId === 'string'
      ? dc.dcOrderId
      : '';

  const schoolName = (order?.school_name || dc.customerName || '').trim();
  if (!schoolName) return null;

  const products = normalizeDcProducts(dc, order);

  return {
    _id: String(dc._id),
    linkedDcOrderId,
    dc_code: dcNoFrom(dc),
    school_name: schoolName,
    school_code: order?.school_code || '',
    school_type: order?.school_type || '',
    contact_person: order?.contact_person || '',
    contact_mobile: order?.contact_mobile || dc.customerPhone || '',
    address: order?.address || dc.customerAddress || '',
    location: order?.location || '',
    city: order?.city || '',
    zone: order?.zone || '',
    cluster_code: order?.cluster_code || '',
    transport_name: order?.transport_name || dc.transport || '',
    year: order?.year || '',
    createdAt: dc.completedAt || dc.createdAt,
    lrNo: dc.lrNo || '',
    products,
  };
}

function DateField({
  label,
  value,
  onChange,
  required,
  minDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minDate?: string;
}) {
  const changeDate = (nextValue: string) => {
    if (minDate && nextValue && nextValue < minDate) {
      Alert.alert('Invalid date', `${label} cannot be earlier than today.`);
      return;
    }
    onChange(nextValue);
  };
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={formStyles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      {Platform.OS === 'web' ? (
        React.createElement('input', {
          type: 'date',
          value: value || '',
          min: minDate,
          onChange: (e: any) => changeDate(e.target.value || ''),
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
        })
      ) : (
        <WebInput value={value} onChangeText={changeDate} placeholder="YYYY-MM-DD" />
      )}
    </View>
  );
}

function localTodayDate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

function FutureCalendarField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const today = localTodayDate();
  const [month, setMonth] = useState(() => {
    const source = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(source.getFullYear(), source.getMonth(), 1);
  });
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = month.getDay();
  const changeMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const isCurrentMonth = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
  const display = value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select return date';

  return <View style={{ marginBottom: 12 }}>
    <Text style={formStyles.label}>{label} *</Text>
    <TouchableOpacity style={calendarStyles.field} onPress={() => setOpen(true)}><Text style={calendarStyles.fieldText}>{display}</Text><Text style={calendarStyles.icon}>▣</Text></TouchableOpacity>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={calendarStyles.overlay}><View style={calendarStyles.modal}>
        <View style={calendarStyles.header}><TouchableOpacity onPress={() => changeMonth(-1)} disabled={isCurrentMonth} style={[calendarStyles.nav, isCurrentMonth && calendarStyles.navDisabled]}><Text style={calendarStyles.navText}>‹</Text></TouchableOpacity><Text style={calendarStyles.monthTitle}>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text><TouchableOpacity onPress={() => changeMonth(1)} style={calendarStyles.nav}><Text style={calendarStyles.navText}>›</Text></TouchableOpacity></View>
        <View style={calendarStyles.grid}>{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <Text key={day} style={calendarStyles.weekday}>{day}</Text>)}
          {Array.from({ length: firstDay }).map((_, index) => <View key={`blank-${index}`} style={calendarStyles.day} />)}
          {Array.from({ length: daysInMonth }).map((_, index) => { const day = index + 1; const date = new Date(month.getFullYear(), month.getMonth(), day); const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; if (iso < today) return <View key={day} style={calendarStyles.day} />; return <TouchableOpacity key={day} style={[calendarStyles.day, value === iso && calendarStyles.selectedDay]} onPress={() => { onChange(iso); setOpen(false); }}><Text style={[calendarStyles.dayText, value === iso && calendarStyles.selectedDayText]}>{day}</Text></TouchableOpacity>; })}
        </View>
        <TouchableOpacity style={calendarStyles.closeButton} onPress={() => setOpen(false)}><Text style={calendarStyles.closeText}>Cancel</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </View>;
}

const NEXT_ACTION_BY_STATUS: Record<string, string> = {
  Draft: 'Complete & Submit',
  Submitted: 'Warehouse Verification',
  Received: 'Under Review',
  'Pending Manager Approval': 'Manager Decision',
  Approved: 'Closed',
  'Partially Approved': 'Closed',
  Rejected: '—',
  'Sent Back': 'Resubmit',
  'Stock Updated': 'Closed',
  Closed: '—',
};

function formatDate(d: string | Date | undefined) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US');
  } catch {
    return '—';
  }
}

function formatDateTime(d: string | Date | undefined) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-US');
  } catch {
    return '—';
  }
}

function cell(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

function getSaleIdFromReturn(ret: any) {
  if (ret?.saleId) return String(ret.saleId);
  if (ret?.dcOrderId && typeof ret.dcOrderId === 'object' && ret.dcOrderId.dc_code) {
    return ret.dcOrderId.dc_code;
  }
  if (typeof ret?.dcOrderId === 'string') return ret.dcOrderId;
  return '—';
}

function getTotalQty(ret: any, rows: ProductRow[]) {
  if (ret?.totalQuantity != null) return ret.totalQuantity;
  if (ret?.returnQty != null) return ret.returnQty;
  return rows.reduce((s, r) => s + (parseInt(r.returnQty, 10) || 0), 0);
}

function resolvePhotoUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getApiUrl().replace(/\/$/, '');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={viewStyles.fieldWrap}>
      <Text style={viewStyles.fieldLabel}>{label}</Text>
      <View style={viewStyles.fieldBox}>
        <Text style={viewStyles.fieldValue}>{value}</Text>
      </View>
    </View>
  );
}

type ProductRow = {
  id: string;
  product: string;
  soldQty: number;
  returnQty: string;
  unitPrice: string;
  reason: string;
  remarks: string;
};

function productsToRows(order: any): ProductRow[] {
  const list = Array.isArray(order?.products) ? order.products : [];
  return list.map((p: any, i: number) => ({
    id: `row-${order._id}-${i}`,
    product: p.product_name || p.product || '',
    soldQty: productQuantity(p),
    returnQty: '',
    unitPrice: String(productUnitPrice(p)),
    reason: '',
    remarks: '',
  }));
}

export default function StockReturnAddScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const returnIdParam = route?.params?.returnId as string | undefined;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completedDcs, setCompletedDcs] = useState<any[]>([]);
  const [warehouseLocations, setWarehouseLocations] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [existingReturn, setExistingReturn] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [customerName, setCustomerName] = useState('');
  const [saleId, setSaleId] = useState('');
  const [dcOrderId, setDcOrderId] = useState('');
  const [selectedCompletedDcId, setSelectedCompletedDcId] = useState('');
  const [warehouse, setWarehouse] = useState('Main Warehouse');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnType, setReturnType] = useState('');
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [executiveRemarks, setExecutiveRemarks] = useState('');
  const [displayReturnId, setDisplayReturnId] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [lrDate, setLrDate] = useState('');
  const [finYear, setFinYear] = useState(defaultFinYear());
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [transport, setTransport] = useState('');
  const [town, setTown] = useState('');
  const [zone, setZone] = useState('');
  const [cluster, setCluster] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [address, setAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  const isViewMode = existingReturn && existingReturn.status !== 'Draft';

  const applyCompletedDc = (order: any) => {
    if (!order) return;
    setCustomerName(order.school_name || '');
    setSaleId(order.dc_code || order.linkedDcOrderId || '');
    setDcOrderId(order.linkedDcOrderId || '');
    setFinYear(order.year || defaultFinYear(order.createdAt));
    setSchoolCode(order.school_code || '');
    setSchoolType(order.school_type || '');
    setTransport(order.transport_name || '');
    setTown(order.location || order.city || '');
    setZone(order.zone || '');
    setCluster(order.cluster_code || '');
    setContactPerson(order.contact_person || '');
    setContactMobile(order.contact_mobile || '');
    setAddress(order.address || '');
    if (order.lrNo) setLrNumber(order.lrNo);
    setProductRows(productsToRows(order));
  };

  const handleCompletedDcSelect = async (completedDcId: string) => {
    setSelectedCompletedDcId(completedDcId);
    const cached = completedDcs.find((o) => o._id === completedDcId);
    if (cached) {
      applyCompletedDc(cached);
    } else {
      setCustomerName('');
      setSaleId('');
      setDcOrderId('');
      setProductRows([]);
    }

    try {
      const fullDc = await apiService.get(`/dc/${completedDcId}`);
      const enriched = mapCompletedDcToOption(fullDc);
      if (enriched) {
        applyCompletedDc(enriched);
        setCompletedDcs((prev) =>
          prev.map((o) => (o._id === completedDcId ? enriched : o))
        );
      }
    } catch {
      // Keep cached list data if detail fetch fails
    }
  };

  const totalItemsReturned = productRows.filter((r) => parseInt(r.returnQty, 10) > 0).length;
  const totalQuantity = productRows.reduce((s, r) => s + (parseInt(r.returnQty, 10) || 0), 0);

  useEffect(() => {
    (async () => {
      if (!user?._id) return;
      try {
        setLoading(true);
        const [locRes, dcRes, prodRes] = await Promise.all([
          apiService.get('/warehouse/locations').catch(() => []),
          apiService.get('/dc/completed').catch(() => []),
          apiService.get('/products/active').catch(() => apiService.get('/products').catch(() => [])),
        ]);
        const prodList = Array.isArray(prodRes) ? prodRes : prodRes?.data || [];
        setAvailableProducts(
          prodList.map((p: any) => p.productName || p.name || p.product).filter(Boolean)
        );
        const dcsRaw = Array.isArray(dcRes) ? dcRes : dcRes?.data || [];
        setCompletedDcs(loadCompletedDcOptions(dcsRaw));
        const locs = Array.isArray(locRes) ? locRes : [];
        setWarehouseLocations(
          locs.length > 0
            ? locs.map((w: any) => (typeof w === 'string' ? w : w.name || w.location || String(w))).filter(Boolean)
            : ['Main Warehouse', 'North Warehouse', 'South Warehouse', 'East Warehouse', 'West Warehouse']
        );
        if (returnIdParam) {
          const ret = await apiService.get(`/stock-returns/${returnIdParam}`);
          setExistingReturn(ret);
          setDisplayReturnId(ret.returnId || '');
          setCustomerName(ret.customerName || '');
          setSaleId(ret.saleId ? String(ret.saleId) : ret.dcOrderId ? String(ret.dcOrderId._id || ret.dcOrderId) : '');
          setWarehouse(ret.warehouse || '');
          setReturnDate(ret.returnDate ? new Date(ret.returnDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
          setReturnType(ret.returnType || '');
          setExecutiveRemarks(ret.executiveRemarks || '');
          setEvidencePhotos(Array.isArray(ret.evidencePhotos) ? ret.evidencePhotos : []);
          setLrNumber(ret.lrNumber || '');
          setLrDate(ret.lrDate ? new Date(ret.lrDate).toISOString().split('T')[0] : '');
          setFinYear(ret.finYear || defaultFinYear());
          setSchoolCode(ret.schoolCode || '');
          setSchoolType(ret.schoolType || '');
          setTransport(ret.transport || '');
          setTown(ret.town || '');
          setZone(ret.zone || '');
          setCluster(ret.cluster || '');
          setContactPerson(ret.contactPerson || '');
          setContactMobile(ret.contactMobile || '');
          setAddress(ret.address || '');
          setRemarks(ret.remarks || '');
          setDcOrderId(ret.dcOrderId ? String(ret.dcOrderId._id || ret.dcOrderId) : '');
          if (ret.products && ret.products.length) {
            setProductRows(
              ret.products.map((p: any, i: number) => ({
                id: `row-${i}-${p.product}`,
                product: p.product || '',
                soldQty: Number(p.soldQty) || 0,
                returnQty: String(p.returnQty ?? ''),
                unitPrice: String(p.unitPrice ?? ''),
                reason: p.reason || '',
                remarks: p.remarks || '',
              }))
            );
          }
        } else {
          setDisplayReturnId(`RET-${Date.now()}`);
          setWarehouse('Main Warehouse');
          setFinYear(defaultFinYear());
        }
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id, returnIdParam]);

  const addProductRow = () => {
    setProductRows((prev) => [
      ...prev,
      {
        id: `product-${Date.now()}`,
        product: '',
        soldQty: 0,
        returnQty: '',
        unitPrice: '',
        reason: '',
        remarks: '',
      },
    ]);
  };

  const removeProductRow = (id: string) => {
    setProductRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'We need photo access to add evidence.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      setUploadingPhoto(true);
      const formData = new FormData();
      const filename = asset.fileName || uri.split('/').pop() || 'photo.jpg';
      const type = asset.mimeType || (asset as any).file?.type || 'image/jpeg';
      if (Platform.OS === 'web') {
        // Browser uploads require a File/Blob; the React Native { uri, name, type }
        // object only works on native devices.
        const webFile = (asset as any).file;
        const blob = webFile || (await fetch(uri).then((response) => response.blob()));
        formData.append('photo', blob as any, filename);
      } else {
        formData.append('photo', { uri, name: filename, type } as any);
      }
      const token = await AsyncStorage.getItem('authToken');
      const baseURL = getApiUrl();
      const response = await fetch(`${baseURL}/stock-returns/upload-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      const data = await response.json();
      const url = data.photoUrl || data.url;
      if (url) setEvidencePhotos((prev) => [...prev, url]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setEvidencePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const updateProductRow = (id: string, field: keyof ProductRow, value: string | number) => {
    setProductRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const sold = field === 'soldQty' ? Number(value) : r.soldQty;
        let returnQty = field === 'returnQty' ? String(value) : r.returnQty;
        if (field === 'returnQty' && /^\d*$/.test(String(value))) {
          const num = parseInt(String(value), 10);
          if (!isNaN(num) && num > sold) return r;
        }
        return { ...r, [field]: value };
      })
    );
  };

  // A DC can contain products that are not part of this return.  Leave those
  // rows at zero; only rows with a return quantity need a reason.
  const returnedProductRows = productRows.filter(
    (r) => parseInt(r.returnQty, 10) > 0
  );
  const hasInvalidReturnQuantity = productRows.some((r) => {
    const rawQuantity = String(r.returnQty ?? '').trim();
    if (!rawQuantity || rawQuantity === '0') return false;

    const quantity = parseInt(rawQuantity, 10);
    return !Number.isInteger(quantity) || quantity <= 0 || quantity > r.soldQty;
  });
  const productsValid =
    returnedProductRows.length > 0 &&
    !hasInvalidReturnQuantity &&
    returnedProductRows.every((r) => (r.reason || '').trim() !== '');
  const evidenceRequired = returnType === 'Damaged' || returnType === 'Expired';
  const evidenceOk =
    evidencePhotos.length > 0 &&
    (!evidenceRequired || (executiveRemarks || '').trim() !== '');
  const canSubmit =
    productsValid &&
    evidenceOk &&
    returnDate &&
    returnType &&
    customerName &&
    selectedCompletedDcId &&
    warehouse &&
    lrNumber.trim() &&
    finYear.trim();

  const buildPayload = () => {
    const products = productRows
      .filter((r) => parseInt(r.returnQty, 10) > 0)
      .map((r) => ({
        product: r.product,
        soldQty: r.soldQty,
        returnQty: parseInt(r.returnQty, 10) || 0,
        unitPrice: parseFloat(r.unitPrice) || 0,
        reason: r.reason.trim(),
        remarks: r.remarks.trim(),
      }));
    return {
      returnId: existingReturn?.returnId || displayReturnId,
      executiveName: user?.name || '',
      returnDate,
      returnType,
      customerName,
      warehouse: warehouse || undefined,
      saleId: saleId || undefined,
      dcOrderId: dcOrderId || saleId || undefined,
      lrNumber: lrNumber.trim(),
      lrDate: lrDate || undefined,
      finYear: finYear.trim(),
      schoolCode,
      schoolType,
      transport,
      town,
      zone,
      cluster,
      contactPerson,
      contactMobile,
      address,
      remarks,
      executiveRemarks: executiveRemarks.trim() || undefined,
      evidencePhotos,
      products,
      totalItems: products.length,
      totalQuantity: products.reduce((s, p) => s + p.returnQty, 0),
    };
  };

  const saveDraft = async () => {
    const mobileError = phoneDigitsError(contactMobile, false);
    if (mobileError) {
      Alert.alert('Validation', mobileError);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...buildPayload(), status: 'Draft' };
      if (payload.products.length === 0) {
        payload.products = [{ product: '—', soldQty: 0, returnQty: 0, reason: 'Draft', remarks: '' }];
        payload.totalItems = 0;
        payload.totalQuantity = 0;
      }
      if (existingReturn?._id) {
        await apiService.put(`/stock-returns/${existingReturn._id}`, payload);
        Alert.alert('Saved', 'Draft updated.');
      } else {
        await apiService.post('/stock-returns/executive', payload);
        Alert.alert('Saved', 'Draft saved.');
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const submitReturn = async () => {
    if (!canSubmit) {
      Alert.alert(
        'Validation',
        'Please complete all required fields: Customer, Sale/DC, Warehouse, Return Date & Type, LR No, Fin Year, at least one product with Return Qty and Reason, and at least one photo. Damaged/Expired returns also require executive remarks.'
      );
      return;
    }
    const mobileError = phoneDigitsError(contactMobile, false);
    if (mobileError) {
      Alert.alert('Validation', mobileError);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (existingReturn?._id) {
        await apiService.put(`/stock-returns/${existingReturn._id}`, { ...payload, status: 'Submitted' });
        Alert.alert('Submitted', 'Return request submitted.');
      } else {
        await apiService.post('/stock-returns/executive', { ...payload, status: 'Submitted' });
        Alert.alert('Submitted', 'Return request submitted.');
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (isViewMode && existingReturn) {
    const saleIdDisplay = getSaleIdFromReturn(existingReturn);
    const totalQty = getTotalQty(existingReturn, productRows);
    const executiveDisplay =
      existingReturn.executiveName || user?.name || '—';
    const statusDisplay = existingReturn.status || '—';

    return (
      <ScreenShell title="View Stock Return" loading={false}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={viewStyles.subtitle}>Return details (read-only)</Text>

          <View style={viewStyles.grid}>
            <ReadOnlyField label="Return ID" value={displayReturnId || '—'} />
            <ReadOnlyField label="Sale ID" value={saleIdDisplay} />
            <ReadOnlyField label="Return Type" value={cell(returnType)} />
            <ReadOnlyField label="Return Status" value={statusDisplay} />
            <ReadOnlyField label="Executive Name" value={executiveDisplay} />
            <ReadOnlyField label="Customer Name" value={cell(customerName)} />
            <ReadOnlyField label="LR No" value={cell(existingReturn.lrNumber)} />
            <ReadOnlyField label="Fin Year" value={cell(existingReturn.finYear)} />
            <ReadOnlyField label="School Code" value={cell(existingReturn.schoolCode)} />
            <ReadOnlyField label="Transport" value={cell(existingReturn.transport)} />
            <ReadOnlyField label="Remarks" value={cell(existingReturn.remarks)} />
            <ReadOnlyField
              label="Return Date"
              value={returnDate ? formatDate(returnDate) : '—'}
            />
            <ReadOnlyField label="Total Quantity" value={String(totalQty)} />
          </View>

          <Text style={styles.sectionTitle}>Products</Text>
          <View style={viewStyles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, viewStyles.colProduct]}>Product</Text>
              <Text style={[styles.th, viewStyles.colQty]}>Sold Qty</Text>
              <Text style={[styles.th, viewStyles.colQty]}>Return Qty</Text>
              <Text style={[styles.th, viewStyles.colReason]}>Reason</Text>
              <Text style={[styles.th, viewStyles.colRemarks]}>Remarks</Text>
            </View>
            {productRows.length === 0 ? (
              <Text style={styles.emptyText}>No products</Text>
            ) : (
              productRows.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  <Text style={[styles.td, viewStyles.colProduct]} numberOfLines={1}>
                    {row.product}
                  </Text>
                  <Text style={[styles.td, viewStyles.colQty]}>{row.soldQty}</Text>
                  <Text style={[styles.td, viewStyles.colQty]}>{row.returnQty || '0'}</Text>
                  <Text style={[styles.td, viewStyles.colReason]} numberOfLines={2}>
                    {row.reason || '—'}
                  </Text>
                  <Text style={[styles.td, viewStyles.colRemarks]} numberOfLines={2}>
                    {row.remarks || '—'}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionTitle}>Evidence Photos</Text>
          {evidencePhotos.length > 0 ? (
            <FlatList
              horizontal
              data={evidencePhotos}
              keyExtractor={(item, i) => `${item}-${i}`}
              renderItem={({ item, index }) => (
                <View style={styles.photoWrap}>
                  <Image
                    source={{ uri: resolvePhotoUrl(item) }}
                    style={viewStyles.evidencePhoto}
                  />
                  <Text style={viewStyles.photoCaption}>Evidence {index + 1}</Text>
                </View>
              )}
            />
          ) : (
            <View style={viewStyles.noPhotoBox}>
              <Text style={viewStyles.noPhotoText}>No photos</Text>
            </View>
          )}

          <View style={viewStyles.grid}>
            <ReadOnlyField
              label="Created At"
              value={formatDateTime(existingReturn.createdAt)}
            />
            <ReadOnlyField
              label="Updated At"
              value={formatDateTime(existingReturn.updatedAt)}
            />
          </View>

          <TouchableOpacity style={viewStyles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={viewStyles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={returnIdParam ? 'Edit Draft Return' : 'Add Stock Return'}
      loading={loading}
    >
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={formStyles.subtitle}>
          Fill in the details to create a new stock return request
        </Text>

        {/* Basic Return Information */}
        <View style={formStyles.section}>
          <Text style={styles.sectionTitle}>Basic Return Information</Text>
          <Text style={styles.readOnlyLabel}>Return ID *</Text>
          <Text style={styles.readOnlyValue}>{displayReturnId || '—'}</Text>
          <Text style={styles.readOnlyLabel}>Executive Name *</Text>
          <Text style={styles.readOnlyValue}>{user?.name || '—'}</Text>

          <ReadOnlyField label="Customer / Outlet *" value={customerName || '—'} />

          <WebSelect
            label="Sale ID / DC Order *"
            value={selectedCompletedDcId}
            onValueChange={handleCompletedDcSelect}
            placeholder="Select Sale/DC Order"
            items={completedDcs.map((o) => ({
              label: `${o.dc_code || o._id} - ${o.school_name}`,
              value: o._id,
            }))}
          />
          {completedDcs.length === 0 ? (
            <Text style={styles.hint}>No completed DC orders found for your account.</Text>
          ) : null}

          <WebSelect
            label="Warehouse *"
            value={warehouse}
            onValueChange={setWarehouse}
            placeholder="Select warehouse"
            items={warehouseLocations.map((w) => ({ label: w, value: w }))}
          />

          <FutureCalendarField label="Return Date" value={returnDate} onChange={setReturnDate} />

          <WebSelect
            label="Return Type *"
            value={returnType}
            onValueChange={setReturnType}
            placeholder="Select return type"
            items={RETURN_TYPES.map((t) => ({ label: t, value: t }))}
          />
        </View>

        {/* School & dispatch details */}
        <View style={formStyles.section}>
          <Text style={styles.sectionTitle}>School & dispatch details</Text>
          <Text style={styles.hint}>
            School fields are filled from the selected DC. Hand stock to your delivery partner for return
            to Main Warehouse; enter the LR No from their lorry receipt before you submit (required).
          </Text>

          <Text style={formStyles.label}>LR No *</Text>
          <WebInput
            style={styles.input}
            value={lrNumber}
            onChangeText={setLrNumber}
            placeholder="Lorry receipt number from delivery partner"
          />

          <DateField label="LR Date" value={lrDate} onChange={setLrDate} required minDate={localTodayDate()} />

          <Text style={formStyles.label}>Fin Year *</Text>
          <WebInput
            style={styles.input}
            value={finYear}
            onChangeText={setFinYear}
            placeholder="e.g. 2025-26"
          />

          <Text style={formStyles.label}>School Code</Text>
          <WebInput style={styles.input} value={schoolCode} onChangeText={setSchoolCode} placeholder="School code" />

          <Text style={formStyles.label}>School Type</Text>
          <WebInput style={styles.input} value={schoolType} onChangeText={setSchoolType} placeholder="School type" />

          <Text style={formStyles.label}>Transport</Text>
          <WebInput style={styles.input} value={transport} onChangeText={setTransport} placeholder="Transport name" />

          <Text style={formStyles.label}>Town / Location</Text>
          <WebInput style={styles.input} value={town} onChangeText={setTown} placeholder="Town or city" />

          <Text style={formStyles.label}>Zone</Text>
          <WebInput style={styles.input} value={zone} onChangeText={setZone} placeholder="Zone" />

          <Text style={formStyles.label}>Cluster</Text>
          <WebInput style={styles.input} value={cluster} onChangeText={setCluster} placeholder="Cluster code" />

          <Text style={formStyles.label}>Contact Person</Text>
          <WebInput style={styles.input} value={contactPerson} onChangeText={setContactPerson} placeholder="Contact person" />

          <Text style={formStyles.label}>Contact Mobile</Text>
          <WebInput style={styles.input} value={contactMobile} onChangeText={(text) => setContactMobile(sanitizePhoneDigits(text))} placeholder="10 to 15 digits" keyboardType="phone-pad" maxLength={15} />

          <Text style={formStyles.label}>Address</Text>
          <WebInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Delivery address" />

          <Text style={formStyles.label}>Remarks (warehouse list)</Text>
          <WebInput
            style={[styles.input, styles.textArea]}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Short note shown in warehouse executive remarks column"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Product Selection */}
        <View style={formStyles.section}>
          <View style={formStyles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Product Selection</Text>
            <TouchableOpacity style={formStyles.addProductBtn} onPress={addProductRow}>
              <Text style={formStyles.addProductBtnText}>+ Add Product</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={formStyles.productTable}>
              <View style={formStyles.productTableHeader}>
                <Text style={[formStyles.productTh, formStyles.colProductName]}>Product</Text>
                <Text style={[formStyles.productTh, formStyles.colSoldQty]}>Sold Qty</Text>
                <Text style={[formStyles.productTh, formStyles.colReturnQty]}>Return Qty</Text>
                <Text style={[formStyles.productTh, formStyles.colUnitPrice]}>Unit Price</Text>
                <Text style={[formStyles.productTh, formStyles.colReasonCell]}>Reason</Text>
                <Text style={[formStyles.productTh, formStyles.colRemarksCell]}>Remarks</Text>
                <Text style={[formStyles.productTh, formStyles.colActionCell]}>Action</Text>
              </View>
              {productRows.length === 0 ? (
                <View style={formStyles.productTableEmpty}>
                  <Text style={styles.emptyText}>
                    {selectedCompletedDcId
                      ? 'No products on this DC. Tap + Add Product to add a row.'
                      : 'Select Sale/DC Order above to load products, or tap + Add Product.'}
                  </Text>
                </View>
              ) : (
                productRows.map((row) => (
                  <View key={row.id} style={formStyles.productTableRow}>
                    <View style={formStyles.colProductName}>
                      {row.product ? (
                        <Text style={formStyles.productNameText} numberOfLines={1}>
                          {row.product}
                        </Text>
                      ) : (
                        <WebSelect
                          label=""
                          value={row.product}
                          onValueChange={(v) => {
                            updateProductRow(row.id, 'product', v);
                            const dcOrder = completedDcs.find((o) => o._id === selectedCompletedDcId);
                            const op = dcOrder?.products?.find(
                              (p: any) => (p.product_name || p.product || '') === v,
                            );
                            if (op) {
                              updateProductRow(row.id, 'soldQty', productQuantity(op));
                              updateProductRow(row.id, 'unitPrice', String(productUnitPrice(op)));
                            }
                          }}
                          placeholder="Select product"
                          items={availableProducts.map((p) => ({ label: p, value: p }))}
                        />
                      )}
                    </View>
                    <View style={formStyles.colSoldQty}>
                      <WebInput
                        style={[formStyles.tableInput, formStyles.readOnlyInput]}
                        value={String(row.soldQty)}
                        editable={false}
                      />
                    </View>
                    <View style={formStyles.colReturnQty}>
                      <WebInput
                        style={formStyles.tableInput}
                        value={row.returnQty}
                        onChangeText={(v) => /^\d*$/.test(v) && updateProductRow(row.id, 'returnQty', v)}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                    <View style={formStyles.colUnitPrice}>
                      <WebInput
                        style={formStyles.tableInput}
                        value={row.unitPrice}
                        onChangeText={(v) => /^\d*\.?\d*$/.test(v) && updateProductRow(row.id, 'unitPrice', v)}
                        keyboardType="decimal-pad"
                        placeholder=""
                      />
                    </View>
                    <View style={formStyles.colReasonCell}>
                      <WebSelect
                        label=""
                        value={row.reason}
                        onValueChange={(v) => updateProductRow(row.id, 'reason', v)}
                        placeholder="Select reason"
                        items={RETURN_REASONS.map((r) => ({ label: r, value: r }))}
                      />
                    </View>
                    <View style={formStyles.colRemarksCell}>
                      <WebInput
                        style={formStyles.tableInput}
                        value={row.remarks}
                        onChangeText={(v) => updateProductRow(row.id, 'remarks', v)}
                        placeholder="Optional remarks"
                      />
                    </View>
                    <View style={formStyles.colActionCell}>
                      <TouchableOpacity onPress={() => removeProductRow(row.id)} style={formStyles.removeBtn}>
                        <Text style={formStyles.removeBtnText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>

        {/* Evidence & Remarks */}
        <View style={formStyles.section}>
          <Text style={styles.sectionTitle}>
            Evidence & Remarks
            {' *'}
          </Text>
          <Text style={styles.warningText}>At least one photo is mandatory for every stock return.</Text>
          {evidenceRequired && (
            <Text style={styles.warningText}>Executive remarks are also mandatory for Damaged/Expired.</Text>
          )}
          <Text style={formStyles.label}>Photo Upload *</Text>
          <TouchableOpacity style={styles.photoButton} onPress={addPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.photoButtonText}>+ Choose Photo</Text>
            )}
          </TouchableOpacity>
          {evidencePhotos.length > 0 && (
            <FlatList
              horizontal
              data={evidencePhotos}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: resolvePhotoUrl(item) }} style={styles.photoThumb} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(index)}>
                    <Text style={styles.photoRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
          <Text style={formStyles.label}>Executive Remarks</Text>
          <WebInput
            style={[styles.input, styles.textArea]}
            value={executiveRemarks}
            onChangeText={setExecutiveRemarks}
            placeholder="Enter remarks about the return"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Summary */}
        <View style={formStyles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Items Returned</Text>
            <Text style={styles.summaryValue}>{totalItemsReturned}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Quantity</Text>
            <Text style={styles.summaryValue}>{totalQuantity}</Text>
          </View>
        </View>

        {/* Status & Tracking */}
        <View style={formStyles.section}>
          <Text style={styles.sectionTitle}>Status & Tracking</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Current Status</Text>
            <Text style={styles.summaryValue}>{existingReturn?.status || 'Draft'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Next Action</Text>
            <Text style={styles.summaryValue}>
              {existingReturn
                ? NEXT_ACTION_BY_STATUS[existingReturn.status] || '—'
                : 'Submit Return Request'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={formStyles.actions}>
          <View style={formStyles.actionsRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnDraft, formStyles.actionBtnHalf]}
              onPress={() => navigation.goBack()}
            >
              <Text style={formStyles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnDraft, formStyles.actionBtnHalf]}
              onPress={saveDraft}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={formStyles.actionBtnText} numberOfLines={1}>
                  Save as Draft
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.btn, styles.btnSubmit, formStyles.actionBtnFull]}
            onPress={submitReturn}
            disabled={saving || !canSubmit}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={formStyles.actionBtnTextPrimary} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                Submit Return Request
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {!canSubmit && (
          <Text style={[styles.hint, { marginBottom: 24 }]}>
            Complete required fields including LR No and Fin Year before submitting.
          </Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h3, color: colors.textLight, flex: 1, textAlign: 'center' },
  stepTabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.backgroundLight, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginHorizontal: 4 },
  stepTabActive: { backgroundColor: colors.primary, marginHorizontal: 4 },
  stepTabText: { ...typography.body.medium, color: colors.textSecondary },
  stepTabTextActive: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
  label: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600', marginBottom: 6 },
  readOnlyLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  readOnlyValue: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 12 },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  warningText: { ...typography.body.small, color: colors.warning, marginBottom: 12 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, fontStyle: 'italic', marginVertical: 12 },
  input: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, marginBottom: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  pickerWrap: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 12 },
  picker: { height: 48 },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: colors.border },
  th: { ...typography.label.small, fontWeight: '600', color: colors.textPrimary },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  td: { ...typography.body.small, color: colors.textPrimary },
  colProduct: { width: 80, paddingRight: 4 },
  colQty: { width: 44, paddingRight: 4 },
  colReason: { flex: 1, minWidth: 70 },
  colRemarks: { flex: 1, minWidth: 60 },
  inputSmall: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 6, fontSize: 12, color: colors.textPrimary },
  photoButton: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  photoButtonText: { ...typography.body.medium, color: colors.primary },
  photoWrap: { marginRight: 12, position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.error, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel: { ...typography.body.medium, color: colors.textSecondary },
  summaryValue: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', minWidth: 90 },
  btnDraft: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border },
  btnSubmit: { backgroundColor: colors.primary },
  btnDraftText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  btnSubmitText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  nextButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  nextButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  backStepButton: { padding: 12, alignItems: 'center', marginTop: 8 },
  backStepText: { ...typography.body.small, color: colors.primary },
});

const formStyles = StyleSheet.create({
  subtitle: {
    ...typography.body.medium,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    ...typography.body.medium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyBox: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  addProductBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundLight,
  },
  addProductBtnText: {
    ...typography.body.small,
    color: colors.primary,
    fontWeight: '600',
  },
  productRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productFieldsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  productTable: {
    minWidth: 860,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  productTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  productTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  productTableEmpty: {
    padding: 20,
    minWidth: 860,
  },
  productTh: {
    ...typography.label.small,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  productNameText: {
    ...typography.body.medium,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  colProductName: { width: 100, paddingRight: 8 },
  colSoldQty: { width: 72, paddingRight: 8 },
  colReturnQty: { width: 72, paddingRight: 8 },
  colUnitPrice: { width: 80, paddingRight: 8 },
  colReasonCell: { width: 130, paddingRight: 8 },
  colRemarksCell: { width: 130, paddingRight: 8 },
  colActionCell: { width: 44, alignItems: 'center' },
  tableInput: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 38,
  },
  readOnlyInput: {
    backgroundColor: '#F8FAFC',
  },
  actions: {
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnHalf: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionBtnFull: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionBtnText: {
    ...typography.body.medium,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionBtnTextPrimary: {
    ...typography.body.medium,
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '600',
    textAlign: 'center',
  },
});

const viewStyles = StyleSheet.create({
  subtitle: {
    ...typography.body.medium,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  grid: {
    gap: 12,
    marginBottom: 20,
  },
  fieldWrap: {
    marginBottom: 4,
  },
  fieldLabel: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  fieldBox: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldValue: {
    ...typography.body.medium,
    color: colors.textPrimary,
  },
  tableCard: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  colProduct: { width: 72, paddingRight: 4 },
  colQty: { width: 52, paddingRight: 4 },
  colReason: { flex: 1, minWidth: 60 },
  colRemarks: { flex: 1, minWidth: 56 },
  evidencePhoto: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoCaption: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  noPhotoBox: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  noPhotoText: {
    ...typography.body.medium,
    color: colors.textSecondary,
  },
  closeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  closeButtonText: {
    ...typography.body.medium,
    color: colors.textLight,
    fontWeight: '600',
  },
});

const calendarStyles = StyleSheet.create({
  field: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldText: { ...typography.body.medium, color: colors.textPrimary }, icon: { color: colors.primary, fontSize: 18 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 20 }, modal: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, monthTitle: { ...typography.heading.h3, color: colors.textPrimary }, nav: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#eff6ff' }, navDisabled: { opacity: 0.35 }, navText: { fontSize: 28, color: colors.primary, lineHeight: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.285%', textAlign: 'center', ...typography.label.small, color: colors.textSecondary, paddingBottom: 7 }, day: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 1 }, dayText: { ...typography.body.medium, color: colors.textPrimary }, selectedDay: { backgroundColor: colors.primary, borderRadius: 18 }, selectedDayText: { color: '#fff', fontWeight: '700' },
  closeButton: { alignItems: 'center', paddingTop: 14 }, closeText: { ...typography.body.medium, color: colors.primary, fontWeight: '600' },
});

/**
 * Completed DC (Warehouse) — matches web /dashboard/warehouse/completed-dc
 * after Update & Submit from DC @ Warehouse.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

/** Native only — react-native-webview throws on Expo web. */
let NativeWebView: any = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch {
    NativeWebView = null;
  }
}

function PdfViewer({ url, title }: { url: string; title: string }) {
  if (Platform.OS === 'web') {
    const isImage = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url) || url.startsWith('data:image/');
    return (
      <View style={styles.pdfContainer}>
        {isImage
          ? React.createElement('img', {
              src: url,
              alt: title,
              style: { width: '100%', maxHeight: 480, objectFit: 'contain' },
            })
          : React.createElement('iframe', {
              src: url,
              title,
              style: { width: '100%', height: 480, border: 'none', borderRadius: 8 },
            })}
        <TouchableOpacity
          style={styles.openBrowserBtn}
          onPress={() => {
            if (typeof window !== 'undefined') window.open(url, '_blank');
            else Linking.openURL(url).catch(() => {});
          }}
        >
          <Text style={styles.openBrowserBtnText}>Open in new tab</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (NativeWebView) {
    return (
      <View style={styles.pdfContainer}>
        <NativeWebView source={{ uri: url }} style={styles.webview} scalesPageToFit startInLoadingState />
        <TouchableOpacity style={styles.openBrowserBtn} onPress={() => Linking.openURL(url).catch(() => {})}>
          <Text style={styles.openBrowserBtnText}>Open externally</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.pdfContainer}>
      <Text style={styles.pdfFallback}>In-app viewer unavailable for this platform.</Text>
      <TouchableOpacity style={styles.openBrowserBtn} onPress={() => Linking.openURL(url).catch(() => {})}>
        <Text style={styles.openBrowserBtnText}>Open document</Text>
      </TouchableOpacity>
    </View>
  );
}

const STUDENT_TYPE_OPTIONS = [
  'NA',
  'Training-Material',
  'New Students',
  'Old Students',
  'Excess',
  'Exchange',
  'Shortage',
  'Excess-OldStudents',
  'Excess-NewStudents',
];

const DELIVERY_STATUS_OPTIONS = ['Pending', 'In Transit', 'Delivered', 'Completed'];
const DC_CATEGORY_OPTIONS = ['Term 1', 'Term 2', 'Shortage', 'Both'];
const STOCK_RETURN_TYPES = ['Damaged', 'Expired', 'Excess', 'Wrong item', 'Replacement'];
const STOCK_RETURN_REASONS = [
  'Damaged',
  'Expired',
  'Excess',
  'Wrong item',
  'Replacement',
  'Customer request',
  'Quality issue',
  'Other',
];
const DEFAULT_WAREHOUSES = ['Main Warehouse', 'North Warehouse', 'South Warehouse', 'East Warehouse', 'West Warehouse'];

type SrProductRow = {
  id: string;
  product: string;
  soldQty: number;
  returnQty: string;
  reason: string;
  remarks: string;
};

type CompletedRow = {
  _id: string;
  dcId: string;
  dcNo: string;
  dcDate?: string;
  dcCategory?: string;
  dcFinYear?: string;
  schoolName?: string;
  schoolCode?: string;
  schoolType?: string;
  zone?: string;
  executive?: string;
  transport?: string;
  lrNo?: string;
  lrDate?: string;
  lrCost?: string;
  boxes?: string;
  transportArea?: string;
  deliveryStatus?: string;
  remarks?: string;
  completedDate?: string;
  poPhotoUrl?: string;
  poDocument?: string;
  productDetails?: any[];
  dcOrderId?: any;
};

function getUploadsBaseUrl(): string {
  return getApiUrl().replace(/\/api\/?$/, '');
}

function buildPdfUrl(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  const base = getUploadsBaseUrl();
  let path: string;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const match = trimmed.match(/^https?:\/\/[^/]+(\/.*)?$/);
    path = match && match[1] ? match[1] : `/${trimmed.split('/').pop() || 'file'}`;
    if (!path.startsWith('/')) path = '/' + path;
  } else {
    path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return `${base}${path}`;
}

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-IN');
  } catch {
    return '-';
  }
}

function toYmd(dateString?: string) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function finYearFrom(createdAt?: string) {
  if (!createdAt) return '';
  const y = new Date(createdAt).getFullYear();
  return `${y}-${y + 1}`;
}

function dcNoFrom(dc: any) {
  const id = String(dc._id || '');
  if (!dc.createdAt) return `DC-${id.slice(-6)}`;
  const year = new Date(dc.createdAt).getFullYear();
  return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}/${id.slice(-4)}`;
}

function transformDc(dc: any): CompletedRow {
  const dcId = String(dc._id);
  const order = dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null;
  return {
    _id: dcId,
    dcId,
    dcNo: dcNoFrom(dc),
    dcDate: dc.dcDate || dc.createdAt,
    dcCategory: dc.dcCategory || 'Term 2',
    dcFinYear: finYearFrom(dc.createdAt),
    schoolName: order?.school_name || dc.customerName || '',
    schoolCode: order?.school_code || order?.dc_code || '',
    schoolType: order?.school_type || '',
    zone: order?.zone || '',
    executive: dc.employeeId?.name || order?.assigned_to?.name || '',
    transport: dc.transport || '',
    lrNo: dc.lrNo || '',
    lrDate: dc.lrDate || '',
    lrCost: dc.lrCost != null && dc.lrCost !== '' ? String(dc.lrCost) : '',
    boxes: dc.boxes || '',
    transportArea: dc.transportArea || '',
    deliveryStatus: dc.deliveryStatus || '',
    remarks: (dc.dcRemarks ?? '').trim() || dc.deliveryNotes || '',
    completedDate: dc.completedAt || '',
    poPhotoUrl: dc.poPhotoUrl || dc.poDocument || '',
    poDocument: dc.poDocument || dc.poPhotoUrl || '',
    productDetails: Array.isArray(dc.productDetails) ? dc.productDetails : [],
    dcOrderId: dc.dcOrderId,
  };
}

export default function WarehouseCompletedDCScreen({ navigation }: any) {
  const { user } = useAuth();
  const [rows, setRows] = useState<CompletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [pdfVisible, setPdfVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState('DC Document');
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);

  const [editing, setEditing] = useState<CompletedRow | null>(null);
  const [editForm, setEditForm] = useState({
    transport: '',
    lrNo: '',
    boxes: '',
    dcCategory: '',
    transportArea: '',
    lrDate: '',
    lrCost: '',
    deliveryStatus: '',
    remarks: '',
    poRemarks: '',
  });
  const [saving, setSaving] = useState(false);

  const [studentTypeById, setStudentTypeById] = useState<Record<string, string>>({});
  const [shortageTarget, setShortageTarget] = useState<CompletedRow | null>(null);
  const [shortageRows, setShortageRows] = useState<
    Array<{ id: string; product: string; class: string; ordered: number; delivered: number; shortage: string }>
  >([]);
  const [shortageRemarks, setShortageRemarks] = useState('');
  const [savingShortage, setSavingShortage] = useState(false);

  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState<any[]>([]);
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);

  const [srOpen, setSrOpen] = useState(false);
  const [srSaving, setSrSaving] = useState(false);
  const [srRow, setSrRow] = useState<CompletedRow | null>(null);
  const [srDcOrderId, setSrDcOrderId] = useState('');
  const [srWarehouses, setSrWarehouses] = useState<string[]>(DEFAULT_WAREHOUSES);
  const [srProducts, setSrProducts] = useState<string[]>([]);
  const [srCustomerName, setSrCustomerName] = useState('');
  const [srWarehouse, setSrWarehouse] = useState('Main Warehouse');
  const [srReturnDate, setSrReturnDate] = useState('');
  const [srReturnType, setSrReturnType] = useState('');
  const [srLrNo, setSrLrNo] = useState('');
  const [srFinYear, setSrFinYear] = useState('');
  const [srSchoolCode, setSrSchoolCode] = useState('');
  const [srZone, setSrZone] = useState('');
  const [srRemarks, setSrRemarks] = useState('');
  const [srProductRows, setSrProductRows] = useState<SrProductRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let data: any = await apiService.get('/dc/completed').catch(() => null);
      if (!Array.isArray(data)) {
        data = await apiService.get('/dc?status=completed').catch(() => []);
      }
      const list = Array.isArray(data) ? data : data?.data || [];
      setRows(list.map(transformDc));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load completed DCs');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openViewPdf = async (row: CompletedRow) => {
    setOpeningPdfId(row._id);
    try {
      const fullDC = await apiService.get(`/dc/${row.dcId}`);
      const url = fullDC?.poDocument || fullDC?.poPhotoUrl || row.poDocument || row.poPhotoUrl;
      const resolved = buildPdfUrl(url);
      if (!resolved) {
        Alert.alert('No PDF', 'No PDF document available for this DC.');
        return;
      }
      setPdfTitle(`DC Document - ${row.dcNo}`);
      setPdfUrl(resolved);
      setPdfVisible(true);
    } catch (e: any) {
      const fallback = buildPdfUrl(row.poDocument || row.poPhotoUrl);
      if (fallback) {
        setPdfTitle(`DC Document - ${row.dcNo}`);
        setPdfUrl(fallback);
        setPdfVisible(true);
      } else {
        Alert.alert('Error', e?.message || 'No PDF document available.');
      }
    } finally {
      setOpeningPdfId(null);
    }
  };

  const openEdit = async (row: CompletedRow) => {
    try {
      const full = await apiService.get(`/dc/${row.dcId}`).catch(() => null);
      setEditing(row);
      setEditForm({
        transport: full?.transport || row.transport || '',
        lrNo: full?.lrNo || row.lrNo || '',
        boxes: full?.boxes || row.boxes || '',
        dcCategory: full?.dcCategory || row.dcCategory || '',
        transportArea: full?.transportArea || row.transportArea || '',
        lrDate: toYmd(full?.lrDate || row.lrDate),
        lrCost: full?.lrCost != null ? String(full.lrCost) : row.lrCost || '',
        deliveryStatus: full?.deliveryStatus || row.deliveryStatus || '',
        remarks: full?.deliveryNotes || row.remarks || '',
        poRemarks: full?.dcRemarks || '',
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to open edit');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const required: Array<[string, string]> = [
      ['transport', 'Transport'],
      ['lrNo', 'LR No'],
      ['boxes', 'Boxes'],
      ['dcCategory', 'DC Category'],
      ['transportArea', 'Transport Area'],
      ['lrDate', 'LR Date'],
      ['lrCost', 'LR Cost'],
      ['deliveryStatus', 'Delivery Status'],
      ['remarks', 'LR / Warehouse Remarks'],
    ];
    for (const [key, label] of required) {
      if (!(editForm as any)[key]?.toString().trim()) {
        Alert.alert('Required', `${label} is required.`);
        return;
      }
    }
    if (!/^\d+$/.test(editForm.boxes.trim())) {
      Alert.alert('Invalid Boxes', 'Boxes must contain numbers only.');
      return;
    }
    setSaving(true);
    try {
      await apiService.put(`/dc/${editing.dcId}`, {
        transport: editForm.transport,
        lrNo: editForm.lrNo,
        boxes: editForm.boxes,
        dcCategory: editForm.dcCategory,
        transportArea: editForm.transportArea,
        lrDate: editForm.lrDate,
        lrCost: editForm.lrCost,
        deliveryStatus: editForm.deliveryStatus,
        deliveryNotes: editForm.remarks,
      });
      setEditing(null);
      await loadData();
      Alert.alert('Saved', 'DC updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update DC');
    } finally {
      setSaving(false);
    }
  };

  const replacePdf = async (row: CompletedRow) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('poPhoto', {
        uri: asset.uri,
        type: asset.mimeType || 'application/pdf',
        name: asset.name || 'dc.pdf',
      } as any);
      const uploaded = await apiService.upload('/dc/upload-po', formData);
      const url = uploaded.poPhotoUrl || uploaded.url || '';
      if (!url) {
        Alert.alert('Error', 'Upload succeeded but no file URL was returned.');
        return;
      }
      await apiService.put(`/dc/${row.dcId}`, {
        poDocument: url,
        poPhotoUrl: url,
      });
      Alert.alert('Success', 'PDF replaced successfully.');
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to replace PDF');
    }
  };

  const openInvoice = async (row: CompletedRow) => {
    setInvoiceLoadingId(row._id);
    try {
      const full = await apiService.get(`/dc/${row.dcId}`);
      const lines = Array.isArray(full?.productDetails) ? full.productDetails : row.productDetails || [];
      setInvoiceLines(lines);
      setInvoiceTitle(`Invoice - ${row.schoolName || row.dcNo}`);
      setInvoiceVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load invoice');
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const continueStudentType = async (row: CompletedRow) => {
    const sel = studentTypeById[row._id];
    if (!sel) {
      Alert.alert('Select student type', 'Select a student type first.');
      return;
    }
    if (sel !== 'Shortage') {
      try {
        await apiService.put(`/dc/${row.dcId}`, { studentType: sel });
        Alert.alert('Saved', `Student type saved: ${sel}`);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to save student type');
      }
      return;
    }
    try {
      const full = await apiService.get(`/dc/${row.dcId}`);
      const products = Array.isArray(full?.productDetails) ? full.productDetails : [];
      setShortageTarget(row);
      setShortageRemarks('');
      setShortageRows(
        products.map((p: any, i: number) => {
          const ordered = Number(p.quantity || p.strength || 0);
          const delivered = Number(p.deliverableQuantity ?? p.quantity ?? 0);
          return {
            id: `${i}-${p.product || p.productName}`,
            product: p.product || p.productName || '',
            class: String(p.class || ''),
            ordered,
            delivered,
            shortage: '',
          };
        })
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load products for shortage');
    }
  };

  const submitShortage = async () => {
    if (!shortageTarget) return;
    const payloadRows = shortageRows
      .filter((r) => Number(r.shortage) > 0)
      .map((r) => ({
        product: r.product,
        class: r.class,
        quantity: Number(r.shortage),
        deliveredQuantity: r.delivered,
        shortageQuantity: Number(r.shortage),
        strength: Number(r.shortage),
      }));
    if (payloadRows.length === 0) {
      Alert.alert('Required', 'Enter shortage quantity for at least one product.');
      return;
    }
    setSavingShortage(true);
    try {
      await apiService.post(`/dc/${shortageTarget.dcId}/record-shortage`, {
        productDetails: payloadRows,
        dcCategory: 'Shortage',
        dcRemarks: shortageRemarks || undefined,
      });
      setShortageTarget(null);
      setStudentTypeById((p) => {
        const next = { ...p };
        delete next[shortageTarget._id];
        return next;
      });
      Alert.alert('Success', 'Shortage DC created successfully.');
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create shortage DC');
    } finally {
      setSavingShortage(false);
    }
  };

  const openStockReturn = async (row: CompletedRow) => {
    try {
      let warehouses = DEFAULT_WAREHOUSES;
      try {
        const whRes = await apiService.get('/warehouse/locations').catch(() => apiService.get('/warehouse'));
        const list = Array.isArray(whRes) ? whRes : whRes?.data || [];
        const names = list
          .map((w: any) => (typeof w === 'string' ? w : w.name || w.location || ''))
          .filter(Boolean);
        if (names.length) warehouses = names;
      } catch {
        /* keep defaults */
      }
      setSrWarehouses(warehouses);

      const full = await apiService.get(`/dc/${row.dcId}`);
      const order = full?.dcOrderId && typeof full.dcOrderId === 'object' ? full.dcOrderId : null;
      const orderId =
        (order?._id ? String(order._id) : null) || (full?.dcOrderId ? String(full.dcOrderId) : '') || '';
      const details = Array.isArray(full?.productDetails) ? full.productDetails : [];
      const fromDc: SrProductRow[] = details
        .map((p: any, idx: number) => ({
          id: `sr-${idx}-${p.product || p.productName || 'p'}`,
          product: p.product || p.productName || '',
          soldQty: Number(p.deliverableQuantity ?? p.quantity ?? p.strength ?? 0),
          returnQty: '0',
          reason: '',
          remarks: '',
        }))
        .filter((p: SrProductRow) => p.product);

      setSrRow(row);
      setSrDcOrderId(orderId);
      setSrProducts(fromDc.map((p) => p.product));
      setSrCustomerName(row.schoolName || order?.school_name || full?.customerName || '');
      setSrWarehouse('Main Warehouse');
      setSrReturnDate(new Date().toISOString().split('T')[0]);
      setSrReturnType('');
      setSrLrNo(full?.lrNo || row.lrNo || '');
      setSrFinYear(row.dcFinYear || '');
      setSrSchoolCode(row.schoolCode || order?.school_code || order?.dc_code || '');
      setSrZone(row.zone || order?.zone || '');
      setSrRemarks('');
      setSrProductRows(
        fromDc.length
          ? fromDc
          : [{ id: `sr-empty-${Date.now()}`, product: '', soldQty: 0, returnQty: '0', reason: '', remarks: '' }]
      );
      setSrOpen(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to open stock return');
    }
  };

  const submitStockReturn = async () => {
    if (!srRow) return;
    if (!srCustomerName.trim()) {
      Alert.alert('Required', 'Customer / Outlet is required');
      return;
    }
    if (!srWarehouse.trim()) {
      Alert.alert('Required', 'Warehouse is required');
      return;
    }
    if (!srReturnDate) {
      Alert.alert('Required', 'Return Date is required');
      return;
    }
    if (!srReturnType) {
      Alert.alert('Required', 'Return Type is required');
      return;
    }
    if (!srLrNo.trim()) {
      Alert.alert('Required', 'LR No is required');
      return;
    }
    if (!srFinYear.trim()) {
      Alert.alert('Required', 'Fin Year is required');
      return;
    }
    const products = srProductRows
      .filter((r) => r.product && Number(r.returnQty) > 0)
      .map((r) => ({
        product: r.product,
        soldQty: Number(r.soldQty) || 0,
        returnQty: Number(r.returnQty) || 0,
        reason: r.reason,
        remarks: r.remarks || '',
      }));
    if (products.length === 0) {
      Alert.alert('Required', 'Add at least one product with return quantity > 0');
      return;
    }
    for (const p of products) {
      if (!p.reason.trim()) {
        Alert.alert('Required', `Reason is required for ${p.product}`);
        return;
      }
      if (p.returnQty > p.soldQty) {
        Alert.alert('Invalid', `Return Qty cannot exceed Sold Qty for ${p.product}`);
        return;
      }
    }
    setSrSaving(true);
    try {
      await apiService.post('/stock-returns/executive', {
        returnDate: srReturnDate,
        returnType: srReturnType,
        customerName: srCustomerName.trim(),
        warehouse: srWarehouse,
        dcOrderId: srDcOrderId || undefined,
        saleId: srRow.dcNo,
        lrNumber: srLrNo.trim(),
        finYear: srFinYear.trim(),
        schoolCode: srSchoolCode || undefined,
        zone: srZone || undefined,
        remarks: srRemarks || undefined,
        executiveRemarks: srRemarks || undefined,
        products,
        totalItems: products.length,
        totalQuantity: products.reduce((s, p) => s + p.returnQty, 0),
        status: 'Submitted',
      });
      setSrOpen(false);
      setSrRow(null);
      Alert.alert('Success', 'Stock return created successfully');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create stock return');
    } finally {
      setSrSaving(false);
    }
  };

  const Info = ({ label, value }: { label: string; value?: string }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value?.trim() ? value : '-'}</Text>
    </View>
  );

  const LabeledInput = ({
    label,
    value,
    onChangeText,
    ...rest
  }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    [key: string]: any;
  }) => (
    <View style={styles.fieldWrap}>
      <WebLabel>{label}</WebLabel>
      <WebInput value={value} onChangeText={onChangeText} {...rest} />
    </View>
  );

  const DateField = ({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) => (
    <View style={styles.fieldWrap}>
      <WebLabel>{label}</WebLabel>
      {Platform.OS === 'web'
        ? React.createElement('input', {
            type: 'date',
            value: value || '',
            onChange: (event: any) => onChangeText(event.target.value || ''),
            style: {
              width: '100%',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 15,
              backgroundColor: '#FFFFFF',
              color: '#1E293B',
              boxSizing: 'border-box',
            },
          })
        : <WebInput value={value} onChangeText={onChangeText} placeholder="YYYY-MM-DD" />}
    </View>
  );

  return (
    <ScreenShell
      title="Completed DC"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {rows.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No completed DCs found</Text>
          </View>
        ) : (
          rows.map((row, idx) => (
            <View key={row._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.customerName}>
                  {idx + 1}. {row.schoolName || row.dcNo}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.success }]}>Completed</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Info label="DC No" value={row.dcNo} />
                <Info label="DC Date" value={formatDate(row.dcDate)} />
                <Info label="DC Category" value={row.dcCategory} />
                <Info label="DC Fin Year" value={row.dcFinYear} />
                <Info label="School Name" value={row.schoolName} />
                <Info label="School Code" value={row.schoolCode} />
                <Info label="School Type" value={row.schoolType} />
                <Info label="Zone" value={row.zone} />
                <Info label="Executive" value={row.executive} />
                <Info label="Completed Date" value={formatDate(row.completedDate)} />
                <Info label="LR Info" value={row.lrNo} />
                <Info label="LR Date" value={formatDate(row.lrDate)} />
                <Info label="LR Cost" value={row.lrCost} />
                <Info label="Remarks" value={row.remarks} />
                <Info label="Delivery Status" value={row.deliveryStatus} />
              </View>

              <View style={styles.actionsBlock}>
                <Text style={styles.actionsTitle}>Action 1</Text>
                <View style={styles.actionWrap}>
                  <TouchableOpacity style={[styles.chipBtn, styles.chipSecondary]} onPress={() => openEdit(row)}>
                    <Text style={styles.chipBtnTextDark}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chipBtn, styles.chipPrimary]}
                    onPress={() => openViewPdf(row)}
                    disabled={!!openingPdfId}
                  >
                    {openingPdfId === row._id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.chipBtnText}>View PDF</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chipBtn, styles.chipOutline]} onPress={() => replacePdf(row)}>
                    <Text style={styles.chipBtnTextDark}>Replace PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chipBtn, styles.chipOutline]}
                    onPress={() => openInvoice(row)}
                    disabled={invoiceLoadingId === row._id}
                  >
                    {invoiceLoadingId === row._id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.chipBtnTextDark}>View Invoice</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <WebSelect
                  label="Student type"
                  value={studentTypeById[row._id] || ''}
                  onValueChange={(v) => setStudentTypeById((p) => ({ ...p, [row._id]: v }))}
                  placeholder="Select student type"
                  items={STUDENT_TYPE_OPTIONS.map((o) => ({ label: o, value: o }))}
                />
                <TouchableOpacity style={styles.continueLink} onPress={() => continueStudentType(row)}>
                  <Text style={styles.continueLinkText}>Continue</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionsBlock}>
                <Text style={styles.actionsTitle}>Action 2</Text>
                <TouchableOpacity
                  style={[styles.chipBtn, styles.chipInfo, { alignSelf: 'flex-start' }]}
                  onPress={() => openStockReturn(row)}
                >
                  <Text style={styles.chipBtnText}>Stock Return</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* PDF modal */}
      <Modal visible={pdfVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {pdfTitle}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setPdfVisible(false);
                  setPdfUrl(null);
                }}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            {pdfUrl ? (
              <PdfViewer url={pdfUrl} title={pdfTitle} />
            ) : (
              <Text style={styles.pdfFallback}>No document</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit LR / delivery modal */}
      <Modal visible={!!editing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit DC — {editing?.dcNo}</Text>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <LabeledInput label="Transport *" value={editForm.transport} onChangeText={(v) => setEditForm((p) => ({ ...p, transport: v }))} />
              <LabeledInput label="LR No *" value={editForm.lrNo} onChangeText={(v) => setEditForm((p) => ({ ...p, lrNo: v }))} />
              <LabeledInput
                label="Boxes *"
                value={editForm.boxes}
                keyboardType="numeric"
                onChangeText={(v) => setEditForm((p) => ({ ...p, boxes: v.replace(/[^0-9]/g, '') }))}
              />
              <WebSelect
                label="DC Category *"
                value={editForm.dcCategory}
                onValueChange={(v) => setEditForm((p) => ({ ...p, dcCategory: v }))}
                items={DC_CATEGORY_OPTIONS.map((o) => ({ label: o, value: o }))}
              />
              <LabeledInput
                label="Transport Area *"
                value={editForm.transportArea}
                onChangeText={(v) => setEditForm((p) => ({ ...p, transportArea: v }))}
              />
              <DateField
                label="LR Date *"
                value={editForm.lrDate}
                onChangeText={(v) => setEditForm((p) => ({ ...p, lrDate: v }))}
              />
              <LabeledInput label="LR Cost *" value={editForm.lrCost} onChangeText={(v) => setEditForm((p) => ({ ...p, lrCost: v }))} />
              <WebSelect
                label="Delivery Status *"
                value={editForm.deliveryStatus}
                onValueChange={(v) => setEditForm((p) => ({ ...p, deliveryStatus: v }))}
                items={DELIVERY_STATUS_OPTIONS.map((o) => ({ label: o, value: o }))}
              />
              <LabeledInput
                label="PO Remarks (up to PO done)"
                value={editForm.poRemarks}
                onChangeText={() => {}}
                editable={false}
                placeholder="—"
              />
              <LabeledInput
                label="LR / Warehouse Remarks *"
                value={editForm.remarks}
                onChangeText={(v) => setEditForm((p) => ({ ...p, remarks: v }))}
                placeholder="Enter LR / warehouse remarks"
                multiline
              />
              <WebButton title={saving ? 'Saving…' : 'Save'} onPress={saveEdit} disabled={saving} />
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Invoice modal */}
      <Modal visible={invoiceVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {invoiceTitle}
              </Text>
              <TouchableOpacity onPress={() => setInvoiceVisible(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {invoiceLines.length === 0 ? (
                <Text style={styles.pdfFallback}>No product lines on this DC.</Text>
              ) : (
                invoiceLines.map((p, i) => (
                  <View key={i} style={styles.invoiceLine}>
                    <Text style={styles.invoiceProduct}>{p.product || p.productName || '-'}</Text>
                    <Text style={styles.invoiceMeta}>
                      Class {p.class || '-'} · Qty {p.deliverableQuantity ?? p.quantity ?? '-'}
                      {p.specs ? ` · Specs ${p.specs}` : ' · Specs -'}
                    </Text>
                    {p.total != null ? <Text style={styles.invoiceMeta}>Total: {p.total}</Text> : null}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Shortage modal */}
      <Modal visible={!!shortageTarget} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Shortage DC</Text>
              <TouchableOpacity onPress={() => setShortageTarget(null)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {shortageRows.map((r, idx) => (
                <View key={r.id} style={styles.shortageCard}>
                  <Text style={styles.invoiceProduct}>
                    {r.product} (Class {r.class || '-'})
                  </Text>
                  <Text style={styles.invoiceMeta}>
                    Ordered {r.ordered} · Delivered {r.delivered}
                  </Text>
                  <LabeledInput
                    label="Shortage qty"
                    value={r.shortage}
                    keyboardType="numeric"
                    onChangeText={(v) =>
                      setShortageRows((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], shortage: v };
                        return next;
                      })
                    }
                  />
                </View>
              ))}
              <LabeledInput label="Remarks" value={shortageRemarks} onChangeText={setShortageRemarks} multiline />
              <WebButton
                title={savingShortage ? 'Saving…' : 'Create Shortage DC'}
                onPress={submitShortage}
                disabled={savingShortage}
              />
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Stock Return modal */}
      <Modal visible={srOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '94%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stock Return</Text>
              <TouchableOpacity
                onPress={() => {
                  setSrOpen(false);
                  setSrRow(null);
                }}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.srHint}>
                Create a stock return for completed DC {srRow?.dcNo || ''}. Enter return quantities, reasons, and
                submit.
              </Text>
              <Info label="DC No" value={srRow?.dcNo} />
              <Info label="Created By" value={user?.name || '-'} />
              <LabeledInput label="Customer / Outlet *" value={srCustomerName} onChangeText={setSrCustomerName} />
              <WebSelect
                label="Warehouse *"
                value={srWarehouse}
                onValueChange={setSrWarehouse}
                items={srWarehouses.map((w) => ({ label: w, value: w }))}
              />
              <LabeledInput
                label="Return Date * (YYYY-MM-DD)"
                value={srReturnDate}
                onChangeText={setSrReturnDate}
                placeholder="YYYY-MM-DD"
              />
              <WebSelect
                label="Return Type *"
                value={srReturnType}
                onValueChange={setSrReturnType}
                placeholder="Select return type"
                items={STOCK_RETURN_TYPES.map((t) => ({ label: t, value: t }))}
              />
              <LabeledInput label="LR No *" value={srLrNo} onChangeText={setSrLrNo} placeholder="Enter LR number" />
              <Info label="Fin Year *" value={srFinYear} />
              <Info label="School Code" value={srSchoolCode} />
              <Info label="Zone" value={srZone} />
              <LabeledInput label="Remarks" value={srRemarks} onChangeText={setSrRemarks} multiline />

              <View style={styles.srProductsHeader}>
                <Text style={styles.actionsTitle}>Return Products *</Text>
                <TouchableOpacity
                  style={[styles.chipBtn, styles.chipOutline]}
                  onPress={() =>
                    setSrProductRows((prev) => [
                      ...prev,
                      {
                        id: `sr-new-${Date.now()}`,
                        product: '',
                        soldQty: 0,
                        returnQty: '0',
                        reason: '',
                        remarks: '',
                      },
                    ])
                  }
                >
                  <Text style={styles.chipBtnTextDark}>+ Add Product</Text>
                </TouchableOpacity>
              </View>

              {srProductRows.map((r, idx) => (
                <View key={r.id} style={styles.shortageCard}>
                  <WebSelect
                    label="Product"
                    value={r.product}
                    onValueChange={(v) =>
                      setSrProductRows((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], product: v };
                        return next;
                      })
                    }
                    items={(srProducts.length ? srProducts : [r.product].filter(Boolean)).map((p) => ({
                      label: p,
                      value: p,
                    }))}
                  />
                  <LabeledInput
                    label="Sold Qty"
                    value={String(r.soldQty)}
                    keyboardType="numeric"
                    onChangeText={(v) =>
                      setSrProductRows((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], soldQty: Math.max(0, Number(v) || 0) };
                        return next;
                      })
                    }
                  />
                  <LabeledInput
                    label="Return Qty *"
                    value={r.returnQty}
                    keyboardType="numeric"
                    onChangeText={(v) =>
                      setSrProductRows((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], returnQty: v };
                        return next;
                      })
                    }
                  />
                  <WebSelect
                    label="Reason *"
                    value={r.reason}
                    onValueChange={(v) =>
                      setSrProductRows((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], reason: v };
                        return next;
                      })
                    }
                    placeholder="Select reason"
                    items={STOCK_RETURN_REASONS.map((reason) => ({ label: reason, value: reason }))}
                  />
                  <LabeledInput
                    label="Remarks"
                    value={r.remarks}
                    onChangeText={(v) =>
                      setSrProductRows((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], remarks: v };
                        return next;
                      })
                    }
                  />
                  <TouchableOpacity
                    onPress={() => setSrProductRows((prev) => prev.filter((x) => x.id !== r.id))}
                    style={{ marginTop: 4 }}
                  >
                    <Text style={styles.continueLinkText}>Remove product</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <WebButton
                title={srSaving ? 'Submitting…' : 'Submit Return'}
                onPress={submitStockReturn}
                disabled={srSaving}
              />
              <View style={{ height: 28 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1, paddingRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { ...typography.label.small, fontWeight: '600' },
  cardBody: { marginBottom: 8 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 120 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  actionsBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  actionsTitle: { ...typography.label.medium, color: colors.textSecondary, marginBottom: 8 },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipPrimary: { backgroundColor: colors.primary },
  chipSecondary: { backgroundColor: colors.backgroundMuted || '#e5e7eb' },
  chipOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  chipInfo: { backgroundColor: colors.info || '#0ea5e9' },
  chipBtnText: { ...typography.label.small, color: '#fff', fontWeight: '600' },
  chipBtnTextDark: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
  continueLink: { marginTop: 4, marginBottom: 4 },
  continueLinkText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.heading.h3, color: colors.textPrimary, flex: 1, paddingRight: 8 },
  modalCloseText: { ...typography.label.medium, color: colors.primary, fontWeight: '600' },
  modalBody: { padding: 16 },
  fieldWrap: { marginBottom: 10 },
  pdfContainer: { minHeight: Platform.OS === 'ios' ? 420 : 400, padding: 8 },
  webview: { flex: 1, minHeight: 400, borderRadius: 8 },
  pdfFallback: { ...typography.body.small, color: colors.textSecondary, padding: 16 },
  openBrowserBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  openBrowserBtnText: { ...typography.label.small, color: '#fff', fontWeight: '600' },
  invoiceLine: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoiceProduct: { ...typography.label.medium, color: colors.textPrimary },
  invoiceMeta: { ...typography.body.small, color: colors.textSecondary, marginTop: 2 },
  shortageCard: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  srHint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  srProductsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
});

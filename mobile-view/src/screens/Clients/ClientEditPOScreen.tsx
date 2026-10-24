/**
 * Edit PO for a client (DcOrder).
 * - View / Download / Preview current PO PDF
 * - Request PO Change (new PDF + remarks) → requires Manager approval; DC Request locked until resolved
 * - Edit products & quantities (saved directly)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import { navigateRoot } from '../../navigation/navigationRef';
import {
  findDuplicateEditPORowIndex,
  pickUnusedEditPOVariant,
  canAddAnotherEditPOVariant,
  formatEditPOVariantHint,
  editPORowIdentityPatchIsDuplicate,
  EDIT_PO_DUPLICATE_MESSAGE,
  type EditPOProductCatalogMeta,
  type EditPOProductVariant,
} from '../../utils/editPOProductIdentity';
import { useDcCatalog } from '../../hooks/useDcCatalog';
import { useAuth } from '../../context/AuthContext';
import { TransportNameField, TransportToFields, transportToError } from '../../components/dc/TransportFields';
import { DcCategoryPicker } from '../../components/dc/DcCategoryPicker';
import {
  collectOriginalEditPoVariantKeys,
  dedupeProductDetailLines,
  editPoHasNewCommercialLines,
  ensureProductLineId,
  expandEditPoRowsBySubject,
  findMatchingOrderProduct,
  isOriginalEditPoLine,
  orderProductToClientDcDetail,
  resolveClientDCRowFields,
  type ResolveClientDCRowOpts,
} from '../../lib/crm/clientDcProductRows';
import {
  canonicalDcRowCategory,
  isBillableDcRow,
  isMarkerSpecs,
  isRelatedItemRow,
  isSpecimenRow,
} from '../../lib/crm/dcRowCategory';
import { applyPaymentDivisorsToBreakdown } from '../../lib/crm/dcPaymentDivisors';
import { persistProductTerm } from '../../lib/crm/productTerm';

let WebView: any;
try {
  WebView = require('react-native-webview').WebView;
} catch {
  WebView = null;
}

function getUploadsBaseUrl(): string {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api\/?$/, '');
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
    path = (match && match[1]) ? match[1] : `/${trimmed.split('/').pop() || 'file'}`;
    if (!path.startsWith('/')) path = '/' + path;
  } else {
    path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return `${base}${path}`;
}

/** Edit PO row, same shape as the web Edit PO dialog rows. */
type ProductRow = {
  id: string;
  lineId?: string;
  product_name: string;
  product?: string;
  quantity: number;
  unit_price: number | string;
  term?: string;
  level?: string;
  class?: string;
  specs?: string;
  subject?: string;
  selected_subjects?: string[];
  productCategory?: string;
  category?: string;
  strength?: number;
  itemType?: string;
  subjectPackage?: boolean;
  dispatchMode?: string;
  section?: string;
  program?: string;
  stream?: string;
  /** A billed line saved without a price keeps its price box open. */
  priceUnlocked?: boolean;
  /** Price kept while the row is switched to a free category. */
  paidUnitPrice?: number | string;
  isNew?: boolean;
};

function normalizeProductName(name: string): string {
  return String(name || '').trim().toLowerCase();
}

const idOf = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'object') return v._id ? String(v._id) : null;
  return String(v);
};

/** Fixed column widths — header and body must use the same values */
const EDIT_PO_TABLE_COLUMNS = [
  { id: 'product', label: 'Product', width: 110 },
  { id: 'dcCategory', label: 'Category', width: 130 },
  { id: 'category', label: 'Series', width: 84 },
  { id: 'class', label: 'Class', width: 56 },
  { id: 'subject', label: 'Subject', width: 76 },
  { id: 'level', label: 'Level', width: 76 },
  { id: 'specs', label: 'Specs', width: 76 },
  { id: 'qty', label: 'Qty', width: 56, align: 'center' as const },
  { id: 'price', label: 'Unit Price', width: 76, align: 'right' as const },
  { id: 'total', label: 'Total', width: 68, align: 'right' as const },
  { id: 'action', label: '', width: 32 },
];
const EDIT_PO_TABLE_WIDTH = EDIT_PO_TABLE_COLUMNS.reduce((sum, col) => sum + col.width, 0);
const COL = Object.fromEntries(EDIT_PO_TABLE_COLUMNS.map((c) => [c.id, c.width])) as Record<string, number>;

function EditPOTableCell({
  width,
  align = 'left',
  children,
}: {
  width: number;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.editPoTableCell,
        { width },
        align === 'center' && styles.editPoTableCellCenter,
        align === 'right' && styles.editPoTableCellRight,
      ]}
    >
      {children}
    </View>
  );
}

export default function ClientEditPOScreen({ navigation, route }: any) {
  const orderId = route?.params?.orderId as string | undefined;
  const paramDcId = route?.params?.dcId as string | undefined;
  const catalog = useDcCatalog();
  const {
    findProduct,
    getProductId,
    getProductSubjects,
    getProductCategories,
    hasProductCategories,
    getProductSpecs,
    getProductLevels,
    getProductRelatedItems,
    getCalculationType,
    getCatalogFallbackCount,
  } = catalog;
  const [order, setOrder] = useState<any>(null);
  const [dcId, setDcId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [originalProductNames, setOriginalProductNames] = useState<string[]>([]);
  const [originalVariantKeys, setOriginalVariantKeys] = useState<string[]>([]);
  const [originalPdfUrl, setOriginalPdfUrl] = useState('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const { user: authUser } = useAuth();
  const [transport, setTransport] = useState({
    transport_name: '',
    transport_location: '',
    transportation_landmark: '',
    pincode: '',
    transport_to: '',
    transport_to_name: '',
    transport_to_mobile: '',
  });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newPdfUrl, setNewPdfUrl] = useState('');
  const [changeRemarks, setChangeRemarks] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  const catalogProducts = useMemo(
    () => Array.from(new Set(catalog.products.filter((p: any) => p.prodStatus !== 0).map((p) => p.productName))),
    [catalog.products],
  );

  useEffect(() => {
    if (orderId && !catalog.loading) loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, catalog.loading]);

  const getCatalogMeta = (productName: string): EditPOProductCatalogMeta | null => {
    const p = findProduct(productName);
    if (!p) return null;
    return {
      hasCategory: p.hasCategory,
      categories: p.categories,
      hasSubjects: p.hasSubjects,
      subjects: p.subjects,
      productLevels: p.productLevels,
      hasSpecs: p.hasSpecs,
      specs: p.specs,
    };
  };

  const getEditPOCategoryOptions = (productName: string) => getProductCategories(productName);
  const getEditPOSubjectOptions = (productName: string) => getProductSubjects(productName);
  const getEditPOLevelOptions = (productName: string) => getProductLevels(productName);
  const getEditPOSpecOptions = (productName: string) => getProductSpecs(productName);

  const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  /** Specimen / related-item lines keep their own text; others fall back to the catalogue spec (web persistEditPoSpecs). */
  const persistEditPoSpecs = (productName: string, savedSpec?: string): string => {
    if (isMarkerSpecs(productName, savedSpec, getProductRelatedItems)) return String(savedSpec).trim();
    const specs = getProductSpecs(productName);
    if (specs.length === 0) return '';
    const current = String(savedSpec || '').trim();
    if (current && specs.includes(current)) return current;
    return specs[0] || '';
  };

  const isFreeEditPoRow = (row: { category?: string; itemType?: string; specs?: string }) =>
    isSpecimenRow(row) || !isBillableDcRow(row);

  /** Edit PO billing, same rules as Close Lead (packages, divisors, free specimen / Training Material rows). */
  const editPoBilling = (rows: ProductRow[]) => {
    const named = rows.filter((row) => row.product_name && row.product_name.trim() !== '');
    const { paymentBreakdown, totalAmount } = applyPaymentDivisorsToBreakdown(
      named.map((row) => ({
        rowId: row.id,
        product: row.product_name,
        class: row.class || '1',
        section: row.section,
        program: row.program,
        stream: row.stream,
        category: row.category,
        itemType: row.itemType,
        strength: Number(row.quantity) || 0,
        unitPrice: Number(row.unit_price) || 0,
        level: row.level && row.level !== '-' ? row.level : undefined,
        subject: row.subject && row.subject !== '-' ? row.subject : undefined,
        subjectPackage: Boolean(row.subjectPackage),
        specs: row.specs,
      })),
      getCalculationType,
      getCatalogFallbackCount,
    );
    const totals = new Map<string, number>();
    paymentBreakdown.forEach((line) => totals.set(String(line.rowId), Number(line.total) || 0));
    return { totals, totalAmount: Math.round((Number(totalAmount) || 0) * 100) / 100 };
  };
  const editPoBill = useMemo(() => editPoBilling(products), [products, catalog.products]);

  const loadOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const data = await apiService.get(`/dc-orders/${orderId}`);
      setOrder(data);
      const pe = data.pendingEdit?.status === 'pending' ? data.pendingEdit : null;
      setTransport({
        transport_name: pe?.transport_name ?? data.transport_name ?? '',
        transport_location: pe?.transport_location ?? data.transport_location ?? '',
        transportation_landmark: pe?.transportation_landmark ?? data.transportation_landmark ?? '',
        pincode: pe?.pincode ?? data.pincode ?? '',
        transport_to: data.transport_to ?? '',
        transport_to_name: data.transport_to_name ?? '',
        transport_to_mobile: data.transport_to_mobile ?? '',
      });

      // This client's DC (My Clients): params first, else the non Term-Wise DC on the order.
      let resolvedDcId: string | null = paramDcId || null;
      if (!resolvedDcId) {
        try {
          const res = await apiService.get(`/dc?dcOrderId=${encodeURIComponent(orderId)}`);
          const list: any[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
          resolvedDcId = idOf(list.find((d: any) => d?.status !== 'scheduled_for_later' && !d?.parentDcId));
        } catch {
          resolvedDcId = null;
        }
      }
      setDcId(resolvedDcId);
      let fullDC: any = null;
      if (resolvedDcId) {
        try {
          fullDC = await apiService.get(`/dc/${resolvedDcId}`);
        } catch {
          fullDC = null;
        }
      }

      const orderProducts: any[] = (pe?.products?.length ? pe.products : data.products) || [];
      const dcDetailsRaw = dedupeProductDetailLines(
        (Array.isArray(fullDC?.productDetails) ? fullDC.productDetails : []).filter(
          (p: any) => p?.closeLeadDestination !== 'TERM_WISE_DC',
        ),
      );
      // Last submitted Edit PO (pending) is what the user just saved.
      let dcDetails: any[] =
        pe?.products?.length > 0
          ? pe.products.map((p: any) => orderProductToClientDcDetail(p)).filter((p: any) => p.product)
          : dcDetailsRaw;
      if (!dcDetails.length && !fullDC) {
        // No DC linked: fall back to the saved order lines.
        dcDetails = orderProducts.map((p: any) => orderProductToClientDcDetail(p)).filter((p: any) => p.product);
      }
      const rowOpts: ResolveClientDCRowOpts = { hasProductCategories, getProductCategories };
      const usedOrderIdx = new Set<number>();
      const rowsFromDetails: ProductRow[] = dcDetails.map((p: any, idx: number) => {
        const name = p.product || p.productName || p.product_name || '';
        const ord = findMatchingOrderProduct(orderProducts, p, idx, usedOrderIdx);
        const merged = ord
          ? {
              ...p,
              product: name,
              class: p.class ?? ord.class,
              specs: p.specs ?? ord.specs,
              productCategory: p.productCategory ?? ord.productCategory,
              strength: Number(p.strength) || Number(p.quantity) || 0,
              quantity: Number(p.quantity) || Number(p.strength) || 0,
              price: p.price ?? ord.unit_price,
              level: p.level || ord.level,
              term: p.term ?? ord.term,
              subject: p.subject ?? ord.subject,
              selected_subjects: p.selected_subjects ?? ord.selected_subjects,
              lineId: p.lineId || ord.lineId,
            }
          : p;
        const resolved = resolveClientDCRowFields(merged, name, rowOpts);
        const savedLevel = (merged.level && String(merged.level).trim()) || '';
        const level = savedLevel && savedLevel !== '-' ? savedLevel : '-';
        const term = persistProductTerm({ term: merged.term, level: savedLevel || level });
        const lineId = ensureProductLineId(merged, idx);
        const price = Number(merged.price ?? merged.unit_price ?? ord?.unit_price) || 0;
        return {
          id: lineId,
          lineId,
          product_name: name,
          quantity: Number(merged.quantity ?? merged.strength) || 0,
          unit_price: price,
          priceUnlocked:
            !(price > 0) &&
            !(canonicalDcRowCategory(merged.category) === 'Training Material' || isSpecimenRow(merged)),
          class: resolved.class,
          specs: persistEditPoSpecs(name, resolved.specs),
          productCategory: resolved.productCategory,
          category: merged.category,
          strength: Number(merged.strength ?? merged.quantity) || 0,
          subject: merged.subject,
          selected_subjects: Array.isArray(merged.selected_subjects) ? merged.selected_subjects : undefined,
          level,
          term,
          itemType: merged.itemType || undefined,
          subjectPackage: Boolean(merged.subjectPackage ?? ord?.subjectPackage),
          dispatchMode: merged.dispatchMode ?? ord?.dispatchMode,
          section: merged.section || undefined,
          program: merged.program || undefined,
          stream: merged.stream || undefined,
          isNew: false,
        };
      });
      const expanded = expandEditPoRowsBySubject(rowsFromDetails, getProductSubjects);
      setProducts(expanded);

      const originalNames: string[] = Array.from(
        new Set((data.products || []).map((p: any) => normalizeProductName(p.product_name)).filter(Boolean)),
      );
      setOriginalProductNames(originalNames);
      setOriginalPdfUrl(data.pod_proof_url || fullDC?.poPhotoUrl || '');
      setOriginalVariantKeys(
        Array.from(
          new Set([
            ...collectOriginalEditPoVariantKeys(data.products || [], getProductId, getProductCategories),
            ...(pe ? [] : collectOriginalEditPoVariantKeys(expanded, getProductId, getProductCategories)),
          ]),
        ),
      );
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to load order');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Current PO: primary from order; fallback to old PDF when there's a pending/rejected change request
  const currentPdfUrl =
    (order?.pod_proof_url && String(order.pod_proof_url).trim()) ||
    (order?.poDocument && String(order.poDocument).trim()) ||
    (order?.poChangeRequest?.oldPdfUrl && String(order.poChangeRequest.oldPdfUrl).trim()) ||
    '';
  const resolvedPdfUrl = buildPdfUrl(currentPdfUrl || undefined);
  const poChange = order?.poChangeRequest;

  const openPdf = (url: string | null) => {
    if (!url) {
      Alert.alert('No document', 'Current PO PDF is not available.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open document'));
  };

  const pickNewPdfForChange = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        if (file.size && file.size > 5 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 5MB');
          return;
        }
        const formData = new FormData();
        formData.append('poPhoto', { uri: file.uri, type: 'application/pdf', name: file.name || 'po.pdf' } as any);
        const res = await apiService.upload('/dc/upload-po', formData);
        setNewPdfUrl(res.poPhotoUrl || res.url || '');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to upload PDF');
    }
  };

  const submitPoChangeRequest = async () => {
    if (!orderId || !newPdfUrl.trim()) {
      Alert.alert('Required', 'Please upload the new PO PDF first.');
      return;
    }
    setSubmittingChange(true);
    try {
      await apiService.post(`/dc-orders/${orderId}/request-po-change`, {
        pod_proof_url: newPdfUrl.trim(),
        remarks: changeRemarks.trim() || undefined,
      });
      setShowRequestModal(false);
      setNewPdfUrl('');
      setChangeRemarks('');
      await loadOrder();
      Alert.alert('Submitted', 'PO change request sent. Request DC will be enabled after Manager approval.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit request');
    } finally {
      setSubmittingChange(false);
    }
  };

  const isOriginalRow = (row: ProductRow) => isOriginalEditPoLine(row, originalVariantKeys, getProductId);
  const priceLocked = (row: ProductRow) => isFreeEditPoRow(row) || (isOriginalRow(row) && !row.priceUnlocked);

  const updateProduct = (index: number, field: 'quantity' | 'unit_price', value: number | string) => {
    const row = products[index];
    if (field === 'unit_price' && row && priceLocked(row)) return;
    const next = [...products];
    if (field === 'quantity') {
      const n = Number(value) || 0;
      next[index] = { ...next[index], quantity: n, strength: n };
    } else {
      next[index] = { ...next[index], unit_price: value };
    }
    setProducts(next);
  };

  /** Row DC category; Training Material / Shortage are free, switching back restores the price (web). */
  const updateRowCategory = (index: number, value: string) => {
    setProducts((rows) =>
      rows.map((r, i) => {
        if (i !== index) return r;
        const free = !isBillableDcRow({ category: value });
        const paid = r.paidUnitPrice ?? r.unit_price;
        const restored = Number(paid) || 0;
        return {
          ...r,
          category: value,
          unit_price: free ? 0 : restored || '',
          paidUnitPrice: free ? paid : undefined,
          priceUnlocked: !free && !(restored > 0) ? true : r.priceUnlocked,
        };
      }),
    );
  };

  const updateProductField = (
    index: number,
    field: 'productCategory' | 'class' | 'subject' | 'level' | 'specs',
    value: string,
  ) => {
    const next = [...products];
    const candidate: ProductRow = { ...next[index], [field]: value };
    if (field === 'subject') candidate.selected_subjects = value ? [value] : [];
    if (
      (field === 'productCategory' || field === 'subject' || field === 'level' || field === 'specs') &&
      editPORowIdentityPatchIsDuplicate(next, candidate, getCatalogMeta, next[index]?.id)
    ) {
      showAlert('Already exists', EDIT_PO_DUPLICATE_MESSAGE);
      return;
    }
    next[index] = candidate;
    setProducts(next);
  };

  const buildNewProductRow = (name: string, variant: EditPOProductVariant = {}): ProductRow => {
    const catOptions = getEditPOCategoryOptions(name);
    const specOptions = getEditPOSpecOptions(name);
    const subjectOptions = getEditPOSubjectOptions(name);
    const levelOptions = getEditPOLevelOptions(name);
    const level = variant.level ?? levelOptions[0] ?? '-';
    const subject = variant.subject ?? subjectOptions[0];
    const id = `new_${Date.now()}_${name}`;
    return {
      id,
      lineId: id,
      product_name: name,
      quantity: 1,
      unit_price: 0,
      priceUnlocked: true,
      term: persistProductTerm({ level }),
      class: '1',
      category: 'New Students',
      productCategory: variant.productCategory ?? catOptions[0],
      subject,
      selected_subjects: subject ? [subject] : undefined,
      level,
      specs: variant.specs ?? specOptions[0],
      isNew: true,
    };
  };

  const addCatalogProduct = (name: string) => {
    const variant = pickUnusedEditPOVariant(name, getCatalogMeta(name), products, getCatalogMeta);
    if (variant === null) {
      showAlert('Already exists', EDIT_PO_DUPLICATE_MESSAGE);
      return;
    }
    const newRow = buildNewProductRow(name, variant);
    if (findDuplicateEditPORowIndex(products, newRow, getCatalogMeta) >= 0) {
      showAlert('Already exists', EDIT_PO_DUPLICATE_MESSAGE);
      return;
    }
    setProducts((prev) => [...prev, newRow]);
    setShowAddProductModal(false);
  };

  const hasNewProducts = editPoHasNewCommercialLines(products, originalVariantKeys, getProductId);

  const removeProduct = (index: number) => {
    const row = products[index];
    if (!row?.isNew && isOriginalRow(row)) {
      showAlert('Not allowed', 'Original PO products cannot be removed here.');
      return;
    }
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!orderId) return;
    const transport_name = (transport.transport_name || '').trim();
    const transport_location = (transport.transport_location || '').trim();
    const transportation_landmark = (transport.transportation_landmark || '').trim();
    const pincode = (transport.pincode || '').trim();
    if (!transport_name || !transport_location || !transportation_landmark || !pincode) {
      showAlert(
        'Required',
        'All Transport Details fields are mandatory: Transport Name, Transport Location, Transportation Landmark, and Pincode.',
      );
      return;
    }
    const transportToProblem = transportToError(transport);
    if (transportToProblem) {
      showAlert('Required', transportToProblem);
      return;
    }
    // Quantity always; unit price only for billed rows (specimen / Training Material go free).
    const invalid = products.filter((row) => {
      if (!row.product_name?.trim()) return false;
      if (!row.quantity || row.quantity <= 0) return true;
      return !isFreeEditPoRow(row) && (!row.unit_price || Number(row.unit_price) <= 0);
    });
    if (invalid.length > 0) {
      showAlert('Required', 'Please fill in Quantity and Unit Price for all products');
      return;
    }
    const missingSpecs = products.filter((row) => {
      if (!row.product_name?.trim()) return false;
      if (getProductSpecs(row.product_name).length === 0) return false;
      return !persistEditPoSpecs(row.product_name, row.specs);
    });
    if (missingSpecs.length > 0) {
      showAlert('Required', 'Please select Specs for all products that require it');
      return;
    }

    const named = products.filter((row) => row.product_name && row.product_name.trim() !== '');
    const subjectOf = (row: ProductRow) =>
      row.subject && String(row.subject).trim() !== '-' ? String(row.subject).trim() : undefined;
    const subjectsOf = (row: ProductRow) =>
      subjectOf(row) ? String(row.subject).split(',').map((d) => d.trim()).filter(Boolean) : [];
    const seriesOf = (row: ProductRow) =>
      hasProductCategories(row.product_name)
        ? String(row.productCategory || '').trim() || getProductCategories(row.product_name)[0] || undefined
        : undefined;
    const levelOf = (row: ProductRow) => {
      const raw = String(row.level || '').trim();
      return !raw || raw === '-' ? '' : raw;
    };
    const unitPriceOf = (row: ProductRow) => (isFreeEditPoRow(row) ? 0 : Number(row.unit_price) || 0);

    const productsPayload = named.map((row) => {
      const level = levelOf(row);
      const qty = Number(row.quantity) || 0;
      return {
        lineId: ensureProductLineId(row),
        product_name: row.product_name,
        quantity: qty,
        unit_price: unitPriceOf(row),
        total: editPoBill.totals.get(row.id) ?? 0,
        class: row.class && String(row.class).trim() !== '' ? String(row.class).trim() : '1',
        itemType: row.itemType || undefined,
        subjectPackage: Boolean(row.subjectPackage),
        dispatchMode: row.dispatchMode || undefined,
        section: row.section || undefined,
        program: row.program || undefined,
        stream: row.stream || undefined,
        specs: persistEditPoSpecs(row.product_name || row.product || '', row.specs),
        productCategory: seriesOf(row),
        category: row.category || undefined,
        strength: qty,
        term: persistProductTerm({ term: row.term, level }),
        level,
        subject: subjectOf(row),
        selected_subjects: subjectsOf(row),
        closeLeadDestination: 'MY_CLIENT',
      };
    });
    const total_amount = editPoBill.totalAmount;
    const pe = order?.pendingEdit?.status === 'pending' ? order.pendingEdit : null;
    const pick = (key: string) => pe?.[key] ?? order?.[key] ?? '';
    const pod_proof_url = pick('pod_proof_url');
    const payload = {
      school_name: pick('school_name'),
      contact_person: pick('contact_person'),
      contact_mobile: pick('contact_mobile'),
      contact_person2: pick('contact_person2'),
      contact_mobile2: pick('contact_mobile2'),
      email: pick('email'),
      address: pick('address'),
      school_type: pick('school_type'),
      zone: pick('zone'),
      location: pick('location'),
      remarks: pick('remarks'),
      pod_proof_url,
      products: productsPayload,
      total_amount,
      transport_name,
      transport_location,
      transportation_landmark,
      pincode,
      transport_to: transport.transport_to,
      transport_to_name: transport.transport_to_name,
      transport_to_mobile: transport.transport_to_mobile,
      originatingDcId: dcId || undefined,
    };
    const dcProductDetailsPayload = named.map((row) => {
      const level = levelOf(row);
      const qty = Number(row.quantity) || 0;
      return {
        lineId: ensureProductLineId(row),
        product: row.product_name,
        class: row.class && String(row.class).trim() !== '' ? String(row.class).trim() : '1',
        specs: persistEditPoSpecs(row.product_name || row.product || '', row.specs),
        quantity: qty,
        strength: qty,
        level,
        term: persistProductTerm({ term: row.term, level }),
        subject: subjectOf(row),
        selected_subjects: subjectsOf(row),
        category: row.category || undefined,
        productCategory: seriesOf(row),
        price: unitPriceOf(row),
        unit_price: unitPriceOf(row),
        total: editPoBill.totals.get(row.id) ?? 0,
        itemType: row.itemType || undefined,
        subjectPackage: Boolean(row.subjectPackage),
        dispatchMode: row.dispatchMode || undefined,
        section: row.section || undefined,
        program: row.program || undefined,
        stream: row.stream || undefined,
        closeLeadDestination: 'MY_CLIENT',
      };
    });

    const pdfChanged = String(pod_proof_url || '') !== String(originalPdfUrl || '') && !!originalPdfUrl;
    setSaving(true);
    try {
      if (pdfChanged || hasNewProducts) {
        // New commercial lines need Executive Manager approval (PO Edit Request).
        await apiService.post(`/dc-orders/${orderId}/submit-edit`, payload);
      } else {
        await apiService.put(`/dc-orders/${orderId}`, payload);
      }
      if (dcId) {
        await apiService.put(`/dc/${dcId}`, {
          productDetails: dcProductDetailsPayload,
          requestedQuantity: dcProductDetailsPayload.reduce((s, p) => s + (Number(p.quantity) || 0), 0),
        });
      }
      showAlert(
        pdfChanged || hasNewProducts
          ? 'PO edit request submitted! Zonal Manager will review and approve.'
          : 'PO updated successfully!',
      );
      if (!navigateRoot('DCClient')) {
        navigation.navigate('DCClient');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to update PO');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !order) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!order) return null;

  // IN DC Flow = DC already requested (status !== 'saved'). PO change not allowed; show message only.
  const isInDcFlow = order.status != null && order.status !== 'saved';
  if (isInDcFlow) {
    return (
    <ScreenShell
      title="Edit PO"
      loading={loading}
    >
<View style={styles.dcFlowBlock}>
          <Text style={styles.dcFlowBlockMessage}>
            PO can only be changed before requesting DC. This client is already in the DC process.
          </Text>
          <TouchableOpacity style={styles.dcFlowBlockButton} onPress={() => navigation.goBack()}>
            <Text style={styles.dcFlowBlockButtonText}>Back to My Clients</Text>
          </TouchableOpacity>
        </View>
    </ScreenShell>
  );
  }

  // Billed total, same rules as Close Lead (packages, divisors, free rows ₹0).
  const grandTotal = editPoBill.totalAmount;

  return (
    <ScreenShell title={`Edit PO - ${order.school_name || 'Client'}`}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >

        {/* Current PO PDF card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current PO PDF</Text>
          {(currentPdfUrl && resolvedPdfUrl) ? (
            <View style={styles.poCard}>
              <Text style={styles.poCardLabel}>PO document attached</Text>
              <View style={styles.poCardActions}>
                <TouchableOpacity style={styles.poCardButton} onPress={() => openPdf(resolvedPdfUrl)}>
                  <Text style={styles.poCardButtonText}>View / Download</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.poCardButton} onPress={() => setPreviewPdfUrl(resolvedPdfUrl)}>
                  <Text style={styles.poCardButtonText}>Preview in app</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.hint}>No PO PDF uploaded yet.</Text>
          )}
        </View>

        {/* PO Change request status */}
        {poChange && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PO Change Request</Text>
            <View style={[styles.badge, poChange.status === 'PENDING_MANAGER_APPROVAL' && styles.badgePending, poChange.status === 'APPROVED' && styles.badgeSuccess, poChange.status === 'REJECTED' && styles.badgeRejected]}>
              <Text style={styles.badgeText}>
                {poChange.status === 'PENDING_MANAGER_APPROVAL' && 'Pending Manager Approval'}
                {poChange.status === 'APPROVED' && 'Approved'}
                {poChange.status === 'REJECTED' && 'Rejected'}
              </Text>
            </View>
            {poChange.requestedAt && (
              <Text style={styles.metaText}>Requested at {new Date(poChange.requestedAt).toLocaleString()}</Text>
            )}
            {(poChange.status === 'APPROVED' || poChange.status === 'REJECTED') && (poChange.managerRemarks || poChange.rejectionReason) && (
              <View style={styles.managerRemarksBox}>
                <Text style={styles.managerRemarksLabel}>Manager remarks</Text>
                <Text style={styles.managerRemarksText}>{poChange.managerRemarks || poChange.rejectionReason}</Text>
              </View>
            )}
          </View>
        )}

        {/* Request PO Change button - only when no pending request */}
        {(!poChange || poChange.status !== 'PENDING_MANAGER_APPROVAL') && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.requestChangeButton} onPress={() => setShowRequestModal(true)}>
              <Text style={styles.requestChangeButtonText}>Request PO Change</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Upload a new PDF and add optional remarks. Manager approval required before you can Request DC.</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transport Details</Text>
          <Text style={styles.hint}>All fields are mandatory before you can Request DC.</Text>
          <TransportNameField
            inputStyle={styles.fieldInput}
            value={transport.transport_name}
            onChange={(t) => setTransport((tr) => ({ ...tr, transport_name: t }))}
          />
          <TransportToFields
            inputStyle={styles.fieldInput}
            value={transport}
            onChange={(next) => setTransport((tr) => ({ ...tr, ...next }))}
            bde={{ name: (authUser as any)?.name, mobile: (authUser as any)?.mobile || (authUser as any)?.phone }}
            school={{ name: order?.school_name, mobile: order?.contact_mobile }}
          />
          <Text style={styles.label}>Transport Location *</Text>
          <WebInput
            style={styles.fieldInput}
            value={transport.transport_location}
            onChangeText={(t) => setTransport((tr) => ({ ...tr, transport_location: t }))}
            placeholder="Transport location"
          />
          <Text style={styles.label}>Transportation Landmark *</Text>
          <WebInput
            style={styles.fieldInput}
            value={transport.transportation_landmark}
            onChangeText={(t) => setTransport((tr) => ({ ...tr, transportation_landmark: t }))}
            placeholder="Landmark"
          />
          <Text style={styles.label}>Pincode *</Text>
          <WebInput
            style={styles.fieldInput}
            value={transport.pincode}
            onChangeText={(t) => setTransport((tr) => ({ ...tr, pincode: t }))}
            placeholder="Pincode"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.productsHeaderRow}>
            <Text style={styles.sectionTitle}>Products Interested</Text>
            <TouchableOpacity
              style={styles.addProductBtn}
              onPress={() => setShowAddProductModal(true)}
            >
              <Text style={styles.addProductBtnText}>+ Add Product</Text>
            </TouchableOpacity>
          </View>
          {hasNewProducts ? (
            <Text style={styles.hint}>
              New products require Executive Manager approval (PO Edit Request) when you save.
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled">
            <View style={{ width: EDIT_PO_TABLE_WIDTH }}>
              <View style={[styles.tableHeader, { width: EDIT_PO_TABLE_WIDTH }]}>
                {EDIT_PO_TABLE_COLUMNS.map((col) => (
                  <EditPOTableCell key={col.id} width={col.width} align={col.align}>
                    <Text style={styles.th} numberOfLines={1}>
                      {col.label}
                    </Text>
                  </EditPOTableCell>
                ))}
              </View>
              {products.map((p, idx) => {
                const catOptions = getEditPOCategoryOptions(p.product_name);
                const subjectOptions = getEditPOSubjectOptions(p.product_name);
                const levelOptions = getEditPOLevelOptions(p.product_name);
                const specOptions = getEditPOSpecOptions(p.product_name);
                const locked = priceLocked(p);
                const free = isFreeEditPoRow(p);
                const lineTotal = editPoBill.totals.get(p.id) ?? 0;
                const marker = isSpecimenRow(p) || isRelatedItemRow(p);
                const canRemove = !!p.isNew || !isOriginalRow(p);

                const renderMetaCell = (
                  width: number,
                  options: string[],
                  value: string | undefined,
                  onChange: (v: string) => void,
                ) => (
                  <EditPOTableCell width={width}>
                    {options.length > 0 && !marker ? (
                      <WebSelect
                        compact
                        value={value || options[0]}
                        onValueChange={onChange}
                        items={(value && !options.includes(value) ? [value, ...options] : options).map((o) => ({
                          label: o,
                          value: o,
                        }))}
                      />
                    ) : (
                      <Text style={styles.emptyMeta}>{value && value !== '-' ? value : '-'}</Text>
                    )}
                  </EditPOTableCell>
                );

                return (
                  <View key={p.id} style={[styles.productRowWide, { width: EDIT_PO_TABLE_WIDTH }]}>
                    <EditPOTableCell width={COL.product}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {p.product_name}
                      </Text>
                      {isSpecimenRow(p) ? <Text style={styles.freeTag}>Specimen copy · no billing</Text> : null}
                      {isRelatedItemRow(p) ? (
                        <Text style={styles.relatedTag}>Related item{free ? ' · no billing' : ''}</Text>
                      ) : null}
                      {!marker && free ? <Text style={styles.freeTag}>Training Material · no billing</Text> : null}
                      {p.section || p.program || p.stream ? (
                        <Text style={styles.emptyMeta}>
                          {[p.section && p.section !== 'ALL' ? `Sec ${p.section}` : 'Whole class', p.program, p.stream]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      ) : null}
                      {canRemove ? <Text style={styles.newBadge}>New</Text> : null}
                    </EditPOTableCell>
                    <EditPOTableCell width={COL.dcCategory}>
                      {marker ? (
                        <Text style={styles.emptyMeta}>Training Material</Text>
                      ) : (
                        <DcCategoryPicker value={p.category} onChange={(v) => updateRowCategory(idx, v)} />
                      )}
                    </EditPOTableCell>
                    {renderMetaCell(COL.category, catOptions, p.productCategory, (v) =>
                      updateProductField(idx, 'productCategory', v),
                    )}
                    <EditPOTableCell width={COL.class}>
                      {!marker && (p.isNew || p.class) ? (
                        <WebSelect
                          compact
                          value={p.class || CLASS_OPTIONS[0]}
                          onValueChange={(v) => updateProductField(idx, 'class', v)}
                          items={(p.class && !CLASS_OPTIONS.includes(p.class) ? [p.class, ...CLASS_OPTIONS] : CLASS_OPTIONS).map(
                            (c) => ({ label: c, value: c }),
                          )}
                        />
                      ) : (
                        <Text style={styles.emptyMeta}>{p.class || '-'}</Text>
                      )}
                    </EditPOTableCell>
                    {renderMetaCell(COL.subject, subjectOptions, p.subject, (v) => updateProductField(idx, 'subject', v))}
                    {renderMetaCell(COL.level, levelOptions, p.level, (v) => updateProductField(idx, 'level', v))}
                    {renderMetaCell(COL.specs, specOptions, p.specs, (v) => updateProductField(idx, 'specs', v))}
                    <EditPOTableCell width={COL.qty} align="center">
                      <WebInput
                        style={[styles.tableInput, styles.qtyInput]}
                        value={String(p.quantity)}
                        onChangeText={(t) => {
                          const n = t.replace(/[^\d]/g, '');
                          updateProduct(idx, 'quantity', n === '' ? 0 : parseInt(n, 10));
                        }}
                        keyboardType="number-pad"
                        placeholder="Qty"
                        editable
                        selectTextOnFocus
                      />
                    </EditPOTableCell>
                    <EditPOTableCell width={COL.price} align="right">
                      {!locked ? (
                        <WebInput
                          style={styles.tableInput}
                          value={String(p.unit_price ?? '')}
                          onChangeText={(t) => updateProduct(idx, 'unit_price', t.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                          placeholder="Price"
                        />
                      ) : (
                        <Text style={styles.tablePriceLocked}>{(free ? 0 : Number(p.unit_price) || 0).toFixed(2)}</Text>
                      )}
                    </EditPOTableCell>
                    <EditPOTableCell width={COL.total} align="right">
                      <Text style={styles.lineTotal}>{lineTotal.toFixed(2)}</Text>
                    </EditPOTableCell>
                    <EditPOTableCell width={COL.action} align="center">
                      {canRemove ? (
                        <TouchableOpacity style={styles.removeBtn} onPress={() => removeProduct(idx)}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.removeBtnPlaceholder} />
                      )}
                    </EditPOTableCell>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <Text style={styles.grandTotal}>Grand Total: ₹{grandTotal.toFixed(2)}</Text>
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.textLight} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Request PO Change modal */}
      <Modal visible={showRequestModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request PO Change</Text>
              <TouchableOpacity onPress={() => { setShowRequestModal(false); setNewPdfUrl(''); setChangeRemarks(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.hint}>Upload the new PO PDF. Manager must approve before the change is applied and you can Request DC.</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={pickNewPdfForChange}>
                <Text style={styles.uploadButtonText}>{newPdfUrl ? 'New PDF selected' : 'Choose new PDF'}</Text>
              </TouchableOpacity>
              <Text style={styles.label}>Remarks (optional)</Text>
              <WebInput
                style={styles.remarksInput}
                value={changeRemarks}
                onChangeText={setChangeRemarks}
                placeholder="Reason for change"
                multiline
                numberOfLines={3}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setShowRequestModal(false)}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonSubmit, submittingChange && styles.buttonDisabled]} onPress={submitPoChangeRequest} disabled={submittingChange}>
                {submittingChange ? <ActivityIndicator size="small" color={colors.textLight} /> : <Text style={styles.modalButtonTextSubmit}>Submit request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Product modal — catalog products not already on the original PO */}
      <Modal visible={showAddProductModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity onPress={() => setShowAddProductModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.hint}>
                Select a product from the catalog. Products not on the original PO need manager
                approval when you save.
              </Text>
              {catalogProducts.length === 0 ? (
                <Text style={styles.hint}>No products available in the catalog.</Text>
              ) : (
                catalogProducts.map((name) => {
                  const isOriginal = originalProductNames.includes(normalizeProductName(name));
                  const nextVariant = pickUnusedEditPOVariant(
                    name,
                    getCatalogMeta(name),
                    products,
                    getCatalogMeta,
                  );
                  const nextHint = nextVariant ? formatEditPOVariantHint(nextVariant) : '';
                  const alreadyInList = products.some(
                    (p) => normalizeProductName(p.product_name) === normalizeProductName(name),
                  );
                  const canAdd = canAddAnotherEditPOVariant(
                    name,
                    getCatalogMeta(name),
                    products,
                    getCatalogMeta,
                  );
                  return (
                    <View key={name} style={styles.catalogRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catalogName}>{name}</Text>
                        {isOriginal ? (
                          <Text style={styles.catalogMeta}>On original PO</Text>
                        ) : (
                          <Text style={styles.catalogMetaNew}>New — needs approval</Text>
                        )}
                        {alreadyInList && nextHint ? (
                          <Text style={styles.catalogMetaNext}>Next: {nextHint}</Text>
                        ) : null}
                        {alreadyInList && !canAdd ? (
                          <Text style={styles.catalogMetaWarn}>All variants already added</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={[styles.catalogAddBtn, !canAdd && styles.catalogAddBtnDisabled]}
                        onPress={() => addCatalogProduct(name)}
                        disabled={!canAdd}
                      >
                        <Text style={styles.catalogAddBtnText}>
                          {alreadyInList ? 'Add variant' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowAddProductModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PDF Preview modal */}
      <Modal visible={!!previewPdfUrl} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PO Preview</Text>
              <TouchableOpacity onPress={() => setPreviewPdfUrl(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {previewPdfUrl && WebView ? (
              <WebView source={{ uri: previewPdfUrl }} style={styles.webview} />
            ) : previewPdfUrl ? (
              <TouchableOpacity style={styles.poCardButton} onPress={() => openPdf(previewPdfUrl)}>
                <Text style={styles.poCardButtonText}>Open in browser</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  dcFlowBlock: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  dcFlowBlockMessage: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  dcFlowBlockButton: { paddingVertical: 14, paddingHorizontal: 24, backgroundColor: colors.primary, borderRadius: 12 },
  dcFlowBlockButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h3, color: colors.textLight, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.backgroundLight,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editPoTableCell: {
    paddingHorizontal: 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editPoTableCellCenter: { alignItems: 'center' },
  editPoTableCellRight: { alignItems: 'flex-end' },
  th: { ...typography.label.small, fontWeight: '600', color: colors.textSecondary, fontSize: 11 },
  tableInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: colors.backgroundLight,
  },
  tablePriceLocked: {
    width: '100%',
    textAlign: 'right',
    fontSize: 12,
    color: colors.textSecondary,
    paddingVertical: 8,
  },
  colName: { flex: 1 },
  colQty: { width: 56 },
  colPrice: { width: 72 },
  colTotal: { width: 64, textAlign: 'right' },
  lineTotal: { fontSize: 12, fontWeight: '600', textAlign: 'right', color: colors.textPrimary },
  grandTotal: { ...typography.heading.h4, color: colors.primary, marginTop: 12, fontWeight: '700' },
  footerRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 12 },
  productsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addProductBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  addProductBtnText: { ...typography.body.small, color: colors.textLight, fontWeight: '700' },
  productNameCol: { flex: 1, marginRight: 4 },
  freeTag: { fontSize: 11, color: '#B45309', marginTop: 2 },
  relatedTag: { fontSize: 11, color: '#1D4ED8', marginTop: 2 },
  newBadge: {
    ...typography.label.small,
    color: colors.warning,
    fontWeight: '700',
    marginTop: 2,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnPlaceholder: { width: 28 },
  removeBtnText: { color: colors.error, fontSize: 16, fontWeight: '700' },
  colAction: { width: 28 },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  catalogName: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  catalogMeta: { ...typography.body.small, color: colors.textSecondary, marginTop: 2 },
  catalogMetaNew: { ...typography.body.small, color: colors.warning, marginTop: 2, fontWeight: '600' },
  catalogMetaNext: { ...typography.body.small, color: colors.success, marginTop: 2 },
  catalogMetaWarn: { ...typography.body.small, color: colors.warning, marginTop: 2 },
  catalogAddBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  catalogAddBtnText: { ...typography.body.small, color: colors.primary, fontWeight: '700' },
  catalogAddBtnDisabled: { opacity: 0.45 },
  poCard: { backgroundColor: colors.backgroundDark, borderRadius: 12, padding: 16, marginBottom: 8 },
  poCardLabel: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 12 },
  poCardActions: { flexDirection: 'row', gap: 12 },
  poCardButton: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.primary, borderRadius: 8 },
  poCardButtonText: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  badgePending: { backgroundColor: colors.warning + '25' },
  badgeSuccess: { backgroundColor: colors.success + '25' },
  badgeRejected: { backgroundColor: colors.error + '25' },
  badgeText: { ...typography.body.small, fontWeight: '600', color: colors.textPrimary },
  metaText: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  rejectionText: { ...typography.body.small, color: colors.error, marginTop: 4 },
  managerRemarksBox: { marginTop: 12, backgroundColor: colors.backgroundDark, padding: 12, borderRadius: 10 },
  managerRemarksLabel: { ...typography.label.small, color: colors.textSecondary, marginBottom: 6 },
  managerRemarksText: { ...typography.body.medium, color: colors.textPrimary },
  requestChangeButton: { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: colors.primary, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 8 },
  requestChangeButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  productRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  colNameWide: { width: 88 },
  colMeta: { width: 76 },
  metaCell: { ...typography.body.small, color: colors.textSecondary, fontSize: 11 },
  emptyMeta: { fontSize: 12, color: colors.textMuted, textAlign: 'center', width: '100%' },
  qtyInput: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
  },
  priceLocked: {
    backgroundColor: colors.background,
    textAlign: 'right',
    paddingVertical: 10,
    color: colors.textSecondary,
  },
  inputReadOnly: { backgroundColor: colors.background, opacity: 0.85 },
  productName: { ...typography.body.medium, color: colors.textPrimary, fontSize: 13 },
  uploadButton: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.backgroundDark, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 12 },
  uploadButtonText: { ...typography.body.medium, color: colors.primary, fontWeight: '600' },
  label: { ...typography.label.small, color: colors.textSecondary, marginBottom: 4 },
  remarksInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, ...typography.body.medium, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  saveButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  saveButtonText: { ...typography.heading.h4, color: colors.textLight, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.heading.h2, color: colors.textPrimary },
  modalClose: { fontSize: 24, color: colors.textSecondary },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20 },
  modalButtonCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  modalButtonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  modalButtonSubmit: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  modalButtonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  previewModalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, flex: 1, maxHeight: '90%' },
  webview: { flex: 1, minHeight: 400 },
});

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import { isTransportComplete, TRANSPORT_REQUIRED_MESSAGE } from '../../utils/dcTransport';
import { showAlert, showConfirm } from '../../utils/showAlert';
import { navigateRoot } from '../../navigation/navigationRef';
import SchoolOverview, { OverviewSection } from '../../components/SchoolOverview';
import SchoolLocation from '../../components/SchoolLocation';

/** School modules on each client card (same as the web's school info). */
const MODULES: { key: OverviewSection; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'deals', label: 'POs' },
  { key: 'dcs', label: 'Material/Kits' },
  { key: 'payments', label: 'Payments' },
  { key: 'returns', label: 'Returns' },
  { key: 'trainings', label: 'Trainings' },
  { key: 'visits', label: 'Visits' },
];
import { useFieldDay } from '../../components/SchoolVisitActions';
import SchoolHub, { ORDER_STEPS, orderStepOf } from '../../components/SchoolHub';

/** Academic years run April to March, e.g. 2026-27. */
const academicYearFor = (date: string | Date = new Date()) => {
  const d = new Date(new Date(date).getTime() + 330 * 60000);
  const start = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};
const yearStart = (y: string) => Number(String(y).slice(0, 4)) || 0;
const yearFrom = (start: number) => `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
import { resolveMyClientsDcStatus } from '../../utils/myClientsDcStatus';

/** A DC completed at the warehouse moves from My Orders to My Clients. */
const isCompletedDc = (dc: any) =>
  String(dc?.status || '').toLowerCase() === 'completed' || ['delivery_confirmation', 'billing'].includes(dc?.workflow?.stage);

export default function DCClientScreen({ navigation, route }: any) {
  // Bottom sheets stay above the phone's navigation bar.
  const sheetBottom = useSafeAreaInsets().bottom;
  /** orders = My Orders (PO uploaded, DC on its way); clients = My Clients (DC completed). */
  const view: 'orders' | 'clients' = route?.params?.view === 'orders' ? 'orders' : 'clients';
  const { user } = useAuth();
  const fieldDay = useFieldDay();
  const [dcs, setDcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDC, setSelectedDC] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{
    schoolName: string;
    lines: { product: string; term: string; qty: number; unitPrice: number; total: number }[];
    grandTotal: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load on mount and whenever screen comes into focus (e.g. after closing a lead so new client appears)
  useFocusEffect(
    useCallback(() => {
      loadDCs();
    }, [])
  );

  const loadDCs = async () => {
    try {
      setLoading(true);
      // My Clients checks every client's DCs on the server, so it can take longer than other lists.
      const data = await apiService.get('/dc/employee/my', { timeout: 45000 });
      const dataArray = Array.isArray(data) ? data : [];
      setDcs(dataArray);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load clients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDCs();
  };

  const openDCModal = (dc: any) => {
    setSelectedDC(dc);
    setShowModal(true);
  };

  const [openId, setOpenId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<OverviewSection>('details');
  /** The school whose page (all modules) is open. */
  const [hubDc, setHubDc] = useState<any>(null);

  const orderOf = (dc: any) => (dc?.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : {});
  const schoolName = (dc: any) => dc.customerName || orderOf(dc).school_name || 'Unknown school';
  /** Address line: street address, area / town, pincode. */
  const placeText = (dc: any) => {
    const o = orderOf(dc);
    const parts = [o.address || dc.customerAddress, o.area, o.location, o.city, o.pincode].map((v: any) => String(v || '').trim()).filter(Boolean);
    return Array.from(new Set(parts)).join(', ');
  };
  /** Everything a user may search a school by. */
  const searchText = (dc: any) => {
    const o = orderOf(dc);
    return [
      schoolName(dc), o.school_code, o.dc_code, o.contact_person, o.contact_mobile, o.contact_mobile2, dc.customerPhone,
      o.email, o.address, dc.customerAddress, o.area, o.location, o.city, o.pincode, o.zone, o.cluster, o.school_type,
      dealYear(dc), getProductsText(dc), formatDcStatusLabel(getDcStatus(dc)),
    ]
      .map((v: any) => String(v || '').toLowerCase())
      .join(' | ');
  };
  const [addingYear, setAddingYear] = useState<string | null>(null);

  /** The deal's academic year: saved year, else when it was created. */
  const dealYear = (dc: any) => {
    const o = typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null;
    const saved = String(o?.year || '').trim();
    if (/^\d{4}-\d{2}$/.test(saved)) return saved;
    return academicYearFor(o?.createdAt || dc.createdAt || new Date());
  };

  // New academic year for this school: a new PO row; earlier years' POs stay as they are.
  const addNextYearPo = (dc: any) => {
    const orderId = getOrderId(dc);
    if (!orderId) return;
    const year = yearFrom(Math.max(yearStart(dealYear(dc)) + 1, yearStart(academicYearFor())));
    const name = dc.customerName || dc.dcOrderId?.school_name || 'this school';
    Alert.alert('New Year PO', `Add a PO for ${year} for ${name}? The ${dealYear(dc)} PO stays as it is.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Add ${year}`,
        onPress: async () => {
          setAddingYear(dc._id);
          try {
            const res: any = await apiService.post(`/dc-orders/${orderId}/next-year`, { academicYear: year });
            const created = res?.data ?? res;
            await loadDCs();
            Alert.alert(
              created?.existing ? 'Already added' : 'Added',
              `${year} row is ready. Upload the PO for ${year}, then Request DC.`,
              [{ text: 'Upload PO', onPress: () => navigation.navigate('ClientEditPO', { orderId: created.orderId, dcId: created.dcId || undefined }) }]
            );
          } catch (e: any) {
            Alert.alert('Could not add', e?.response?.data?.message || e?.message || 'Try again.');
          } finally {
            setAddingYear(null);
          }
        },
      },
    ]);
  };

  const getOrderId = (dc: any) => {
    if (dc._isConvertedLead && dc._id) return dc._id;
    const o = dc.dcOrderId;
    if (!o) return null;
    return typeof o === 'object' && o._id ? o._id : o;
  };

  const orderHasTerm2Products = (dc: any) => {
    const products =
      (typeof dc.dcOrderId === 'object' && Array.isArray(dc.dcOrderId?.products)
        ? dc.dcOrderId.products
        : null) ||
      (Array.isArray(dc.productDetails) ? dc.productDetails : []) ||
      [];
    return products.some((p: any) => {
      const term = String(p?.term || '').trim();
      if (term === 'Term 2') return true;
      const level = String(p?.level || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
      return level === 'level2' || level === 'l2' || level.startsWith('level2');
    });
  };

  const isPendingPoEdit = (dc: any) => {
    const pe = typeof dc.dcOrderId === 'object' ? dc.dcOrderId?.pendingEdit : null;
    return !!(pe && pe.status === 'pending');
  };

  const getOrderStatus = (dc: any) => {
    if (typeof dc.dcOrderId === 'object' && dc.dcOrderId?.status) return dc.dcOrderId.status;
    return null;
  };

  const getDcStatus = (dc: any) => resolveMyClientsDcStatus(dc);

  const isDcRequested = (dc: any) => {
    const resolved = getDcStatus(dc);
    const orderStatus = getOrderStatus(dc);
    return resolved === 'dc_requested' || orderStatus === 'dc_requested';
  };

  const canRequestDC = (dc: any) => {
    if (isDcRequested(dc)) return false;
    const orderStatus = getOrderStatus(dc);
    const poChange = dc.dcOrderId?.poChangeRequest;
    if (isPendingPoEdit(dc)) return false;
    if (poChange && poChange.status === 'PENDING_MANAGER_APPROVAL') return false;
    if (orderStatus === 'dc_accepted' || orderStatus === 'dc_approved' || orderStatus === 'dc_sent_to_senior') {
      return false;
    }
    return true;
  };

  const isPoChangePending = (dc: any) => {
    const poChange = dc.dcOrderId?.poChangeRequest;
    return !!(poChange && poChange.status === 'PENDING_MANAGER_APPROVAL');
  };

  /** Web: Edit PO + Request DC when created / po_submitted / sent_to_manager (pending EM) */
  const showEditAndRequest = (dc: any) => {
    const dcStatus = getDcStatus(dc);
    const orderStatus = getOrderStatus(dc);
    if (isDcRequested(dc)) return true;
    if (orderStatus === 'saved' || !orderStatus) return true;
    if (orderStatus === 'dc_requested' && orderHasTerm2Products(dc)) return true;
    return dcStatus === 'created' || dcStatus === 'po_submitted' || dcStatus === 'sent_to_manager';
  };

  const formatDcStatusLabel = (status: string) => {
    const key = (status || 'created').toLowerCase();
    if (key === 'sent_to_manager') return 'Sent to manager';
    if (key === 'po_submitted') return 'PO submitted';
    if (key === 'dc_requested') return 'Awaiting Closed Sales';
    if (key === 'created') return 'Created';
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  };

  const getSchoolCode = (dc: any) => {
    if (typeof dc.dcOrderId === 'object') {
      return dc.dcOrderId?.school_code || dc.dcOrderId?.dc_code || '-';
    }
    return '-';
  };

  const getPhone = (dc: any) =>
    dc.customerPhone ||
    (typeof dc.dcOrderId === 'object' ? dc.dcOrderId?.contact_mobile : '') ||
    '-';

  const getProductsText = (dc: any) => {
    if (Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
      const names = dc.productDetails
        .map((p: any) => (p?.product || p?.productName || '').toString().trim())
        .filter(Boolean);
      if (names.length) return [...new Set(names)].join(', ');
    }
    if (typeof dc.dcOrderId === 'object' && Array.isArray(dc.dcOrderId?.products)) {
      const names = dc.dcOrderId.products
        .map((p: any) => (p.product_name || p.product || '').toString().trim())
        .filter(Boolean);
      if (names.length) return [...new Set(names)].join(', ');
    }
    return dc.product || dc.dcOrderId?.products?.[0]?.product_name || 'N/A';
  };

  const openInvoiceView = async (dc: any) => {
    setInvoiceLoading(true);
    setShowInvoiceModal(true);
    setInvoiceData(null);
    try {
      const fullDC = await apiService.get(`/dc/${dc._id}`);
      let dcOrder: any = null;
      const orderId = getOrderId(dc);
      if (orderId) {
        try {
          dcOrder = await apiService.get(`/dc-orders/${orderId}`);
        } catch {
          dcOrder = null;
        }
      }
      const lines: { product: string; term: string; qty: number; unitPrice: number; total: number }[] = [];
      const details = fullDC.productDetails || [];
      if (Array.isArray(details) && details.length > 0) {
        details.forEach((pd: any, index: number) => {
          const match = dcOrder?.products?.[index] || {};
          const qty = Number(pd.quantity ?? pd.strength ?? match.quantity ?? 0);
          const unitPrice = Number(match.unit_price ?? pd.unit_price ?? pd.price ?? 0);
          lines.push({
            product: pd.product || pd.productName || match.product_name || '-',
            term: pd.term || match.term || 'Term 1',
            qty,
            unitPrice,
            total: qty * unitPrice,
          });
        });
      } else if (dcOrder?.products?.length) {
        dcOrder.products.forEach((p: any) => {
          const qty = Number(p.quantity) || 0;
          const unitPrice = Number(p.unit_price) || 0;
          lines.push({
            product: p.product_name || p.product || '-',
            term: p.term || 'Term 1',
            qty,
            unitPrice,
            total: qty * unitPrice,
          });
        });
      }
      const grandTotal = lines.reduce((s, l) => s + l.total, 0);
      setInvoiceData({
        schoolName: dcOrder?.school_name || dc.customerName || 'Client',
        lines,
        grandTotal: dcOrder?.total_amount ?? grandTotal,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load invoice');
      setShowInvoiceModal(false);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const handleRequestDC = async (dc: any) => {
    const orderId = getOrderId(dc);
    if (!orderId) {
      showAlert('Error', 'This client has no order id.');
      return;
    }
    if (!canRequestDC(dc)) {
      showAlert(
        'Request DC locked',
        isPoChangePending(dc)
          ? 'Waiting for manager approval on PO change.'
          : 'Request DC is not available for this client right now.',
      );
      return;
    }

    try {
      // Always fetch latest order — list payload often lacks transport fields
      const order = await apiService.get(`/dc-orders/${orderId}`);
      if (!isTransportComplete(order)) {
        showConfirm(
          'Transport required',
          TRANSPORT_REQUIRED_MESSAGE,
          () => {
            if (!navigateRoot('ClientEditPO', { orderId })) {
              navigation.navigate('ClientEditPO', { orderId });
            }
          },
          'Open Edit PO',
        );
        return;
      }
      if (!navigateRoot('DCRequestSummary', { orderId, client: dc, dcId: dc._isConvertedLead ? undefined : dc._id })) {
        navigation.navigate('DCRequestSummary', {
          orderId,
          client: dc,
          dcId: dc._isConvertedLead ? undefined : dc._id,
        });
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to check transport details');
    }
  };

  const filteredDCs = dcs
    .filter((dc) => (view === 'orders' ? !isCompletedDc(dc) : isCompletedDc(dc)))
    .filter((dc) => {
      const words = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) return true;
      const text = searchText(dc);
      return words.every((w) => text.includes(w));
    })
    .slice()
    .sort((a, b) => {
      const turnedMs = (dc: any) => {
        const order =
          dc?.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null;
        const primary =
          order?.createdAt || dc?.createdAt || order?.updatedAt || dc?.updatedAt;
        if (!primary) return 0;
        const t = new Date(primary).getTime();
        return Number.isFinite(t) ? t : 0;
      };
      return turnedMs(b) - turnedMs(a);
    });

  return (
    <ScreenShell
      title={view === 'orders' ? 'My Orders' : 'My Clients'}
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<View style={styles.searchContainer}>
        <WebInput
          style={styles.searchInput}
          placeholder="Search name, code, area, town, mobile, product…"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {filteredDCs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>{view === 'orders' ? 'No Orders' : 'No Clients'}</Text>
            <Text style={styles.emptySubtitle}>
              {view === 'orders'
                ? 'Closed leads with an uploaded PO appear here. Raise the DC when ready.'
                : 'Schools move here once their DC is completed at the warehouse.'}
            </Text>
          </View>
        ) : (
          filteredDCs.map((dc) => {
            const orderId = getOrderId(dc);
            const dcStatus = getDcStatus(dc);
            const statusLabel =
              view === 'orders' ? ORDER_STEPS[orderStepOf(dc.workflow?.stage)] : dc.workflow?.label || formatDcStatusLabel(dcStatus);
            const createdDate = formatDate(dc.createdAt);
            const turnedDate =
              typeof dc.dcOrderId === 'object' && dc.dcOrderId?.createdAt
                ? formatDate(dc.dcOrderId.createdAt)
                : createdDate;
            const canEditRequest = showEditAndRequest(dc);

            return (
              <TouchableOpacity key={dc._id} style={styles.card} activeOpacity={0.85} onPress={() => setHubDc(dc)}>
                <View style={styles.cardTop}>
                  <Text style={styles.customerName} numberOfLines={2}>{schoolName(dc)}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{statusLabel}</Text>
                  </View>
                </View>
                {dc.workflow?.nextAction || dc.workflow?.nextActorRole ? (
                  <View style={styles.nextBox}>
                    <Text style={styles.nextRole}>Next: {dc.workflow?.nextActorRole || 'BDE'}</Text>
                    {dc.workflow?.nextAction ? <Text style={styles.nextAction}>{dc.workflow.nextAction}</Text> : null}
                  </View>
                ) : null}

                <View style={styles.kv}>
                  <Text style={styles.k}>School code</Text>
                  <Text style={[styles.v, styles.code]}>{getSchoolCode(dc)}</Text>
                </View>
                <SchoolLocation schoolCode={orderOf(dc).school_code} schoolName={schoolName(dc)} />
                <View style={styles.kv}>
                  <Text style={styles.k}>Year</Text>
                  <Text style={styles.v}>{dealYear(dc)}</Text>
                </View>
                {getPhone(dc) && getPhone(dc) !== '-' ? (
                  <View style={styles.kv}>
                    <Text style={styles.k}>Mobile</Text>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${getPhone(dc)}`)}>
                      <Text style={[styles.v, styles.phone]}>{getPhone(dc)}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {placeText(dc) ? (
                  <View style={styles.kv}>
                    <Text style={styles.k}>Address</Text>
                    <Text style={styles.v}>{placeText(dc)}</Text>
                  </View>
                ) : null}
                <View style={styles.kv}>
                  <Text style={styles.k}>Products</Text>
                  <Text style={styles.v}>{getProductsText(dc)}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.k}>Client since</Text>
                  <Text style={styles.v}>{turnedDate}</Text>
                </View>
                {dc.poSubmittedAt ? (
                  <View style={styles.kv}>
                    <Text style={styles.k}>PO closure date</Text>
                    <Text style={styles.v}>{formatDate(dc.poSubmittedAt)}</Text>
                  </View>
                ) : null}
                {dc.poPhotoUrl ? (
                  <TouchableOpacity onPress={() => openDCModal(dc)}>
                    <Text style={styles.viewPoLink}>View PO document</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.openRow}>
                  <Text style={styles.openText}>Open school · DC, returns, payments, visits, training</Text>
                  <Text style={styles.openArrow}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {hubDc ? (() => {
        const dc = hubDc;
        const orderId = getOrderId(dc);
        const canEditRequest = showEditAndRequest(dc);
        const editPO = orderId
          ? () => navigation.navigate('ClientEditPO', { orderId, dcId: dc._isConvertedLead ? undefined : dc._id })
          : undefined;
        return (
          <SchoolHub
            visible
            onClose={() => setHubDc(null)}
            id={orderId || dc._id}
            orderId={orderId || undefined}
            dcId={dc._isConvertedLead ? undefined : dc._id}
            schoolName={schoolName(dc)}
            schoolCode={getSchoolCode(dc)}
            year={dealYear(dc)}
            mode={view === 'orders' ? 'order' : 'client'}
            stage={dc.workflow?.stage}
            status={view === 'orders' ? ORDER_STEPS[orderStepOf(dc.workflow?.stage)] : dc.workflow?.label || formatDcStatusLabel(getDcStatus(dc))}
            nextStep={
              dc.workflow?.nextAction || dc.workflow?.nextActorRole
                ? `Next: ${dc.workflow?.nextActorRole || 'BDE'}${dc.workflow?.nextAction ? ` · ${dc.workflow.nextAction}` : ''}`
                : undefined
            }
            fieldDay={fieldDay}
            onYearChanged={() => { setHubDc(null); void loadDCs(); }}
            actions={{
              editPO,
              viewInvoice: canEditRequest ? undefined : () => openInvoiceView(dc),
              newYearPO: orderId ? () => addNextYearPo(dc) : undefined,
              requestDC:
                canEditRequest && !isDcRequested(dc)
                  ? {
                      label: isPoChangePending(dc) ? 'Waiting for Approval' : isPendingPoEdit(dc) ? 'Waiting for Manager' : 'Request DC',
                      disabled: !orderId || !canRequestDC(dc),
                      onPress: () => handleRequestDC(dc),
                    }
                  : undefined,
            }}
          />
        );
      })() : null}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: sheetBottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>DC Details</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedDC && (
                <>
                  <Text style={styles.modalLabel}>Customer: {selectedDC.customerName || selectedDC.dcOrderId?.school_name}</Text>
                  <Text style={styles.modalLabel}>Product: {selectedDC.product || 'N/A'}</Text>
                  <Text style={styles.modalLabel}>Status: {formatDcStatusLabel(resolveMyClientsDcStatus(selectedDC))}</Text>
                  {selectedDC.poPhotoUrl && (
                    <Image source={{ uri: selectedDC.poPhotoUrl }} style={styles.previewImage} />
                  )}
                  {selectedDC.deliveryNotes && (
                    <>
                      <Text style={styles.modalLabel}>Delivery Notes:</Text>
                      <Text style={styles.modalText}>{selectedDC.deliveryNotes}</Text>
                    </>
                  )}
                </>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showInvoiceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: sheetBottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Invoice{invoiceData ? ` - ${invoiceData.schoolName}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowInvoiceModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {invoiceLoading ? (
                <Text style={styles.hint}>Loading invoice...</Text>
              ) : invoiceData && invoiceData.lines.length > 0 ? (
                <>
                  {invoiceData.lines.map((line, i) => (
                    <View key={i} style={styles.invoiceRow}>
                      <Text style={styles.invoiceProduct}>
                        {line.product} ({line.term})
                      </Text>
                      <Text style={styles.invoiceMeta}>
                        Qty {line.qty} × ₹{line.unitPrice.toFixed(2)} = ₹{line.total.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.invoiceGrand}>Grand Total: ₹{invoiceData.grandTotal.toFixed(2)}</Text>
                </>
              ) : (
                <Text style={styles.hint}>No invoice line items available.</Text>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowInvoiceModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  nextYearButton: { marginTop: 10, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#16A34A', alignItems: 'center' },
  nextYearText: { color: '#15803D', fontWeight: '700', fontSize: 14 },
  fullInfoLink: { color: '#2563EB', fontSize: 13, fontWeight: '600', marginTop: 4 },
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, marginBottom: 4 },
  headerSubtitle: { ...typography.body.small, color: colors.textLight + 'CC' },
  placeholder: { width: 40 },
  searchContainer: { padding: 16, backgroundColor: colors.backgroundLight, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { backgroundColor: colors.background, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { ...typography.heading.h2, color: colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { ...typography.body.medium, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, marginBottom: 16, padding: 16, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  customerName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1, marginRight: 12 },
  statusBadge: { backgroundColor: colors.info + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { ...typography.body.small, color: colors.info, fontWeight: '600' },
  nextBox: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 },
  nextRole: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  nextAction: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  cardBody: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.small, color: colors.textSecondary, width: 80 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  cardFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  viewDetailsText: { ...typography.body.small, color: colors.primary, textAlign: 'right', fontWeight: '500' },
  viewPoLink: { ...typography.body.small, color: colors.primary, marginTop: 8, fontWeight: '600' },
  cardDcFlowMessageText: {
    ...typography.body.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardActions: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
  cardButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardButtonEdit: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  cardButtonInvoice: { backgroundColor: colors.info },
  cardButtonRequest: { backgroundColor: colors.primary },
  cardButtonDisabled: { backgroundColor: colors.textSecondary + '40', opacity: 0.8 },
  cardButtonTextEdit: { ...typography.body.small, color: colors.textPrimary, fontWeight: '600' },
  cardButtonTextInvoice: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  cardButtonTextRequest: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  cardButtonTextRequestDisabled: { ...typography.body.small, color: colors.textSecondary, fontWeight: '600' },
  hint: { ...typography.body.small, color: colors.textSecondary, paddingVertical: 16 },
  invoiceRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  invoiceProduct: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  invoiceMeta: { ...typography.body.small, color: colors.textSecondary, marginTop: 4 },
  invoiceGrand: { ...typography.heading.h4, color: colors.primary, marginTop: 8, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.heading.h2, color: colors.textPrimary },
  modalClose: { fontSize: 24, color: colors.textSecondary },
  modalBody: { padding: 20 },
  modalLabel: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  modalText: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 16 },
  previewImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16 },
  modalFooter: { flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  modalButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  modalButtonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  kv: { flexDirection: 'row', paddingVertical: 3 },
  k: { width: 100, fontSize: 13, color: colors.textSecondary },
  v: { flex: 1, fontSize: 14, color: colors.textPrimary },
  code: { fontWeight: '700' },
  phone: { color: '#2563EB', textDecorationLine: 'underline' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0F2FE' },
  chipOn: { backgroundColor: '#0284C7' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#0369A1' },
  chipTextOn: { color: '#fff' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { flexGrow: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: '#fff' },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  actionPrimary: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  actionPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  actionMuted: { backgroundColor: '#F1F5F9' },
  actionMutedText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  openRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  openText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  openArrow: { fontSize: 22, color: colors.primaryDark, marginLeft: 8 },
});



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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';

export default function DCClientScreen({ navigation }: any) {
  const { user } = useAuth();
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
      const data = await apiService.get('/dc/employee/my');
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

  const getOrderId = (dc: any) => {
    if (dc._isConvertedLead && dc._id) return dc._id;
    const o = dc.dcOrderId;
    if (!o) return null;
    return typeof o === 'object' && o._id ? o._id : o;
  };

  const canRequestDC = (dc: any) => {
    const orderStatus = dc.dcOrderId?.status;
    if (orderStatus === 'dc_requested' || orderStatus === 'dc_accepted' || orderStatus === 'dc_approved' || orderStatus === 'dc_sent_to_senior') return false;
    const poChange = dc.dcOrderId?.poChangeRequest;
    if (poChange && poChange.status === 'PENDING_MANAGER_APPROVAL') return false;
    return true;
  };

  const isPoChangePending = (dc: any) => {
    const poChange = dc.dcOrderId?.poChangeRequest;
    return !!(poChange && poChange.status === 'PENDING_MANAGER_APPROVAL');
  };

  const getOrderStatus = (dc: any) => {
    if (typeof dc.dcOrderId === 'object' && dc.dcOrderId?.status) return dc.dcOrderId.status;
    return null;
  };

  const getDcStatus = (dc: any) => dc.status || 'created';

  /** Web: Edit PO + Request DC when created / po_submitted */
  const showEditAndRequest = (dc: any) => {
    const dcStatus = getDcStatus(dc);
    const orderStatus = getOrderStatus(dc);
    if (orderStatus === 'saved' || !orderStatus) return true;
    return dcStatus === 'created' || dcStatus === 'po_submitted';
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
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return '-';
    }
  };

  const filteredDCs = dcs.filter((dc) => {
    const customerName = dc.customerName || dc.dcOrderId?.school_name || '';
    return customerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <ScreenShell
      title="My Clients"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<View style={styles.searchContainer}>
        <WebInput
          style={styles.searchInput}
          placeholder="Search by customer name..."
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
            <Text style={styles.emptyTitle}>No Clients</Text>
            <Text style={styles.emptySubtitle}>Closed leads will appear here. Request DC when ready.</Text>
          </View>
        ) : (
          filteredDCs.map((dc) => {
            const orderId = getOrderId(dc);
            const dcStatus = getDcStatus(dc);
            const statusLabel = (dcStatus || 'created')
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            const createdDate = formatDate(dc.createdAt);
            const turnedDate =
              typeof dc.dcOrderId === 'object' && dc.dcOrderId?.createdAt
                ? formatDate(dc.dcOrderId.createdAt)
                : createdDate;
            const canEditRequest = showEditAndRequest(dc);

            return (
              <View key={dc._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.customerName} numberOfLines={2}>
                    {dc.customerName || dc.dcOrderId?.school_name || 'Unknown Customer'}
                  </Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>School Code:</Text>
                    <Text style={styles.infoValue}>{getSchoolCode(dc)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={styles.infoValue}>{getPhone(dc)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Product:</Text>
                    <Text style={styles.infoValue}>{getProductsText(dc)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Created:</Text>
                    <Text style={styles.infoValue}>{createdDate}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Turned:</Text>
                    <Text style={styles.infoValue}>{turnedDate}</Text>
                  </View>
                  {dc.poPhotoUrl ? (
                    <TouchableOpacity onPress={() => openDCModal(dc)}>
                      <Text style={styles.viewPoLink}>View PO document</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.cardActions}>
                  {canEditRequest ? (
                    <>
                      <TouchableOpacity
                        style={[styles.cardButton, styles.cardButtonEdit]}
                        onPress={() => orderId && navigation.navigate('ClientEditPO', { orderId })}
                        disabled={!orderId}
                      >
                        <Text style={styles.cardButtonTextEdit}>Edit PO</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.cardButton,
                          styles.cardButtonRequest,
                          (!canRequestDC(dc) || !orderId) && styles.cardButtonDisabled,
                        ]}
                        onPress={() =>
                          orderId &&
                          canRequestDC(dc) &&
                          navigation.navigate('DCRequestSummary', { orderId, client: dc })
                        }
                        disabled={!orderId || !canRequestDC(dc)}
                      >
                        <Text style={styles.cardButtonTextRequest}>
                          {isPoChangePending(dc) ? 'Waiting for Approval' : 'Request DC'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.cardButton, styles.cardButtonInvoice]}
                        onPress={() => openInvoiceView(dc)}
                      >
                        <Text style={styles.cardButtonTextInvoice}>View Invoice</Text>
                      </TouchableOpacity>
                      {orderId ? (
                        <TouchableOpacity
                          style={[styles.cardButton, styles.cardButtonEdit]}
                          onPress={() => navigation.navigate('ClientEditPO', { orderId })}
                        >
                          <Text style={styles.cardButtonTextEdit}>Edit PO</Text>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  )}
                </View>
                {!canEditRequest && (
                  <Text style={styles.cardDcFlowMessageText}>
                    PO can only be changed before requesting DC. Use View Invoice for clients in the DC process.
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                  <Text style={styles.modalLabel}>Status: {selectedDC.status || 'Created'}</Text>
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
          <View style={styles.modalContent}>
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
});



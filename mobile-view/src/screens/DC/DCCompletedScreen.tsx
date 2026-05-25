/**
 * Completed DC screen (admin) - shows all DCs with status 'completed' from GET /dc/completed.
 * View PDF and Stock Returns buttons work like navbar-landing completed DC (PDF in modal, stock returns list with doc viewer).
 */
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';

// WebView for PDF/document display (like navbar iframe)
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

/**
 * Build a PDF/document URL the app can load. Uses the same host as the API so uploads
 * work on device (stored URLs often have localhost or wrong host → "cannot get file").
 */
function buildPdfUrl(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // data: URLs (base64) use as-is
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }
  const base = getUploadsBaseUrl();
  // Extract path: full URL → use pathname so we always hit the app's API host (fixes "cannot get file" when stored URL had localhost/wrong host)
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

export default function DCCompletedScreen({ navigation }: any) {
  const [dcs, setDcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // View PDF modal (same as navbar: DC Document in modal)
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState('DC Document');
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);

  // Stock Returns modal: list returns for this DC, view docs like PDF modal
  const [returnsModalVisible, setReturnsModalVisible] = useState(false);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsDc, setReturnsDc] = useState<any>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('Document');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/dc/completed');
      setDcs(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load completed DCs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return '-';
    }
  };

  const getCustomerName = (dc: any) =>
    dc.customerName ||
    (dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId.school_name : null) ||
    dc.saleId?.customerName ||
    'N/A';

  const getProduct = (dc: any) => {
    if (dc.product) return dc.product;
    if (dc.productDetails && Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
      return dc.productDetails.map((p: any) => p.productName || p.product).join(', ');
    }
    return dc.saleId?.product || '-';
  };

  const getZone = (dc: any) =>
    (dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId.zone : null) || dc.zone || '-';

  const getDCNumber = (dc: any) => {
    if (!dc?.createdAt) return `DC-${(dc?._id || '').slice(-6)}`;
    const year = new Date(dc.createdAt).getFullYear();
    const shortYear = year.toString().slice(-2);
    const nextYear = (year + 1).toString().slice(-2);
    const id = (dc._id || '').slice(-4);
    return `${shortYear}-${nextYear}/${id}`;
  };

  const openViewPdf = async (dc: any) => {
    setOpeningPdfId(dc._id);
    setPdfModalVisible(false);
    setPdfUrl(null);
    try {
      const fullDC = await apiService.get(`/dc/${dc._id}`);
      const url = fullDC?.poDocument || fullDC?.poPhotoUrl || dc?.poDocument || dc?.poPhotoUrl;
      const resolved = buildPdfUrl(url);
      if (resolved) {
        setPdfTitle(`DC Document - ${getDCNumber(dc)}`);
        setPdfUrl(resolved);
        setPdfModalVisible(true);
      } else {
        Alert.alert('No PDF', 'No PDF document available for this DC.');
      }
    } catch (e: any) {
      const fallback = buildPdfUrl(dc?.poDocument || dc?.poPhotoUrl);
      if (fallback) {
        setPdfTitle(`DC Document - ${getDCNumber(dc)}`);
        setPdfUrl(fallback);
        setPdfModalVisible(true);
      } else {
        Alert.alert('Error', e?.message || 'No PDF document available for this DC.');
      }
    } finally {
      setOpeningPdfId(null);
    }
  };

  const openStockReturns = async (dc: any) => {
    setReturnsDc(dc);
    setReturnsModalVisible(true);
    setReturnsList([]);
    setReturnsLoading(true);
    try {
      const list = await apiService.get('/stock-returns/executive/list');
      const arr = Array.isArray(list) ? list : [];
      const dcOrderId = dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId._id : dc.dcOrderId;
      const forThisDc = dcOrderId ? arr.filter((r: any) => (r.dcOrderId && (r.dcOrderId._id || r.dcOrderId)?.toString() === dcOrderId?.toString())) : [];
      setReturnsList(forThisDc);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load stock returns');
      setReturnsList([]);
    } finally {
      setReturnsLoading(false);
    }
  };

  const openReturnDocument = (urlRaw: string, title: string) => {
    const resolved = buildPdfUrl(urlRaw);
    if (resolved) {
      setViewerTitle(title);
      setViewerUrl(resolved);
    } else {
      Alert.alert('No document', 'No document available.');
    }
  };

  const closePdfModal = () => {
    setPdfModalVisible(false);
    setPdfUrl(null);
  };

  const closeReturnsModal = () => {
    setReturnsModalVisible(false);
    setReturnsList([]);
    setReturnsDc(null);
    setViewerUrl(null);
  };

  return (
    <ScreenShell
      title="Completed DCs"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {dcs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No completed DCs found</Text>
          </View>
        ) : (
          dcs.map((dc) => (
            <View key={dc._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.customerName}>{getCustomerName(dc)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.success }]}>Completed</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Product:</Text>
                  <Text style={styles.infoValue}>{getProduct(dc)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Quantity:</Text>
                  <Text style={styles.infoValue}>{dc.requestedQuantity ?? dc.deliverableQuantity ?? '-'}</Text>
                </View>
                {(dc.dcDate || dc.completedAt) && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>DC Date:</Text>
                    <Text style={styles.infoValue}>{formatDate(dc.dcDate || dc.completedAt)}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Zone:</Text>
                  <Text style={styles.infoValue}>{getZone(dc)}</Text>
                </View>
                {dc.employeeId && typeof dc.employeeId === 'object' && dc.employeeId.name && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Employee:</Text>
                    <Text style={styles.infoValue}>{dc.employeeId.name}</Text>
                  </View>
                )}
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.viewPdfButton]}
                  onPress={() => openViewPdf(dc)}
                  disabled={!!openingPdfId}
                >
                  {openingPdfId === dc._id ? <ActivityIndicator size="small" color={colors.textLight} /> : <Text style={styles.actionButtonText}>View PDF</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.stockReturnsButton]}
                  onPress={() => openStockReturns(dc)}
                  disabled={returnsLoading}
                >
                  <Text style={styles.actionButtonText}>Stock Returns</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* PDF / Document modal - same as navbar "View PDF" dialog */}
      <Modal visible={pdfModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{pdfTitle}</Text>
              <TouchableOpacity onPress={closePdfModal} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pdfContainer}>
              {pdfUrl && WebView ? (
                <WebView
                  source={{ uri: pdfUrl }}
                  style={styles.webview}
                  scalesPageToFit
                  startInLoadingState
                  originWhitelist={['http://*', 'https://*', 'data:*', 'file:*']}
                  allowFileAccess
                  renderLoading={() => (
                    <View style={styles.pdfLoading}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={styles.pdfLoadingText}>Loading document...</Text>
                    </View>
                  )}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.warn('WebView PDF error:', nativeEvent);
                  }}
                />
              ) : pdfUrl ? (
                <Text style={styles.pdfFallback}>Install react-native-webview to view PDF in app. URL: {pdfUrl.slice(0, 50)}...</Text>
              ) : (
                <Text style={styles.pdfFallback}>No document available</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Stock Returns modal - list returns for this DC, view docs like navbar */}
      <Modal visible={returnsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stock Returns{returnsDc ? ` - ${getCustomerName(returnsDc)}` : ''}</Text>
              <TouchableOpacity onPress={closeReturnsModal} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            {viewerUrl ? (
              <View style={styles.pdfContainer}>
                {WebView ? (
                  <WebView
                    source={{ uri: viewerUrl }}
                    style={styles.webview}
                    scalesPageToFit
                    startInLoadingState
                  />
                ) : (
                  <Text style={styles.pdfFallback}>Document: {viewerUrl.slice(0, 60)}...</Text>
                )}
                <TouchableOpacity style={styles.backFromViewer} onPress={() => setViewerUrl(null)}>
                  <Text style={styles.modalCloseText}>← Back to list</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.returnsList}>
                {returnsLoading ? (
                  <View style={styles.returnsLoading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.returnsLoadingText}>Loading stock returns...</Text>
                  </View>
                ) : returnsList.length === 0 ? (
                  <View style={styles.returnsEmpty}>
                    <Text style={styles.returnsEmptyText}>No stock returns for this DC</Text>
                  </View>
                ) : (
                  returnsList.map((r: any) => (
                    <View key={r._id} style={styles.returnCard}>
                      <Text style={styles.returnCardTitle}>Return #{r.returnNumber || r.returnId || r._id?.slice(-6)}</Text>
                      <Text style={styles.returnCardDate}>{formatDate(r.returnDate || r.createdAt)}</Text>
                      <Text style={styles.returnCardStatus}>{r.status || '-'}</Text>
                      {r.evidencePhotos && Array.isArray(r.evidencePhotos) && r.evidencePhotos.length > 0 && (
                        <View style={styles.returnDocRow}>
                          {r.evidencePhotos.slice(0, 3).map((photoUrl: string, idx: number) => (
                            <TouchableOpacity
                              key={idx}
                              style={styles.viewDocButton}
                              onPress={() => openReturnDocument(photoUrl, `Return #${r.returnNumber || r._id?.slice(-6)} - Photo ${idx + 1}`)}
                            >
                              <Text style={styles.viewDocButtonText}>View doc {idx + 1}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
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
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { ...typography.label.small, fontWeight: '600' },
  cardBody: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 100 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  viewPdfButton: { backgroundColor: colors.primary },
  stockReturnsButton: { backgroundColor: colors.info || '#0ea5e9' },
  actionButtonText: { ...typography.label.small, color: colors.textLight, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: colors.backgroundLight, borderRadius: 16, maxHeight: '90%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  modalClose: { padding: 8 },
  modalCloseText: { ...typography.label.medium, color: colors.primary, fontWeight: '600' },
  pdfContainer: { height: 400, padding: 8 },
  webview: { flex: 1, borderRadius: 8 },
  pdfLoading: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  pdfLoadingText: { marginTop: 8, ...typography.body.small, color: colors.textSecondary },
  pdfFallback: { ...typography.body.small, color: colors.textSecondary, padding: 16 },
  backFromViewer: { padding: 12, alignItems: 'center' },
  returnsList: { maxHeight: 400, padding: 16 },
  returnsLoading: { padding: 40, alignItems: 'center' },
  returnsLoadingText: { marginTop: 8, ...typography.body.small, color: colors.textSecondary },
  returnsEmpty: { padding: 40, alignItems: 'center' },
  returnsEmptyText: { ...typography.body.medium, color: colors.textSecondary },
  returnCard: { backgroundColor: colors.background, borderRadius: 12, padding: 12, marginBottom: 10 },
  returnCardTitle: { ...typography.label.medium, color: colors.textPrimary },
  returnCardDate: { ...typography.body.small, color: colors.textSecondary },
  returnCardStatus: { ...typography.body.small, color: colors.textSecondary, marginTop: 4 },
  returnDocRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  viewDocButton: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  viewDocButtonText: { ...typography.label.small, color: colors.textLight },
});

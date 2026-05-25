/**
 * Request DC (Term-Wise) - Read-only review screen.
 * Shown when user taps "Request DC" on Term-Wise DC list.
 * All fields read-only; Term is not editable. Request button submits DC to normal flow.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

type ProductRow = {
  id: string;
  product_name: string;
  term: string;
  quantity: number;
  unit_price: number;
};

export default function DCTermWiseRequestDCScreen({ navigation, route }: any) {
  const dcId = route?.params?.dcId as string | undefined;
  const [dc, setDc] = useState<any>(null);
  const [dcOrder, setDcOrder] = useState<any>(null);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (dcId) loadData();
  }, [dcId]);

  const loadData = async () => {
    if (!dcId) return;
    try {
      setLoading(true);
      const fullDC = await apiService.get(`/dc/${dcId}`);
      setDc(fullDC);

      const orderId =
        fullDC.dcOrderId && typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId._id
          ? fullDC.dcOrderId._id
          : typeof fullDC.dcOrderId === 'string'
            ? fullDC.dcOrderId
            : null;

      if (orderId) {
        try {
          const order = await apiService.get(`/dc-orders/${orderId}`);
          setDcOrder(order);
        } catch {
          setDcOrder(null);
        }
      } else {
        setDcOrder(null);
      }

      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        setProductRows(
          fullDC.productDetails.map((p: any, idx: number) => ({
            id: String(idx + 1),
            product_name: p.product || p.productName || 'Abacus',
            term: p.term || 'Term 1',
            quantity: Number(p.quantity) ?? Number(p.strength) ?? 0,
            unit_price: Number(p.price) ?? Number(p.unit_price) ?? 0,
          }))
        );
      } else {
        setProductRows([
          {
            id: '1',
            product_name: fullDC.product || 'Abacus',
            term: 'Term 1',
            quantity: fullDC.requestedQuantity || 0,
            unit_price: 0,
          },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load DC');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!dc) return;
    const orderId = dcOrder?._id ?? (dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId._id : dc.dcOrderId);
    if (!orderId) {
      Alert.alert('Error', 'This DC has no linked order.');
      return;
    }

    const totalQty = productRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    if (totalQty <= 0) {
      Alert.alert('Error', 'At least one product must have quantity > 0');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.put(`/dc/${dcId}`, { status: 'po_submitted' });
      await apiService.put(`/dc-orders/${orderId}`, { status: 'dc_requested' });
      Alert.alert('Done', 'DC requested. It will appear in Closed Sales and follow the normal flow.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to request DC');
    } finally {
      setSubmitting(false);
    }
  };

  const order = dcOrder || (dc?.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null);
  const schoolName = order?.school_name || dc?.customerName || 'Client';
  const totalAmount = dcOrder?.total_amount ?? productRows.reduce((s, r) => s + r.quantity * r.unit_price, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!dc) return null;

  const grandTotal = productRows.reduce(
    (s, r) => s + (r.quantity || 0) * (r.unit_price || 0),
    0
  );

  return (
    <ScreenShell
      title={`Request DC - ${schoolName}`}
      loading={loading}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>
          Review PO details and request Delivery Challan. All fields are read-only.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transport Details</Text>
          <ReadOnlyField label="Transport Name" value={order?.transport_name || order?.pendingEdit?.transport_name || '-'} />
          <ReadOnlyField label="Transport Location" value={order?.transport_location || order?.pendingEdit?.transport_location || '-'} />
          <ReadOnlyField label="Transportation Landmark" value={order?.transportation_landmark || order?.pendingEdit?.transportation_landmark || '-'} />
          <ReadOnlyField label="Pincode" value={order?.pincode || order?.pendingEdit?.pincode || '-'} />
        </View>

        <View style={styles.section}>
          <ReadOnlyField label="Remarks" value={order?.remarks || '-'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.tableWrap}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colProduct]}>Product Name</Text>
                <Text style={[styles.th, styles.colTerm]}>Term</Text>
                <Text style={[styles.th, styles.colQty]}>Quantity</Text>
                <Text style={[styles.th, styles.colPrice]}>Unit Price</Text>
                <Text style={[styles.th, styles.colTotal]}>Total</Text>
              </View>
              {productRows.map((row) => {
                const lineTotal = (row.quantity || 0) * (row.unit_price || 0);
                return (
                  <View key={row.id} style={styles.tableRow}>
                    <Text style={[styles.td, styles.colProduct]} numberOfLines={1}>{row.product_name}</Text>
                    <Text style={[styles.td, styles.colTerm]}>{row.term || 'Term 2'}</Text>
                    <Text style={[styles.td, styles.colQty]}>{row.quantity}</Text>
                    <Text style={[styles.td, styles.colPrice]}>{row.unit_price}</Text>
                    <Text style={[styles.td, styles.colTotal]}>{lineTotal.toFixed(2)}</Text>
                  </View>
                );
              })}
              <View style={styles.tableFooter}>
                <Text style={styles.footerLabel}>Grand Total:</Text>
                <Text style={styles.footerValue}>₹{(grandTotal || totalAmount).toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.requestButton, submitting && styles.buttonDisabled]}
            onPress={handleRequest}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.textLight} />
            ) : (
              <Text style={styles.requestButtonText}>Request</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.readOnlyValue}>{value || '-'}</Text>
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
  headerTitle: { ...typography.heading.h3, color: colors.textLight, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  subtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { ...typography.label.small, color: colors.textSecondary, marginBottom: 4 },
  readOnlyValue: { ...typography.body.medium, color: colors.textPrimary, backgroundColor: colors.backgroundDark, padding: 12, borderRadius: 8 },
  tableWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 520,
  },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.backgroundDark, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  td: { ...typography.body.small, color: colors.textPrimary },
  colProduct: { flex: 1.2, minWidth: 100 },
  colTerm: { width: 72 },
  colQty: { width: 64 },
  colPrice: { width: 80 },
  colTotal: { width: 80 },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.backgroundDark,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    gap: 8,
    minWidth: 520,
  },
  footerLabel: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  footerValue: { ...typography.body.medium, fontWeight: '700', color: colors.primary },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelButtonText: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '600' },
  requestButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  requestButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});

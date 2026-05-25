/**
 * DC Request Summary (My Clients flow) — Read-only summary then "Request DC" to move to Closed Sales.
 * Params: orderId (DcOrder id), optional client (preloaded item from My Clients).
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.readOnlyValue}>{value || '-'}</Text>
    </View>
  );
}

export default function DCRequestSummaryScreen({ navigation, route }: any) {
  const orderId = route?.params?.orderId as string | undefined;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const data = await apiService.get(`/dc-orders/${orderId}`);
      setOrder(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load order');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDC = async () => {
    if (!orderId) return;
    setSubmitting(true);
    try {
      await apiService.put(`/dc-orders/${orderId}`, { status: 'dc_requested' });
      Alert.alert('Done', 'DC requested. It will appear in Closed Sales and follow the normal flow.', [
        { text: 'OK', onPress: () => navigation.navigate('DCClient') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to request DC');
    } finally {
      setSubmitting(false);
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

  if (!order) return null;

  const products = order.products && Array.isArray(order.products) ? order.products : [];
  const totalAmount = products.reduce((s: number, p: any) => s + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0);

  return (
    <ScreenShell
      title={`Request DC${order.school_name ? ` - ${order.school_name}` : ''}`}
      loading={loading}
    >
<ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>Review details. Tap Request DC to move this to Closed Sales.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client / School</Text>
          <ReadOnlyField label="Client Name" value={order.school_name} />
          <ReadOnlyField label="Zone" value={order.zone} />
          <ReadOnlyField label="Contact" value={order.contact_person} />
          <ReadOnlyField label="Mobile" value={order.contact_mobile} />
          <ReadOnlyField label="Address" value={order.address || order.location} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery & category</Text>
          <ReadOnlyField label="Delivery (est.)" value={order.estimated_delivery_date ? new Date(order.estimated_delivery_date).toLocaleDateString('en-IN') : '-'} />
          <ReadOnlyField label="DC Category / School type" value={order.school_type} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PO Reference</Text>
          <ReadOnlyField label="PO Document" value={order.pod_proof_url ? 'Attached' : 'Not attached'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products & quantities</Text>
          <View style={styles.tableWrap}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colProduct]}>Product</Text>
              <Text style={[styles.th, styles.colQty]}>Qty</Text>
              <Text style={[styles.th, styles.colPrice]}>Unit price</Text>
              <Text style={[styles.th, styles.colTotal]}>Total</Text>
            </View>
            {products.map((p: any, idx: number) => {
              const q = Number(p.quantity) || 0;
              const up = Number(p.unit_price) || 0;
              return (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.td, styles.colProduct]} numberOfLines={1}>{p.product_name || p.product || '-'}</Text>
                  <Text style={[styles.td, styles.colQty]}>{q}</Text>
                  <Text style={[styles.td, styles.colPrice]}>{up}</Text>
                  <Text style={[styles.td, styles.colTotal]}>{(q * up).toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
          <ReadOnlyField label="Total amount" value={String(totalAmount.toFixed(2))} />
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.stickyFooter}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.requestButton, submitting && styles.buttonDisabled]}
          onPress={handleRequestDC}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textLight} />
          ) : (
            <Text style={styles.requestButtonText}>Request DC</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenShell>
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
  contentContainer: { padding: 20, paddingBottom: 24 },
  subtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { ...typography.label.small, color: colors.textSecondary, marginBottom: 4 },
  readOnlyValue: { ...typography.body.medium, color: colors.textPrimary, backgroundColor: colors.backgroundDark, padding: 12, borderRadius: 8 },
  tableWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.backgroundDark, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  td: { ...typography.body.small, color: colors.textPrimary },
  colProduct: { flex: 1, minWidth: 80 },
  colQty: { width: 48 },
  colPrice: { width: 72 },
  colTotal: { width: 64 },
  spacer: { height: 24 },
  stickyFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: colors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  requestButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  requestButtonText: { ...typography.heading.h4, color: colors.textLight, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});

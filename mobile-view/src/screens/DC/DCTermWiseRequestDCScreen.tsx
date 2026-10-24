/**
 * Request DC (Term-Wise) — the web "Request DC" dialog on app/dashboard/dc/client-dc/term-wise/page.tsx.
 * Everything is read-only except Strength. Request keeps the DC in Term-Wise (scheduled_for_later),
 * stores the request on the order and moves the order to dc_requested so it appears in Closed Sales.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { isTransportComplete, TRANSPORT_REQUIRED_MESSAGE } from '../../utils/dcTransport';
import { showAlert } from '../../utils/showAlert';
import { transportToLabel } from '../../components/dc/TransportFields';
import { persistProductTerm } from '../../lib/crm/productTerm';
import {
  dcOrderIdOf,
  orderToForm,
  rowsTotal,
  termWiseRows,
  type TermWiseOrderForm,
  type TermWiseRow,
} from '../../lib/termWiseDc';

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

export default function DCTermWiseRequestDCScreen({ navigation, route }: any) {
  const dcId = route?.params?.dcId as string | undefined;
  const [dc, setDc] = useState<any>(null);
  const [dcOrder, setDcOrder] = useState<any>(null);
  const [form, setForm] = useState<TermWiseOrderForm>(orderToForm(null));
  const [productRows, setProductRows] = useState<TermWiseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (dcId) loadData();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dcId]);

  const loadData = async () => {
    if (!dcId) return;
    try {
      setLoading(true);
      const fullDC = await apiService.get(`/dc/${dcId}`);
      const orderId = dcOrderIdOf(fullDC);
      if (!orderId) {
        showAlert('Error', 'Cannot request DC: DC Order not found');
        navigation.goBack();
        return;
      }
      const order = await apiService.get(`/dc-orders/${orderId}`);
      setDc(fullDC);
      setDcOrder(order);
      setForm(orderToForm(order, fullDC));
      setProductRows(termWiseRows(fullDC, order, false));
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to load DC Order details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const setStrength = (id: string, text: string) => {
    const value = Number(text.replace(/\D/g, '')) || 0;
    setProductRows((rows) => rows.map((r) => (r.id === id ? { ...r, quantity: value < 0 ? 0 : value } : r)));
  };

  const handleRequest = async () => {
    if (!dc) return;
    const orderId = dcOrder?._id || dcOrderIdOf(dc);
    if (!orderId) {
      showAlert('Error', 'Cannot request DC: DC Order not found');
      return;
    }
    if (!isTransportComplete(dcOrder || dc.dcOrderId)) {
      showAlert('Transport required', TRANSPORT_REQUIRED_MESSAGE);
      return;
    }
    const totalQuantity = productRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    if (totalQuantity <= 0) {
      showAlert('Error', 'Please ensure at least one product with quantity > 0');
      return;
    }

    setSubmitting(true);
    try {
      const existing: any[] = Array.isArray(dc.productDetails) ? dc.productDetails : [];
      const category = form.school_type === 'Existing' ? 'Existing School' : 'New School';
      const productDetails = productRows.map((row, idx) => {
        const prev =
          existing[idx] ||
          existing.find((p: any) => {
            if (norm(p.product || p.product_name) !== norm(row.product_name)) return false;
            const pl = norm(p.level);
            const rl = norm(row.level);
            return !pl || !rl || pl === rl;
          }) ||
          {};
        return {
          ...prev,
          product: row.product_name,
          class: row.class || prev.class || '1',
          category: row.category || prev.category || category,
          specs: row.specs || prev.specs || 'Regular',
          subject: row.subject ?? prev.subject,
          productCategory: row.productCategory || prev.productCategory,
          quantity: row.quantity,
          strength: row.quantity,
          price: row.unit_price,
          total: (row.quantity || 0) * (row.unit_price || 0),
          level: row.level || prev.level,
          term: persistProductTerm({ ...prev, ...row }),
          closeLeadDestination: 'TERM_WISE_DC',
          unit_price: row.unit_price || 0,
        };
      });

      // Keep scheduled_for_later so the DC stays in Term-Wise DC (as on the web).
      await apiService.put(`/dc/${dc._id}`, {
        dcOrderId: orderId,
        customerName: form.school_name || dc.customerName || '',
        customerPhone: form.contact_mobile || dc.customerPhone || '',
        productDetails,
        dcDate: new Date().toISOString().split('T')[0],
        dcRemarks: form.remarks,
        dcCategory: category,
        status: 'scheduled_for_later',
      });

      let orderWarning = '';
      try {
        const updated = await apiService.put(`/dc-orders/${orderId}`, {
          status: 'dc_requested',
          dcRequestData: {
            productDetails,
            requestedQuantity: totalQuantity,
            requestedAt: new Date().toISOString(),
          },
        });
        if (updated?.status && updated.status !== 'dc_requested') {
          orderWarning = 'DC updated, but the order status may not have been updated. Please check Closed Sales.';
        }
      } catch (orderError: any) {
        orderWarning = `Failed to update the order status: ${orderError?.message || 'Unknown error'}. Please refresh Closed Sales manually.`;
      }

      showAlert(
        orderWarning ? 'DC requested with a warning' : 'Done',
        orderWarning || 'DC requested successfully! It will appear in Closed Sales.'
      );
      navigation.goBack();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to request DC');
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

  if (!dc) return null;

  const grandTotal = rowsTotal(productRows);

  return (
    <ScreenShell title={`Request DC - ${form.school_name || dc.customerName || 'Client'}`}>
      <Text style={styles.subtitle}>Review PO details and request Delivery Challan. All fields are read-only except Strength.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>School / Client</Text>
        <ReadOnlyField label="School Name" value={form.school_name} />
        <ReadOnlyField label="School Type" value={form.school_type} />
        <ReadOnlyField label="Contact Person" value={form.contact_person} />
        <ReadOnlyField label="Contact Mobile" value={form.contact_mobile} />
        <ReadOnlyField label="Contact Person 2" value={form.contact_person2} />
        <ReadOnlyField label="Contact Mobile 2" value={form.contact_mobile2} />
        <ReadOnlyField label="Email" value={form.email} />
        <ReadOnlyField label="Location" value={form.location} />
        <ReadOnlyField label="Zone" value={form.zone} />
        <ReadOnlyField label="Address" value={form.address} />
      </View>

      <View style={styles.section}>
        <ReadOnlyField label="Remarks" value={form.remarks} />
        <ReadOnlyField label="PO Photo URL" value={form.pod_proof_url} />
        <ReadOnlyField label="Total Amount" value={`₹${(Number(form.total_amount) || 0).toFixed(2)}`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transport Details</Text>
        <ReadOnlyField label="Transport Name *" value={form.transport_name} />
        <ReadOnlyField label="Transport To" value={transportToLabel(form)} />
        <ReadOnlyField label="Transport Location *" value={form.transport_location} />
        <ReadOnlyField label="Transportation Landmark" value={form.transportation_landmark} />
        <ReadOnlyField label="Pincode *" value={form.pincode} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Products</Text>
        {productRows.length === 0 ? <Text style={styles.muted}>No Term-Wise products on this DC.</Text> : null}
        {productRows.map((row) => {
          const lineTotal = (row.quantity || 0) * (row.unit_price || 0);
          return (
            <View key={row.id} style={styles.productCard}>
              <Text style={styles.productName}>{row.product_name || '-'}</Text>
              <Text style={styles.productMeta}>
                {persistProductTerm(row)}
                {row.level ? ` · Level ${row.level}` : ''}
                {row.class ? ` · Class ${row.class}` : ''}
              </Text>
              <View style={styles.inline}>
                <View style={styles.cell}>
                  <Text style={styles.label}>Strength</Text>
                  <WebInput
                    value={String(row.quantity)}
                    keyboardType="number-pad"
                    onChangeText={(t) => setStrength(row.id, t)}
                    style={styles.strengthInput}
                  />
                </View>
                <View style={styles.cell}>
                  <Text style={styles.label}>Unit Price</Text>
                  <Text style={styles.readOnlyValue}>{row.unit_price}</Text>
                </View>
              </View>
              <Text style={styles.lineTotal}>Total: ₹{lineTotal.toFixed(2)}</Text>
            </View>
          );
        })}
        <View style={styles.tableFooter}>
          <Text style={styles.footerLabel}>Grand Total:</Text>
          <Text style={styles.footerValue}>₹{grandTotal.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={submitting}>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  subtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 16 },
  section: {
    marginBottom: 16,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { ...typography.label.small, color: colors.textSecondary, marginBottom: 4 },
  readOnlyValue: { ...typography.body.medium, color: colors.textPrimary, backgroundColor: colors.backgroundDark, padding: 12, borderRadius: 8 },
  muted: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  productCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10 },
  productName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  productMeta: { ...typography.body.small, color: colors.textSecondary, marginTop: 2, marginBottom: 8 },
  inline: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  strengthInput: { marginBottom: 0 },
  lineTotal: { ...typography.body.small, fontWeight: '600', color: colors.textPrimary, textAlign: 'right', marginTop: 8 },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  footerLabel: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  footerValue: { ...typography.body.medium, fontWeight: '700', color: colors.primary },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelButtonText: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '600' },
  requestButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  requestButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});

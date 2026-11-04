/**
 * Request DC (Term-Wise) — the web "Request DC" dialog on app/dashboard/dc/client-dc/term-wise/page.tsx.
 * Everything is read-only except Strength. Request keeps the DC in Term-Wise (scheduled_for_later),
 * stores the request on the order and moves the order to dc_requested so it appears in Closed Sales.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { InfoRow } from '../../ui/Kit';
import { ui } from '../../components/dc/DcUi';
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
    return <ScreenShell title="Request DC" loading>{null}</ScreenShell>;
  }

  if (!dc) return null;

  const grandTotal = rowsTotal(productRows);
  const req = (v: string) => (String(v || '').trim() ? v : 'Not set');

  return (
    <ScreenShell title="Request DC" subtitle={form.school_name || dc.customerName || 'Client'}>
      <Text style={ui.hint}>Only Strength can be changed here.</Text>

      <PageSection title="School / Client">
        <InfoRow label="School name" value={form.school_name} bold />
        <InfoRow label="School type" value={form.school_type} />
        <InfoRow label="Contact" value={form.contact_person} />
        <InfoRow label="Mobile" value={form.contact_mobile} phone />
        <InfoRow label="Contact 2" value={form.contact_person2} />
        <InfoRow label="Mobile 2" value={form.contact_mobile2} phone />
        <InfoRow label="Email" value={form.email} />
        <InfoRow label="Location" value={form.location} />
        <InfoRow label="Zone" value={form.zone} />
        <InfoRow label="Address" value={form.address} />
        <InfoRow label="Remarks" value={form.remarks} />
        <InfoRow label="PO photo" value={form.pod_proof_url} />
        <InfoRow label="Total amount" value={`₹${(Number(form.total_amount) || 0).toFixed(2)}`} bold />
      </PageSection>

      <PageSection title="Transport">
        <InfoRow label="Name *" value={req(form.transport_name)} />
        <InfoRow label="Transport to" value={transportToLabel(form)} />
        <InfoRow label="Location *" value={req(form.transport_location)} />
        <InfoRow label="Landmark" value={form.transportation_landmark} />
        <InfoRow label="Pincode *" value={req(form.pincode)} />
      </PageSection>

      <PageSection title="Products">
        {productRows.length === 0 ? <Text style={ui.muted}>No Term-Wise products on this DC.</Text> : null}
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
                  <WebLabel>Strength *</WebLabel>
                  <WebInput
                    value={String(row.quantity)}
                    keyboardType="number-pad"
                    onChangeText={(t) => setStrength(row.id, t)}
                    style={styles.strengthInput}
                  />
                </View>
                <View style={styles.cell}>
                  <WebLabel>Unit price</WebLabel>
                  <Text style={styles.readOnlyValue}>{row.unit_price}</Text>
                </View>
              </View>
              <Text style={styles.lineTotal}>Total: ₹{lineTotal.toFixed(2)}</Text>
            </View>
          );
        })}
        <View style={styles.tableFooter}>
          <Text style={styles.footerLabel}>Grand total</Text>
          <Text style={styles.footerValue}>₹{grandTotal.toFixed(2)}</Text>
        </View>
      </PageSection>

      <View style={styles.buttonRow}>
        <View style={styles.cell}><WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} disabled={submitting} /></View>
        <View style={styles.cell}><WebButton title="Request DC" onPress={handleRequest} loading={submitting} disabled={submitting} /></View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  readOnlyValue: { fontSize: 15, color: colors.textPrimary, backgroundColor: colors.backgroundMuted, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 10, minHeight: 48 },
  productCard: { borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: colors.background },
  productName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  productMeta: { fontSize: 13, color: colors.textTertiary, marginTop: 2, marginBottom: 8 },
  inline: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
  strengthInput: { marginBottom: 0 },
  lineTotal: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'right', marginTop: 8 },
  tableFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F7', marginTop: 4 },
  footerLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  footerValue: { fontSize: 17, fontWeight: '700', color: colors.primaryDark },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
});

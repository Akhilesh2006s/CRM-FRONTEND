/**
 * Edit PO for a Term-Wise DC — the web "Edit PO" dialog on app/dashboard/dc/client-dc/term-wise/page.tsx.
 * Loads only the rows on this Term-Wise DC (the shared Edit PO screen hides TERM_WISE_DC rows),
 * saves the order with originatingDcId, then writes the edited rows back to the DC.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { colors, radii, spacing } from '../../theme/colors';
import { WebButton, WebInput, WebLabel } from '../../ui/WebPrimitives';
import { showAlert } from '../../utils/showAlert';
import { persistProductTerm } from '../../lib/crm/productTerm';
import { TransportNameField, TransportToFields, transportToError } from './TransportFields';
import {
  dcOrderIdOf,
  orderToForm,
  rowsTotal,
  termWiseRows,
  termWiseTransportError,
  type TermWiseOrderForm,
  type TermWiseRow,
} from '../../lib/termWiseDc';

type Props = {
  dc: any | null;
  onClose: () => void;
  onSaved: () => void;
  bde?: { name?: string; mobile?: string };
};

export default function TermWiseEditPOModal({ dc, onClose, onSaved, bde }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullDc, setFullDc] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [form, setForm] = useState<TermWiseOrderForm>(orderToForm(null));
  const [rows, setRows] = useState<TermWiseRow[]>([]);

  useEffect(() => {
    if (!dc) return;
    const orderId = dcOrderIdOf(dc);
    if (!orderId) {
      showAlert('Error', 'Cannot edit: DC Order not found');
      onClose();
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([apiService.get(`/dc-orders/${orderId}`), apiService.get(`/dc/${dc._id}`).catch(() => dc)])
      .then(([o, d]) => {
        if (!active) return;
        const source = d?._id ? d : dc;
        setOrder(o);
        setFullDc(source);
        setForm(orderToForm(o, source));
        setRows(termWiseRows(source, o, true));
      })
      .catch((e: any) => {
        if (!active) return;
        showAlert('Error', e?.message || 'Failed to load DC Order details');
        onClose();
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dc?._id]);

  const set = <K extends keyof TermWiseOrderForm>(key: K, value: TermWiseOrderForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateRow = (id: string, patch: Partial<TermWiseRow>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((list) => [...list, { id: String(Date.now()), product_name: '', quantity: 0, unit_price: 0, term: 'Term 1' }]);

  const save = async () => {
    if (!order?._id) return;
    const transportProblem = termWiseTransportError(form, transportToError(form));
    if (transportProblem) {
      showAlert('Required', transportProblem);
      return;
    }
    if (rows.some((r) => !r.product_name.trim())) {
      showAlert('Required', 'Enter a product name for every product row, or remove the empty row.');
      return;
    }
    setSaving(true);
    try {
      const products = rows.map((row) => ({
        product_name: row.product_name.trim(),
        quantity: row.quantity,
        unit_price: row.unit_price,
        level: row.level,
        class: row.class,
        specs: row.specs,
        subject: row.subject,
        category: row.category,
        productCategory: row.productCategory,
        term: persistProductTerm(row),
      }));
      await apiService.put(`/dc-orders/${order._id}`, {
        ...form,
        products,
        total_amount: rowsTotal(rows),
        transport_name: form.transport_name.trim(),
        transport_location: form.transport_location.trim(),
        transportation_landmark: form.transportation_landmark.trim(),
        pincode: form.pincode.trim(),
        originatingDcId: fullDc?._id,
      });
      if (fullDc?._id) {
        const existing: any[] = Array.isArray(fullDc.productDetails) ? fullDc.productDetails : [];
        const productDetails = rows.map((row, idx) => {
          const prev = existing[idx] || {};
          return {
            ...prev,
            product: row.product_name || prev.product,
            productName: row.product_name || prev.productName,
            quantity: row.quantity,
            strength: Number(prev.strength) || row.quantity,
            price: row.unit_price ?? prev.price,
            unit_price: row.unit_price,
            level: row.level || prev.level,
            class: row.class || prev.class,
            specs: row.specs || prev.specs,
            subject: row.subject ?? prev.subject,
            category: row.category || prev.category,
            productCategory: row.productCategory || prev.productCategory,
            term: persistProductTerm({ ...prev, ...row }),
          };
        });
        await apiService.put(`/dc/${fullDc._id}`, { productDetails });
      }
      showAlert('Saved', 'PO updated successfully!');
      onSaved();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to update PO');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={Boolean(dc)} animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.root}>
        <View style={styles.bar}>
          <TouchableOpacity onPress={() => !saving && onClose()} hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={26} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              Edit PO - {form.school_name || 'Client'}
            </Text>
            <Text style={styles.subtitle}>Make changes to the PO. Changes will be saved instantly.</Text>
          </View>
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Section title="School / Client">
              <ReadOnly label="School Name" value={form.school_name} />
              <ReadOnly label="School Type" value={form.school_type} />
              <ReadOnly label="Contact Person" value={form.contact_person} />
              <ReadOnly label="Contact Mobile" value={form.contact_mobile} />
              <ReadOnly label="Contact Person 2" value={form.contact_person2} />
              <ReadOnly label="Contact Mobile 2" value={form.contact_mobile2} />
              <ReadOnly label="Zone" value={form.zone} />
              <WebLabel>Email</WebLabel>
              <WebInput value={form.email} onChangeText={(t) => set('email', t)} keyboardType="email-address" autoCapitalize="none" />
              <WebLabel>Location</WebLabel>
              <WebInput value={form.location} onChangeText={(t) => set('location', t)} />
              <WebLabel>Address</WebLabel>
              <WebInput value={form.address} onChangeText={(t) => set('address', t)} multiline style={styles.multiline} />
              <WebLabel>Remarks</WebLabel>
              <WebInput value={form.remarks} onChangeText={(t) => set('remarks', t)} multiline style={styles.multiline} />
            </Section>

            <Section title="PO Details">
              <WebLabel>PO Photo URL</WebLabel>
              <WebInput value={form.pod_proof_url} onChangeText={(t) => set('pod_proof_url', t)} autoCapitalize="none" />
              <ReadOnly label="Total Amount" value={`₹${rowsTotal(rows).toFixed(2)}`} />
            </Section>

            <Section title="Transport Details">
              <TransportNameField value={form.transport_name} onChange={(v) => set('transport_name', v)} />
              <TransportToFields
                value={form}
                onChange={(next) => setForm((f) => ({ ...f, ...next }))}
                bde={bde}
                school={{ name: form.school_name, mobile: form.contact_mobile }}
              />
              <WebLabel>Transport Location *</WebLabel>
              <WebInput value={form.transport_location} onChangeText={(t) => set('transport_location', t)} placeholder="Enter transport location" />
              <WebLabel>Transportation Landmark *</WebLabel>
              <WebInput
                value={form.transportation_landmark}
                onChangeText={(t) => set('transportation_landmark', t)}
                placeholder="Enter transportation landmark"
              />
              <WebLabel>Pincode *</WebLabel>
              <WebInput
                value={form.pincode}
                onChangeText={(t) => set('pincode', t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="6-digit pincode"
              />
            </Section>

            <Section title="Products">
              {rows.length === 0 ? <Text style={styles.muted}>No Term-Wise products on this DC.</Text> : null}
              {rows.map((row) => (
                <View key={row.id} style={styles.rowCard}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowMeta}>
                      {persistProductTerm(row)}
                      {row.level ? ` · ${row.level}` : ''}
                      {row.class ? ` · Class ${row.class}` : ''}
                    </Text>
                    <TouchableOpacity onPress={() => setRows((list) => list.filter((r) => r.id !== row.id))} hitSlop={8}>
                      <Text style={styles.remove}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <WebLabel>Product Name</WebLabel>
                  <WebInput value={row.product_name} onChangeText={(t) => updateRow(row.id, { product_name: t })} />
                  <View style={styles.inline}>
                    <View style={styles.cell}>
                      <WebLabel>Quantity</WebLabel>
                      <WebInput
                        value={String(row.quantity)}
                        keyboardType="number-pad"
                        onChangeText={(t) => updateRow(row.id, { quantity: Number(t.replace(/\D/g, '')) || 0 })}
                      />
                    </View>
                    <View style={styles.cell}>
                      <WebLabel>Unit Price</WebLabel>
                      <WebInput value={String(row.unit_price)} editable={false} style={styles.readonlyInput} />
                    </View>
                  </View>
                  <Text style={styles.lineTotal}>Total: ₹{((row.quantity || 0) * (row.unit_price || 0)).toFixed(2)}</Text>
                </View>
              ))}
              <WebButton title="+ Add Product" variant="outline" onPress={addRow} />
            </Section>

            <View style={styles.footer}>
              <View style={styles.cell}>
                <WebButton title="Cancel" variant="outline" disabled={saving} onPress={onClose} />
              </View>
              <View style={styles.cell}>
                <WebButton title={saving ? 'Saving...' : 'Save Changes'} loading={saving} disabled={saving} onPress={() => void save()} />
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <WebLabel>{label}</WebLabel>
      <Text style={styles.readonly}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  section: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 },
  readonly: {
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readonlyInput: { backgroundColor: colors.backgroundMuted, color: colors.textSecondary },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  muted: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  rowCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 12, marginBottom: 10 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowMeta: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  remove: { color: colors.error, fontWeight: '600', fontSize: 13 },
  inline: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  lineTotal: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'right' },
  footer: { flexDirection: 'row', gap: 10 },
});

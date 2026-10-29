import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import { printReturnSlip } from '../../lib/returnSlip';

import DateField from '../../ui/DateField';
/** Same list as web app/dashboard/returns/warehouse-executive/page.tsx ("Marked by students": written in, counted but not sellable). */
const CONDITION_OPTIONS = ['Sellable', 'Marked by students', 'Wrong Print', 'Damaged', 'Expired', 'Missing', 'Short received'];

type DcOrderRef = {
  _id?: string;
  school_name?: string;
  school_code?: string;
  contact_person?: string;
  contact_mobile?: string;
  address?: string;
  zone?: string;
  location?: string;
  city?: string;
  area?: string;
  cluster_code?: string;
  transport_name?: string;
  transport_location?: string;
};

type StockReturnDetail = {
  _id: string;
  returnId?: string;
  returnNumber?: number;
  status?: string;
  returnStatus?: string;
  returnDate?: string;
  lrNumber?: string;
  lrDate?: string;
  remarks?: string;
  whReturnRemarks?: string;
  transport?: string;
  town?: string;
  address?: string;
  zone?: string;
  cluster?: string;
  contactPerson?: string;
  contactMobile?: string;
  schoolCode?: string;
  customerName?: string;
  dcOrderId?: DcOrderRef | string;
  returnType?: string;
  saleId?: string;
  executiveName?: string;
  products?: Array<{
    product: string;
    class?: string;
    productCategory?: string;
    level?: string;
    subject?: string;
    specs?: string;
    soldQty?: number;
    /** No longer returned to the warehouse executive (blind count). */
    returnQty?: number;
    receivedQty?: number;
    reason?: string;
    remarks?: string;
    condition?: string;
    batchLot?: string;
    storageLocation?: string;
    mismatchRemark?: string;
  }>;
};

type ProductLine = {
  id: string;
  productRaw: string;
  productLabel: string;
  class: string;
  productCategory: string;
  level: string;
  subject: string;
  specs: string;
  soldQty?: number;
  qty: number;
  /** Raw input so an explicit 0 can be entered. */
  qtyText: string;
  reason: string;
  remarks: string;
  condition: string;
  batchLot: string;
  storageLocation: string;
  mismatchRemark: string;
};

function toDateInput(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function resolveReturnStatus(detail: StockReturnDetail): string {
  return String(detail.status || detail.returnStatus || '').trim();
}

function canVerify(status: string) {
  const s = status.trim();
  return s === 'Submitted' || s === 'Sent Back';
}

export default function StockReturnWarehouseVerifyScreen({ navigation, route }: any) {
  const returnId = route?.params?.returnId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<StockReturnDetail | null>(null);

  const [schoolName, setSchoolName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [town, setTown] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState('');
  const [cluster, setCluster] = useState('');
  const [moreRemarks, setMoreRemarks] = useState('');

  const [returnDate, setReturnDate] = useState('');
  const [whReturnRemarks, setWhReturnRemarks] = useState('');
  const [lrDate, setLrDate] = useState('');
  const [transport, setTransport] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [lines, setLines] = useState<ProductLine[]>([]);

  const returnStatus = detail ? resolveReturnStatus(detail) : '';
  const canEdit = detail ? canVerify(returnStatus) : false;
  const readOnly = !canEdit;

  const loadDetail = useCallback(async () => {
    if (!returnId) return;
    setLoading(true);
    try {
      const data = (await apiService.get(
        `/stock-returns/warehouse-executive/${returnId}`,
      )) as StockReturnDetail;
      const normalized: StockReturnDetail = {
        ...data,
        status: resolveReturnStatus(data),
      };
      setDetail(normalized);
      const dc =
        data.dcOrderId && typeof data.dcOrderId === 'object' ? data.dcOrderId : null;

      setSchoolName(dc?.school_name || data.customerName || '');
      setSchoolCode(data.schoolCode || dc?.school_code || '');
      setContactPerson(data.contactPerson || dc?.contact_person || '');
      setContactMobile(data.contactMobile || dc?.contact_mobile || '');
      setTown(data.town || dc?.city || dc?.area || dc?.location || '');
      setAddress(data.address || dc?.address || '');
      setZone(data.zone || dc?.zone || '');
      setCluster(data.cluster || dc?.cluster_code || '');
      setMoreRemarks(data.remarks || '');

      setReturnDate(toDateInput(data.returnDate));
      setWhReturnRemarks(data.whReturnRemarks || '');
      setLrDate(toDateInput(data.lrDate || data.returnDate));
      setTransport(
        data.transport || dc?.transport_name || dc?.transport_location || '',
      );
      setLrNumber(data.lrNumber || '');

      const rows: ProductLine[] = (data.products || []).map((p, idx) => {
        // Blind count: start empty unless this line was already verified.
        const received = Number(p.receivedQty);
        const verified = Boolean(String(p.condition || '').trim()) || (Number.isFinite(received) && received > 0);
        const qty = verified && Number.isFinite(received) ? received : 0;
        return {
          id: `line-${idx}`,
          productRaw: (p.product || '').trim(),
          productLabel: (p.product || '').trim() || '—',
          class: p.class || '',
          productCategory: p.productCategory || '',
          level: p.level || '',
          subject: p.subject || '',
          specs: p.specs || '',
          soldQty: p.soldQty,
          qty,
          qtyText: verified ? String(qty) : '',
          reason: p.reason || '',
          remarks: p.remarks || '',
          condition: p.condition || '',
          batchLot: p.batchLot || '',
          storageLocation: p.storageLocation || '',
          mismatchRemark: p.mismatchRemark || '',
        };
      });
      setLines(rows);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load return', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [returnId, navigation]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const buildPayload = () => ({
    returnDate: returnDate || undefined,
    lrNumber,
    lrDate: lrDate || undefined,
    remarks: moreRemarks,
    whReturnRemarks,
    transport,
    town,
    address,
    zone,
    cluster,
    contactPerson,
    contactMobile,
    schoolCode,
    products: lines.map((l) => ({
      product: l.productRaw || l.productLabel,
      soldQty: l.soldQty,
      reason: l.reason || undefined,
      remarks: l.remarks,
      receivedQty: l.qty,
      condition: l.condition,
      batchLot: l.batchLot,
      storageLocation: l.storageLocation,
      class: l.class,
      productCategory: l.productCategory,
      level: l.level,
      subject: l.subject,
      mismatchRemark: (l.mismatchRemark || '').trim(),
    })),
    totalReceivedQty: lines.reduce((sum, l) => sum + (l.qty || 0), 0),
  });

  const updateLineQty = (lineId: string, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId ? { ...l, qtyText: cleaned, qty: cleaned === '' ? 0 : Number(cleaned) } : l,
      ),
    );
  };

  const updateLineBatch = (lineId: string, batchLot: string) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, batchLot } : l)));
  };

  const handlePrint = () => {
    if (!detail) return;
    const dc = detail.dcOrderId && typeof detail.dcOrderId === 'object' ? detail.dcOrderId : null;
    printReturnSlip(
      {
        returnId: detail.returnId,
        saleId: detail.saleId,
        returnType: detail.returnType,
        status: returnStatus,
        executiveName: detail.executiveName,
        customerName: schoolName || dc?.school_name,
        schoolCode,
        returnDate: returnDate || detail.returnDate,
        lrNumber,
        transport,
        products: lines.map((l) => ({
          product: l.productRaw || l.productLabel,
          class: l.class,
          productCategory: l.productCategory,
          level: l.level,
          subject: l.subject,
          specs: l.specs,
          receivedQty: l.qty,
          condition: l.condition,
        })),
      },
      { showReceived: true, hideReturnQty: true },
    ).catch((e: any) => Alert.alert('Print', e?.message || 'Could not create the return slip'));
  };

  const updateLineCondition = (lineId: string, condition: string) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, condition } : l)));
  };

  const updateMismatchRemark = (lineId: string, mismatchRemark: string) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, mismatchRemark } : l)));
  };

  const handleSave = async () => {
    if (!detail || readOnly) return;
    const mobileError = phoneDigitsError(contactMobile, false);
    if (mobileError) {
      Alert.alert('Validation', mobileError);
      return;
    }
    setSaving(true);
    try {
      await apiService.put(`/stock-returns/${detail._id}/warehouse-save`, buildPayload());
      Alert.alert('Saved', 'Return update saved');
      await loadDetail();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitToAdmin = async () => {
    if (!detail || readOnly) return;
    if (!returnDate) {
      Alert.alert('Validation', 'Return date is required');
      return;
    }
    const mobileError = phoneDigitsError(contactMobile, false);
    if (mobileError) {
      Alert.alert('Validation', mobileError);
      return;
    }
    if (!lrNumber.trim()) {
      Alert.alert('Validation', 'Enter LR No from the delivery partner lorry receipt');
      return;
    }
    if (!lrDate) {
      Alert.alert('Validation', 'LR Date is required');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('Validation', 'No products on this return');
      return;
    }
    // 0 is a valid count (nothing arrived); only an empty / invalid entry is rejected.
    const missingQty = lines.find((l) => l.qtyText.trim() === '' || !Number.isFinite(l.qty) || l.qty < 0);
    if (missingQty) {
      Alert.alert(
        'Validation',
        `Please enter a valid received quantity for ${missingQty.productLabel || missingQty.productRaw || 'each product'}`,
      );
      return;
    }
    const missingCondition = lines.find((l) => !l.condition);
    if (missingCondition) {
      Alert.alert('Validation', `Select product condition for ${missingCondition.productLabel || 'each product'}`);
      return;
    }

    setSubmitting(true);
    try {
      await apiService.put(`/stock-returns/${detail._id}/warehouse-verify`, buildPayload());
      Alert.alert('Submitted', 'Submitted to Warehouse Manager', [
        { text: 'OK', onPress: () => navigation.navigate('ReturnsWarehouseExecutive') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !detail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading return…</Text>
      </View>
    );
  }

  return (
    <ScreenShell
      title="Stock Return Update"
      subtitle={`Return No. ${detail.returnNumber ?? detail.returnId}${
        readOnly ? ` (${returnStatus} — view only)` : ''
      }`}
      loading={false}
      noScroll
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>School Information</Text>
          <WebLabel>School Name</WebLabel>
          <WebInput value={schoolName} editable={false} style={styles.readonly} />
          <WebLabel>School Code</WebLabel>
          <WebInput
            value={schoolCode}
            onChangeText={setSchoolCode}
            editable={!readOnly}
            style={readOnly ? styles.readonly : undefined}
          />
          <WebLabel>Contact Person Name</WebLabel>
          <WebInput
            value={contactPerson}
            onChangeText={setContactPerson}
            editable={!readOnly}
            style={readOnly ? styles.readonly : undefined}
          />
          <WebLabel>Contact Mobile</WebLabel>
          <WebInput
            value={contactMobile}
            onChangeText={(text) => setContactMobile(sanitizePhoneDigits(text))}
            editable={!readOnly}
            keyboardType="phone-pad"
            maxLength={15}
            placeholder="10 to 15 digits"
            style={readOnly ? styles.readonly : undefined}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>More Information</Text>
          <WebLabel>Town</WebLabel>
          <WebInput
            value={town}
            onChangeText={setTown}
            placeholder="Town"
            editable={!readOnly}
            style={readOnly ? styles.readonly : undefined}
          />
          <WebLabel>Address</WebLabel>
          <WebInput
            value={address}
            onChangeText={setAddress}
            placeholder="Address"
            multiline
            numberOfLines={3}
            editable={!readOnly}
            style={[styles.textArea, readOnly ? styles.readonly : null]}
          />
          <WebLabel>Zone</WebLabel>
          <WebInput
            value={zone}
            onChangeText={setZone}
            editable={!readOnly}
            style={readOnly ? styles.readonly : undefined}
          />
          <WebLabel>Cluster</WebLabel>
          <WebInput
            value={cluster}
            onChangeText={setCluster}
            editable={!readOnly}
            style={readOnly ? styles.readonly : undefined}
          />
          <WebLabel>Remarks</WebLabel>
          <WebInput
            value={moreRemarks}
            onChangeText={setMoreRemarks}
            placeholder="Remarks"
            multiline
            numberOfLines={2}
            editable={!readOnly}
            style={[styles.textArea, readOnly ? styles.readonly : null]}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stock Return Information Update</Text>

          {readOnly ? (
            <View style={styles.readOnlyBanner}>
              <Text style={styles.readOnlyBannerText}>
                This return is already {returnStatus}. Open a return with status Submitted to
                enter received quantity, LR details, and submit to the manager.
              </Text>
            </View>
          ) : null}

          <WebLabel>Return Date</WebLabel>
          <DateField placeholder="Return Date" value={returnDate} onChange={setReturnDate} />
          <WebLabel>LR Date</WebLabel>
          <DateField placeholder="LR Date" value={lrDate} onChange={setLrDate} />
          <WebLabel>LR No *</WebLabel>
          <WebInput
            value={lrNumber}
            onChangeText={setLrNumber}
            placeholder="From delivery partner lorry receipt"
            editable={!readOnly}
            style={readOnly ? styles.readonly : undefined}
          />
          {!readOnly ? (
            <Text style={styles.helpText}>
              Enter the lorry receipt number from the delivery partner when goods arrive.
            </Text>
          ) : null}
          <WebLabel>Transport</WebLabel>
          <WebInput
            value={transport}
            onChangeText={setTransport}
            editable={!readOnly}
            style={readOnly ? styles.readonly : undefined}
          />
          <WebLabel>WH Return Remarks</WebLabel>
          <WebInput
            value={whReturnRemarks}
            onChangeText={setWhReturnRemarks}
            multiline
            numberOfLines={3}
            editable={!readOnly}
            style={[styles.textArea, readOnly ? styles.readonly : null]}
          />

          <Text style={styles.instruction}>
            Enter Received Qty — the actual quantity counted when stock arrives at the warehouse.
          </Text>

          {lines.length === 0 ? (
            <Text style={styles.emptyProducts}>No products on this return.</Text>
          ) : (
            <View style={styles.productList}>
              {lines.map((line) => (
                <View key={line.id} style={styles.productCard}>
                  <Text style={styles.productName}>{line.productLabel || line.productRaw || '—'}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>Class: {line.class || '-'}</Text>
                    <Text style={styles.metaText}>Series: {line.productCategory || '-'}</Text>
                    {line.level ? <Text style={styles.metaText}>Level: {line.level}</Text> : null}
                  </View>
                  <Text style={[styles.metaText, { marginBottom: 8 }]}>Deliverables: {line.subject || line.specs || '-'}</Text>
                  <View style={styles.productFields}>
                    <View style={styles.receivedField}>
                      <Text style={styles.fieldLabel}>Received Qty *</Text>
                      <WebInput
                        value={canEdit ? line.qtyText : String(line.qty)}
                        onChangeText={(v) => updateLineQty(line.id, v)}
                        keyboardType="number-pad"
                        placeholder={canEdit ? 'Enter count' : ''}
                        editable={canEdit}
                        style={canEdit ? styles.qtyInput : styles.readonly}
                      />
                    </View>
                    <View style={styles.conditionField}>
                      <Text style={styles.fieldLabel}>Product Condition *</Text>
                    <WebSelect
                      value={line.condition}
                      onValueChange={(value) => updateLineCondition(line.id, value)}
                      placeholder="Select condition"
                      disabled={!canEdit}
                      compact
                      items={CONDITION_OPTIONS.map((c) => ({ label: c, value: c }))}
                    />
                  </View>
                  </View>
                  <Text style={styles.fieldLabel}>Batch / Lot</Text>
                  <WebInput
                    value={line.batchLot}
                    onChangeText={(v) => updateLineBatch(line.id, v)}
                    placeholder="Batch/Lot number"
                    editable={canEdit}
                    style={canEdit ? undefined : styles.readonly}
                  />
                  <Text style={styles.fieldLabel}>Remark</Text>
                  <WebInput
                    value={line.mismatchRemark}
                    onChangeText={(v) => updateMismatchRemark(line.id, v)}
                    placeholder="Optional remark"
                    multiline
                    editable={canEdit}
                    style={canEdit ? undefined : styles.readonly}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <WebButton title="Print Return Slip" variant="outline" onPress={handlePrint} />
          <WebButton
            title="Back to list"
            variant="outline"
            onPress={() => navigation.navigate('ReturnsWarehouseExecutive')}
          />
          {!readOnly ? (
            <>
              <WebButton
                title={saving ? 'Saving…' : 'Save'}
                variant="outline"
                onPress={handleSave}
                disabled={saving || submitting}
                loading={saving}
              />
              <WebButton
                title={submitting ? 'Submitting…' : 'Submit to Warehouse Manager'}
                onPress={handleSubmitToAdmin}
                disabled={saving || submitting}
                loading={submitting}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 6,
  },
  sectionTitle: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  readonly: {
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  readOnlyBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  readOnlyBannerText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  helpText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -2,
    marginBottom: 6,
  },
  instruction: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 8,
  },
  emptyProducts: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: 16,
  },
  productList: { gap: 10 },
  productCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, backgroundColor: '#F8FAFC' },
  productName: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '700', marginBottom: 10 },
  productFields: { flexDirection: 'row', gap: 10 },
  receivedField: { width: '34%' },
  conditionField: { flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 2 },
  metaText: { fontSize: 12, color: colors.textSecondary },
  fieldLabel: { ...typography.label.small, color: colors.textSecondary, marginBottom: 5 },
  qtyInput: {
    borderColor: '#059669',
    backgroundColor: '#FFFFFF',
  },
  footer: {
    gap: 10,
    marginTop: 4,
  },
});

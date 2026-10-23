import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { inr, nameOf, statusColors } from './paymentHelpers';

/**
 * Shared review screen for web
 * - app/dashboard/payments/approval-pending-cash/[id]  (PUT /payments/:id/approve, Approve/Hold/Reject/Update)
 * - app/dashboard/payments/approval-pending-cheques/[id] (PUT /payments/:id {referenceNumber, description, status})
 */
export default function PaymentApprovalDetail({ kind, navigation, route }: { kind: 'cash' | 'cheque'; navigation: any; route: any }) {
  const id = route?.params?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState('Pending');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const p = await apiService.get(`/payments/${id}`);
        setData(p);
        setReferenceNumber(p?.referenceNumber || p?.refNo || '');
        if (kind === 'cheque') {
          setRemarks(p?.description || '');
          setStatus(p?.status === 'hold/duplicate' ? 'Hold' : p?.status || 'Pending');
        } else {
          setRemarks(p?.adminRemarks || p?.rejectionReason || '');
          const opts = ['Pending', 'Approved', 'Hold', 'Rejected'].filter((s) => s !== (p?.status || 'Pending'));
          setStatus(opts[0]);
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to load payment');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [id, kind, navigation]);

  const submitCash = async (statusToSet?: string) => {
    const s = statusToSet || status;
    if (!remarks.trim() && (s === 'Hold' || s === 'Rejected')) {
      Alert.alert('Error', 'Please add remarks for Hold or Reject actions');
      return;
    }
    setSaving(true);
    try {
      await apiService.put(`/payments/${id}/approve`, {
        status: s,
        adminRemarks: remarks || undefined,
        rejectionReason: s === 'Rejected' ? remarks : undefined,
        referenceNumber: referenceNumber || undefined,
      });
      Alert.alert('Success', `Payment ${s.toLowerCase()} successfully`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update payment');
    } finally {
      setSaving(false);
    }
  };

  const submitCheque = async () => {
    if ((status === 'Hold' || status === 'Rejected') && !remarks.trim()) {
      Alert.alert('Error', `Enter remarks explaining why the payment is ${status === 'Hold' ? 'on hold' : 'rejected'}`);
      return;
    }
    setSaving(true);
    try {
      await apiService.put(`/payments/${id}`, { referenceNumber, description: remarks, status });
      Alert.alert('Success', 'Payment updated successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update payment');
    } finally {
      setSaving(false);
    }
  };

  const d = data || {};
  const sc = statusColors(d.status);
  const fmt = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN') : '-');
  const fmtTs = (v?: string) => (v ? new Date(v).toLocaleString() : '');
  const prevAdmin = d.adminRemarks || d.rejectionReason;
  const statusOptions =
    kind === 'cheque'
      ? ['Pending', 'Hold', 'Rejected', 'Approved']
      : ['Pending', 'Approved', 'Hold', 'Rejected'].filter((s) => s !== (d.status || 'Pending'));

  return (
    <ScreenShell title={kind === 'cheque' ? 'Cheque Payment Update' : 'Payment Review & Approval'} loading={loading}>
      {data ? (
        <>
          <PageSection title="School Information">
            <Row label="School Type" value="Existing" />
            <Row label="School Name" value={d.customerName} />
            <Row label="School Code" value={d.schoolCode} />
            <Row label="Contact Person" value={d.contactName} />
            <Row label="Contact Mobile" value={d.mobileNumber} />
          </PageSection>

          <PageSection title="More Information">
            <Row label="Town" value={d.town} />
            <Row label="Address" value={d.location} />
            <Row label="Zone" value={nameOf(d.zone)} />
            <Row label="Cluster" value={nameOf(d.cluster)} />
            <Row label="Remarks" value={d.description} />
          </PageSection>

          <PageSection title="Payment Information">
            <Row label="BDE" value={d.createdBy?.name} />
            <Row label="Payment Mode" value={d.paymentMethod} />
            <Row label="Amount" value={inr(d.amount)} />
            <Row label="Payment Date" value={fmt(d.paymentDate)} />
            <Row label="Financial Year" value={d.financialYear} />
            {d.paymentMethod === 'Cheque' ? (
              <>
                <Row label="Cheque Number" value={d.chequeNumber} />
                <Row label="Cheque Date" value={fmt(d.chqDate)} />
                <Row label="Cheque Bank" value={d.bankName} />
                <Row label="Deposited Bank" value={d.depositedBank} />
                <Row label="Deposited Bank Branch" value={d.depositedBankBranch} />
              </>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Current Status</Text>
              <Text style={[styles.rowValue, { color: sc.fg, fontWeight: '700' }]}>{d.status || 'Pending'}</Text>
            </View>
            {d.approvedBy ? <Row label="Approved By" value={`${d.approvedBy.name || ''} ${fmtTs(d.approvedAt)}`} /> : null}
            {d.heldBy ? <Row label="Held By" value={`${d.heldBy.name || ''} ${fmtTs(d.heldAt)}`} /> : null}
            {d.rejectedBy ? <Row label="Rejected By" value={`${d.rejectedBy.name || ''} ${fmtTs(d.rejectedAt)}`} /> : null}
            <Row label="BDE Remarks" value={d.description} />
            {prevAdmin ? (
              <View style={styles.prevBox}>
                <Text style={styles.prevLabel}>Previous Admin Remarks</Text>
                <Text style={styles.prevText}>{prevAdmin}</Text>
              </View>
            ) : null}
          </PageSection>

          <PageSection title="Update">
            <Text style={styles.label}>Reference No *</Text>
            <WebInput value={referenceNumber} onChangeText={setReferenceNumber} placeholder="Enter reference number" />
            <WebSelect
              label={kind === 'cheque' ? 'Status *' : 'New Status'}
              value={status}
              onValueChange={(v) => v && setStatus(v)}
              items={statusOptions.map((s) => ({ label: s, value: s }))}
            />
            <Text style={styles.label}>{kind === 'cheque' ? 'Remarks *' : 'Admin Remarks'}</Text>
            <WebInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder={
                kind === 'cheque' ? 'Enter remarks' : 'Enter remarks for your action (required for Hold/Reject, optional for Approve)'
              }
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
            {kind === 'cash' ? <Text style={styles.hint}>Remarks are required when holding or rejecting a payment.</Text> : null}

            {kind === 'cash' ? (
              <View style={styles.btns}>
                <WebButton title={saving ? 'Processing...' : 'Approve'} onPress={() => submitCash('Approved')} disabled={saving} />
                <WebButton title={saving ? 'Processing...' : 'Hold'} variant="outline" onPress={() => submitCash('Hold')} disabled={saving} />
                <WebButton title={saving ? 'Processing...' : 'Reject'} variant="destructive" onPress={() => submitCash('Rejected')} disabled={saving} />
                <WebButton title={saving ? 'Processing...' : 'Update Status'} variant="outline" onPress={() => submitCash()} disabled={saving} />
              </View>
            ) : (
              <View style={styles.btns}>
                <WebButton title={saving ? 'Updating...' : 'Update'} onPress={submitCheque} disabled={saving} />
              </View>
            )}
          </PageSection>
        </>
      ) : null}
    </ScreenShell>
  );
}

function Row({ label, value }: { label: string; value?: any }) {
  const v = value === undefined || value === null || String(value).trim() === '' ? '-' : String(value);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { width: 140, fontSize: 13, color: colors.textSecondary },
  rowValue: { flex: 1, fontSize: 14, color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.textTertiary, marginTop: -6, marginBottom: 10 },
  btns: { gap: 8, marginTop: 8 },
  prevBox: { backgroundColor: colors.warningLight, borderRadius: 8, padding: 10, marginTop: 8 },
  prevLabel: { fontSize: 12, fontWeight: '700', color: colors.warning, marginBottom: 2 },
  prevText: { fontSize: 13, color: colors.textPrimary },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { printReturnSlip } from '../../lib/returnSlip';

type ProductLine = {
  id: string;
  product: string;
  productName: string;
  class: string;
  productCategory: string;
  level: string;
  subject: string;
  specs: string;
  soldQty: number;
  fieldExecQty: number;
  warehouseExecQty: number;
  condition: string;
  reason: string;
  mismatchRemark: string;
  managerDecision: string;
  approvedQty: number;
  stockBucket: string;
  managerRemark: string;
};

type ReturnDetail = {
  _id: string;
  returnId?: string;
  returnNumber?: number;
  status?: string;
  executiveName?: string;
  customerName?: string;
  schoolCode?: string;
  returnDate?: string;
  lrNumber?: string;
  finYear?: string;
  remarks?: string;
  executiveRemarks?: string;
  whReturnRemarks?: string;
  verifiedBy?: { name?: string };
  approvedBy?: { name?: string };
  managerRemarks?: string;
  rejectionReason?: string;
  approvedAt?: string;
  returnType?: string;
  saleId?: string;
  transport?: string;
  dcOrderId?: { school_name?: string; school_code?: string };
  products?: Array<{
    product: string;
    class?: string;
    productCategory?: string;
    subject?: string;
    specs?: string;
    level?: string;
    soldQty: number;
    returnQty: number;
    receivedQty?: number;
    condition?: string;
    reason?: string;
    mismatchRemark?: string;
    quantityMismatch?: boolean;
    managerDecision?: string;
    approvedQty?: number;
    stockBucket?: string;
    managerRemark?: string;
  }>;
};

const DECISION_OPTIONS = ['Approve', 'Partial Approve', 'Reject', 'Send Back'];
/** Same buckets as web app/dashboard/returns/warehouse-manager/page.tsx */
const STOCK_BUCKETS = ['Sellable', 'Marked by students', 'Wrong Print', 'Damaged', 'Expired', 'QC / Hold'];
/** Warehouse conditions that map 1:1 onto a stock bucket (used as the default bucket). */
const CONDITION_BUCKETS = ['Sellable', 'Marked by students', 'Wrong Print', 'Damaged', 'Expired'];

/** The Warehouse Executive's "submit to manager" sets WAREHOUSE_MANAGER_PENDING. */
function canDecide(status?: string) {
  return status === 'WAREHOUSE_MANAGER_PENDING' || status === 'Received' || status === 'Pending Manager Approval';
}

function statusLabel(status?: string) {
  return status === 'WAREHOUSE_MANAGER_PENDING' ? 'Pending Manager Approval' : status || '—';
}

function qtyDiff(field: number, wh: number) {
  if (field === wh) return null;
  return wh - field;
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPair}>
      <Text style={styles.infoPairLabel}>{label}</Text>
      <Text style={styles.infoPairValue}>{value}</Text>
    </View>
  );
}

export default function StockReturnWarehouseManagerReviewScreen({ navigation, route }: any) {
  const returnId = route?.params?.returnId as string;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [detail, setDetail] = useState<ReturnDetail | null>(null);
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [managerRemarks, setManagerRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const readOnly = detail ? !canDecide(detail.status) : true;

  const loadDetail = useCallback(async () => {
    if (!returnId) return;
    setLoading(true);
    try {
      const data = (await apiService.get(
        `/stock-returns/warehouse-manager/${returnId}`,
      )) as ReturnDetail;
      setDetail(data);
      setManagerRemarks(data.managerRemarks || '');
      setRejectionReason(data.rejectionReason || '');
      setLines(
        (data.products || []).map((p, idx) => ({
          id: `line-${idx}`,
          product: p.product || '',
          productName: p.level || '',
          class: p.class || '',
          productCategory: p.productCategory || '',
          level: p.level || '',
          subject: p.subject || '',
          specs: p.specs || '',
          soldQty: Number(p.soldQty) || 0,
          fieldExecQty: Number(p.returnQty) || 0,
          warehouseExecQty: Number(p.receivedQty) || 0,
          condition: p.condition || '',
          reason: p.reason || '',
          mismatchRemark: p.mismatchRemark || '',
          managerDecision: p.managerDecision || '',
          approvedQty: Number(p.approvedQty) || 0,
          stockBucket:
            p.stockBucket ||
            (CONDITION_BUCKETS.includes(String(p.condition || '')) ? String(p.condition) : ''),
          managerRemark: p.managerRemark || '',
        })),
      );
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

  const updateLine = (lineId: string, patch: Partial<ProductLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next = { ...l, ...patch };
        if (patch.managerDecision === 'Approve') {
          next.approvedQty = next.warehouseExecQty;
        }
        if (patch.managerDecision === 'Reject' || patch.managerDecision === 'Send Back') {
          next.approvedQty = 0;
          next.stockBucket = '';
        }
        if (patch.approvedQty != null && next.approvedQty > next.warehouseExecQty) {
          Alert.alert('Validation', 'Approved qty cannot exceed warehouse received qty');
          return l;
        }
        return next;
      }),
    );
  };

  const validateLines = (): boolean => {
    const withDecision = lines.filter((l) => l.managerDecision);
    if (withDecision.length === 0) {
      Alert.alert('Validation', 'Set a decision for at least one product line');
      return false;
    }
    for (const l of withDecision) {
      if (l.managerDecision === 'Approve' || l.managerDecision === 'Partial Approve') {
        if (l.approvedQty <= 0) {
          Alert.alert('Validation', `Approved qty required for ${l.product}`);
          return false;
        }
        if (!l.stockBucket) {
          Alert.alert('Validation', `Stock bucket required for ${l.product}`);
          return false;
        }
        if (
          !l.managerRemark.trim() &&
          (l.managerDecision === 'Partial Approve' || l.approvedQty !== l.warehouseExecQty)
        ) {
          Alert.alert('Validation', `Reason is required for ${l.product} (partial approval or quantity override)`);
          return false;
        }
      }
      if (
        (l.managerDecision === 'Reject' || l.managerDecision === 'Send Back') &&
        !l.managerRemark.trim()
      ) {
        Alert.alert('Validation', `Remark required for ${l.product}`);
        return false;
      }
    }
    return true;
  };

  const buildProductPayload = () =>
    lines.map((l) => ({
      product: l.product,
      managerDecision: l.managerDecision,
      approvedQty: l.approvedQty,
      stockBucket: l.stockBucket,
      managerRemark: l.managerRemark,
    }));

  const runAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!detail) return;
    setProcessing(true);
    try {
      // Same payload shapes as web: reject sends no lines, send back only line remarks.
      const products =
        action === 'reject'
          ? undefined
          : action === 'send_back'
            ? lines.map((l) => ({ product: l.product, managerRemark: l.managerRemark }))
            : buildProductPayload();
      await apiService.put(`/stock-returns/${detail._id}/manager-action`, {
        action,
        ...(products ? { products } : {}),
        managerRemarks,
        ...extra,
      });
      const hasPartialApproval = lines.some((line) => line.managerDecision === 'Partial Approve');
      const message =
        action === 'approve'
          ? `Return ${hasPartialApproval ? 'partially approved' : 'approved'} successfully. Stock has been updated for the approved quantities.`
          : action === 'reject'
            ? 'Return rejected'
            : 'Return sent back to warehouse executive';
      Alert.alert(action === 'approve' ? 'Success' : 'Done', message, [
        { text: 'OK', onPress: () => navigation.navigate('ReturnsWarehouseManager') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = () => {
    if (!validateLines()) return;
    runAction('approve');
  };

  const handleRejectAll = () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Validation', 'Enter rejection reason');
      return;
    }
    runAction('reject', { rejectionReason });
  };

  const handleSendBack = () => {
    if (!validateLines()) return;
    runAction('send_back');
  };

  const mismatchCount = useMemo(
    () => lines.filter((l) => qtyDiff(l.fieldExecQty, l.warehouseExecQty) !== null).length,
    [lines],
  );

  if (loading || !detail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading return review…</Text>
      </View>
    );
  }

  const schoolName =
    (detail.dcOrderId && typeof detail.dcOrderId === 'object'
      ? detail.dcOrderId.school_name
      : null) ||
    detail.customerName ||
    '-';
  const schoolCode =
    detail.schoolCode ||
    (detail.dcOrderId && typeof detail.dcOrderId === 'object'
      ? detail.dcOrderId.school_code
      : null) ||
    '—';

  return (
    <ScreenShell
      title="Return Review"
      subtitle={`Return No. ${detail.returnNumber ?? detail.returnId} · ${schoolName}${
        readOnly ? ` (${statusLabel(detail.status)} — view only)` : ''
      }`}
      loading={false}
      noScroll
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.rolesLine}>
          Field Executive: {detail.executiveName || '—'} · Warehouse Executive:{' '}
          {detail.verifiedBy?.name || '—'}
        </Text>

        {mismatchCount > 0 ? (
          <View style={styles.mismatchBanner}>
            <Ionicons name="warning-outline" size={18} color="#92400E" />
            <Text style={styles.mismatchBannerText}>
              {mismatchCount} line(s) have different Field Executive vs Warehouse Executive
              quantities. Review carefully before approving.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Return summary</Text>
          <View style={styles.summaryGrid}>
            <InfoPair label="School" value={schoolName} />
            <InfoPair label="School code" value={schoolCode} />
            <InfoPair label="LR No" value={detail.lrNumber || '—'} />
            <InfoPair label="Status" value={statusLabel(detail.status)} />
          </View>
          {detail.executiveRemarks ? (
            <InfoPair label="Field exec remarks" value={detail.executiveRemarks} />
          ) : null}
          {detail.whReturnRemarks ? (
            <InfoPair label="Warehouse exec remarks" value={detail.whReturnRemarks} />
          ) : null}
          {detail.remarks ? (
            <InfoPair label="Return remarks" value={detail.remarks} />
          ) : null}
          {detail.managerRemarks ? (
            <InfoPair label="Manager remarks" value={detail.managerRemarks} />
          ) : null}
          {detail.rejectionReason ? (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionLabel}>Rejection reason</Text>
              <Text style={styles.rejectionValue}>{detail.rejectionReason}</Text>
            </View>
          ) : null}
          {detail.approvedBy?.name ? (
            <Text style={styles.processedBy}>
              Processed by {detail.approvedBy.name}
              {detail.approvedAt
                ? ` on ${new Date(detail.approvedAt).toLocaleString()}`
                : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Compare quantities — Field Executive vs Warehouse Executive
          </Text>
          <Text style={styles.hint}>
            Approve full or partial per line, or reject individual lines. Use Reject entire return
            to reject all.
          </Text>

          {lines.length === 0 ? (
            <Text style={styles.emptyText}>No product lines</Text>
          ) : (
            lines.map((line) => {
              const diff = qtyDiff(line.fieldExecQty, line.warehouseExecQty);
              const mismatch = diff !== null && diff !== 0;
              const decisionLocked =
                readOnly ||
                line.managerDecision === 'Reject' ||
                line.managerDecision === 'Send Back';
              return (
                <View
                  key={line.id}
                  style={[styles.lineCard, mismatch && styles.lineCardMismatch]}
                >
                  <Text style={styles.lineProduct}>{line.product || '—'}</Text>
                  <Text style={styles.lineMeta}>
                    {[line.class ? `Class ${line.class}` : '', line.productCategory, line.level, line.subject || line.specs]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Text>
                  <InfoPair label="Sold" value={String(line.soldQty)} />

                  <View style={styles.groupBlue}>
                    <Text style={styles.groupTitle}>Field Executive</Text>
                    <InfoPair label="Return Qty" value={String(line.fieldExecQty)} />
                    <InfoPair label="Reason" value={line.reason || '—'} />
                  </View>

                  <View style={styles.groupOrange}>
                    <Text style={styles.groupTitle}>Warehouse Executive</Text>
                    <InfoPair label="Received Qty" value={String(line.warehouseExecQty)} />
                    <InfoPair label="Condition" value={line.condition || '—'} />
                    <InfoPair
                      label="Diff"
                      value={diff === null ? '—' : diff > 0 ? `+${diff}` : String(diff)}
                    />
                  </View>

                  <View style={styles.groupGreen}>
                    <Text style={styles.groupTitle}>Manager decision</Text>
                    <WebLabel>Decision</WebLabel>
                    <WebSelect
                      placeholder="Decision"
                      value={line.managerDecision}
                      onValueChange={(v) => updateLine(line.id, { managerDecision: v })}
                      items={DECISION_OPTIONS.map((d) => ({ label: d, value: d }))}
                      disabled={readOnly}
                    />
                    <WebLabel>Approved Qty</WebLabel>
                    <WebInput
                      value={String(line.approvedQty || 0)}
                      onChangeText={(v) => {
                        const cleaned = v.replace(/\D/g, '');
                        updateLine(line.id, {
                          approvedQty: cleaned === '' ? 0 : Number(cleaned),
                        });
                      }}
                      keyboardType="number-pad"
                      editable={
                        !readOnly &&
                        !!line.managerDecision &&
                        line.managerDecision !== 'Reject' &&
                        line.managerDecision !== 'Send Back'
                      }
                      style={
                        decisionLocked || !line.managerDecision
                          ? styles.readonly
                          : undefined
                      }
                    />
                    <WebLabel>Bucket</WebLabel>
                    <WebSelect
                      placeholder="Bucket"
                      value={line.stockBucket}
                      onValueChange={(v) => updateLine(line.id, { stockBucket: v })}
                      items={STOCK_BUCKETS.map((b) => ({ label: b, value: b }))}
                      disabled={decisionLocked}
                    />
                    <WebLabel>Remark</WebLabel>
                    <WebInput
                      value={line.managerRemark}
                      onChangeText={(v) => updateLine(line.id, { managerRemark: v })}
                      placeholder="Remark"
                      editable={!readOnly}
                      style={readOnly ? styles.readonly : undefined}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <WebLabel>Manager remarks</WebLabel>
          <WebInput
            value={managerRemarks}
            onChangeText={setManagerRemarks}
            multiline
            numberOfLines={3}
            editable={!readOnly}
            style={[styles.textArea, readOnly ? styles.readonly : null]}
          />

          {readOnly && detail.rejectionReason ? (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionLabel}>Rejection reason</Text>
              <Text style={styles.rejectionValue}>{detail.rejectionReason}</Text>
            </View>
          ) : !readOnly ? (
            <>
              <WebLabel>Rejection reason (for reject entire return)</WebLabel>
              <WebInput
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                numberOfLines={3}
                placeholder="Required only when rejecting the full return"
                style={styles.textArea}
              />
            </>
          ) : null}
        </View>

        <View style={styles.footer}>
          <WebButton
            title="Print Return Slip"
            variant="outline"
            onPress={() =>
              printReturnSlip(
                {
                  returnId: detail.returnId,
                  saleId: detail.saleId,
                  returnType: detail.returnType,
                  status: statusLabel(detail.status),
                  executiveName: detail.executiveName,
                  customerName: schoolName,
                  schoolCode,
                  returnDate: detail.returnDate,
                  lrNumber: detail.lrNumber,
                  transport: detail.transport,
                  products: lines.map((l) => ({
                    product: l.product,
                    class: l.class,
                    productCategory: l.productCategory,
                    level: l.level,
                    subject: l.subject,
                    specs: l.specs,
                    returnQty: l.fieldExecQty,
                    receivedQty: l.warehouseExecQty,
                    condition: l.condition,
                    reason: l.reason,
                  })),
                },
                { showReceived: true },
              ).catch((e: any) => Alert.alert('Print', e?.message || 'Could not create the return slip'))
            }
          />
          <WebButton
            title="Back to list"
            variant="outline"
            onPress={() => navigation.navigate('ReturnsWarehouseManager')}
          />
          {!readOnly ? (
            <>
              <WebButton
                title="Send back to WH Exec"
                variant="outline"
                onPress={handleSendBack}
                disabled={processing}
              />
              <WebButton
                title="Reject entire return"
                variant="destructive"
                onPress={handleRejectAll}
                disabled={processing}
              />
              <WebButton
                title={processing ? 'Processing…' : 'Approve (full / partial)'}
                onPress={handleApprove}
                disabled={processing}
                loading={processing}
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
  rolesLine: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  mismatchBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  mismatchBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  summaryGrid: {
    gap: 8,
  },
  infoPair: {
    marginBottom: 4,
  },
  infoPairLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoPairValue: {
    ...typography.body.medium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  rejectionBox: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
  },
  rejectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  rejectionValue: {
    marginTop: 4,
    fontSize: 13,
    color: '#7F1D1D',
  },
  processedBy: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: 16,
  },
  lineCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  lineMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  lineCardMismatch: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  lineProduct: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  groupBlue: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  groupOrange: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  groupGreen: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    gap: 4,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  readonly: {
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    gap: 10,
    marginTop: 4,
  },
});

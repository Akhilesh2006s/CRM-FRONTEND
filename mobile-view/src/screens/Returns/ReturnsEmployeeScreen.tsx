/**
 * Employee Returns List — admin view of all executive stock returns.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import { printReturnSlip } from '../../lib/returnSlip';

function printSlip(ret: any) {
  printReturnSlip({
    ...ret,
    saleId: ret.saleId || ret.dcOrderId?.dc_code || '',
    customerName: ret.customerName || ret.dcOrderId?.school_name || '',
  }).catch((e: any) => Alert.alert('Print', e?.message || 'Could not create the return slip'));
}

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-US');
  } catch {
    return '-';
  }
}

function formatCreated(dateString?: string) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString('en-US');
  } catch {
    return '-';
  }
}

function cell(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function getLeadName(ret: any) {
  return ret.leadId?.school_name || ret.dcOrderId?.school_name || ret.customerName || '-';
}

function getExecutiveName(ret: any) {
  return ret.executiveName || ret.createdBy?.name || '-';
}

function getManagerText(ret: any) {
  if (ret.rejectionReason) return { text: `Rejected: ${ret.rejectionReason}`, rejected: true };
  if (ret.managerRemarks) return { text: ret.managerRemarks, rejected: false };
  return { text: '-', rejected: false };
}

function showError(message: string, setBanner: (v: any) => void) {
  if (Platform.OS === 'web') {
    setBanner({ type: 'error', message });
  } else {
    Alert.alert('Error', message);
  }
}

export default function ReturnsEmployeeScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { isAdmin } = getRoleFlags(user);
  const isExecutiveScreen = route?.name === 'ReturnsExecutive';

  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [returnDate, setReturnDate] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [finYear, setFinYear] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [remarks, setRemarks] = useState('');

  const loadData = useCallback(async () => {
    if (!user?._id) return;
    try {
      setLoading(true);
      const url = isExecutiveScreen
        ? '/stock-returns/executive/mine'
        : isAdmin
          ? '/stock-returns/executive/list'
          : '/stock-returns/executive/mine';
      const returnsData = await apiService.get(url).catch(() => []);
      setReturns(Array.isArray(returnsData) ? returnsData : returnsData?.data || []);
    } catch (error: any) {
      showError(error.message || 'Failed to load returns', setBanner);
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id, isAdmin, isExecutiveScreen]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const openReturn = (ret: any) => {
    navigation.navigate('StockReturnAdd', { returnId: ret._id });
  };

  if (isExecutiveScreen) {
    const allReturns = returns.filter((r) => r.status !== 'Draft');
    const drafts = returns.filter((r) => r.status === 'Draft');

    const getReturnId = (ret: any) =>
      ret.returnId || (ret.returnNumber != null ? `RET-${ret.returnNumber}` : String(ret._id || '').slice(-8));
    const getSaleId = (ret: any) =>
      ret.saleId ||
      ret.dcOrderId?.dc_code ||
      (typeof ret.dcOrderId === 'string' ? ret.dcOrderId : '-') ||
      '-';
    const getSchool = (ret: any) => ret.customerName || ret.dcOrderId?.school_name || '-';
    const getQty = (ret: any) =>
      ret.totalQuantity ??
      ret.returnQty ??
      (Array.isArray(ret.products)
        ? ret.products.reduce((s: number, p: any) => s + (p.returnQty || 0), 0)
        : 0);

    return (
      <ScreenShell title="Stock Returns" loading={loading} onRefresh={loadData}>
        {banner ? (
          <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
        ) : null}

        <View style={styles.executiveHeader}>
          <Text style={styles.executiveSubtitle}>Manage stock returns for your sales</Text>
          <TouchableOpacity
            style={styles.addReturnButton}
            onPress={() => navigation.navigate('StockReturnAdd')}
          >
            <Text style={styles.addReturnButtonText}>+ Add Return</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {drafts.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Saved drafts ({drafts.length})</Text>
              {drafts.map((ret) => (
                <TouchableOpacity key={ret._id} style={styles.resultCard} onPress={() => openReturn(ret)}>
                  <Text style={styles.returnNumber}>{getReturnId(ret)}</Text>
                  <Text style={styles.infoValue}>Draft · Tap to continue</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {allReturns.length === 0 && !loading ? (
            <Text style={styles.emptyText}>No returns found</Text>
          ) : (
            allReturns.map((ret) => (
              <View key={ret._id} style={styles.resultCard}>
                <View style={styles.resultTop}>
                  <Text style={styles.returnNumber}>{getReturnId(ret)}</Text>
                  <Text style={styles.statusBadge}>{cell(ret.status)}</Text>
                </View>
                <InfoRow label="LR No" value={cell(ret.lrNumber)} />
                <InfoRow label="Fin Year" value={cell(ret.finYear)} />
                <InfoRow label="School" value={getSchool(ret)} />
                <InfoRow label="School Code" value={cell(ret.schoolCode)} />
                <InfoRow label="Sale ID" value={getSaleId(ret)} />
                <InfoRow label="Return Type" value={cell(ret.returnType)} />
                <InfoRow label="Return Qty" value={String(getQty(ret))} />
                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.viewButton, styles.cardActionBtn]} onPress={() => openReturn(ret)}>
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.printBtn, styles.cardActionBtn]} onPress={() => printSlip(ret)}>
                    <Text style={styles.printBtnText}>Print</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Employee Stock Returns" loading={loading} onRefresh={loadData}>
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.formCard}>
          <Field label="Return Date *">
            <WebInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={returnDate}
              onChangeText={setReturnDate}
            />
          </Field>
          <Field label="LR No (optional)">
            <WebInput
              style={styles.input}
              placeholder="e.g. C062455"
              value={lrNumber}
              onChangeText={setLrNumber}
            />
          </Field>
          <Field label="Fin Year (optional)">
            <WebInput
              style={styles.input}
              placeholder="e.g. 2025-26"
              value={finYear}
              onChangeText={setFinYear}
            />
          </Field>
          <Field label="School Type (optional)">
            <WebInput
              style={styles.input}
              placeholder="New / Existing"
              value={schoolType}
              onChangeText={setSchoolType}
            />
          </Field>
          <Field label="School Code (optional)">
            <WebInput
              style={styles.input}
              placeholder="e.g. VJVIJ5050"
              value={schoolCode}
              onChangeText={setSchoolCode}
            />
          </Field>
          <Field label="Remarks">
            <WebInput
              style={[styles.input, styles.textArea]}
              placeholder="Reason/notes for return"
              value={remarks}
              onChangeText={setRemarks}
              multiline
            />
          </Field>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {isAdmin ? 'All Executive Returns' : 'My Returns'} ({returns.length})
          </Text>
        </View>

        {returns.length === 0 && !loading ? (
          <Text style={styles.emptyText}>No returns yet</Text>
        ) : (
          returns.map((ret) => {
            const manager = getManagerText(ret);
            return (
              <View key={ret._id} style={styles.resultCard}>
                <View style={styles.resultTop}>
                  <Text style={styles.returnNumber}>Return #{ret.returnNumber}</Text>
                  <Text style={styles.status}>{cell(ret.status)}</Text>
                </View>
                <InfoRow label="LR No" value={cell(ret.lrNumber)} />
                <InfoRow label="Fin Year" value={cell(ret.finYear)} />
                <InfoRow label="Lead" value={getLeadName(ret)} />
                <InfoRow label="Return Date" value={formatDate(ret.returnDate)} />
                {isAdmin && <InfoRow label="Executive" value={getExecutiveName(ret)} />}
                <InfoRow label="Remarks" value={cell(ret.remarks)} />
                {isAdmin && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Manager / rejection</Text>
                    <Text style={[styles.infoValue, manager.rejected && styles.rejectedText]}>
                      {manager.text}
                    </Text>
                  </View>
                )}
                <InfoRow label="Created" value={formatCreated(ret.createdAt)} />
                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.viewButton, styles.cardActionBtn]} onPress={() => openReturn(ret)}>
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.printBtn, styles.cardActionBtn]} onPress={() => printSlip(ret)}>
                    <Text style={styles.printBtnText}>Print</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  formCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  field: { marginBottom: 12 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  input: {
    ...typography.body.medium,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  resultsHeader: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  resultsTitle: { ...typography.label.large, color: colors.textPrimary, fontWeight: '600' },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  resultCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  returnNumber: { ...typography.label.large, color: colors.textPrimary, fontWeight: '600' },
  status: { ...typography.body.small, color: colors.textSecondary, fontWeight: '600' },
  infoRow: { flexDirection: 'row', marginBottom: 6, gap: 8 },
  infoLabel: { ...typography.body.small, color: colors.textSecondary, width: 130 },
  infoValue: { ...typography.body.small, color: colors.textPrimary, flex: 1 },
  rejectedText: { color: '#DC2626' },
  viewButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  viewButtonText: { ...typography.label.medium, color: '#059669', fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8 },
  cardActionBtn: { flex: 1 },
  printBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },
  printBtnText: { ...typography.label.medium, color: colors.primary, fontWeight: '600' },
  addReturnButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  addReturnButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  executiveHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  executiveSubtitle: { ...typography.body.small, color: colors.textSecondary },
  statusBadge: {
    ...typography.label.small,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
});

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { fmtDate, inr, nameOf } from './paymentHelpers';

/** Mode lists as in web approval-pending-cash / approval-pending-cheques pages. */
const CASH_MODES = ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Other'];
const CHEQUE_MODES = [...CASH_MODES, 'Cheque'];

export default function PaymentApprovalList({ kind, navigation }: { kind: 'cash' | 'cheque'; navigation: any }) {
  const defaultMode = kind === 'cash' ? 'Cash' : 'Cheque';
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    schoolCode: '',
    schoolName: '',
    mobileNo: '',
    paymentMode: defaultMode,
    executive: '',
    zone: '',
    fromDate: '',
    toDate: '',
  });
  const setF = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const loadData = useCallback(async () => {
    try {
      const parts = ['status=Pending', `paymentMode=${encodeURIComponent(filters.paymentMode || defaultMode)}`];
      Object.entries(filters).forEach(([k, v]) => {
        if (!v || k === 'paymentMode') return;
        const key = k === 'fromDate' ? 'startDate' : k === 'toDate' ? 'endDate' : k === 'executive' ? 'employee' : k;
        parts.push(`${key}=${encodeURIComponent(v)}`);
      });
      const data = await apiService.get(`/payments?${parts.join('&')}`);
      setPayments(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
    } catch (error: any) {
      Alert.alert('Error', error?.message || `Failed to load pending ${kind} payments`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, defaultMode, kind]);

  // Reload whenever the screen regains focus (e.g. after approving on the detail screen), with the current filters.
  const loadRef = useRef(loadData);
  loadRef.current = loadData;
  useFocusEffect(
    useCallback(() => {
      loadRef.current();
    }, [])
  );

  const detailRoute = kind === 'cash' ? 'PaymentApprovalPendingCashDetail' : 'PaymentApprovalPendingChequesDetail';
  const modes = kind === 'cash' ? CASH_MODES : CHEQUE_MODES;

  return (
    <ScreenShell
      title={kind === 'cash' ? 'Pending Cash Payments' : 'Pending Cheque Payments'}
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadData();
      }}
    >
      <PageSection title="Filters">
        <WebInput value={filters.schoolCode} onChangeText={(t) => setF('schoolCode', t)} placeholder="By School Code" />
        <WebInput value={filters.schoolName} onChangeText={(t) => setF('schoolName', t)} placeholder="By School Name" />
        {showFilters ? (
          <>
            <WebInput value={filters.mobileNo} onChangeText={(t) => setF('mobileNo', t)} placeholder="By Mobile No" keyboardType="phone-pad" />
            <WebSelect
              value={filters.paymentMode}
              onValueChange={(v) => setF('paymentMode', v || defaultMode)}
              items={modes.map((m) => ({ label: m, value: m }))}
              placeholder="Select Payment Mode"
            />
            <WebInput value={filters.fromDate} onChangeText={(t) => setF('fromDate', t)} placeholder="From Date (YYYY-MM-DD)" />
            <WebInput value={filters.toDate} onChangeText={(t) => setF('toDate', t)} placeholder="To Date (YYYY-MM-DD)" />
            <WebInput value={filters.executive} onChangeText={(t) => setF('executive', t)} placeholder="BDE" />
            <WebInput value={filters.zone} onChangeText={(t) => setF('zone', t)} placeholder="Zone" />
          </>
        ) : null}
        <View style={styles.filterBtns}>
          <View style={{ flex: 1 }}>
            <WebButton title={showFilters ? 'Fewer Filters' : 'More Filters'} variant="outline" onPress={() => setShowFilters((s) => !s)} />
          </View>
          <View style={{ flex: 1 }}>
            <WebButton
              title="Search"
              onPress={() => {
                setLoading(true);
                loadData();
              }}
            />
          </View>
        </View>
      </PageSection>

      {payments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending {kind === 'cash' ? 'cash' : 'cheque'} payments found</Text>
        </View>
      ) : (
        payments.map((p) => (
          <TouchableOpacity key={p._id} style={styles.card} onPress={() => navigation.navigate(detailRoute, { id: p._id })} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{p.customerName || 'N/A'}</Text>
                <Text style={styles.code}>{p.schoolCode || '-'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.statusBadgeText, { color: colors.warning }]}>Pending</Text>
              </View>
            </View>
            <Info label="Amount" value={inr(p.amount)} strong />
            <Info label="Date" value={fmtDate(p.paymentDate)} />
            <Info label="Mode" value={p.paymentMethod || '-'} />
            {p.paymentMethod === 'Cheque' ? (
              <>
                <Info label="Cheque No" value={p.chequeNumber || '-'} />
                <Info label="Cheque Date" value={fmtDate(p.chqDate)} />
              </>
            ) : null}
            {p.mobileNumber ? <Info label="Mobile" value={p.mobileNumber} /> : null}
            <Info label="BDE" value={p.createdBy?.name || '-'} />
            {nameOf(p.zone) ? <Info label="Zone" value={nameOf(p.zone)} /> : null}
          </TouchableOpacity>
        ))
      )}
    </ScreenShell>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={[styles.infoValue, strong && styles.amountText]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterBtns: { flexDirection: 'row', gap: 8 },
  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  customerName: { ...typography.heading.h3, color: colors.textPrimary },
  code: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 100 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  amountText: { color: colors.success, fontWeight: '700' },
});

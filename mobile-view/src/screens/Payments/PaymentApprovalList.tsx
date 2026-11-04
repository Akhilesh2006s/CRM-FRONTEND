import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { fmtDate, inr, nameOf } from './paymentHelpers';

import DateField from '../../ui/DateField';
/** Mode lists as in web approval-pending-cash / approval-pending-cheques pages. */
const CASH_MODES = ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Other'];
const CHEQUE_MODES = [...CASH_MODES, 'Cheque'];

export default function PaymentApprovalList({ kind, navigation }: { kind: 'cash' | 'cheque'; navigation: any }) {
  const defaultMode = kind === 'cash' ? 'Cash' : 'Cheque';
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState('');
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

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = words.length
    ? payments.filter((p) => {
        const text = [
          p.customerName,
          p.schoolCode,
          p.mobileNumber,
          p.createdBy?.name,
          nameOf(p.zone),
          p.paymentMethod,
          p.chequeNumber,
          p.amount,
          inr(p.amount),
          fmtDate(p.paymentDate),
        ]
          .filter((v) => v !== undefined && v !== null)
          .join(' ')
          .toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : payments;

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
      <WebInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search school, code, mobile, BDE, zone…"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {showFilters ? (
        <PageSection title="Filters">
          <WebSelect
            label="Payment Mode"
            value={filters.paymentMode}
            onValueChange={(v) => setF('paymentMode', v || defaultMode)}
            items={modes.map((m) => ({ label: m, value: m }))}
            placeholder="Select Payment Mode"
          />
          <DateField placeholder="From date" value={filters.fromDate} onChange={(t) => setF('fromDate', t)} />
          <DateField placeholder="To date" value={filters.toDate} onChange={(t) => setF('toDate', t)} />
          <WebButton
            title="Apply"
            onPress={() => {
              setLoading(true);
              loadData();
            }}
          />
        </PageSection>
      ) : null}
      <View style={styles.filterBtns}>
        <WebButton title={showFilters ? 'Hide Filters' : 'Mode & Date Filters'} variant="outline" onPress={() => setShowFilters((s) => !s)} />
      </View>

      {visible.length === 0 ? (
        <EmptyState icon="💳" title={`No pending ${kind === 'cash' ? 'cash' : 'cheque'} payments found`} />
      ) : (
        visible.map((p) => (
          <Card key={p._id} onPress={() => navigation.navigate(detailRoute, { id: p._id })}>
            <CardTitle title={p.customerName || 'N/A'} subtitle={p.schoolCode || undefined} badge="Pending" tone="warning" />
            <InfoRow label="Amount" value={<Text style={styles.amountText}>{inr(p.amount)}</Text>} />
            <InfoRow label="Date" value={fmtDate(p.paymentDate)} />
            <InfoRow label="Mode" value={p.paymentMethod || '-'} />
            {p.paymentMethod === 'Cheque' ? (
              <>
                <InfoRow label="Cheque No" value={p.chequeNumber || '-'} />
                <InfoRow label="Cheque Date" value={fmtDate(p.chqDate)} />
              </>
            ) : null}
            <InfoRow label="Mobile" value={p.mobileNumber} phone />
            <InfoRow label="BDE" value={p.createdBy?.name || '-'} />
            <InfoRow label="Zone" value={nameOf(p.zone)} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filterBtns: { flexDirection: 'row', marginBottom: 12 },
  amountText: { fontSize: 15, color: colors.success, fontWeight: '700' },
});

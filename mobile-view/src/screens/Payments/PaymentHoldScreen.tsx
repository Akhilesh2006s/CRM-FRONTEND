import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { inr, paymentRemarks, statusColors } from './paymentHelpers';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';

import DateField from '../../ui/DateField';
/** Same mode list as web hold-payments filter. */
const PAYMENT_MODES = ['Cash', 'Cheque', 'Online Payment'];

const EMPTY_FILTERS = {
  schoolCode: '',
  schoolName: '',
  mobileNo: '',
  paymentMode: '',
  executive: '',
  zone: '',
  fromDate: '',
  toDate: '',
};

function fmtDateTime(v?: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function PaymentHoldScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState('');

  const setF = (k: keyof typeof EMPTY_FILTERS, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const loadData = useCallback(async (f = filters) => {
    try {
      const parts: string[] = ['status=' + encodeURIComponent('Hold,Rejected')];
      Object.entries(f).forEach(([k, v]) => {
        if (!v) return;
        const key =
          k === 'fromDate' ? 'startDate' : k === 'toDate' ? 'endDate' : k === 'executive' ? 'employee' : k;
        parts.push(`${key}=${encodeURIComponent(v)}`);
      });
      const data = await apiService.get(`/payments?${parts.join('&')}`);
      setPayments(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load HOLD payments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadData(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = words.length
    ? payments.filter((p) => {
        const text = [
          p.customerName,
          p.schoolCode,
          p.mobileNumber,
          p.contactName,
          p.createdBy?.name,
          p.zone?.name || p.zone,
          p.location,
          p.paymentMethod,
          p.financialYear,
          p.submissionNo,
          p.refNo,
          p.referenceNumber,
          inr(p.amount),
          paymentRemarks(p),
        ]
          .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : ''))
          .join(' ')
          .toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : payments;

  return (
    <ScreenShell
      title="HOLD Payments"
      subtitle="Held and rejected payments"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadData();
      }}
    >
      <WebInput
        placeholder="Search school, code, mobile, BDE, zone…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {showFilters ? (
        <PageSection title="Filters">
          <DateField placeholder="From date" value={filters.fromDate} onChange={(t) => setF('fromDate', t)} />
          <DateField placeholder="To date" value={filters.toDate} onChange={(t) => setF('toDate', t)} />
          <WebSelect
            label="Payment Mode"
            value={filters.paymentMode}
            onValueChange={(v) => setF('paymentMode', v)}
            items={PAYMENT_MODES.map((m) => ({ label: m, value: m }))}
            placeholder="Select Payment Mode"
          />
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
        <EmptyState icon="⏸️" title="No held or rejected payments found" />
      ) : (
        visible.map((p, idx) => {
          const isRejected = p.status === 'Rejected';
          return (
            <Card key={p._id || idx}>
              <CardTitle
                title={p.customerName || '-'}
                subtitle={p.schoolCode || undefined}
                badge={isRejected ? 'Rejected' : 'Hold'}
                tone={isRejected ? 'error' : 'warning'}
              />
              <InfoRow label="Amount" value={inr(p.amount)} bold />
              <InfoRow label="Date of Pay" value={fmtDateTime(p.paymentDate)} />
              <InfoRow label="Mode" value={p.paymentMethod || '-'} />
              <InfoRow label="Fin. Year" value={p.financialYear || '-'} />
              <InfoRow label="Contact" value={[p.contactName, p.mobileNumber].filter(Boolean).join(' · ') || '-'} />
              <InfoRow label="Location" value={p.location || '-'} />
              <InfoRow label="Submission" value={p.submissionNo || p.refNo || p.referenceNumber || '-'} />
              <InfoRow label="Added By" value={p.createdBy?.name || '-'} />
              <InfoRow
                label="Reason"
                value={
                  <Text style={[styles.reasonText, { color: isRejected ? colors.error : '#B45309' }]}>
                    {paymentRemarks({ ...p, status: isRejected ? 'Rejected' : 'Hold' })}
                  </Text>
                }
              />
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filterBtns: { flexDirection: 'row', marginBottom: 12 },
  reasonText: { fontSize: 14, fontWeight: '600' },
});

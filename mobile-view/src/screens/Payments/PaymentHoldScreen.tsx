import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { inr, paymentRemarks, statusColors } from './paymentHelpers';

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
  return d.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function PaymentHoldScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);

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
      <PageSection title="Filters">
        {showFilters ? (
          <>
            <WebInput placeholder="By School Code" value={filters.schoolCode} onChangeText={(t) => setF('schoolCode', t)} />
            <WebInput placeholder="By School Name" value={filters.schoolName} onChangeText={(t) => setF('schoolName', t)} />
            <WebInput placeholder="By Mobile No" value={filters.mobileNo} onChangeText={(t) => setF('mobileNo', t)} keyboardType="phone-pad" />
            <WebInput placeholder="From Date (YYYY-MM-DD)" value={filters.fromDate} onChangeText={(t) => setF('fromDate', t)} />
            <WebInput placeholder="To Date (YYYY-MM-DD)" value={filters.toDate} onChangeText={(t) => setF('toDate', t)} />
            <WebSelect
              value={filters.paymentMode}
              onValueChange={(v) => setF('paymentMode', v)}
              items={PAYMENT_MODES.map((m) => ({ label: m, value: m }))}
              placeholder="Select Payment Mode"
            />
            <WebInput placeholder="BDE" value={filters.executive} onChangeText={(t) => setF('executive', t)} />
            <WebInput placeholder="Zone" value={filters.zone} onChangeText={(t) => setF('zone', t)} />
          </>
        ) : null}
        <View style={styles.filterBtns}>
          <View style={{ flex: 1 }}>
            <WebButton title={showFilters ? 'Hide Filters' : 'Show Filters'} variant="outline" onPress={() => setShowFilters((s) => !s)} />
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
          <Text style={styles.emptyText}>No held or rejected payments found</Text>
        </View>
      ) : (
        payments.map((p, idx) => {
          const isRejected = p.status === 'Rejected';
          const sc = statusColors(isRejected ? 'Rejected' : 'Hold');
          return (
            <View key={p._id || idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{p.customerName || '-'}</Text>
                  <Text style={styles.code}>{p.schoolCode || '-'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: sc.fg }]}>{isRejected ? 'Rejected' : 'Hold'}</Text>
                </View>
              </View>
              <Info label="Amount" value={inr(p.amount)} strong />
              <Info label="Date of Pay" value={fmtDateTime(p.paymentDate)} />
              <Info label="Mode" value={p.paymentMethod || '-'} />
              <Info label="Fin. Year" value={p.financialYear || '-'} />
              <Info label="Contact" value={[p.contactName, p.mobileNumber].filter(Boolean).join(' · ') || '-'} />
              <Info label="Location" value={p.location || '-'} />
              <Info label="Submission" value={p.submissionNo || p.refNo || p.referenceNumber || '-'} />
              <Info label="Added By" value={p.createdBy?.name || '-'} />
              <View style={[styles.reasonBox, { backgroundColor: sc.bg }]}>
                <Text style={[styles.reasonLabel, { color: sc.fg }]}>Reason</Text>
                <Text style={styles.reasonText}>{paymentRemarks({ ...p, status: isRejected ? 'Rejected' : 'Hold' })}</Text>
              </View>
            </View>
          );
        })
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
  emptyText: { ...typography.heading.h3, color: colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  customerName: { ...typography.heading.h3, color: colors.textPrimary },
  code: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 100 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  amountText: { color: colors.textPrimary, fontWeight: '700' },
  reasonBox: { borderRadius: 8, padding: 10, marginTop: 6 },
  reasonLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  reasonText: { fontSize: 13, color: colors.textPrimary },
});

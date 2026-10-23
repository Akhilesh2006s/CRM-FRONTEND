import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ALL_PAYMENT_MODES, fmtDate, inr, paymentDetailsText, paymentRemarks, statusColors } from './paymentHelpers';

type SchoolBalance = { schoolCode: string; schoolName: string; total: number; paid: number; balance: number };

const STATUS_ITEMS = ['Pending', 'Approved', 'Hold', 'Rejected'].map((s) => ({ label: s, value: s }));

export default function PaymentDoneScreen() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [balances, setBalances] = useState<SchoolBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const loadData = useCallback(async () => {
    if (!user?._id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const isBde = ['Executive', 'Sales BDE', 'Employee'].includes(String(user.role || ''));
      const data = await apiService.get(isBde ? `/payments?createdBy=${user._id}` : '/payments');
      setPayments(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
      apiService
        .get('/payments/school-balances')
        .then((rows: any) => setBalances(Array.isArray(rows) ? rows : []))
        .catch(() => setBalances([]));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load payments');
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id, user?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    let list = statusFilter ? payments.filter((p) => p.status === statusFilter) : [...payments];
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((p) =>
        [p.customerName, p.schoolCode, p.paymentMethod, p.referenceNumber, p.refNo, p.description].some((v) =>
          String(v || '').toLowerCase().includes(term)
        )
      );
    }
    if (methodFilter) list = list.filter((p) => p.paymentMethod === methodFilter);
    list.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    return list;
  }, [payments, statusFilter, search, methodFilter]);

  const filteredBalances = useMemo(() => {
    const q = search.trim().toLowerCase();
    return balances.filter(
      (b) => !q || String(b.schoolName || '').toLowerCase().includes(q) || String(b.schoolCode || '').toLowerCase().includes(q)
    );
  }, [balances, search]);

  const sum = (rows: any[]) => rows.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const approved = filtered.filter((p) => p.status === 'Approved');
  const pending = filtered.filter((p) => p.status === 'Pending');

  return (
    <ScreenShell
      title="Payments Done"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadData();
      }}
    >
      <View style={styles.statsRow}>
        <StatCard label="Total Payments" count={filtered.length} amount={sum(filtered)} color={colors.textPrimary} />
        <StatCard label="Approved" count={approved.length} amount={sum(approved)} color={colors.success} />
        <StatCard label="Pending" count={pending.length} amount={sum(pending)} color={colors.warning} />
      </View>

      <PageSection title="Filters">
        <WebInput placeholder="Search by school, code, method, ref..." value={search} onChangeText={setSearch} />
        <WebSelect value={statusFilter} onValueChange={setStatusFilter} items={STATUS_ITEMS} placeholder="All Status" />
        <WebSelect
          value={methodFilter}
          onValueChange={setMethodFilter}
          items={ALL_PAYMENT_MODES.map((m) => ({ label: m, value: m }))}
          placeholder="All Methods"
        />
      </PageSection>

      {filteredBalances.length > 0 && (
        <PageSection title="School Balances" description="Order total, approved payments and what is still due for each school.">
          <View style={styles.balHead}>
            <Text style={[styles.balTh, { flex: 2 }]}>School</Text>
            <Text style={styles.balTh}>Total</Text>
            <Text style={styles.balTh}>Paid</Text>
            <Text style={styles.balTh}>Balance</Text>
          </View>
          {filteredBalances.map((b) => (
            <View key={b.schoolCode} style={styles.balRow}>
              <View style={{ flex: 2, paddingRight: 4 }}>
                <Text style={styles.balSchool}>{b.schoolName || '-'}</Text>
                <Text style={styles.balCode}>{b.schoolCode}</Text>
              </View>
              <Text style={styles.balTd}>{inr(b.total)}</Text>
              <Text style={[styles.balTd, { color: colors.success }]}>{inr(b.paid)}</Text>
              <Text style={[styles.balTd, styles.bold, { color: b.balance > 0 ? colors.error : colors.success }]}>{inr(b.balance)}</Text>
            </View>
          ))}
        </PageSection>
      )}

      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No payments found</Text>
        </View>
      ) : (
        filtered.map((p) => {
          const sc = statusColors(p.status);
          return (
            <View key={p._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{p.customerName || '-'}</Text>
                  <Text style={styles.code}>{p.schoolCode || '-'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: sc.fg }]}>{p.status || 'Pending'}</Text>
                </View>
              </View>
              <Info label="Amount" value={inr(p.amount)} strong />
              <Info label="Date" value={fmtDate(p.paymentDate)} />
              <Info label="Method" value={p.paymentMethod || '-'} />
              <Info label="Details" value={paymentDetailsText(p)} />
              <Info label="Fin. Year" value={p.financialYear || '-'} />
              <Info label={p.status === 'Hold' || p.status === 'Rejected' ? 'Reason' : 'Remarks'} value={paymentRemarks(p)} />
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

function StatCard({ label, count, amount, color }: { label: string; count: number; amount: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statCount, { color }]}>{count}</Text>
      <Text style={styles.statAmount}>{inr(amount)}</Text>
    </View>
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
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: colors.backgroundLight, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 10 },
  statLabel: { fontSize: 12, color: colors.textSecondary },
  statCount: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  statAmount: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  balHead: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  balTh: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'right' },
  balRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  balSchool: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  balCode: { fontSize: 11, color: colors.textTertiary },
  balTd: { flex: 1, fontSize: 12, color: colors.textPrimary, textAlign: 'right' },
  bold: { fontWeight: '700' },
  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  customerName: { ...typography.heading.h3, color: colors.textPrimary },
  code: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 90 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  amountText: { color: colors.success, fontWeight: '700' },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, toneFor } from '../../ui/Kit';
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
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      list = list.filter((p) => {
        const text = [
          p.customerName,
          p.schoolCode,
          p.paymentMethod,
          p.referenceNumber,
          p.refNo,
          p.description,
          p.status,
          p.financialYear,
          p.amount,
          inr(p.amount),
          fmtDate(p.paymentDate),
          paymentDetailsText(p),
          paymentRemarks(p),
        ]
          .map((v) => String(v ?? ''))
          .join(' ')
          .toLowerCase();
        return words.every((w) => text.includes(w));
      });
    }
    if (methodFilter) list = list.filter((p) => p.paymentMethod === methodFilter);
    list.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    return list;
  }, [payments, statusFilter, search, methodFilter]);

  const filteredBalances = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return balances.filter((b) => {
      if (!words.length) return true;
      const text = `${b.schoolName || ''} ${b.schoolCode || ''}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
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

      <WebInput
        placeholder="Search school, code, method, ref, remarks…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <WebSelect value={statusFilter} onValueChange={setStatusFilter} items={STATUS_ITEMS} placeholder="All Status" />
        </View>
        <View style={{ flex: 1 }}>
          <WebSelect
            value={methodFilter}
            onValueChange={setMethodFilter}
            items={ALL_PAYMENT_MODES.map((m) => ({ label: m, value: m }))}
            placeholder="All Methods"
          />
        </View>
      </View>

      {filteredBalances.length > 0 && (
        <PageSection title="School Balances" description="Order total, approved and still due per school.">
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
        <EmptyState icon="💳" title="No payments found" />
      ) : (
        filtered.map((p) => (
          <Card key={p._id}>
            <CardTitle
              title={p.customerName || '-'}
              subtitle={p.schoolCode || undefined}
              badge={p.status || 'Pending'}
              tone={toneFor(p.status || 'Pending')}
            />
            <InfoRow label="Amount" value={<Text style={styles.amountText}>{inr(p.amount)}</Text>} />
            <InfoRow label="Date" value={fmtDate(p.paymentDate)} />
            <InfoRow label="Method" value={p.paymentMethod || '-'} />
            <InfoRow label="Details" value={paymentDetailsText(p)} />
            <InfoRow label="Fin. Year" value={p.financialYear || '-'} />
            <InfoRow label={p.status === 'Hold' || p.status === 'Rejected' ? 'Reason' : 'Remarks'} value={paymentRemarks(p)} />
          </Card>
        ))
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

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: colors.backgroundLight, borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F7', padding: 12 },
  statLabel: { fontSize: 13, color: colors.textSecondary },
  statCount: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  statAmount: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8 },
  balHead: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  balTh: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary, textAlign: 'right' },
  balRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  balSchool: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  balCode: { fontSize: 13, color: colors.textTertiary },
  balTd: { flex: 1, fontSize: 13, color: colors.textPrimary, textAlign: 'right' },
  bold: { fontWeight: '700' },
  amountText: { fontSize: 15, color: colors.success, fontWeight: '700' },
});

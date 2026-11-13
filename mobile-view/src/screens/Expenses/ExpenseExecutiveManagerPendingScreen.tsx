import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { navigateRoot } from '../../navigation/navigationRef';
import { type ApprovalExpense, expenseStatusColor, expenseStatusText } from '../../lib/expenseApproval';
import ExpenseDateFilterBar from '../../components/expenses/ExpenseDateFilterBar';
import { EMPTY_EXPENSE_FILTER, expenseYears, filterExpenses } from '../../lib/expenseDateFilter';

type Person = { _id: string; name: string; email?: string };

type Expense = ApprovalExpense & {
  _id: string;
  title?: string;
  amount: number;
  category: string;
  createdAt: string;
  date?: string;
  pendingMonth?: string;
  approxKms?: number;
  trackedDistanceKm?: number;
  employeeId?: Person | null;
  trainerId?: Person | null;
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: Person | null;
};

type Employee = { _id: string; name: string };
type Tab = 'pending' | 'decided';

const getEmployee = (e: Expense) => e.employee || e.employeeId || e.trainerId || e.createdBy || null;

const getExpenseType = (category: string) => {
  if (category === 'Other' || category === 'others') return 'Others';
  if (!category) return '-';
  return category.charAt(0).toUpperCase() + category.slice(1);
};

const formatDateTime = (d?: string) => {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const getPendingMonth = (e: Expense) =>
  e.pendingMonth || new Date(e.createdAt).toLocaleString('en-US', { month: 'long' });

/** Team expenses: awaiting this Zonal Manager, or already approved / rejected by them (with current status). */
export default function ExpenseExecutiveManagerPendingScreen({ navigation, route }: any) {
  const tab: Tab = route?.params?.tab === 'decided' ? 'decided' : 'pending';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [df, setDf] = useState(EMPTY_EXPENSE_FILTER);
  const visible = filterExpenses(expenses, df);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employeeId, setEmployeeId] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService
      .get('/executive-managers/my/executives')
      .then((data: any) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));
  }, []);

  const loadExpenses = useCallback(async () => {
    try {
      setError(null);
      const q = employeeId !== 'all' ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
      const base = tab === 'decided' ? '/expenses/my-decisions' : '/expenses/executive-manager-pending';
      const data = await apiService.get(`${base}${q}`);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId, tab]);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [loadExpenses])
  );

  const openReview = (exp: Expense) => {
    const empId = getEmployee(exp)?._id;
    if (empId) navigateRoot('ExpenseManagerUpdate', { employeeId: empId });
    // Approvers only review; the claim stays as the employee submitted it.
    else navigateRoot('ExpenseDetail', { id: exp._id });
  };

  const setTab = (t: Tab) => {
    setLoading(true);
    navigation.setParams({ tab: t });
  };

  return (
    <ScreenShell
      title={tab === 'decided' ? 'Team Expenses: Approved / Rejected' : 'Team Expenses to Approve'}
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadExpenses();
      }}
    >
      <View style={styles.tabRow}>
        {(['pending', 'decided'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'pending' ? 'To Approve' : 'Approved / Rejected'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <WebSelect
        label="Employee"
        value={employeeId === 'all' ? '' : employeeId}
        placeholder="All Employees"
        onValueChange={(v) => setEmployeeId(v || 'all')}
        items={employees.map((e) => ({ label: e.name, value: e._id }))}
      />
      <Text style={employees.length === 0 ? styles.warnHint : styles.hint}>
        {employees.length === 0
          ? 'No employees assigned to you. Please contact an administrator to assign employees.'
          : `Showing expenses for ${employees.length} assigned employee${employees.length !== 1 ? 's' : ''}`}
      </Text>

      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}

      <ExpenseDateFilterBar value={df} onChange={setDf} years={expenseYears(expenses)} shown={visible.length} total={expenses.length} />
      {visible.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={tab === 'decided' ? 'Nothing decided yet' : 'Nothing to approve'}
          message={
            tab === 'decided'
              ? 'You have not approved or rejected any expenses yet.'
              : employees.length === 0
                ? 'No employees assigned to you. Please contact an administrator.'
                : 'No expenses are awaiting your approval'
          }
        />
      ) : tab === 'decided' ? (
        visible.map((exp, i) => {
          const c = expenseStatusColor(exp.status);
          return (
            <Card key={exp._id}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {i + 1}. {getEmployee(exp)?.name || '-'}
                  </Text>
                  <Text style={styles.meta}>{getExpenseType(exp.category)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.badgeText, { color: c.text }]} numberOfLines={1}>
                    {expenseStatusText(exp)}
                  </Text>
                </View>
              </View>
              <InfoRow
                label="Date"
                value={exp.date ? new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
              />
              <InfoRow label="Claimed" value={Number(exp.employeeAmount ?? exp.amount).toFixed(2)} />
              <InfoRow
                label="Approved"
                bold
                value={exp.status === 'Rejected' ? '—' : Number(exp.firstLevelApprovedAmount ?? exp.approvedAmount ?? 0).toFixed(2)}
              />
              <InfoRow label="Your remarks" value={exp.managerRemarks || exp.rejectionReason || '-'} />
            </Card>
          );
        })
      ) : (
        visible.map((exp, i) => (
          <Card key={exp._id} onPress={() => openReview(exp)}>
            <CardTitle title={`${i + 1}. ${getEmployee(exp)?.name || '-'}`} badge="Pending" tone="warning" />
            <InfoRow label="Amount" value={Number(exp.amount).toFixed(2)} bold />
            <InfoRow label="Type" value={getExpenseType(exp.category)} />
            {exp.category?.toLowerCase() === 'travel' ? (
              <InfoRow
                label="GPS KM / Employee KM"
                value={`${Number(exp.trackedDistanceKm ?? 0).toFixed(2)} / ${exp.approxKms ? Number(exp.approxKms).toFixed(2) : '-'}`}
              />
            ) : null}
            <InfoRow label="Raised" value={formatDateTime(exp.createdAt)} />
            <InfoRow label="Pending month" value={getPendingMonth(exp)} />
            <ActionRow>
              <View style={styles.reviewBtn}>
                <Text style={styles.reviewBtnText}>Review & Approve</Text>
              </View>
            </ActionRow>
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundLight,
  },
  tabBtnActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  tabTextActive: { color: colors.primaryForeground },
  hint: { fontSize: 13, color: colors.textTertiary, marginTop: -4, marginBottom: 12 },
  warnHint: { fontSize: 13, color: '#B45309', marginTop: -4, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardTitle: { fontWeight: '700', fontSize: 16, color: colors.textPrimary, flexShrink: 1 },
  meta: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },
  metaStrong: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, maxWidth: 160 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  reviewBtn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.success,
    borderRadius: 10,
  },
  reviewBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
});

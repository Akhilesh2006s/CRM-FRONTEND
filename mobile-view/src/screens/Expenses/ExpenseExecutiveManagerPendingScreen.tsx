import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { navigateRoot } from '../../navigation/navigationRef';
import { type ApprovalExpense, expenseStatusColor, expenseStatusText } from '../../lib/expenseApproval';

type Person = { _id: string; name: string; email?: string };

type Expense = ApprovalExpense & {
  _id: string;
  title?: string;
  amount: number;
  category: string;
  createdAt: string;
  date?: string;
  pendingMonth?: string;
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
    else navigateRoot('ExpenseEdit', { id: exp._id });
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

      {expenses.length === 0 ? (
        <Text style={styles.empty}>
          {tab === 'decided'
            ? 'You have not approved or rejected any expenses yet.'
            : employees.length === 0
              ? 'No employees assigned to you. Please contact an administrator.'
              : 'No expenses are awaiting your approval'}
        </Text>
      ) : tab === 'decided' ? (
        expenses.map((exp, i) => {
          const c = expenseStatusColor(exp.status);
          return (
            <View key={exp._id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {i + 1}. {getEmployee(exp)?.name || '-'}
                </Text>
                <Text style={styles.meta}>{exp.date ? new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</Text>
              </View>
              <Text style={styles.meta}>Type: {getExpenseType(exp.category)}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Claimed: {Number(exp.employeeAmount ?? exp.amount).toFixed(2)}</Text>
                <Text style={styles.metaStrong}>
                  Approved:{' '}
                  {exp.status === 'Rejected' ? '-' : Number(exp.firstLevelApprovedAmount ?? exp.approvedAmount ?? 0).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: c.bg }]}>
                <Text style={[styles.badgeText, { color: c.text }]}>{expenseStatusText(exp)}</Text>
              </View>
              <Text style={styles.meta}>Your remarks: {exp.managerRemarks || exp.rejectionReason || '-'}</Text>
            </View>
          );
        })
      ) : (
        expenses.map((exp, i) => (
          <TouchableOpacity key={exp._id} style={styles.card} onPress={() => openReview(exp)} activeOpacity={0.8}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>
                {i + 1}. {getEmployee(exp)?.name || '-'}
              </Text>
              <Text style={styles.metaStrong}>{Number(exp.amount).toFixed(2)}</Text>
            </View>
            <Text style={styles.meta}>Raised: {formatDateTime(exp.createdAt)}</Text>
            <Text style={styles.meta}>
              Type: {getExpenseType(exp.category)} · Pending month: {getPendingMonth(exp)}
            </Text>
            <View style={styles.reviewBtn}>
              <Text style={styles.reviewBtnText}>Review & Approve</Text>
            </View>
          </TouchableOpacity>
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  tabTextActive: { color: colors.primaryForeground },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: -4, marginBottom: 12 },
  warnHint: { fontSize: 12, color: colors.warning, marginTop: -4, marginBottom: 12 },
  card: {
    backgroundColor: colors.backgroundLight,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontWeight: '600', fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
  meta: { color: colors.textSecondary, fontSize: 13 },
  metaStrong: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.sm, marginVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  reviewBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  reviewBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
});

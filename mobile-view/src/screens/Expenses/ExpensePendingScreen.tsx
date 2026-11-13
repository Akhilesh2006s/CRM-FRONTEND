import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { EmptyState } from '../../ui/Kit';
import { WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../utils/showAlert';
import {
  type ApprovalExpense,
  expenseStatusColor,
  expenseStatusText,
  firstLevelAmount,
} from '../../lib/expenseApproval';
import ExpenseDateFilterBar from '../../components/expenses/ExpenseDateFilterBar';
import { EMPTY_EXPENSE_FILTER, expenseYears, filterExpenses } from '../../lib/expenseDateFilter';

type Person = { _id: string; name: string; email?: string; empCode?: string; role?: string };

type Expense = ApprovalExpense & {
  _id: string;
  title?: string;
  amount: number;
  category?: string;
  createdAt?: string;
  employeeId?: Person | null;
  trainerId?: Person | null;
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: Person | null;
  pendingMonth?: string;
};

const getEmployee = (e: Expense) => e.employee || e.employeeId || e.trainerId || e.createdBy || null;

const formatAmount = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-';

type OptionItem = { _id: string; name: string };

function formatRaisedDate(dateString?: string) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date
      .toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$2-$1')
      .replace(', ', ' ');
  } catch {
    return '-';
  }
}

function getExpenseType(category?: string) {
  if (!category) return '-';
  if (category === 'Other' || category === 'others') return 'Others';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function getPendingMonth(expense: Expense) {
  if (expense.pendingMonth) return expense.pendingMonth;
  if (!expense.createdAt) return '-';
  return new Date(expense.createdAt).toLocaleString('en-US', { month: 'long' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ExpensePendingScreen({ navigation }: any) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [df, setDf] = useState(EMPTY_EXPENSE_FILTER);
  const visible = filterExpenses(expenses, df);
  const [employees, setEmployees] = useState<OptionItem[]>([]);
  const [trainers, setTrainers] = useState<OptionItem[]>([]);
  const [filters, setFilters] = useState({ employeeId: '', trainerId: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFilters = useCallback(async () => {
    try {
      const [employeeData, trainerData] = await Promise.all([
        apiService.get('/employees?isActive=true').catch(() => []),
        apiService.get('/trainers?status=active').catch(() => []),
      ]);
      setEmployees(Array.isArray(employeeData) ? employeeData : (employeeData as any)?.data || []);
      setTrainers(Array.isArray(trainerData) ? trainerData : (trainerData as any)?.data || []);
    } catch {
      setEmployees([]);
      setTrainers([]);
    }
  }, []);

  const loadData = useCallback(async (nextFilters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (nextFilters.employeeId) params.append('employeeId', nextFilters.employeeId);
      if (nextFilters.trainerId) params.append('trainerId', nextFilters.trainerId);
      const qs = params.toString();
      const data = await apiService.get(`/expenses/manager-pending${qs ? `?${qs}` : ''}`);
      const list = Array.isArray(data) ? data : (data as any)?.data || [];
      setExpenses(list);
      // Logins that can't list every employee (e.g. a tagged Product Manager) filter by
      // the people in their own queue.
      if (!qs) {
        const people = (key: 'employeeId' | 'trainerId') => {
          const seen = new Map<string, string>();
          for (const e of list) {
            const p = e?.[key];
            if (p && typeof p === 'object' && p._id) seen.set(String(p._id), p.name || 'Unknown');
          }
          return [...seen].map(([_id, name]) => ({ _id, name }));
        };
        setEmployees((current: any[]) => (current.length ? current : people('employeeId')) as any);
        setTrainers((current: any[]) => (current.length ? current : people('trainerId')) as any);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFilters();
    loadData({ employeeId: '', trainerId: '' });
  }, [loadFilters]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFilters();
    loadData(filters);
  };

  const handleSearch = () => loadData(filters);

  // Approving needs an amount (and optional remarks) per item, so it happens on the
  // per-employee review page — same as web /dashboard/expenses/manager-update/[employeeId].
  const openReview = (expense: Expense) => {
    const emp = getEmployee(expense);
    if (!emp?._id) {
      showAlert('Error', 'This expense has no employee to review');
      return;
    }
    navigation.navigate('ExpenseManagerUpdate', { employeeId: emp._id, employeeName: emp.name || 'Employee' });
  };

  const isFinance = user?.role === 'Finance Manager';

  return (
    <ScreenShell
      title="Pending Expenses List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.pageHint} numberOfLines={2}>
          {isFinance
            ? 'Expenses approved at first level and awaiting your final approval.'
            : 'Expenses awaiting your approval. Open one to review it, then approve or reject it on the review page.'}
        </Text>
        <View style={styles.filterCard}>
          <WebSelect
            placeholder="All Employees"
            value={filters.employeeId}
            onValueChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))}
            items={employees.map((e) => ({ label: e.name, value: e._id }))}
          />
          <WebSelect
            placeholder="All Trainers"
            value={filters.trainerId}
            onValueChange={(v) => setFilters((f) => ({ ...f, trainerId: v }))}
            items={trainers.map((t) => ({ label: t.name, value: t._id }))}
          />
          <WebButton title="Search" onPress={handleSearch} />
        </View>

        <ExpenseDateFilterBar value={df} onChange={setDf} years={expenseYears(expenses)} shown={visible.length} total={expenses.length} />
        {visible.length === 0 ? (
          <EmptyState icon="✅" title="Nothing to approve" message="No expenses are awaiting your approval." />
        ) : (
          visible.map((expense, index) => {
            const badge = expenseStatusColor(expense.status);
            return (
              <TouchableOpacity key={expense._id} style={styles.card} onPress={() => openReview(expense)} activeOpacity={0.85}>
                <View style={styles.cardTop}>
                  <Text style={styles.employeeName}>{getEmployee(expense)?.name || '-'}</Text>
                  <Text style={styles.amount}>{formatAmount(expense.employeeAmount ?? expense.amount)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: badge.text }]}>{expenseStatusText(expense)}</Text>
                </View>
                <InfoRow label="S.No" value={String(index + 1)} />
                <InfoRow label="Raised Date" value={formatRaisedDate(expense.createdAt)} />
                <InfoRow label="Exp Type" value={getExpenseType(expense.category)} />
                <InfoRow label="1st Level Amount" value={formatAmount(firstLevelAmount(expense))} />
                <InfoRow label="Pending Months" value={getPendingMonth(expense)} />

                <View style={styles.actions}>
                  <View style={styles.approveBtn}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.approveBtnText}>Review</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  pageHint: { fontSize: 13, color: colors.textTertiary, lineHeight: 18 },
  contentContainer: { padding: 16, paddingBottom: 32, gap: 12 },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
    gap: 4,
  },
  emptyBox: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  emptyHint: { marginTop: 6, fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  employeeName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  amount: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 10 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', paddingVertical: 4, gap: 8 },
  infoLabel: { width: 120, fontSize: 13, color: colors.textTertiary },
  infoValue: { flex: 1, fontSize: 14, color: colors.textPrimary },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
  },
  editBtnText: { color: '#EA580C', fontWeight: '700', fontSize: 14 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#16A34A',
  },
  approveBtnDisabled: { opacity: 0.6 },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { type ApprovalExpense, type ExpensePerson, firstLevelApprovedBy } from '../../lib/expenseApproval';
import ExpenseDateFilterBar from '../../components/expenses/ExpenseDateFilterBar';
import { EMPTY_EXPENSE_FILTER, expenseYears, filterExpenses } from '../../lib/expenseDateFilter';

type Expense = ApprovalExpense & {
  _id: string;
  title: string;
  amount: number;
  category: string;
  createdAt: string;
  employeeId?: ExpensePerson | null;
  trainerId?: ExpensePerson | null;
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: ExpensePerson | null;
  pendingMonth?: string;
  approxKms?: number;
  trackedDistanceKm?: number;
  gpsAmount?: number | null;
};

const money = (v?: number) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '-');

interface OptionItem {
  _id: string;
  name: string;
}

export default function ExpenseFinancePendingScreen({ navigation }: any) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [df, setDf] = useState(EMPTY_EXPENSE_FILTER);
  const visible = filterExpenses(expenses, df);
  const [employees, setEmployees] = useState<OptionItem[]>([]);
  const [trainers, setTrainers] = useState<OptionItem[]>([]);
  const [filters, setFilters] = useState({ employeeId: 'all', trainerId: 'all' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFilters();
    loadData();
  }, []);

  const loadFilters = async () => {
    try {
      const [employeeData, trainerData] = await Promise.all([
        apiService.get('/employees?isActive=true').catch(() => []),
        apiService.get('/trainers?status=active').catch(() => []),
      ]);
      setEmployees(employeeData || []);
      setTrainers(trainerData || []);
    } catch {
      setEmployees([]);
      setTrainers([]);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.employeeId !== 'all') params.append('employeeId', filters.employeeId);
      if (filters.trainerId !== 'all') params.append('trainerId', filters.trainerId);
      const data = await apiService.get(`/expenses/finance-pending${params.toString() ? `?${params.toString()}` : ''}`);
      setExpenses(Array.isArray(data) ? data : []);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearch = () => {
    loadData();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  return (
    <ScreenShell
      title="Finance Approved Exp List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<PageSection title="Filters">
        <WebLabel>Employee</WebLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
          <TouchableOpacity
            style={[styles.filterChip, filters.employeeId === 'all' && styles.filterChipSelected]}
            onPress={() => setFilters((f) => ({ ...f, employeeId: 'all' }))}
          >
            <Text style={[styles.filterChipText, filters.employeeId === 'all' && styles.filterChipTextSelected]}>All</Text>
          </TouchableOpacity>
          {employees.map((emp) => (
            <TouchableOpacity
              key={emp._id}
              style={[styles.filterChip, filters.employeeId === emp._id && styles.filterChipSelected]}
              onPress={() => setFilters((f) => ({ ...f, employeeId: emp._id }))}
            >
              <Text style={[styles.filterChipText, filters.employeeId === emp._id && styles.filterChipTextSelected]}>{emp.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <WebLabel>Trainer</WebLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
          <TouchableOpacity
            style={[styles.filterChip, filters.trainerId === 'all' && styles.filterChipSelected]}
            onPress={() => setFilters((f) => ({ ...f, trainerId: 'all' }))}
          >
            <Text style={[styles.filterChipText, filters.trainerId === 'all' && styles.filterChipTextSelected]}>All</Text>
          </TouchableOpacity>
          {trainers.map((trainer) => (
            <TouchableOpacity
              key={trainer._id}
              style={[styles.filterChip, filters.trainerId === trainer._id && styles.filterChipSelected]}
              onPress={() => setFilters((f) => ({ ...f, trainerId: trainer._id }))}
            >
              <Text style={[styles.filterChipText, filters.trainerId === trainer._id && styles.filterChipTextSelected]}>{trainer.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <WebButton title="Search" onPress={handleSearch} />
      </PageSection>

      <ExpenseDateFilterBar value={df} onChange={setDf} years={expenseYears(expenses)} shown={visible.length} total={expenses.length} />
      {visible.length === 0 ? (
        <EmptyState icon="📄" title="No finance approved expenses found" />
      ) : (
        visible.map((expense) => (
          <Card key={expense._id} onPress={() => navigation.navigate('ExpenseDetail', { id: expense._id })}>
            <CardTitle
              title={expense.title || 'Expense'}
              subtitle={`₹${money(expense.approvedAmount)} approved`}
              badge="Finance approved"
              tone="success"
            />
            <InfoRow label="Employee" value={(expense.employee || expense.employeeId || expense.trainerId)?.name || 'Unknown'} />
            <InfoRow label="Category" value={expense.category || 'General'} />
            <InfoRow label="Raised" value={formatDate(expense.createdAt)} />
            <InfoRow label="Claimed" value={`₹${money(expense.employeeAmount ?? expense.amount)}`} />
            <InfoRow label="First level" value={`${firstLevelApprovedBy(expense)?.name || '-'} · ₹${money(expense.firstLevelApprovedAmount)}`} />
            {expense.category?.toLowerCase() === 'travel' ? (
              <>
                <InfoRow label="GPS KM" value={money(expense.trackedDistanceKm ?? 0)} />
                <InfoRow label="Employee KM" value={money(expense.approxKms)} />
                <InfoRow label="GPS amount" value={typeof expense.gpsAmount === 'number' ? `₹${money(expense.gpsAmount)}` : '-'} />
              </>
            ) : null}
            <InfoRow label="Finance" value={expense.approvedBy?.name || '-'} />
            <InfoRow label="Finance remarks" value={expense.financeRemarks} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filterOptions: { marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundLight,
    marginRight: 8,
  },
  filterChipSelected: { borderColor: colors.primaryDark, backgroundColor: colors.primaryDark },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  filterChipTextSelected: { color: '#FFFFFF' },
});

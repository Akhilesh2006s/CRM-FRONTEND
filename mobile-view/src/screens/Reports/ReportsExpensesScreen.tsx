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
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { downloadExpensesReport } from '../../utils/downloadExpensesReport';
import {
  type ApprovalExpense,
  type ExpensePerson,
  expenseStatusColor,
  expenseStatusText,
  firstLevelApprovedBy,
} from '../../lib/expenseApproval';

import DateField from '../../ui/DateField';
type Expense = ApprovalExpense & {
  _id: string;
  expItemId?: string;
  amount: number;
  category?: string;
  date?: string;
  employeeId?: (ExpensePerson & { zone?: string }) | null;
  trainerId?: (ExpensePerson & { zone?: string }) | null;
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: (ExpensePerson & { zone?: string }) | null;
  /** Server-computed status text (same wording as the export) */
  statusText?: string;
  /** Travel kilometres claimed (server-computed) */
  kilometres?: number;
  /** When the Finance Manager approved it (Approved expenses only) */
  financeApprovedAt?: string | null;
};

type Employee = {
  _id: string;
  name: string;
  zone?: string;
};

type Filters = {
  zone: string;
  employeeId: string;
  status: string;
  fromDate: string;
  toDate: string;
};

const emptyFilters: Filters = {
  zone: '',
  employeeId: '',
  status: '',
  fromDate: '',
  toDate: '',
};

function formatCreatedOn(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
  return `${day}-${month}-${year} ${displayHours}:${minutes}:${seconds} ${ampm}`;
}

function formatExpDate(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ReportsExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const loadMeta = useCallback(async () => {
    try {
      const [empData, allExpenses] = await Promise.all([
        apiService.get('/employees?isActive=true').catch(() => []),
        apiService.get('/expenses').catch(() => []),
      ]);
      const empList: Employee[] = Array.isArray(empData) ? empData : (empData as any)?.data || [];
      const expList: Expense[] = Array.isArray(allExpenses)
        ? allExpenses
        : (allExpenses as any)?.data || [];
      setEmployees(empList);

      const uniqueZones = new Set<string>();
      empList.forEach((emp) => {
        if (emp.zone) uniqueZones.add(emp.zone);
      });
      expList.forEach((exp) => {
        const zone = exp.employeeId?.zone || exp.trainerId?.zone;
        if (zone) uniqueZones.add(zone);
      });
      setZones(Array.from(uniqueZones).sort());
    } catch {
      // optional meta
    }
  }, []);

  const loadExpenses = useCallback(async (nextFilters: Filters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (nextFilters.zone) params.append('zone', nextFilters.zone);
      if (nextFilters.employeeId) params.append('employeeId', nextFilters.employeeId);
      if (nextFilters.status) params.append('status', nextFilters.status);
      if (nextFilters.fromDate) params.append('fromDate', nextFilters.fromDate);
      if (nextFilters.toDate) params.append('toDate', nextFilters.toDate);
      const qs = params.toString();
      const data = await apiService.get(`/expenses/report${qs ? `?${qs}` : ''}`);
      setExpenses(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadMeta();
    loadExpenses(emptyFilters);
  }, [loadMeta]);

  const onSearch = () => loadExpenses(filters);

  const onRefresh = () => {
    setRefreshing(true);
    loadMeta();
    loadExpenses(filters);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.zone) params.append('zone', filters.zone);
      if (filters.employeeId) params.append('employeeId', filters.employeeId);
      if (filters.status) params.append('status', filters.status);
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      await downloadExpensesReport(params.toString());
      Alert.alert('Success', 'Excel file downloaded successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export expenses');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenShell
      title="Expenses"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
      headerRight={
        <TouchableOpacity onPress={handleExport} disabled={exporting} style={styles.headerExport}>
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={styles.headerExportText}>{exporting ? '…' : 'Export'}</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />

        <View style={styles.filterCard}>
          <WebLabel>Zone</WebLabel>
          <WebSelect
            placeholder="All Zones"
            value={filters.zone}
            onValueChange={(v) => setFilters((f) => ({ ...f, zone: v }))}
            items={zones.map((z) => ({ label: z, value: z }))}
          />
          <WebLabel>Employee</WebLabel>
          <WebSelect
            placeholder="All Employees"
            value={filters.employeeId}
            onValueChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))}
            items={employees.map((e) => ({ label: e.name, value: e._id }))}
          />
          <WebLabel>Status</WebLabel>
          <WebSelect
            placeholder="All Status"
            value={filters.status}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            items={[
              { label: 'Pending at first level', value: 'Pending' },
              { label: 'Pending at Finance', value: 'finance' },
              { label: 'Approved', value: 'Approved' },
              { label: 'Rejected', value: 'Rejected' },
              { label: 'Sent back for correction', value: 'Needs Correction' },
            ]}
          />
          <WebLabel>From Date</WebLabel>
          <DateField placeholder="From Date" value={filters.fromDate} onChange={(v) => setFilters((f) => ({ ...f, fromDate: v }))} />
          <WebLabel>To Date</WebLabel>
          <DateField placeholder="To Date" value={filters.toDate} onChange={(v) => setFilters((f) => ({ ...f, toDate: v }))} />
          <WebButton title="Search" onPress={onSearch} />
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No expenses found</Text>
          </View>
        ) : (
          expenses.map((expense, index) => {
            const badge = expenseStatusColor(expense.status || '');
            const expNo = expense.expItemId || String(expense._id).slice(-5);
            const employeeName =
              (expense.employee || expense.employeeId || expense.trainerId)?.name || '-';
            const expenseAmount = Number(expense.employeeAmount ?? expense.amount ?? 0);
            return (
              <View key={expense._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.expNo}>#{expNo}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {expense.statusText || expenseStatusText(expense)}
                    </Text>
                  </View>
                </View>
                <InfoRow label="S.No" value={String(index + 1)} />
                <InfoRow label="Created On" value={formatCreatedOn(expense.createdAt)} />
                <InfoRow label="Exp Date" value={formatExpDate(expense.date)} />
                <InfoRow label="Employee Name" value={employeeName} />
                <InfoRow label="Kilometer" value={expense.kilometres ? String(expense.kilometres) : '-'} />
                <InfoRow label="Expense Amount" value={expenseAmount.toFixed(2)} />
                <InfoRow label="1st Level Approver" value={firstLevelApprovedBy(expense)?.name || '-'} />
                <InfoRow
                  label="1st Level Amount"
                  value={typeof expense.firstLevelApprovedAmount === 'number' ? expense.firstLevelApprovedAmount.toFixed(2) : '-'}
                />
                <InfoRow
                  label="1st Level Remarks"
                  value={firstLevelApprovedBy(expense) ? expense.managerRemarks || '-' : '-'}
                />
                <InfoRow label="Finance Approver" value={expense.status === 'Approved' ? expense.approvedBy?.name || '-' : '-'} />
                <InfoRow
                  label="Final Amount"
                  value={expense.status === 'Approved' && typeof expense.approvedAmount === 'number' ? expense.approvedAmount.toFixed(2) : '-'}
                />
                <InfoRow label="Finance Approved Date" value={expense.financeApprovedAt ? formatExpDate(expense.financeApprovedAt) : '-'} />
                <InfoRow label="Finance Remarks" value={expense.financeRemarks || '-'} />
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32, gap: 12 },
  headerExport: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerExportText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 6,
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  expNo: {
    ...typography.heading.h3,
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  infoLabel: {
    width: 130,
    ...typography.body.small,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
});

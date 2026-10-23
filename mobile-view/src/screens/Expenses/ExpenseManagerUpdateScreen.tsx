import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../utils/showAlert';
import { ExpenseBillButton } from '../../components/expenses/ExpenseBillViewer';
import {
  type ApprovalExpense,
  type ExpensePerson,
  expenseStage,
  expenseStatusText,
  firstLevelAmount,
  firstLevelApprovedBy,
} from '../../lib/expenseApproval';

type Expense = ApprovalExpense & {
  _id: string;
  title: string;
  amount: number;
  category: string;
  description?: string;
  date: string;
  /** Distance tracked by the employee's device (LocationPing) on the expense date */
  trackedDistanceKm?: number;
  expItemId?: string;
  receipt?: string;
  ticketReceipt?: string;
  transportType?: string;
  travelFrom?: string;
  travelTo?: string;
  approxKms?: number;
  employeeId?: ExpensePerson | null;
  trainerId?: ExpensePerson | null;
  employee?: ExpensePerson | null;
};

type Decision = 'approve' | 'reject';
type ItemForm = { decision: Decision; approvedAmount: string; remarks: string };

const isTravel = (e: Expense) => e.category?.toLowerCase() === 'travel';
const claimedAmount = (e: Expense) => Number(e.employeeAmount ?? e.amount) || 0;
const itemId = (e: Expense) => e.expItemId || e._id.slice(-5);
const gpsKm = (e: Expense) => e.trackedDistanceKm ?? 0;

// Legacy format: "90 Kms Tadepalligudem to Bhimavaram / By Bike"
const describe = (e: Expense) => {
  if (e.description?.trim()) return e.description;
  if (isTravel(e) && (e.travelFrom || e.travelTo)) {
    const kms = e.approxKms ? `${e.approxKms} Kms ` : '';
    const mode = e.transportType ? ` / By ${e.transportType}` : '';
    return `${kms}${e.travelFrom || '?'} to ${e.travelTo || '?'}${mode}`;
  }
  return e.title || '';
};

const pageTitle = (role: string) => {
  if (role === 'Finance Manager') return 'Finance Expense Approval';
  if (role === 'Executive Manager') return 'Zonal Manager Expense Update';
  return 'Expense Review & Approval';
};

const formatDate = (d?: string) => {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getExpenseType = (c: string) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : '-');

export default function ExpenseManagerUpdateScreen({ navigation, route }: any) {
  const employeeId: string | undefined = route?.params?.employeeId;
  const { user } = useAuth();
  const role = (user as any)?.role || '';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [employee, setEmployee] = useState<ExpensePerson | null>(null);
  const [forms, setForms] = useState<Record<string, ItemForm>>({});
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: string[] = [];
      if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) params.push(`fromDate=${fromDate}`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) params.push(`toDate=${toDate}`);
      const data: Expense[] =
        (await apiService.get(`/expenses/employee/${employeeId}${params.length ? `?${params.join('&')}` : ''}`)) || [];
      const list = Array.isArray(data) ? data : [];
      setExpenses(list);
      // Finance starts from the first-level amount; first level starts from the claim.
      const initial: Record<string, ItemForm> = {};
      list.forEach((exp) => {
        const start = expenseStage(exp) === 'finance' ? firstLevelAmount(exp) ?? claimedAmount(exp) : claimedAmount(exp);
        initial[exp._id] = { decision: 'approve', approvedAmount: String(start), remarks: '' };
      });
      setForms(initial);
      if (list.length > 0) {
        const first = list[0];
        setEmployee(first.employee || first.employeeId || first.trainerId || first.createdBy || null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, fromDate, toDate]);

  useEffect(() => {
    loadExpenses();
    // Reload on employee change only; date filters apply via Search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const setForm = (id: string, patch: Partial<ItemForm>) =>
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const parsedAmount = (e: Expense): number | null => {
    const raw = forms[e._id]?.approvedAmount;
    if (raw === undefined || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  const itemError = (e: Expense): string | null => {
    const form = forms[e._id];
    if (!form) return 'missing form';
    if (form.decision === 'approve') {
      const n = parsedAmount(e);
      if (n === null || Number.isNaN(n) || n < 0) return 'enter a valid approval amount';
    }
    return null;
  };

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => (new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0)),
    [expenses]
  );

  const totalClaimed = expenses.reduce((s, e) => s + claimedAmount(e), 0);
  const approvingList = expenses.filter((e) => forms[e._id]?.decision !== 'reject');
  const rejectingCount = expenses.length - approvingList.length;
  const totalApproved = approvingList.reduce((s, e) => {
    const n = parsedAmount(e);
    return s + (n === null || Number.isNaN(n) ? 0 : n);
  }, 0);
  // The tracked figure is per day, so count each travel day once.
  const totalGpsDistance = [
    ...new Map(expenses.filter(isTravel).map((e) => [new Date(e.date).toDateString(), gpsKm(e)] as const)).values(),
  ].reduce((s, km) => s + km, 0);
  const totalClaimedKm = expenses.filter(isTravel).reduce((s, e) => s + (Number(e.approxKms) || 0), 0);

  const goToList = () => {
    if (role === 'Executive Manager') navigation.navigate('ExpenseExecutiveManagerPending', { tab: 'decided' });
    else navigation.navigate('ExpensePending');
  };

  const handleSubmit = async () => {
    setError(null);
    setWarning(null);
    if (expenses.length === 0) {
      setError('No expenses to approve');
      return;
    }
    const invalid = sortedExpenses.find((e) => itemError(e));
    if (invalid) {
      setError(`Item ${itemId(invalid)}: ${itemError(invalid)}`);
      return;
    }
    setSubmitting(true);
    try {
      const payload = expenses.map((e) => {
        const form = forms[e._id];
        return {
          id: e._id,
          action: form.decision,
          approvedAmount: form.decision === 'approve' ? parsedAmount(e) : undefined,
          remarks: form.remarks.trim(),
        };
      });
      const res: { message?: string; failed?: { id: string; message: string }[] } = await apiService.post(
        '/expenses/approve-multiple',
        { expenses: payload }
      );
      if (res?.failed?.length) {
        setWarning(`${res.message || 'Some items failed'}. ${res.failed[0].message}`);
        loadExpenses();
        return;
      }
      showAlert('Success', res?.message || 'Expenses updated');
      goToList();
    } catch (e: any) {
      setError(e?.message || 'Failed to update expenses');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title={pageTitle(role)} loading={loading}>
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}
      {warning ? <MessageBanner type="error" message={warning} onDismiss={() => setWarning(null)} /> : null}

      <View style={styles.filterCard}>
        <View style={styles.filterRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>From (YYYY-MM-DD)</Text>
            <WebInput value={fromDate} onChangeText={setFromDate} placeholder="2026-01-01" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>To (YYYY-MM-DD)</Text>
            <WebInput value={toDate} onChangeText={setToDate} placeholder="2026-01-31" />
          </View>
        </View>
        <WebButton title="Search" onPress={loadExpenses} />
      </View>

      <View style={styles.employeeCard}>
        <Text style={styles.employeeText}>
          Employee: <Text style={styles.employeeName}>{employee?.name || '-'}</Text>
          {employee?.empCode ? <Text style={styles.muted}> ({employee.empCode})</Text> : null}
          {employee?.role ? <Text style={styles.muted}> · {employee.role}</Text> : null}
        </Text>
        <Text style={styles.hint}>
          Approving needs an approved amount (first level) or the final amount (Finance); remarks are optional. Either
          level can reject an item.
        </Text>
      </View>

      {expenses.length === 0 ? (
        <Text style={styles.empty}>No expenses awaiting your approval for this employee</Text>
      ) : (
        sortedExpenses.map((exp, index) => {
          const form = forms[exp._id];
          const stage = expenseStage(exp);
          const rejecting = form?.decision === 'reject';
          const amount = parsedAmount(exp);
          const reference = stage === 'finance' ? firstLevelAmount(exp) ?? claimedAmount(exp) : claimedAmount(exp);
          const edited = !rejecting && amount !== null && !Number.isNaN(amount) && amount !== reference;
          const firstBy = firstLevelApprovedBy(exp);
          return (
            <View key={exp._id} style={[styles.card, rejecting && styles.cardRejecting]}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {index + 1}. #{itemId(exp)} · {getExpenseType(exp.category)}
                </Text>
                <Text style={styles.cardAmount}>Rs. {claimedAmount(exp).toFixed(2)}</Text>
              </View>
              <Text style={styles.statusLine}>{expenseStatusText(exp)}</Text>
              <Text style={styles.meta}>Date of expense: {formatDate(exp.date)}</Text>
              {isTravel(exp) ? (
                <View style={styles.rowBetween}>
                  <Text style={styles.gps}>GPS: {gpsKm(exp)} Kms</Text>
                  <Text style={styles.meta}>
                    Claimed:{' '}
                    {exp.approxKms ? `${exp.approxKms} Kms${exp.transportType ? ` · ${exp.transportType}` : ''}` : '-'}
                  </Text>
                </View>
              ) : null}
              {describe(exp) ? <Text style={styles.desc}>{describe(exp)}</Text> : null}
              {exp.employeeRemarks ? <Text style={styles.meta}>Emp. remarks: {exp.employeeRemarks}</Text> : null}

              {stage === 'finance' ? (
                <View style={styles.firstLevelBox}>
                  <Text style={styles.firstLevelTitle}>First-level approval</Text>
                  <Text style={styles.meta}>
                    {firstBy?.name || 'Unknown'}
                    {firstBy?.role ? ` (${firstBy.role})` : ''} · Rs. {(firstLevelAmount(exp) ?? claimedAmount(exp)).toFixed(2)}
                  </Text>
                  {exp.managerRemarks ? <Text style={styles.meta}>“{exp.managerRemarks}”</Text> : null}
                </View>
              ) : null}

              <View style={styles.decisionRow}>
                {(['approve', 'reject'] as Decision[]).map((d) => {
                  const active = (form?.decision || 'approve') === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.decisionBtn,
                        active && (d === 'approve' ? styles.decisionApprove : styles.decisionReject),
                      ]}
                      onPress={() => setForm(exp._id, { decision: d })}
                    >
                      <Text style={[styles.decisionText, active && styles.decisionTextActive]}>
                        {d === 'approve' ? 'Approve' : 'Reject'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.filterLabel}>{stage === 'finance' ? 'Final Amount' : 'Approved Amount'}</Text>
              <WebInput
                value={form?.approvedAmount ?? ''}
                onChangeText={(t) => setForm(exp._id, { approvedAmount: t })}
                editable={!rejecting}
                keyboardType="decimal-pad"
                placeholder={stage === 'finance' ? 'Final Amount' : 'Approved Amount'}
                style={[rejecting && styles.inputDisabled, edited && styles.inputEdited]}
              />
              <WebInput
                value={form?.remarks || ''}
                onChangeText={(t) => setForm(exp._id, { remarks: t })}
                placeholder="Remarks (optional)"
                multiline
                style={styles.remarks}
              />
              {exp.receipt || exp.ticketReceipt ? (
                <View style={styles.billRow}>
                  <ExpenseBillButton label="Image 1" url={exp.receipt} />
                  <ExpenseBillButton label="Ticket" url={exp.ticketReceipt} />
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {expenses.length > 0 ? (
        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>Totals</Text>
          <Text style={styles.meta}>GPS distance: <Text style={styles.gps}>{totalGpsDistance.toFixed(2)} Kms</Text></Text>
          <Text style={styles.meta}>Kms claimed: {totalClaimedKm.toFixed(2)} Kms</Text>
          <Text style={styles.meta}>Claimed: Rs. {totalClaimed.toFixed(2)}</Text>
          <Text style={styles.metaStrong}>Approved: Rs. {totalApproved.toFixed(2)}</Text>
          <Text style={[styles.hint, { marginTop: 8 }]}>
            Approving {approvingList.length} item(s) for Rs. {totalApproved.toFixed(2)}
            {rejectingCount > 0 ? `, rejecting ${rejectingCount}` : ''}
            {totalApproved !== totalClaimed && rejectingCount === 0 ? ` (claimed Rs. ${totalClaimed.toFixed(2)})` : ''}
          </Text>
          <View style={{ marginTop: 12 }}>
            <WebButton
              title={submitting ? 'Submitting...' : rejectingCount === expenses.length ? 'Reject' : 'Approve'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filterCard: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
  employeeCard: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  employeeText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  employeeName: { color: colors.primary },
  muted: { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 32 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: 10,
    gap: 4,
  },
  cardRejecting: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  cardAmount: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  statusLine: { fontSize: 11, color: colors.textSecondary },
  meta: { fontSize: 13, color: colors.textSecondary },
  metaStrong: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  gps: { fontSize: 13, fontWeight: '600', color: colors.error },
  desc: { fontSize: 13, color: colors.textPrimary, backgroundColor: colors.backgroundMuted, padding: 8, borderRadius: radii.sm },
  firstLevelBox: { backgroundColor: '#F5F3FF', borderRadius: radii.md, padding: 8, marginTop: 4 },
  firstLevelTitle: { fontSize: 12, fontWeight: '600', color: '#6D28D9' },
  decisionRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  decisionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },
  decisionApprove: { backgroundColor: colors.success, borderColor: colors.success },
  decisionReject: { backgroundColor: colors.error, borderColor: colors.error },
  decisionText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  decisionTextActive: { color: '#fff' },
  inputDisabled: { opacity: 0.5 },
  inputEdited: { borderColor: '#FB923C', color: '#C2410C' },
  remarks: { minHeight: 60, textAlignVertical: 'top' },
  billRow: { flexDirection: 'row', marginTop: 4 },
  totalsCard: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: 4,
  },
  totalsTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
});

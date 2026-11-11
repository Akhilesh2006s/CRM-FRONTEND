import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { EmptyState } from '../../ui/Kit';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../utils/showAlert';
import { ExpenseBillButton } from '../../components/expenses/ExpenseBillViewer';
import DateField from '../../ui/DateField';
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
  /** Bike / Car amount at the policy rate for the GPS km */
  gpsAmount?: number | null;
  expItemId?: string;
  receipt?: string;
  receipts?: string[];
  ticketReceipt?: string;
  transportType?: string;
  travelFrom?: string;
  travelTo?: string;
  approxKms?: number;
  tripId?: string;
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
    if (form.decision === 'reject' && !form.remarks.trim()) return 'remarks are required to reject';
    if (form.decision === 'approve') {
      const n = parsedAmount(e);
      if (n === null || Number.isNaN(n) || n < 0) return 'enter a valid approval amount';
      const start = expenseStage(e) === 'finance' ? firstLevelAmount(e) ?? claimedAmount(e) : claimedAmount(e);
      // Approvers may reduce an amount, never raise it above the claim / the first-level amount.
      if (n > start + 0.001) {
        return `approved amount cannot be more than Rs. ${start.toFixed(2)} (${expenseStage(e) === 'finance' ? 'approved at first level' : 'claimed by the employee'})`;
      }
      if (Math.abs(n - start) > 0.001 && !form.remarks.trim()) return 'remarks are required when you change the amount';
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
            <Text style={styles.filterLabel}>From</Text>
            <DateField placeholder="From date" value={fromDate} onChange={setFromDate} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>To</Text>
            <DateField placeholder="To date" value={toDate} onChange={setToDate} />
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
        <Text style={styles.hint} numberOfLines={4}>
          Approving needs an approved amount (first level) or the final amount (Finance); remarks are required to reject or to change the amount. Either
          level can reject an item.
        </Text>
      </View>

      {expenses.length === 0 ? (
        <EmptyState icon="✅" title="Nothing to approve" message="No expenses awaiting your approval for this employee" />
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
                <View style={styles.kmBox}>
                  <View style={styles.kmCell}>
                    <Text style={styles.kmLabel}>GPS KM</Text>
                    <Text style={styles.kmValue}>{gpsKm(exp).toFixed(2)}</Text>
                    <Text style={styles.kmSub}>Start Day → End Day</Text>
                  </View>
                  <View style={styles.kmCell}>
                    <Text style={styles.kmLabel}>Employee KM</Text>
                    <Text style={[styles.kmValue, Number(exp.approxKms || 0) > gpsKm(exp) * 1.1 + 1 ? styles.kmOver : null]}>
                      {exp.approxKms ? Number(exp.approxKms).toFixed(2) : '-'}
                    </Text>
                    <Text style={styles.kmSub}>
                      {[exp.transportType, exp.tripId ? 'GPS trip' : ''].filter(Boolean).join(' · ') || 'Claimed'}
                    </Text>
                  </View>
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
                  <View style={[styles.kmBox, { marginTop: 8 }]}>
                    <View style={styles.kmCell}>
                      <Text style={styles.kmLabel}>BDE amount</Text>
                      <Text style={styles.kmValue}>{claimedAmount(exp).toFixed(2)}</Text>
                    </View>
                    <View style={styles.kmCell}>
                      <Text style={styles.kmLabel}>Manager approved</Text>
                      <Text style={styles.kmValue}>{(firstLevelAmount(exp) ?? claimedAmount(exp)).toFixed(2)}</Text>
                    </View>
                    {isTravel(exp) ? (
                      <View style={styles.kmCell}>
                        <Text style={styles.kmLabel}>GPS amount</Text>
                        <Text style={styles.kmValue}>{typeof exp.gpsAmount === 'number' ? exp.gpsAmount.toFixed(2) : '-'}</Text>
                      </View>
                    ) : null}
                  </View>
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
                placeholder={form?.decision === 'reject' ? 'Remarks (required to reject)' : 'Remarks (required if you change the amount)'}
                multiline
                style={styles.remarks}
              />
              {(exp.receipts?.length || exp.receipt || exp.ticketReceipt) ? (
                <View style={styles.billRow}>
                  {(exp.receipts?.length ? exp.receipts : exp.receipt ? [exp.receipt] : []).map((url, i, all) => (
                    <ExpenseBillButton key={url} label={all.length > 1 ? `Image ${i + 1}` : 'Image 1'} url={url} />
                  ))}
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
  kmBox: { flexDirection: 'row', gap: 8, marginTop: 8 },
  kmCell: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 8 },
  kmLabel: { fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' },
  kmValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  kmOver: { color: colors.error },
  kmSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  filterCard: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  employeeCard: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  employeeText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  employeeName: { color: colors.primaryDark },
  muted: { fontSize: 13, fontWeight: '400', color: colors.textTertiary },
  hint: { fontSize: 13, color: colors.textTertiary, marginTop: 6, lineHeight: 18 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 32 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardRejecting: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  cardAmount: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statusLine: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meta: { fontSize: 13, color: colors.textTertiary },
  metaStrong: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  gps: { fontSize: 13, fontWeight: '700', color: colors.error },
  desc: { fontSize: 13, color: colors.textPrimary, backgroundColor: colors.backgroundMuted, padding: 10, borderRadius: 10 },
  firstLevelBox: { backgroundColor: '#F5F3FF', borderRadius: 10, padding: 10, marginTop: 4 },
  firstLevelTitle: { fontSize: 13, fontWeight: '700', color: '#6D28D9' },
  decisionRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  decisionBtn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },
  decisionApprove: { backgroundColor: colors.success, borderColor: colors.success },
  decisionReject: { backgroundColor: colors.error, borderColor: colors.error },
  decisionText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  decisionTextActive: { color: '#fff' },
  inputDisabled: { opacity: 0.5 },
  inputEdited: { borderColor: '#FB923C', color: '#C2410C' },
  remarks: { minHeight: 60, textAlignVertical: 'top' },
  billRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  totalsCard: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    gap: 2,
  },
  totalsTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
});

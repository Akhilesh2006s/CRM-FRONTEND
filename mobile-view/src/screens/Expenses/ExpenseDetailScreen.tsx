import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton, DataTable } from '../../ui/WebPrimitives';
import { navigateRoot } from '../../navigation/navigationRef';
import { approvalHistory, expenseStatusText, firstLevelAmount } from '../../lib/expenseApproval';

export default function ExpenseDetailScreen({ route }: any) {
  const { id } = route.params;
  const { user } = useAuth();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get(`/expenses/${id}`);
        setExpense(data);
      } catch {
        setExpense(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const canResubmit =
    expense?.status === 'Needs Correction' &&
    user?._id &&
    String(expense?.createdBy?._id) === String(user._id);

  const money = (v?: number) => (typeof v === 'number' && Number.isFinite(v) ? `₹${v.toFixed(2)}` : '—');
  const firstAmount = expense ? firstLevelAmount(expense) : undefined;
  const fields: [string, string][] = expense
    ? [
        ['Title', expense.title],
        ['Category', expense.category],
        ['Claimed amount', money(expense.employeeAmount ?? expense.amount)],
        ['Status', expenseStatusText(expense)],
        ['Date', expense.date ? new Date(expense.date).toLocaleDateString('en-IN') : '—'],
        ['Employee remarks', expense.employeeRemarks || '—'],
        ['First-level amount', money(firstAmount)],
        ['First-level remarks', expense.managerRemarks || '—'],
        ['Final approved amount', expense.status === 'Approved' ? money(expense.approvedAmount) : '—'],
        ['Finance remarks', expense.financeRemarks || '—'],
        ['Rejection', expense.rejectionReason || '—'],
      ]
    : [];
  const history = expense ? approvalHistory(expense) : [];

  return (
    <ScreenShell title="Expense details" loading={loading} subtitle={expense ? undefined : 'Not found'}>
      {!expense && !loading ? (
        <PageSection title="Expense">
          <Text>Expense not found</Text>
        </PageSection>
      ) : (
        <PageSection title="Expense details">
          <DataTable
            columns={['Field', 'Value']}
            rows={fields.map(([k, v]) => [k, v])}
          />
          <DataTable
            columns={['Stage', 'By', 'When', 'Amount', 'Remarks']}
            rows={history.map((h) => [
              h.step,
              h.by?.name ? `${h.by.name}${h.by.role ? ` (${h.by.role})` : ''}` : '—',
              h.at ? new Date(h.at).toLocaleString('en-IN') : '—',
              money(h.amount),
              h.remarks || '—',
            ])}
          />
          {canResubmit && (
            <WebButton title="Resubmit expense" onPress={() => navigateRoot('ExpenseResubmit', { id })} />
          )}
        </PageSection>
      )}
    </ScreenShell>
  );
}

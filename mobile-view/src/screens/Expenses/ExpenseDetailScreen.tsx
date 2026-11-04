import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { colors } from '../../theme/colors';
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
        ['Date', expense.date ? new Date(expense.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'],
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
        <EmptyState icon="🧾" title="Expense not found" />
      ) : expense ? (
        <>
          <Card>
            <CardTitle
              title={expense.title || expense.category || 'Expense'}
              subtitle={money(expense.employeeAmount ?? expense.amount)}
              badge={expenseStatusText(expense)}
              tone={toneFor(expense.status)}
            />
            {fields.map(([k, v]) => (
              <InfoRow key={k} label={k} value={v} />
            ))}
          </Card>
          {history.length ? (
            <>
              <SectionTitle>Approval history</SectionTitle>
              <Card>
                {history.map((h, i) => (
                  <View key={i} style={[styles.historyRow, i === history.length - 1 && styles.historyLast]}>
                    <Text style={styles.historyStep}>{h.step}</Text>
                    <InfoRow label="By" value={h.by?.name ? `${h.by.name}${h.by.role ? ` (${h.by.role})` : ''}` : '—'} />
                    <InfoRow
                      label="When"
                      value={h.at ? new Date(h.at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    />
                    <InfoRow label="Amount" value={money(h.amount)} />
                    <InfoRow label="Remarks" value={h.remarks || '—'} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}
          {canResubmit && (
            <WebButton title="Resubmit expense" onPress={() => navigateRoot('ExpenseResubmit', { id })} />
          )}
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  historyRow: { paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  historyLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
  historyStep: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
});

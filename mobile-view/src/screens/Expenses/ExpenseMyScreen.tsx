import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { apiService } from '../../services/api';
import {
  type ApprovalExpense,
  approvalHistory,
  expenseStatusColor,
  expenseStatusText,
  inMyExpenseView,
  MY_EXPENSE_VIEWS,
  MY_EXPENSE_VIEW_EMPTY,
  MY_EXPENSE_VIEW_LABELS,
  MY_EXPENSE_VIEW_TITLES,
  toMyExpenseView,
  type MyExpenseView,
} from '../../lib/expenseApproval';
import { ExpenseBillButton } from '../../components/expenses/ExpenseBillViewer';

type Expense = ApprovalExpense & {
  _id: string;
  title?: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
  approvedAmount?: number;
  receipt?: string;
  ticketReceipt?: string;
  receiptNumber?: string;
  transportType?: string;
  travelFrom?: string;
  travelTo?: string;
  approxKms?: number;
  hotelName?: string;
  hotelAddress?: string;
  checkInDate?: string;
  checkOutDate?: string;
};


/** Completed = rejected, or approved by Finance and credited to the bank; everything else is still moving. */

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getExpenseType = (category: string) => {
  if (!category) return '-';
  if (category === 'Other' || category === 'others') return 'Others';
  return category.charAt(0).toUpperCase() + category.slice(1);
};

const money = (n?: number) => `Rs. ${Number(n ?? 0).toFixed(2)}`;

function StatusBadge({ expense }: { expense: Expense }) {
  const c = expenseStatusColor(expense.status);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{expenseStatusText(expense)}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (value === undefined || value === null || value === '' || value === '-') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ExpenseView({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  return (
    <Modal visible={!!expense} animationType="slide" onRequestClose={onClose}>
      {expense ? (
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{getExpenseType(expense.category)} Expense</Text>
              <Text style={styles.modalSub}>Raised {formatDate(expense.createdAt)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <StatusBadge expense={expense} />
            <View style={{ marginTop: spacing.md }}>
              <DetailRow label="Date" value={formatDate(expense.date)} />
              <DetailRow label="Amount" value={money(expense.employeeAmount ?? expense.amount)} />
              <DetailRow label="Approved Amount" value={expense.approvedAmount != null ? money(expense.approvedAmount) : undefined} />
              <DetailRow
                label="Travel"
                value={
                  expense.transportType
                    ? `${expense.travelFrom || '?'} → ${expense.travelTo || '?'} by ${expense.transportType}`
                    : undefined
                }
              />
              <DetailRow label="Kilometres" value={expense.approxKms ? `${expense.approxKms} km` : undefined} />
              <DetailRow label="Hotel Name" value={expense.hotelName} />
              <DetailRow label="Hotel Address" value={expense.hotelAddress} />
              <DetailRow label="Check-in" value={expense.checkInDate ? formatDate(expense.checkInDate) : undefined} />
              <DetailRow label="Check-out" value={expense.checkOutDate ? formatDate(expense.checkOutDate) : undefined} />
              <DetailRow label="Bill Number" value={expense.receiptNumber} />
              <DetailRow label="Remarks" value={expense.employeeRemarks} />
            </View>
            <Text style={styles.sectionTitle}>Approval history</Text>
            {approvalHistory(expense).map((entry, i) => (
              <Text key={i} style={styles.historyItem}>
                <Text style={{ fontWeight: '600' }}>{entry.step}</Text>
                {entry.by?.name ? ` · ${entry.by.name}` : ''}
                {entry.at ? ` · ${formatDate(entry.at)}` : ''}
                {entry.amount != null ? ` · ${money(entry.amount)}` : ''}
                {entry.remarks ? ` · “${entry.remarks}”` : ''}
              </Text>
            ))}
            {expense.receipt || expense.ticketReceipt ? (
              <View style={styles.billRow}>
                <ExpenseBillButton label="Bill" url={expense.receipt} />
                <ExpenseBillButton label="Ticket" url={expense.ticketReceipt} />
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

export default function ExpenseMyScreen({ navigation, route }: any) {
  const view: MyExpenseView = toMyExpenseView(route?.params?.view);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState<Expense | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await apiService.get('/expenses?my=true');
      setExpenses(Array.isArray(data) ? data : []);
    } catch (_) {
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener?.('focus', loadData);
    loadData();
    return unsub;
  }, [navigation, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const countFor = (v: MyExpenseView) => expenses.filter((e) => inMyExpenseView(e, v)).length;
  const shown = expenses.filter((e) => inMyExpenseView(e, view));

  return (
    <ScreenShell
      noScroll
      title={MY_EXPENSE_VIEW_TITLES[view]}
      loading={loading && !refreshing}
      headerRight={
        <TouchableOpacity onPress={() => navigation.navigate('ExpenseCreate')} style={styles.headerAction}>
          <Text style={styles.headerActionText}>+ Create</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.toggleRow}>
          {MY_EXPENSE_VIEWS.map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
              onPress={() => navigation.setParams({ view: v })}
            >
              <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                {MY_EXPENSE_VIEW_LABELS[v]} ({countFor(v)})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {shown.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {MY_EXPENSE_VIEW_EMPTY[view]}
            </Text>
          </View>
        ) : (
          shown.map((expense, index) => (
            <TouchableOpacity key={expense._id} style={styles.card} onPress={() => setViewing(expense)} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <Text style={styles.expenseTitle}>
                  {index + 1}. {getExpenseType(expense.category)}
                </Text>
                <Text style={styles.dateText}>{formatDate(expense.date)}</Text>
              </View>
              <View style={styles.amountRow}>
                <View>
                  <Text style={styles.amountLabel}>Amount</Text>
                  <Text style={styles.amountText}>{Number(expense.employeeAmount ?? expense.amount).toFixed(2)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amountLabel}>Approved Amount</Text>
                  <Text style={styles.amountText}>{expense.approvedAmount != null ? expense.approvedAmount.toFixed(2) : '-'}</Text>
                </View>
              </View>
              {expense.status === 'Rejected' && expense.rejectionReason ? (
                <Text style={styles.rejectionText}>Rejection remarks: {expense.rejectionReason}</Text>
              ) : null}
              <View style={styles.cardFooter}>
                <StatusBadge expense={expense} />
                <Ionicons name="eye-outline" size={20} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <ExpenseView expense={viewing} onClose={() => setViewing(null)} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  headerAction: { paddingHorizontal: 8, paddingVertical: 4 },
  headerActionText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  rejectionText: { fontSize: 13, color: colors.error, marginBottom: 8 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  toggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  toggleTextActive: { color: colors.primaryForeground },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  expenseTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  dateText: { fontSize: 13, color: colors.textSecondary },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  amountLabel: { fontSize: 11, color: colors.textSecondary },
  amountText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.sm, flexShrink: 1 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  modalRoot: { flex: 1, backgroundColor: colors.backgroundLight },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  modalSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  modalBody: { padding: spacing.md, paddingBottom: 40 },
  detailRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { width: 130, fontSize: 13, color: colors.textSecondary },
  detailValue: { flex: 1, fontSize: 13, color: colors.textPrimary },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.md, marginBottom: 4 },
  historyItem: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  billRow: { flexDirection: 'row', marginTop: spacing.md },
});

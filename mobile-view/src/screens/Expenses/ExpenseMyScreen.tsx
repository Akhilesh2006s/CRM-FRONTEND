import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { Card, InfoRow, EmptyState } from '../../ui/Kit';
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
          <EmptyState icon="🧾" title={MY_EXPENSE_VIEW_EMPTY[view]} />
        ) : (
          shown.map((expense, index) => (
            <Card key={expense._id} onPress={() => setViewing(expense)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expenseTitle}>
                    {index + 1}. {getExpenseType(expense.category)}
                  </Text>
                  <Text style={styles.dateText}>{formatDate(expense.date)}</Text>
                </View>
                <StatusBadge expense={expense} />
              </View>
              <InfoRow label="Amount" value={Number(expense.employeeAmount ?? expense.amount).toFixed(2)} bold />
              <InfoRow label="Approved" value={expense.approvedAmount != null ? expense.approvedAmount.toFixed(2) : '-'} />
              {expense.status === 'Rejected' && expense.rejectionReason ? (
                <Text style={styles.rejectionText}>Rejection remarks: {expense.rejectionReason}</Text>
              ) : null}
              <View style={styles.cardFooter}>
                <Text style={styles.viewText}>View details</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
              </View>
            </Card>
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
  headerAction: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accent },
  headerActionText: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  rejectionText: { fontSize: 13, color: colors.error, marginTop: 6 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundLight,
  },
  toggleBtnActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  toggleTextActive: { color: colors.primaryForeground },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  expenseTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  dateText: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  viewText: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexShrink: 1, maxWidth: 170 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalSub: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  modalBody: { padding: 16, paddingBottom: 40 },
  detailRow: { flexDirection: 'row', paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { width: 120, fontSize: 13, color: colors.textTertiary },
  detailValue: { flex: 1, fontSize: 14, color: colors.textPrimary },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  historyItem: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, lineHeight: 18 },
  billRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
});

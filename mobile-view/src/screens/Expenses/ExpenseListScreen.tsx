import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, toneFor } from '../../ui/Kit';
import { colors } from '../../theme/colors';
import MessageBanner from '../../components/MessageBanner';

import DateField from '../../ui/DateField';
import ExpenseDateFilterBar from '../../components/expenses/ExpenseDateFilterBar';
import { EMPTY_EXPENSE_FILTER, expenseYears, filterExpenses } from '../../lib/expenseDateFilter';
export default function ExpenseListScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const showMyExpenses = route?.params?.myExpenses || false;
  const [expenses, setExpenses] = useState<any[]>([]);
  const [df, setDf] = useState(EMPTY_EXPENSE_FILTER);
  const visible = filterExpenses(expenses, df);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadExpenses();
  }, [showMyExpenses]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const endpoint = showMyExpenses ? '/expenses?my=true' : '/expenses';
      const data = await apiService.get(endpoint);
      setExpenses(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (!date || !category || !amount || !description) {
      setErrorMessage('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/expenses/create', {
        date,
        category,
        amount: parseFloat(amount),
        description,
        remarks,
        employeeId: user?._id,
        createdBy: user?._id,
      });
      setSuccessMessage('Expense submitted successfully.');
      setShowAddModal(false);
      resetForm();
      loadExpenses();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || 'Failed to submit expense');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('');
    setAmount('');
    setDescription('');
    setRemarks('');
  };

  const expenseCategories = [
    'Travel',
    'Food',
    'Accommodation',
    'Training Materials',
    'Office Supplies',
    'Transport',
    'Other',
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return '#28a745';
      case 'Rejected':
        return '#dc3545';
      case 'Pending':
        return '#ffc107';
      default:
        return '#666';
    }
  };

  const fmtDate = (v?: string) =>
    v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

  return (
    <ScreenShell
      title={showMyExpenses ? 'My Expenses' : 'Expenses'}
      loading={loading}
      headerRight={
        !showMyExpenses ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} hitSlop={8}>
            <Text style={styles.addButton}>+ Add</Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      {successMessage && <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />}
      <ExpenseDateFilterBar value={df} onChange={setDf} years={expenseYears(expenses)} shown={visible.length} total={expenses.length} />
      {visible.length === 0 ? (
        <EmptyState icon="🧾" title="No expenses found" />
      ) : (
        visible.map((expense) => (
          <Card key={expense._id}>
            <CardTitle
              title={expense.category || 'N/A'}
              subtitle={`₹${expense.amount?.toFixed(2) || '0.00'}`}
              badge={expense.status || 'Pending'}
              tone={toneFor(expense.status || 'Pending')}
            />
            <InfoRow label="Description" value={expense.description || 'N/A'} />
            <InfoRow label="Date" value={fmtDate(expense.date)} />
            <InfoRow label="Remarks" value={expense.remarks} />
          </Card>
        ))
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Expense</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={10}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {errorMessage && showAddModal && (
              <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
            )}
            <PageSection title="Expense">
              <WebLabel>Date *</WebLabel>
              <DateField placeholder="Date *" value={date} onChange={setDate} />

              <View style={{ height: 12 }} />
              <WebLabel>Category *</WebLabel>
              <View style={styles.categoryGrid}>
                {expenseCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryButton, category === cat && styles.categoryButtonSelected]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.categoryButtonText, category === cat && styles.categoryButtonTextSelected]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <WebLabel>Amount *</WebLabel>
              <WebInput placeholder="Enter amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </PageSection>

            <PageSection title="Details">
              <WebLabel>Description *</WebLabel>
              <WebInput
                style={styles.textArea}
                placeholder="Enter expense description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
              <WebLabel>Remarks</WebLabel>
              <WebInput
                style={styles.textArea}
                placeholder="Optional remarks"
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={3}
              />
            </PageSection>

            <WebButton title="Submit Expense" onPress={handleSubmit} loading={submitting} disabled={submitting} />
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accent },
  addButton: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  closeButton: { fontSize: 18, color: colors.textTertiary, fontWeight: '700' },
  modalContent: { padding: 16, paddingBottom: 40 },
  textArea: { height: 96, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DCE3EC',
  },
  categoryButtonSelected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  categoryButtonText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  categoryButtonTextSelected: { color: '#FFFFFF' },
});

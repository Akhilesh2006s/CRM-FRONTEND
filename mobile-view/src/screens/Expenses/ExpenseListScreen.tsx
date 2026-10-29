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
import { WebInput, WebButton, DataTable } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

import DateField from '../../ui/DateField';
export default function ExpenseListScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const showMyExpenses = route?.params?.myExpenses || false;
  const [expenses, setExpenses] = useState<any[]>([]);
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

  return (
    <ScreenShell title="Expense List"
      loading={loading}>
      <PageSection title="Expense List">
<View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {showMyExpenses ? 'My Expenses' : 'Expenses'}
        </Text>
        {!showMyExpenses && (
          <TouchableOpacity onPress={() => setShowAddModal(true)}>
            <Text style={styles.addButton}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {successMessage && (
            <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
          )}
          {expenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No expenses found</Text>
            </View>
          ) : (
            expenses.map((expense) => (
              <View key={expense._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{expense.category || 'N/A'}</Text>
                  <Text style={styles.amount}>₹{expense.amount?.toFixed(2) || '0.00'}</Text>
                </View>
                <Text style={styles.cardSubtitle}>{expense.description || 'N/A'}</Text>
                <Text style={styles.cardSubtitle}>
                  Date: {expense.date ? new Date(expense.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                </Text>
                {expense.remarks && (
                  <Text style={styles.cardSubtitle}>Remarks: {expense.remarks}</Text>
                )}
                <Text style={[styles.status, { color: getStatusColor(expense.status) }]}>
                  {expense.status || 'Pending'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Expense</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {errorMessage && showAddModal && (
              <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
            )}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date *</Text>
              <DateField placeholder="Date *" value={date} onChange={setDate} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category *</Text>
              <View style={styles.categoryGrid}>
                {expenseCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      category === cat && styles.categoryButtonSelected,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        category === cat && styles.categoryButtonTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount *</Text>
              <WebInput
                style={styles.input}
                placeholder="Enter amount"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <WebInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter expense description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Remarks</Text>
              <WebInput
                style={[styles.input, styles.textArea]}
                placeholder="Optional remarks"
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Expense</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#007AFF',
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#007AFF',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});


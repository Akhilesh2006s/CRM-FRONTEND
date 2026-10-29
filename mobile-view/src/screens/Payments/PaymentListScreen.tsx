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
export default function PaymentListScreen({ navigation }: any) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [schoolCode, setSchoolCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await apiService.get('/payments');
      setPayments(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payments');
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
    if (!schoolCode || !customerName || !amount || !paymentMethod) {
      setErrorMessage('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/payments/create', {
        schoolCode,
        customerName,
        mobileNumber,
        amount: parseFloat(amount),
        paymentMethod,
        paymentDate,
        remarks,
        createdBy: user?._id,
      });
      setSuccessMessage('Payment added successfully.');
      setShowAddModal(false);
      resetForm();
      loadPayments();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || 'Failed to add payment');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSchoolCode('');
    setCustomerName('');
    setMobileNumber('');
    setAmount('');
    setPaymentMethod('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
  };

  const paymentMethods = ['Cash', 'Cheque', 'Online Transfer', 'UPI', 'Other'];

  return (
    <ScreenShell title="Payment List"
      loading={loading}>
      <PageSection title="Payment List">
<View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
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
          {errorMessage && (
            <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
          )}
          {payments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No payments found</Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View key={payment._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{payment.customerName || 'N/A'}</Text>
                  <Text style={styles.amount}>₹{payment.amount?.toFixed(2) || '0.00'}</Text>
                </View>
                <Text style={styles.cardSubtitle}>School Code: {payment.schoolCode || 'N/A'}</Text>
                <Text style={styles.cardSubtitle}>Method: {payment.paymentMethod || 'N/A'}</Text>
                <Text style={styles.cardSubtitle}>
                  Date: {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                </Text>
                <Text style={[styles.status, { color: payment.status === 'Approved' ? '#28a745' : '#ffc107' }]}>
                  {payment.status || 'Pending'}
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
            <Text style={styles.modalTitle}>Add Payment</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {errorMessage && showAddModal && (
              <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
            )}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>School Code *</Text>
              <WebInput
                style={styles.input}
                placeholder="Enter school code"
                value={schoolCode}
                onChangeText={setSchoolCode}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Customer Name *</Text>
              <WebInput
                style={styles.input}
                placeholder="Enter customer name"
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number</Text>
              <WebInput
                style={styles.input}
                placeholder="Enter mobile number"
                value={mobileNumber}
                onChangeText={setMobileNumber}
                keyboardType="phone-pad"
              />
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
              <Text style={styles.label}>Payment Method *</Text>
              <View style={styles.methodGrid}>
                {paymentMethods.map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.methodButton,
                      paymentMethod === method && styles.methodButtonSelected,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text
                      style={[
                        styles.methodButtonText,
                        paymentMethod === method && styles.methodButtonTextSelected,
                      ]}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Date</Text>
              <DateField placeholder="Payment Date" value={paymentDate} onChange={setPaymentDate} />
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
                <Text style={styles.submitButtonText}>Submit Payment</Text>
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
    color: '#28a745',
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
    height: 80,
    textAlignVertical: 'top',
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
  },
  methodButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  methodButtonText: {
    fontSize: 14,
    color: '#333',
  },
  methodButtonTextSelected: {
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


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
import { Card, CardTitle, InfoRow, ChipRow, EmptyState, toneFor } from '../../ui/Kit';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';
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
    <ScreenShell
      title="Payment List"
      loading={loading}
      onRefresh={loadPayments}
      headerRight={
        <TouchableOpacity onPress={() => setShowAddModal(true)} hitSlop={8} accessibilityLabel="Add payment">
          <Text style={styles.addButton}>+ Add</Text>
        </TouchableOpacity>
      }
    >
      {successMessage && (
        <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
      )}
      {errorMessage && !showAddModal && (
        <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
      )}
      {!Array.isArray(payments) || payments.length === 0 ? (
        <EmptyState icon="💳" title="No payments found" />
      ) : (
        payments.map((payment) => (
          <Card key={payment._id}>
            <CardTitle
              title={payment.customerName || 'N/A'}
              subtitle={payment.schoolCode || undefined}
              badge={payment.status || 'Pending'}
              tone={toneFor(payment.status || 'Pending')}
            />
            <InfoRow label="Amount" value={<Text style={styles.amount}>₹{payment.amount?.toFixed(2) || '0.00'}</Text>} />
            <InfoRow label="Method" value={payment.paymentMethod || 'N/A'} />
            <InfoRow
              label="Date"
              value={payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
            />
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
            <Text style={styles.modalTitle}>Add Payment</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={8}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {errorMessage && showAddModal && (
              <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
            )}
            <PageSection title="Payment">
              <WebLabel>School Code *</WebLabel>
              <WebInput placeholder="Enter school code" value={schoolCode} onChangeText={setSchoolCode} />
              <WebLabel>Customer Name *</WebLabel>
              <WebInput placeholder="Enter customer name" value={customerName} onChangeText={setCustomerName} />
              <WebLabel>Mobile Number</WebLabel>
              <WebInput placeholder="Enter mobile number" value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" />
              <WebLabel>Amount *</WebLabel>
              <WebInput placeholder="Enter amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              <WebLabel>Payment Method *</WebLabel>
              <View style={styles.methodGrid}>
                <ChipRow
                  items={paymentMethods.map((m) => ({ key: m, label: m }))}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                />
              </View>
              <WebLabel>Payment Date</WebLabel>
              <DateField placeholder="Payment Date" value={paymentDate} onChange={setPaymentDate} />
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
            <WebButton title="Submit Payment" onPress={handleSubmit} loading={submitting} disabled={submitting} />
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  addButton: { fontSize: 15, fontWeight: '700', color: colors.primary },
  amount: { fontSize: 15, fontWeight: '700', color: colors.success },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  closeButton: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  modalContent: { padding: 16, paddingBottom: 32 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  methodGrid: { marginTop: -12, marginBottom: 14 },
});

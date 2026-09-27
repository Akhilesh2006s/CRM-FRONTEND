import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Cheque', 'Other'];

export default function PaymentAddScreen({ navigation }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    customerName: '',
    schoolCode: '',
    contactName: '',
    mobileNumber: '',
    location: '',
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    paymentMethod: 'Cash',
    financialYear: '',
    chqDate: '',
    refNo: '',
    submissionNo: '',
    handoverRemarks: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    clearMessages();
    if (!form.customerName?.trim()) {
      setErrorMessage('Customer Name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.amount?.trim() || parseFloat(form.amount) <= 0) {
      setErrorMessage('Valid amount is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.paymentDate?.trim()) {
      setErrorMessage('Payment Date is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const mobileError = phoneDigitsError(form.mobileNumber, false);
    if (mobileError) {
      setErrorMessage(mobileError);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        status: 'Pending',
        createdBy: user?._id,
      };
      await apiService.post('/payments/create', payload);
      setSuccessMessage('Payment added successfully.');
      setErrorMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to add payment');
      setSuccessMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Add Payment"
    >
<ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="View Payments"
            onAction={() => navigation.navigate('PaymentList')}
          />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}
        <FormField label="Customer Name *" value={form.customerName} onChangeText={(text: string) => setForm((f) => ({ ...f, customerName: text }))} placeholder="Enter customer name" />
        <FormField label="School Code" value={form.schoolCode} onChangeText={(text: string) => setForm((f) => ({ ...f, schoolCode: text }))} placeholder="Enter school code" />
        <FormField label="Contact Name" value={form.contactName} onChangeText={(text: string) => setForm((f) => ({ ...f, contactName: text }))} placeholder="Enter contact name" />
        <FormField label="Mobile Number" value={form.mobileNumber} onChangeText={(text: string) => setForm((f) => ({ ...f, mobileNumber: sanitizePhoneDigits(text) }))} placeholder="10 to 15 digits" keyboardType="phone-pad" maxLength={15} />
        <FormField label="Location" value={form.location} onChangeText={(text: string) => setForm((f) => ({ ...f, location: text }))} placeholder="Enter location" />
        <FormField label="Payment Date *" value={form.paymentDate} onChangeText={(text: string) => setForm((f) => ({ ...f, paymentDate: text }))} placeholder="YYYY-MM-DD" />
        <FormField label="Amount *" value={form.amount} onChangeText={(text: string) => setForm((f) => ({ ...f, amount: text }))} placeholder="Enter amount" keyboardType="decimal-pad" />
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Payment Method *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalOptions}>
            {PAYMENT_MODES.map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.horizontalOption, form.paymentMethod === mode && styles.horizontalOptionSelected]}
                onPress={() => setForm((f) => ({ ...f, paymentMethod: mode }))}
              >
                <Text style={[styles.horizontalOptionText, form.paymentMethod === mode && styles.horizontalOptionTextSelected]}>
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {form.paymentMethod === 'Cheque' && (
          <>
            <FormField label="Cheque Date" value={form.chqDate} onChangeText={(text: string) => setForm((f) => ({ ...f, chqDate: text }))} placeholder="YYYY-MM-DD" />
            <FormField label="Reference Number" value={form.refNo} onChangeText={(text: string) => setForm((f) => ({ ...f, refNo: text }))} placeholder="Enter reference number" />
          </>
        )}
        <FormField label="Financial Year" value={form.financialYear} onChangeText={(text: string) => setForm((f) => ({ ...f, financialYear: text }))} placeholder="Enter financial year" />
        <FormField label="Submission No" value={form.submissionNo} onChangeText={(text: string) => setForm((f) => ({ ...f, submissionNo: text }))} placeholder="Enter submission number" />
        <View style={styles.textAreaContainer}>
          <Text style={styles.label}>Handover Remarks</Text>
          <WebInput style={styles.textArea} value={form.handoverRemarks} onChangeText={(text: string) => setForm((f) => ({ ...f, handoverRemarks: text }))} placeholder="Enter remarks" multiline numberOfLines={3} />
        </View>
        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
          </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, maxLength }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} maxLength={maxLength} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary },
  horizontalOptions: { flexDirection: 'row' },
  horizontalOption: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border },
  horizontalOptionSelected: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  horizontalOptionText: { ...typography.body.medium, color: colors.textPrimary },
  horizontalOptionTextSelected: { color: colors.primary, fontWeight: '600' },
  textAreaContainer: { marginBottom: 16 },
  textArea: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  submitButton: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
});



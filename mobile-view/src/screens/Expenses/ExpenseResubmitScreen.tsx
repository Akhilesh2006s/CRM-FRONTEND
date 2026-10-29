import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, DataTable } from '../../ui/WebPrimitives';
import { navigateRoot } from '../../navigation/navigationRef';
import DateField from '../../ui/DateField';

export default function ExpenseResubmitScreen({ route }: any) {
  const { id } = route.params;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState('travel');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [employeeRemarks, setEmployeeRemarks] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const exp = await apiService.get(`/expenses/${id}`);
        setCategory((exp.category || 'travel').toLowerCase());
        setAmount(String(exp.amount ?? ''));
        setDate(exp.date ? new Date(exp.date).toISOString().split('T')[0] : '');
        setEmployeeRemarks(exp.employeeRemarks || '');
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load expense');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('amount', amount);
      formData.append('date', date);
      formData.append('employeeRemarks', employeeRemarks);
      await apiService.upload(`/expenses/${id}/resubmit`, formData);
      Alert.alert('Success', 'Expense resubmitted for approval', [
        { text: 'OK', onPress: () => navigateRoot('ExpenseMy') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Resubmit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title="Expense Resubmit" loading={loading}>
      <PageSection title="Expense Resubmit">
<Text style={styles.title}>Resubmit expense</Text>
      <Text style={styles.label}>Category</Text>
      <WebInput style={styles.input} value={category} onChangeText={setCategory} />
      <Text style={styles.label}>Amount</Text>
      <WebInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Text style={styles.label}>Date</Text>
      <DateField placeholder="Date" value={date} onChange={setDate} />
      <Text style={styles.label}>Remarks</Text>
      <WebInput style={[styles.input, styles.area]} value={employeeRemarks} onChangeText={setEmployeeRemarks} multiline />
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Resubmit</Text>}
      </TouchableOpacity>
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { marginTop: 12, marginBottom: 4, color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 },
  area: { minHeight: 80, textAlignVertical: 'top' },
  btn: { marginTop: 24, backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});

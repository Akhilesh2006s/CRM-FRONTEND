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
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
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
    <ScreenShell title="Resubmit Expense" loading={loading}>
      <PageSection title="Expense" description="Fix the details and send it again.">
        <WebLabel>Category</WebLabel>
        <WebInput value={category} onChangeText={setCategory} />
        <WebLabel>Amount</WebLabel>
        <WebInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <WebLabel>Date</WebLabel>
        <DateField placeholder="Date" value={date} onChange={setDate} />
        <View style={{ height: 12 }} />
        <WebLabel>Remarks</WebLabel>
        <WebInput style={styles.area} value={employeeRemarks} onChangeText={setEmployeeRemarks} multiline />
      </PageSection>
      <WebButton title="Resubmit" onPress={submit} loading={submitting} disabled={submitting} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  area: { minHeight: 80, textAlignVertical: 'top' },
});

import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, DataTable } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';

export default function SettingsExpensesScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skipFinanceStage, setSkipFinanceStage] = useState(false);
  const [foodBillMandatoryAbove, setFoodBillMandatoryAbove] = useState('500');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/settings/expense-policy');
        if (data) {
          setSkipFinanceStage(!!data.skipFinanceStage);
          setFoodBillMandatoryAbove(String(data.foodBillMandatoryAbove ?? 500));
        }
      } catch {
        /* defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiService.put('/settings/expense-policy', {
        skipFinanceStage,
        foodBillMandatoryAbove: Number(foodBillMandatoryAbove) || 0,
        requireTicketForModes: ['Bus', 'Train', 'Flight'],
      });
      Alert.alert('Saved', 'Expense policy updated');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell title="Settings Expenses" loading={loading}>
      <PageSection title="Settings Expenses">
<Text style={styles.title}>Expense policy</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Skip finance stage</Text>
        <Switch value={skipFinanceStage} onValueChange={setSkipFinanceStage} />
      </View>
      <Text style={styles.label}>Food bill mandatory above (₹)</Text>
      <WebInput
        style={styles.input}
        keyboardType="numeric"
        value={foodBillMandatoryAbove}
        onChangeText={setFoodBillMandatoryAbove}
      />
      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save policy</Text>}
      </TouchableOpacity>
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 20 },
  saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600' },
});

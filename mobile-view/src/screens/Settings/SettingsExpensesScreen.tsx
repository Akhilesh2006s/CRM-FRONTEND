import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';

export default function SettingsExpensesScreen() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skipFinanceStage, setSkipFinanceStage] = useState(false);
  const [foodBillMandatoryAbove, setFoodBillMandatoryAbove] = useState('500');
  const [bikeRatePerKm, setBikeRatePerKm] = useState('2.8');
  const [carRatePerKm, setCarRatePerKm] = useState('8');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/settings/expense-policy');
        if (data) {
          setSkipFinanceStage(!!data.skipFinanceStage);
          setFoodBillMandatoryAbove(String(data.foodBillMandatoryAbove ?? 500));
          setBikeRatePerKm(String(data.bikeRatePerKm ?? 2.8));
          setCarRatePerKm(String(data.carRatePerKm ?? 8));
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
        ...(isSuperAdmin
          ? {
              bikeRatePerKm: Number(bikeRatePerKm) || 2.8,
              carRatePerKm: Number(carRatePerKm) || 8,
            }
          : {}),
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
        <Text style={styles.sectionTitle}>Travel per-km rates (Bike / Car)</Text>
        <Text style={styles.hint}>
          {isSuperAdmin
            ? 'Edit rates used for auto-calculated travel reimbursement.'
            : 'Only Super Admin can change these rates.'}
        </Text>
        <Text style={styles.label}>Bike rate (₹ per km)</Text>
        <WebInput
          style={[styles.input, !isSuperAdmin && styles.inputReadonly]}
          keyboardType="decimal-pad"
          value={bikeRatePerKm}
          editable={isSuperAdmin}
          onChangeText={setBikeRatePerKm}
        />
        <Text style={styles.label}>Car rate (₹ per km)</Text>
        <WebInput
          style={[styles.input, !isSuperAdmin && styles.inputReadonly]}
          keyboardType="decimal-pad"
          value={carRatePerKm}
          editable={isSuperAdmin}
          onChangeText={setCarRatePerKm}
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
  sectionTitle: { fontSize: 17, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 15, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 20 },
  inputReadonly: { backgroundColor: colors.backgroundLight, opacity: 0.9 },
  saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600' },
});

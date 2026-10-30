import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function SettingsExpensesScreen() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skipFinanceStage, setSkipFinanceStage] = useState(false);
  const [foodBillMandatoryAbove, setFoodBillMandatoryAbove] = useState('500');
  const [requireTicketForModes, setRequireTicketForModes] = useState(
    'Bus, Train, Flight, Other',
  );
  const [bikeRatePerKm, setBikeRatePerKm] = useState('2.8');
  const [carRatePerKm, setCarRatePerKm] = useState('8');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get<{
          skipFinanceStage?: boolean;
          foodBillMandatoryAbove?: number;
          requireTicketForModes?: string[];
          bikeRatePerKm?: number;
          carRatePerKm?: number;
        }>('/settings/expense-policy');
        if (data) {
          setSkipFinanceStage(!!data.skipFinanceStage);
          setFoodBillMandatoryAbove(String(data.foodBillMandatoryAbove ?? 500));
          setRequireTicketForModes(
            Array.isArray(data.requireTicketForModes) && data.requireTicketForModes.length
              ? data.requireTicketForModes.join(', ')
              : 'Bus, Train, Flight, Other',
          );
          setBikeRatePerKm(
            String(Number(data.bikeRatePerKm) > 0 ? data.bikeRatePerKm : 2.8),
          );
          setCarRatePerKm(
            String(Number(data.carRatePerKm) > 0 ? data.carRatePerKm : 8),
          );
        }
      } catch {
        /* keep defaults */
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
        requireTicketForModes: requireTicketForModes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
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
    <ScreenShell title="Expense policy" loading={loading} noScroll>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.intro}>
            Configure reimbursement approval. When finance stage is skipped, manager approval is
            final.
          </Text>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setSkipFinanceStage((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, skipFinanceStage && styles.checkboxChecked]}>
              {skipFinanceStage ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : null}
            </View>
            <Text style={styles.checkLabel}>
              Skip finance review (manager approval is final)
            </Text>
          </TouchableOpacity>

          <WebLabel>Food bill mandatory above (₹)</WebLabel>
          <WebInput
            style={styles.input}
            keyboardType="numeric"
            value={foodBillMandatoryAbove}
            onChangeText={setFoodBillMandatoryAbove}
          />

          <WebLabel>Travel modes requiring bill / ticket upload (comma-separated: Bike, Car, Bus, Train, Flight, Auto)</WebLabel>
          <WebInput
            style={styles.input}
            value={requireTicketForModes}
            onChangeText={setRequireTicketForModes}
            autoCapitalize="words"
          />

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Travel per-km rates (Bike / Car)</Text>
          <Text style={styles.hint}>
            Used to auto-calculate travel reimbursement when employees select Bike or Car.
            {isSuperAdmin
              ? ' You can edit these rates below.'
              : ' Only Super Admin can change these values.'}
          </Text>

          <View style={styles.rateRow}>
            <View style={styles.rateField}>
              <WebLabel>Bike rate (₹ per km)</WebLabel>
              <WebInput
                style={[styles.input, !isSuperAdmin && styles.inputReadonly]}
                keyboardType="decimal-pad"
                value={bikeRatePerKm}
                editable={isSuperAdmin}
                onChangeText={setBikeRatePerKm}
              />
            </View>
            <View style={styles.rateField}>
              <WebLabel>Car rate (₹ per km)</WebLabel>
              <WebInput
                style={[styles.input, !isSuperAdmin && styles.inputReadonly]}
                keyboardType="decimal-pad"
                value={carRatePerKm}
                editable={isSuperAdmin}
                onChangeText={setCarRatePerKm}
              />
            </View>
          </View>

          <WebButton
            title={saving ? 'Saving…' : 'Save policy'}
            onPress={save}
            disabled={saving}
            loading={saving}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 4,
  },
  intro: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkLabel: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
  input: {
    marginBottom: 14,
  },
  inputReadonly: {
    backgroundColor: '#F1F5F9',
    opacity: 0.95,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  rateField: {
    flex: 1,
    minWidth: 140,
  },
});

/** Mirrors web components/clients/ContractEditor.tsx: Admins set length + start; end follows. */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/colors';
import { WebButton, WebLabel, WebSelect } from '../../ui/WebPrimitives';
import { ContractPeriod, type ContractFields } from './ContractPeriod';

const toDateInput = (value?: string | Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

export function ContractEditor({
  schoolId,
  contract,
  canEdit,
  onSaved,
}: {
  schoolId: string;
  contract?: ContractFields | null;
  canEdit: boolean;
  onSaved?: (contract: ContractFields) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [years, setYears] = useState(String(contract?.contract_years || 1));
  const [start, setStart] = useState(toDateInput(contract?.contract_start));
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const save = async () => {
    if (!start) {
      Alert.alert('Contract', 'Choose the contract start date.');
      return;
    }
    setSaving(true);
    try {
      const saved = await apiService.put(`/dc-orders/${schoolId}/contract`, {
        contract_years: Number(years),
        contract_start: start,
      });
      Alert.alert('Success', 'Contract saved');
      setEditing(false);
      onSaved?.(saved || {});
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save the contract');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ContractPeriod contract={contract} />
        </View>
        {canEdit ? (
          <WebButton
            variant="outline"
            title={contract?.contract_end ? 'Edit contract' : 'Set contract'}
            onPress={() => {
              setYears(String(contract?.contract_years || 1));
              setStart(toDateInput(contract?.contract_start));
              setEditing(true);
            }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.editor}>
      <WebSelect
        label="Length"
        value={years}
        onValueChange={(v) => setYears(v || '1')}
        items={[1, 2, 3].map((n) => ({ label: `${n} year${n > 1 ? 's' : ''}`, value: String(n) }))}
      />
      <WebLabel>Start date</WebLabel>
      {Platform.OS === 'web' ? (
        React.createElement('input', {
          type: 'date',
          value: start,
          'aria-label': 'Contract start date',
          onChange: (e: any) => setStart(e.target.value),
          style: {
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #E2E8F0',
            fontSize: 15,
            marginBottom: 12,
            boxSizing: 'border-box',
          },
        })
      ) : (
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <Text style={start ? styles.dateText : styles.datePlaceholder}>{start || 'Pick start date'}</Text>
        </TouchableOpacity>
      )}
      {showPicker && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={start ? new Date(start) : new Date()}
          mode="date"
          display="default"
          onChange={(event, d) => {
            setShowPicker(Platform.OS === 'ios');
            if (event.type !== 'dismissed' && d) setStart(toDateInput(d));
          }}
        />
      ) : null}
      <View style={styles.actions}>
        <WebButton title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
        <WebButton title="Cancel" variant="outline" onPress={() => setEditing(false)} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  editor: { gap: 4 },
  dateBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.backgroundLight,
    marginBottom: 12,
  },
  dateText: { fontSize: 15, color: colors.textPrimary },
  datePlaceholder: { fontSize: 15, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 8 },
});

/** Mobile port of the web components/dc/AbacusMaterialsFields.tsx. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { WebInput, WebLabel } from '../../ui/WebPrimitives';

export function AbacusMaterialsFields({
  studentQuantity,
  masterQuantity,
  masterQuantityInput,
  onMasterQuantityChange,
  masterUnitPrice,
  onMasterUnitPriceChange,
  hint,
  disabled = false,
}: {
  studentQuantity: number;
  masterQuantity: number;
  masterQuantityInput: string;
  onMasterQuantityChange: (value: string) => void;
  masterUnitPrice: string;
  onMasterUnitPriceChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>First DC · Abacus materials</Text>
      <WebLabel>Student Abacus quantity (one per student)</WebLabel>
      <WebInput value={String(studentQuantity)} editable={false} style={styles.readOnly} />
      <WebLabel>Flash Card sets (with Master Abacus)</WebLabel>
      <WebInput value={String(masterQuantity)} editable={false} style={styles.readOnly} />
      <WebLabel>Master Abacus quantity</WebLabel>
      <WebInput
        value={masterQuantityInput}
        editable={!disabled}
        keyboardType="number-pad"
        onChangeText={(v) => onMasterQuantityChange(v.replace(/[^\d]/g, ''))}
      />
      <WebLabel>Master Abacus unit price (₹, if charged)</WebLabel>
      <WebInput
        value={masterUnitPrice}
        editable={!disabled}
        keyboardType="decimal-pad"
        onChangeText={(v) => onMasterUnitPriceChange(v.replace(/[^\d.]/g, ''))}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginTop: 12, backgroundColor: '#fff' },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  readOnly: { backgroundColor: colors.backgroundMuted, color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textSecondary },
});

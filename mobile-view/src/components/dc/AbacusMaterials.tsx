import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme/colors';
import { WebInput, WebLabel } from '../../ui/WebPrimitives';

export type AbacusMaterialsData = {
  studentAbacusQuantity?: number;
  masterAbacusQuantity?: number;
  flashCardSetsQuantity?: number;
  masterAbacusUnitPrice?: number;
  masterAbacusCharge?: number;
};

/** Read-only Student Abacus / Master Abacus / Flash Cards lines that ship with an Abacus DC (web AbacusMaterialsSummary). */
export function AbacusMaterialsSummary({ materials }: { materials?: AbacusMaterialsData | null }) {
  if (!materials) return null;
  const rows = [
    { label: 'Student Abacus', quantity: Number(materials.studentAbacusQuantity) || 0, note: 'One per Abacus student' },
    {
      label: 'Master Abacus',
      quantity: Number(materials.masterAbacusQuantity) || 0,
      note:
        Number(materials.masterAbacusCharge) > 0
          ? `₹${Number(materials.masterAbacusUnitPrice) || 0} each · ₹${Number(materials.masterAbacusCharge).toLocaleString('en-IN')} billed`
          : 'No charge',
    },
    { label: 'Flash Card sets', quantity: Number(materials.flashCardSetsQuantity) || 0, note: 'With the Master Abacus' },
  ].filter((r) => r.quantity > 0);
  if (!rows.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Abacus materials</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.line}>
          <Text style={[styles.cell, styles.bold]}>{r.label}</Text>
          <Text style={[styles.cell, styles.qty]}>{r.quantity}</Text>
          <Text style={[styles.cell, styles.muted]}>{r.note}</Text>
        </View>
      ))}
    </View>
  );
}

/** Student / Master Abacus + Flash Card fields shown inside the DC product forms (web AbacusMaterialsFields). */
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
    <View style={styles.card}>
      <Text style={styles.title}>First DC · Abacus materials</Text>
      <WebLabel>Student Abacus quantity (one per student)</WebLabel>
      <WebInput value={String(studentQuantity)} editable={false} />
      <WebLabel>Flash Card sets (with Master Abacus)</WebLabel>
      <WebInput value={String(masterQuantity)} editable={false} />
      <WebLabel>Master Abacus quantity</WebLabel>
      <WebInput
        value={masterQuantityInput}
        editable={!disabled}
        keyboardType="number-pad"
        onChangeText={(t) => onMasterQuantityChange(t.replace(/[^0-9]/g, ''))}
      />
      <WebLabel>Master Abacus unit price (₹, if charged)</WebLabel>
      <WebInput
        value={masterUnitPrice}
        editable={!disabled}
        keyboardType="decimal-pad"
        onChangeText={(t) => onMasterUnitPriceChange(t.replace(/[^0-9.]/g, ''))}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.backgroundMuted,
    padding: 12,
    marginVertical: 8,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  line: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 6, gap: 8 },
  cell: { fontSize: 13, color: colors.textPrimary },
  bold: { flex: 1.2, fontWeight: '600' },
  qty: { flex: 0.6 },
  muted: { flex: 2, fontSize: 12, color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textSecondary },
});

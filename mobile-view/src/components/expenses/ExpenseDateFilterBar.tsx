import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import DateField from '../../ui/DateField';
import { MONTH_OPTIONS, EMPTY_EXPENSE_FILTER, type ExpenseDateFilter } from '../../lib/expenseDateFilter';

const MONTH_ITEMS = MONTH_OPTIONS.map((m, i) => ({ label: m, value: String(i + 1) }));

/** Search + Date + Month + Year, shown above every Expense list (same as the web). */
export default function ExpenseDateFilterBar({
  value,
  onChange,
  years,
  shown,
  total,
}: {
  value: ExpenseDateFilter;
  onChange: (next: ExpenseDateFilter) => void;
  years: string[];
  shown?: number;
  total?: number;
}) {
  const set = (patch: Partial<ExpenseDateFilter>) => onChange({ ...value, ...patch });
  const active = !!(value.search || value.date || value.month || value.year);
  return (
    <View style={styles.box}>
      <WebInput
        placeholder="Search employee, code, type, description…"
        value={value.search}
        onChangeText={(search) => set({ search })}
      />
      <DateField placeholder="Date" value={value.date} onChange={(date) => set({ date })} />
      <View style={styles.row}>
        <View style={styles.col}>
          <WebSelect value={value.month} onValueChange={(month) => set({ month })} items={MONTH_ITEMS} placeholder="All months" />
        </View>
        <View style={styles.col}>
          <WebSelect
            value={value.year}
            onValueChange={(year) => set({ year })}
            items={years.map((y) => ({ label: y, value: y }))}
            placeholder="All years"
          />
        </View>
      </View>
      {active ? (
        <View style={styles.footer}>
          <Text style={styles.count}>{total != null ? `Showing ${shown ?? 0} of ${total}` : ''}</Text>
          <TouchableOpacity onPress={() => onChange(EMPTY_EXPENSE_FILTER)} hitSlop={8}>
            <Text style={styles.clear}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, gap: 8, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: colors.textTertiary, fontSize: 12 },
  clear: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { type LeaveBalance, longDay, fmtDays } from '../../lib/leavePolicy';

/** Paid leave this month, comp-offs (holidays worked) and loss of pay this year. */
export default function LeaveBalanceCard({ balance }: { balance: LeaveBalance | null }) {
  if (!balance) return null;
  const m = balance.monthlyPaidLeave;
  const c = balance.compOff;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>Paid leave this month</Text>
          <Text style={styles.value}>
            {m.remaining}
            <Text style={styles.of}> / {m.allowance}</Text>
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Comp-Offs available</Text>
          <Text style={[styles.value, styles.green]}>{c.available}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Loss of pay this year</Text>
          <Text style={[styles.value, balance.lopDaysThisYear > 0 ? styles.red : null]}>{fmtDays(balance.lopDaysThisYear)}</Text>
        </View>
      </View>
      <Text style={styles.note}>
        {c.earned} earned, {c.used} used · {c.resetsOn ? `Comp-Offs reset on ${longDay(c.resetsOn)}` : 'Comp-Offs carry forward'}
      </Text>
      <Text style={styles.note}>Sick Leave or Company Paid Leave, no salary deduction (1 paid leave a month).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  label: { fontSize: 11, color: '#6B7280', textTransform: 'uppercase' },
  value: { fontSize: 20, fontWeight: '700', color: colors.primaryDark, marginTop: 2 },
  green: { color: '#047857' },
  red: { color: '#B91C1C' },
  of: { fontSize: 13, fontWeight: '400', color: '#6B7280' },
  note: { fontSize: 12, color: '#6B7280', marginTop: 6 },
});

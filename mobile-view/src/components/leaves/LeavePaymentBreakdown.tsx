import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { type LeaveAllocation, SOURCE_LABELS, shortDay, fmtDays } from '../../lib/leavePolicy';

/** How a leave's days are paid: monthly leave, comp-off or loss of pay, with sandwich days. */
export default function LeavePaymentBreakdown({ allocation }: { allocation: LeaveAllocation | null }) {
  if (!allocation || !allocation.entries) return null;
  const { chargedDays, monthlyDays, compOffDays, lopDays, sandwichDates } = allocation;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Leave counted: {fmtDays(chargedDays)}</Text>
      {sandwichDates.length > 0 && (
        <Text style={styles.sandwich}>
          {allocation.sandwichRuns?.length
            ? allocation.sandwichRuns
                .map(
                  (r) =>
                    `Sandwich: ${r.dates.map(shortDay).join(', ')} ${r.dates.length === 1 ? 'counts' : 'count'} as leave because you are on leave on ${shortDay(r.before)} and ${shortDay(r.after)}.`
                )
                .join(' ')
            : `Sandwich: ${sandwichDates.map(shortDay).join(', ')} ${sandwichDates.length === 1 ? 'counts' : 'count'} as leave (leave on the working day before and after).`}
        </Text>
      )}
      {monthlyDays > 0 && <Text style={styles.line}>{SOURCE_LABELS.monthly}: {fmtDays(monthlyDays)}</Text>}
      {compOffDays > 0 && <Text style={styles.line}>{SOURCE_LABELS.compoff}: {fmtDays(compOffDays)}</Text>}
      {lopDays > 0 && <Text style={[styles.line, styles.lop]}>{SOURCE_LABELS.lop}: {fmtDays(lopDays)}</Text>}
      {chargedDays === 0 && <Text style={styles.line}>No working days in this range (Sundays / company holidays).</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginTop: 10, gap: 4 },
  title: { fontWeight: '700', color: '#111827', fontSize: 14 },
  sandwich: { color: '#92400E', backgroundColor: '#FFFBEB', borderRadius: 6, padding: 6, fontSize: 13 },
  line: { color: '#374151', fontSize: 13 },
  lop: { color: '#B91C1C', fontWeight: '700' },
});

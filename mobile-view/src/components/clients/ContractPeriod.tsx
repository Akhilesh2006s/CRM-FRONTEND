/** Mirrors web components/clients/ContractPeriod.tsx */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export type ContractFields = {
  contract_years?: number | null;
  contract_start?: string | Date | null;
  contract_end?: string | Date | null;
};

const fmt = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Whole days from today to the contract end (negative once it has ended). */
export function contractDaysLeft(end: string | Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  return Math.round((last.getTime() - today.getTime()) / 86400000);
}

export function contractDueLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Ended ${-daysLeft} day${daysLeft === -1 ? '' : 's'} ago`;
  if (daysLeft === 0) return 'Ends today';
  return `Ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
}

/** Red once ended, amber within 60 days, green otherwise. */
export function contractDueTone(daysLeft: number): { bg: string; fg: string } {
  if (daysLeft < 0) return { bg: '#FEE2E2', fg: '#B91C1C' };
  if (daysLeft <= 60) return { bg: '#FEF3C7', fg: '#92400E' };
  return { bg: '#DCFCE7', fg: '#15803D' };
}

/** "2-year · 16 Dec 2024 – 16 Dec 2026" with a due badge; "—" when no contract is set. */
export function ContractPeriod({
  contract,
  compact = false,
}: {
  contract?: ContractFields | null;
  compact?: boolean;
}) {
  if (!contract?.contract_end) return <Text style={styles.empty}>—</Text>;
  const daysLeft = contractDaysLeft(contract.contract_end);
  const tone = contractDueTone(daysLeft);
  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>
        {contract.contract_years ? (
          <Text style={styles.bold}>{contract.contract_years}-year</Text>
        ) : (
          'Contract'
        )}
        {!compact && contract.contract_start
          ? ` · ${fmt(contract.contract_start)} – ${fmt(contract.contract_end)}`
          : ''}
        {compact ? ` · ends ${fmt(contract.contract_end)}` : ''}
      </Text>
      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
        <Text style={[styles.badgeText, { color: tone.fg }]}>{contractDueLabel(daysLeft)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, flexShrink: 1 },
  empty: { color: colors.textMuted, fontSize: 13 },
  line: { fontSize: 12, color: colors.textPrimary },
  bold: { fontWeight: '700' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
});

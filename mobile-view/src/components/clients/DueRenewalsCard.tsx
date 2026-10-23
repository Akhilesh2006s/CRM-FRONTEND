/**
 * Mirrors web components/clients/DueRenewalsCard.tsx: client schools whose contract ends within
 * the chosen window (ended ones included). GET /dc-orders/renewals-due?days=N scopes by role.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { apiService } from '../../services/api';
import { colors, radii } from '../../theme/colors';
import { WebButton, WebSelect } from '../../ui/WebPrimitives';
import { ContractPeriod } from './ContractPeriod';

export type DueRenewalRow = {
  _id: string;
  school_name?: string;
  school_code?: string;
  dc_code?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  city?: string;
  location?: string;
  assigned_to?: { _id?: string; name?: string } | null;
  productNames?: string[];
  contract_years?: number;
  contract_start?: string;
  contract_end?: string;
  daysLeft: number;
  hasOpenRenewalLead: boolean;
};

const WINDOWS = [
  { value: '0', label: 'Ended (overdue) only' },
  { value: '30', label: 'Ending in 30 days' },
  { value: '60', label: 'Ending in 60 days' },
  { value: '90', label: 'Ending in 90 days' },
  { value: '180', label: 'Ending in 180 days' },
];

export function DueRenewalsCard({
  onStartRenewal,
  refreshKey = 0,
}: {
  onStartRenewal: (row: DueRenewalRow) => void;
  refreshKey?: number;
}) {
  const [days, setDays] = useState('90');
  const [rows, setRows] = useState<DueRenewalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiService.get(`/dc-orders/renewals-due?days=${days}`);
      const data: DueRenewalRow[] = Array.isArray(res?.data) ? res.data : [];
      setRows(days === '0' ? data.filter((row) => row.daysLeft < 0) : data);
    } catch (e: any) {
      setError(e?.message || 'Could not load schools due for renewal.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Due for renewal</Text>
      <Text style={styles.sub}>Client schools whose contract has ended or ends soon.</Text>
      <WebSelect value={days} onValueChange={(v) => setDays(v || '90')} items={WINDOWS} />

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : error ? (
        <View style={styles.errorRow}>
          <Text style={styles.error}>{error}</Text>
          <WebButton title="Retry" variant="outline" onPress={load} />
        </View>
      ) : rows.length === 0 ? (
        <Text style={styles.muted}>No client schools are due in this window.</Text>
      ) : (
        rows.map((row) => (
          <View key={row._id} style={styles.item}>
            <Text style={styles.school}>{row.school_name || '-'}</Text>
            <Text style={styles.code}>{row.school_code || row.dc_code || '-'}</Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>BDE: </Text>
              {row.assigned_to?.name || '-'}
            </Text>
            <Text style={styles.meta}>
              <Text style={styles.metaLabel}>Products: </Text>
              {(row.productNames || []).join(', ') || '-'}
            </Text>
            <View style={styles.contractRow}>
              <ContractPeriod contract={row} />
            </View>
            <View style={styles.actionRow}>
              {row.hasOpenRenewalLead ? (
                <View style={styles.openBadge}>
                  <Text style={styles.openBadgeText}>Renewal lead open</Text>
                </View>
              ) : (
                <WebButton title="Start renewal" onPress={() => onStartRenewal(row)} />
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: 10 },
  muted: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 16 },
  errorRow: { alignItems: 'center', gap: 8, paddingVertical: 10 },
  error: { fontSize: 13, color: colors.error, textAlign: 'center' },
  item: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  school: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  code: { fontSize: 12, color: '#1D4ED8', fontFamily: 'monospace', marginBottom: 4 },
  meta: { fontSize: 12, color: colors.textPrimary, marginTop: 2 },
  metaLabel: { color: colors.textSecondary },
  contractRow: { marginTop: 6 },
  actionRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  openBadge: { backgroundColor: '#DBEAFE', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  openBadgeText: { fontSize: 12, fontWeight: '600', color: '#1D4ED8' },
});

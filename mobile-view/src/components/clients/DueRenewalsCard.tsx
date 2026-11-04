/**
 * Mirrors web components/clients/DueRenewalsCard.tsx: client schools whose contract ends within
 * the chosen window (ended ones included). GET /dc-orders/renewals-due?days=N scopes by role.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { WebButton, WebSelect } from '../../ui/WebPrimitives';
import { ContractPeriod } from './ContractPeriod';
import { CardTitle, InfoRow } from '../../ui/Kit';

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
            <CardTitle
              title={row.school_name || '-'}
              subtitle={row.school_code || row.dc_code || undefined}
              badge={row.hasOpenRenewalLead ? 'Renewal lead open' : undefined}
              tone="info"
            />
            <InfoRow label="BDE" value={row.assigned_to?.name || undefined} />
            <InfoRow label="Mobile" value={row.contact_mobile || undefined} phone />
            <InfoRow label="Products" value={(row.productNames || []).join(', ') || undefined} />
            <View style={styles.contractRow}>
              <ContractPeriod contract={row} />
            </View>
            {row.hasOpenRenewalLead ? null : (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.startBtn} onPress={() => onStartRenewal(row)}>
                  <Text style={styles.startBtnText}>Start renewal</Text>
                </TouchableOpacity>
              </View>
            )}
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
    borderColor: '#EEF2F7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textTertiary, marginTop: 2, marginBottom: 12 },
  muted: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 16 },
  errorRow: { alignItems: 'center', gap: 8, paddingVertical: 10 },
  error: { fontSize: 13, color: colors.error, textAlign: 'center' },
  item: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12, paddingBottom: 12 },
  contractRow: { marginTop: 6 },
  actionRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
  startBtn: { backgroundColor: colors.primaryDark, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  startBtnText: { fontSize: 14, fontWeight: '700', color: colors.primaryForeground },
});

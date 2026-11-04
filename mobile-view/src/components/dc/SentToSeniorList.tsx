import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { Card, CardTitle, InfoRow, EmptyState, type Tone } from '../../ui/Kit';
import { WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

type SentOrder = {
  _id: string;
  school_name?: string;
  school_code?: string;
  dc_code?: string;
  zone?: string;
  updatedAt?: string;
  status?: string;
  workflowStage?: string;
  assigned_to?: { name?: string } | string | null;
};

/** Where a raised DC is now: Senior Coordinator, warehouse, or delivered (web SentToSeniorList). */
export function dcStageLabel(row: SentOrder): { label: string; bg: string; fg: string } {
  if (row.status === 'completed' || row.workflowStage === 'CompletedDC') {
    return { label: 'Completed', bg: colors.successLight, fg: '#166534' };
  }
  if (row.workflowStage === 'EmpDC') return { label: 'At Warehouse', bg: colors.infoLight, fg: '#1E40AF' };
  return { label: 'With Senior Coordinator', bg: colors.warningLight, fg: '#92400E' };
}

/** Read-only list of DCs the Coordinator raised after they leave Closed Sales. */
export function SentToSeniorList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<SentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const lists = await Promise.all(
        ['dc_sent_to_senior', 'completed'].map((status) =>
          apiService.get(`/dc-orders?status=${status}&limit=200`).catch(() => [])
        )
      );
      const list: SentOrder[] = lists.flatMap((res: any) => (Array.isArray(res) ? res : res?.data || []));
      setRows(list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))));
    } catch (e: any) {
      setError(e?.message || 'Could not load DC status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const tone = (label: string): Tone => (label === 'Completed' ? 'success' : label === 'At Warehouse' ? 'info' : 'warning');

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>DC Status</Text>
          <Text style={styles.sub}>Where each DC you raised is now.</Text>
        </View>
        <View style={styles.refresh}>
          <WebButton title="Refresh" variant="outline" onPress={load} />
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : error ? (
        <Text style={[styles.empty, { color: colors.error }]}>{error}</Text>
      ) : rows.length === 0 ? (
        <EmptyState title="No DCs raised yet" />
      ) : (
        rows.map((row) => {
          const stage = dcStageLabel(row);
          const bde = typeof row.assigned_to === 'object' && row.assigned_to ? row.assigned_to.name || '-' : '-';
          return (
            <Card key={row._id}>
              <CardTitle title={row.school_name || '-'} badge={stage.label} tone={tone(stage.label)} />
              <InfoRow label="Code" value={row.school_code || row.dc_code || '-'} />
              <InfoRow label="Zone" value={row.zone || '-'} />
              <InfoRow label="BDE" value={bde} />
              <InfoRow
                label="Updated"
                value={row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
              />
            </Card>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  refresh: { minWidth: 110 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  empty: { textAlign: 'center', paddingVertical: 16, fontSize: 13, color: colors.textSecondary },
});

export default SentToSeniorList;

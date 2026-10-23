import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radii } from '../../theme/colors';
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

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>DC Status</Text>
          <Text style={styles.sub}>
            DCs you raised and where each one is now: with the Senior Coordinator, at the warehouse, or completed.
          </Text>
        </View>
        <WebButton title="Refresh" variant="outline" onPress={load} />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : error ? (
        <Text style={[styles.empty, { color: colors.error }]}>{error}</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No DCs raised yet.</Text>
      ) : (
        rows.map((row) => {
          const stage = dcStageLabel(row);
          const bde = typeof row.assigned_to === 'object' && row.assigned_to ? row.assigned_to.name || '-' : '-';
          return (
            <View key={row._id} style={styles.item}>
              <View style={styles.itemTop}>
                <Text style={styles.school} numberOfLines={2}>
                  {row.school_name || '-'}
                </Text>
                <View style={[styles.badge, { backgroundColor: stage.bg }]}>
                  <Text style={[styles.badgeText, { color: stage.fg }]}>{stage.label}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                Code: {row.school_code || row.dc_code || '-'} · Zone: {row.zone || '-'} · BDE: {bde}
              </Text>
              <Text style={styles.meta}>
                Updated: {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('en-IN') : '-'}
              </Text>
            </View>
          );
        })
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
    padding: 12,
    marginTop: 16,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', paddingVertical: 16, fontSize: 13, color: colors.textSecondary },
  item: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: 8 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  school: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});

export default SentToSeniorList;

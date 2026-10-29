import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { apiService } from '../../services/api';

type ArchiveRow = {
  _id: string;
  previousName?: string;
  email?: string;
  yearlySalary?: number;
  monthlyTakeHome?: number;
  archivedAt?: string;
  note?: string;
  personal?: Record<string, unknown>;
  leaves?: unknown[];
  paySlips?: unknown[];
  [key: string]: unknown;
};

const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

function labelFor(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}

/** Recursive renderer — same rules as the web DetailValue (hides password / __v). */
function DetailValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <Text style={styles.muted}>—</Text>;
  if (typeof value === 'boolean') return <Text style={styles.value}>{value ? 'Yes' : 'No'}</Text>;
  if (Array.isArray(value)) {
    if (!value.length) return <Text style={styles.muted}>None</Text>;
    return (
      <View style={{ gap: 6 }}>
        {value.map((item, index) => (
          <View key={index} style={styles.arrayItem}>
            <DetailValue value={item} />
          </View>
        ))}
      </View>
    );
  }
  if (typeof value === 'object') {
    return (
      <View style={{ gap: 6 }}>
        {Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !['password', '__v'].includes(key))
          .map(([key, item]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.fieldLabel}>{labelFor(key)}</Text>
              <View style={{ marginTop: 3 }}>
                <DetailValue value={item} />
              </View>
            </View>
          ))}
      </View>
    );
  }
  return <Text style={styles.value}>{String(value)}</Text>;
}

/** Web: app/dashboard/employees/history/page.tsx — GET /hr/history, GET /hr/history/:id. */
export default function EmployeeHistoryScreen() {
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ArchiveRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/hr/history');
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (e: any) {
      setError(errMsg(e, 'Failed to load history'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showDetails = async (id: string) => {
    setLoadingDetail(id);
    try {
      setSelected((await apiService.get(`/hr/history/${id}`)) as ArchiveRow);
    } catch (e: any) {
      setError(errMsg(e, 'Failed to load employee details'));
    } finally {
      setLoadingDetail(null);
    }
  };

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');

  return (
    <ScreenShell
      title="Employee History"
      subtitle="Archived personal records kept for audit"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.help}>Archived personal records kept for audit. They are not shown on the employee login.</Text>
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      {!loading && rows.length === 0 ? <Text style={styles.empty}>No archived employee records.</Text> : null}

      {rows.map((row) => (
        <View key={row._id} style={styles.card}>
          <Text style={styles.name}>{row.previousName || '—'}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Login</Text>
            <Text style={styles.rowValue}>{row.email || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Yearly salary</Text>
            <Text style={styles.rowValue}>{row.yearlySalary ?? '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Take-home</Text>
            <Text style={styles.rowValue}>{row.monthlyTakeHome ?? '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Archived</Text>
            <Text style={styles.rowValue}>{fmtDate(row.archivedAt)}</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <WebButton
              title="View complete details"
              variant="outline"
              onPress={() => void showDetails(row._id)}
              disabled={!!loadingDetail}
              loading={loadingDetail === row._id}
            />
          </View>
        </View>
      ))}

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{selected?.previousName || 'Employee'} — Complete details</Text>
              <Text style={styles.modalSub}>Archived {fmtDate(selected?.archivedAt)}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>
            {selected ? <DetailValue value={selected} /> : null}
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 32 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  field: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: 8,
  },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  arrayItem: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: 6,
  },
  value: { fontSize: 13, color: colors.textPrimary },
  muted: { fontSize: 13, color: colors.textMuted },
});

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const words = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((row) => {
    if (!words.length) return true;
    const text = [row.previousName, row.email, row.yearlySalary, row.monthlyTakeHome, fmtDate(row.archivedAt)]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return words.every((w) => text.includes(w));
  });

  return (
    <ScreenShell
      title="Employee History\"
      subtitle="Archived records kept for audit (not shown on login)"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      <WebInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search name, login, date…"
      />
      {!loading && filtered.length === 0 ? (
        <EmptyState icon="🗂️" title="No archived employee records" message={searchQuery ? 'Try a different search.' : undefined} />
      ) : null}

      {filtered.map((row) => (
        <Card key={row._id}>
          <CardTitle title={row.previousName || '—'} badge="Archived" tone="neutral" />
          <InfoRow label="Login" value={row.email} />
          <InfoRow label="Yearly salary" value={row.yearlySalary == null ? undefined : String(row.yearlySalary)} />
          <InfoRow label="Take-home" value={row.monthlyTakeHome == null ? undefined : String(row.monthlyTakeHome)} />
          <InfoRow label="Archived" value={fmtDate(row.archivedAt)} />
          <ActionRow>
            <View style={{ flex: 1 }}>
              <WebButton
                title="View complete details"
                variant="outline"
                onPress={() => void showDetails(row._id)}
                disabled={!!loadingDetail}
                loading={loadingDetail === row._id}
              />
            </View>
          </ActionRow>
        </Card>
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
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  field: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  arrayItem: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
  },
  value: { fontSize: 13, color: colors.textPrimary },
  muted: { fontSize: 13, color: colors.textMuted },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { downloadApiFile } from '../../utils/downloadChangeLogsReport';

import DateField from '../../ui/DateField';
type ChangeLog = {
  _id: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  summary?: string;
  fields?: string[];
  actorName?: string;
  actorEmail?: string;
  createdAt?: string;
};

type ChangeLogStats = {
  creates?: number;
  updates?: number;
  deletes?: number;
  topEntity?: string;
};

function formatWhen(dateStr?: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

function splitSummary(summary?: string) {
  const value = (summary || '').trim();
  if (!value) return { title: '-', detail: '' };
  const parts = value.split(/\s+[—–-]\s+/);
  if (parts.length < 2) return { title: value, detail: '' };
  return { title: parts[0], detail: parts.slice(1).join(' — ') };
}

function performedBy(row: ChangeLog) {
  return row.actorName || row.actorEmail || 'Amenity (System)';
}

function capitalizeAction(action?: string) {
  const value = (action || '').trim();
  if (!value) return '-';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default function ReportsChangeLogsScreen() {
  const [rows, setRows] = useState<ChangeLog[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ChangeLogStats>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const buildQuery = useCallback(() => {
    const qs = new URLSearchParams();
    if (entityType) qs.set('entityType', entityType);
    if (action) qs.set('action', action.toLowerCase());
    if (fromDate) qs.set('fromDate', fromDate);
    if (toDate) qs.set('toDate', toDate);
    if (search.trim()) qs.set('search', search.trim());
    qs.set('page', '1');
    qs.set('limit', '200');
    return qs;
  }, [entityType, action, fromDate, toDate, search]);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const qs = buildQuery();
      const data = await apiService.get(`/reports/change-logs?${qs.toString()}`);
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setRows(list);
      setTotal(Number(data?.total) || list.length);
      setStats(data?.stats || {});
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load change logs');
      setRows([]);
      setTotal(0);
      setStats({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    loadLogs();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = buildQuery();
      qs.delete('page');
      qs.delete('limit');
      await downloadApiFile(qs.toString());
      Alert.alert('Success', 'Excel file downloaded successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const kpis = useMemo(() => {
    const createCount =
      stats.creates ??
      rows.filter((row) => (row.action || '').toLowerCase() === 'create').length;
    const updateCount =
      stats.updates ??
      rows.filter((row) => (row.action || '').toLowerCase() === 'update').length;
    let topEntity = stats.topEntity || '';
    if (!topEntity) {
      const counts: Record<string, number> = {};
      rows.forEach((row) => {
        const type = row.entityType || 'Unknown';
        counts[type] = (counts[type] || 0) + 1;
      });
      const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      topEntity =
        ranked.length >= 2
          ? `${ranked[0][0]} & ${ranked[1][0]}`
          : ranked[0]?.[0] || '—';
    }
    return {
      total: total || rows.length,
      createCount,
      updateCount,
      topEntity,
    };
  }, [rows, total, stats]);

  return (
    <ScreenShell
      title="Change Logs"
      subtitle="Creates, updates, and deletes across CRM records"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, styles.kpiBlue]}>
            <Text style={styles.kpiLabel}>TOTAL ACTIVITIES</Text>
            <Text style={styles.kpiValue}>{kpis.total}</Text>
            <Text style={styles.kpiSub}>Recorded</Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiGreen]}>
            <Text style={styles.kpiLabel}>CREATES VS UPDATES</Text>
            <Text style={styles.kpiValueSmall}>
              {kpis.createCount} Created • {kpis.updateCount} Updated
            </Text>
          </View>
          <View style={[styles.kpiCard, styles.kpiOrange]}>
            <Text style={styles.kpiLabel}>TOP MODIFIED ENTITY</Text>
            <Text style={styles.kpiValue}>{kpis.topEntity}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          <WebLabel>Entity</WebLabel>
          <WebSelect
            placeholder="All Entities"
            value={entityType}
            onValueChange={setEntityType}
            items={[
              { label: 'Lead', value: 'Lead' },
              { label: 'DC', value: 'DC' },
              { label: 'DcOrder', value: 'DcOrder' },
              { label: 'Expense', value: 'Expense' },
              { label: 'Product', value: 'Product' },
              { label: 'Training', value: 'Training' },
              { label: 'Service', value: 'Service' },
              { label: 'ContactQuery', value: 'ContactQuery' },
            ]}
          />
          <WebLabel>Action</WebLabel>
          <WebSelect
            placeholder="All Actions"
            value={action}
            onValueChange={setAction}
            items={[
              { label: 'Create', value: 'create' },
              { label: 'Update', value: 'update' },
              { label: 'Delete', value: 'delete' },
            ]}
          />
          <WebLabel>From</WebLabel>
          <DateField placeholder="From" value={fromDate} onChange={setFromDate} />
          <WebLabel>To</WebLabel>
          <DateField placeholder="To" value={toDate} onChange={setToDate} />
          <WebLabel>Search</WebLabel>
          <WebInput value={search} onChangeText={setSearch} placeholder="Search summary or user..." />
          <WebButton title="Search" onPress={loadLogs} />
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.tableTitle}>Activity log</Text>
          <Text style={styles.tableCount}>{kpis.total} records</Text>
        </View>

        {rows.length === 0 && !loading ? (
          <Text style={styles.empty}>No activity records found.</Text>
        ) : (
          rows.map((log) => {
            const { title, detail } = splitSummary(log.summary);
            return (
              <View key={log._id} style={styles.row}>
                <Text style={styles.when}>{formatWhen(log.createdAt)}</Text>
                <View style={styles.badges}>
                  <Text style={[styles.badge, styles.entityBadge]}>{log.entityType || '-'}</Text>
                  <Text style={[styles.badge, styles.actionBadge]}>
                    {capitalizeAction(log.action)}
                  </Text>
                </View>
                <Text style={styles.summaryTitle}>{title}</Text>
                {detail ? <Text style={styles.summarySub}>{detail}</Text> : null}
                <Text style={styles.fields}>{(log.fields || []).join(' • ') || '-'}</Text>
                <Text style={styles.performer}>{performedBy(log)}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  kpiRow: { gap: spacing.sm },
  kpiCard: { borderRadius: radii.lg, padding: spacing.md, borderWidth: 1 },
  kpiBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  kpiGreen: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  kpiOrange: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  kpiValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  kpiValueSmall: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  kpiSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  filters: {
    gap: spacing.xs,
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  tableCount: { fontSize: 13, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: spacing.lg },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 4,
    backgroundColor: '#fff',
  },
  when: { fontSize: 12, color: colors.textSecondary },
  badges: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  entityBadge: { backgroundColor: '#EDE9FE', color: '#6D28D9' },
  actionBadge: {
    backgroundColor: '#ECFDF5',
    color: '#047857',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  summarySub: { fontSize: 12, color: colors.textSecondary },
  fields: { fontSize: 12, color: colors.textSecondary },
  performer: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: 4 },
});

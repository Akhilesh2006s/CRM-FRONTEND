import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Alert } from 'react-native';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { StatGrid, rk } from './ReportKit';
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
      <StatGrid
        items={[
          { label: 'Total activities', value: kpis.total, tone: 'blue' },
          { label: 'Created', value: kpis.createCount, tone: 'green' },
          { label: 'Updated', value: kpis.updateCount, tone: 'amber' },
          { label: 'Top modified entity', value: kpis.topEntity, tone: 'slate' },
        ]}
      />

      <PageSection title="Filters">
        <WebInput value={search} onChangeText={setSearch} placeholder="Search summary or user…" />
        <View style={rk.row2}>
          <View style={rk.col}>
            <WebSelect
              label="Entity"
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
          </View>
          <View style={rk.col}>
            <WebSelect
              label="Action"
              placeholder="All Actions"
              value={action}
              onValueChange={setAction}
              items={[
                { label: 'Create', value: 'create' },
                { label: 'Update', value: 'update' },
                { label: 'Delete', value: 'delete' },
              ]}
            />
          </View>
        </View>
        <DateField placeholder="From" value={fromDate} onChange={setFromDate} />
        <DateField placeholder="To" value={toDate} onChange={setToDate} />
        <View style={rk.btnRow}>
          <View style={rk.col}>
            <WebButton title="Search" onPress={loadLogs} />
          </View>
          <View style={rk.col}>
            <WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={handleExport} loading={exporting} />
          </View>
        </View>
      </PageSection>

      <SectionTitle>{`Activity log (${kpis.total})`}</SectionTitle>

      {rows.length === 0 && !loading ? (
        <EmptyState title="No activity records found" />
      ) : (
        rows.map((log) => {
          const { title, detail } = splitSummary(log.summary);
          return (
            <Card key={log._id}>
              <CardTitle title={title} subtitle={formatWhen(log.createdAt)} badge={capitalizeAction(log.action)} tone={toneFor(log.action === 'delete' ? 'rejected' : log.action === 'create' ? 'completed' : 'pending')} />
              <InfoRow label="Entity" value={log.entityType} />
              <InfoRow label="Details" value={detail} />
              <InfoRow label="Fields" value={(log.fields || []).join(' • ')} />
              <InfoRow label="By" value={performedBy(log)} bold />
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
import { StatGrid, rk, matchesWords } from './ReportKit';
import { apiService } from '../../services/api';
import { downloadReturnsReport } from '../../utils/downloadReturnsReport';

import DateField from '../../ui/DateField';
type ReturnRow = {
  _id: string;
  returnNumber: number | string;
  returnDate?: string;
  createdAt?: string;
  createdBy?: { name?: string };
  remarks?: string;
  lrNumber?: string;
  finYear?: string;
  leadId?: { school_name?: string };
};

function formatDateIn(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTimeIn(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function remarksText(row: ReturnRow) {
  return (row.remarks || '').trim();
}

function isPendingRow(row: ReturnRow) {
  return remarksText(row).toLowerCase().includes('pending');
}

function statusFromRemarks(remarks?: string) {
  const text = (remarks || '').toLowerCase();
  if (text.includes('pending')) {
    return { label: 'Pending Approval', bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' };
  }
  if (text.includes('partial')) {
    return { label: 'Partial Approval', bg: '#F0F9FF', fg: '#0369A1', border: '#BAE6FD' };
  }
  return { label: 'Approved', bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' };
}

function matchesSearch(row: ReturnRow, search: string) {
  if (!search) return true;
  return matchesWords(search, [
    row.returnNumber,
    row.lrNumber,
    row.createdBy?.name,
    row.remarks,
    row.finYear,
    row.leadId?.school_name,
    statusFromRemarks(row.remarks).label,
    formatDateIn(row.returnDate),
  ]);
}

export default function ReportsReturnsScreen() {
  const [executive, setExecutive] = useState<ReturnRow[]>([]);
  const [warehouse, setWarehouse] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [finYear, setFinYear] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeTab, setActiveTab] = useState<'executive' | 'warehouse'>('executive');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const execQs = new URLSearchParams();
      if (fromDate) execQs.set('fromDate', fromDate);
      if (toDate) execQs.set('toDate', toDate);
      const execSuffix = execQs.toString() ? `?${execQs.toString()}` : '';

      const [execData, whData] = await Promise.all([
        apiService.get(`/stock-returns/executive${execSuffix}`),
        apiService.get('/stock-returns/warehouse'),
      ]);

      const execList = Array.isArray(execData) ? execData : (execData as any)?.data || [];
      let warehouseRows: ReturnRow[] = Array.isArray(whData)
        ? whData
        : (whData as any)?.data || [];

      if (fromDate || toDate) {
        warehouseRows = warehouseRows.filter((r) => {
          const created = r.createdAt ? new Date(r.createdAt) : null;
          if (!created) return false;
          if (fromDate && created < new Date(fromDate)) return false;
          if (toDate && created > new Date(`${toDate}T23:59:59`)) return false;
          return true;
        });
      }

      setExecutive(execList);
      setWarehouse(warehouseRows);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load returns');
      setExecutive([]);
      setWarehouse([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    load();
  }, []);

  const onSearch = () => {
    setAppliedSearch(searchTerm.trim());
    load();
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (fromDate) qs.set('fromDate', fromDate);
      if (toDate) qs.set('toDate', toDate);
      await downloadReturnsReport(qs.toString());
      Alert.alert('Success', 'Excel file downloaded successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const finYears = useMemo(() => {
    const years = new Set<string>();
    [...executive, ...warehouse].forEach((row) => {
      if (row.finYear) years.add(row.finYear);
    });
    return Array.from(years).sort().reverse();
  }, [executive, warehouse]);

  const filterRows = useCallback(
    (rows: ReturnRow[]) =>
      rows.filter((row) => {
        if (finYear && row.finYear !== finYear) return false;
        return matchesSearch(row, appliedSearch);
      }),
    [finYear, appliedSearch],
  );

  const executiveReturns = useMemo(() => filterRows(executive), [executive, filterRows]);
  const warehouseReturns = useMemo(() => filterRows(warehouse), [warehouse, filterRows]);

  const totalReturnsCount = executiveReturns.length + warehouseReturns.length;
  const pendingManagerReview = [...executiveReturns, ...warehouseReturns].filter(isPendingRow).length;
  const receivedAtWarehouse = warehouseReturns.length;
  const activeRows = activeTab === 'executive' ? executiveReturns : warehouseReturns;

  return (
    <ScreenShell
      title="Returns Report"
      subtitle="BDE and warehouse stock returns"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
      headerRight={
        <TouchableOpacity onPress={handleExport} disabled={exporting} style={styles.headerExport}>
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={styles.headerExportText}>{exporting ? '…' : 'Export'}</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <StatGrid
          items={[
            { label: 'Total returns', value: totalReturnsCount, tone: 'green' },
            { label: 'Pending manager review', value: pendingManagerReview, tone: 'amber' },
            { label: 'Received at warehouse', value: receivedAtWarehouse, tone: 'blue' },
          ]}
        />

        <PageSection title="Filters">
          <WebInput value={searchTerm} onChangeText={setSearchTerm} placeholder="Search return no, LR no, executive, remarks…" />
          <WebSelect
            label="Fin Year"
            placeholder="All"
            value={finYear}
            onValueChange={setFinYear}
            items={finYears.map((year) => ({ label: year, value: year }))}
          />
          <DateField placeholder="From Date" value={fromDate} onChange={setFromDate} />
          <DateField placeholder="To Date" value={toDate} onChange={setToDate} />
          <View style={rk.btnRow}>
            <View style={rk.col}>
              <WebButton title="Search" onPress={onSearch} />
            </View>
            <View style={rk.col}>
              <WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={handleExport} loading={exporting} />
            </View>
          </View>
        </PageSection>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'executive' && styles.tabActive]}
            onPress={() => setActiveTab('executive')}
          >
            <Text style={[styles.tabText, activeTab === 'executive' && styles.tabTextActive]}>
              Executive Returns ({executiveReturns.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'warehouse' && styles.tabActive]}
            onPress={() => setActiveTab('warehouse')}
          >
            <Text style={[styles.tabText, activeTab === 'warehouse' && styles.tabTextActive]}>
              Warehouse Returns ({warehouseReturns.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeRows.length === 0 ? (
          <EmptyState title={activeTab === 'executive' ? 'No executive returns' : 'No warehouse returns'} />
        ) : (
          activeRows.map((row) => {
            const status = statusFromRemarks(row.remarks);
            const remark = remarksText(row);
            return (
              <Card key={row._id}>
                <CardTitle
                  title={`#${row.returnNumber}`}
                  subtitle={row.leadId?.school_name || undefined}
                  badge={status.label}
                  tone={status.label === 'Approved' ? 'success' : status.label === 'Pending Approval' ? 'warning' : 'info'}
                />
                <InfoRow label="LR Number" value={row.lrNumber || '-'} />
                <InfoRow label={activeTab === 'executive' ? 'Initiated By' : 'Manager'} value={row.createdBy?.name || '-'} />
                <InfoRow label="Fin Year" value={row.finYear || '-'} />
                <InfoRow label="Return Date" value={formatDateIn(row.returnDate)} />
                {remark ? <InfoRow label="Remarks" value={remark} /> : null}
                <InfoRow label="Created At" value={formatDateTimeIn(row.createdAt)} />
              </Card>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  headerExport: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerExportText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  tabs: { flexDirection: 'row', backgroundColor: colors.backgroundMuted, borderRadius: 12, padding: 4, gap: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textTertiary, textAlign: 'center' },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
});

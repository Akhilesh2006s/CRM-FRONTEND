import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
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
  const q = search.toLowerCase();
  return (
    (row.lrNumber || '').toLowerCase().includes(q) ||
    (row.createdBy?.name || '').toLowerCase().includes(q) ||
    (row.remarks || '').toLowerCase().includes(q)
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
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
      subtitle="Executive and warehouse stock returns"
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
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />

        <View style={[styles.kpiCard, styles.kpiGreen]}>
          <View style={styles.kpiTextWrap}>
            <Text style={[styles.kpiLabel, { color: '#047857' }]}>TOTAL RETURNS</Text>
            <Text style={[styles.kpiValue, { color: '#047857' }]}>{totalReturnsCount} Logged</Text>
          </View>
          <Ionicons name="cube-outline" size={22} color="#047857" />
        </View>
        <View style={[styles.kpiCard, styles.kpiAmber]}>
          <View style={styles.kpiTextWrap}>
            <Text style={[styles.kpiLabel, { color: '#B45309' }]}>PENDING MANAGER REVIEW</Text>
            <Text style={[styles.kpiValue, { color: '#B45309' }]}>{pendingManagerReview}</Text>
          </View>
          <Ionicons name="time-outline" size={22} color="#B45309" />
        </View>
        <View style={[styles.kpiCard, styles.kpiBlue]}>
          <View style={styles.kpiTextWrap}>
            <Text style={[styles.kpiLabel, { color: '#1D4ED8' }]}>RECEIVED AT WAREHOUSE</Text>
            <Text style={[styles.kpiValue, { color: '#1D4ED8' }]}>{receivedAtWarehouse}</Text>
          </View>
          <Ionicons name="business-outline" size={22} color="#1D4ED8" />
        </View>

        <View style={styles.filterCard}>
          <WebInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search by LR No, Executive, or Remarks..."
          />
          <WebLabel>Fin Year</WebLabel>
          <WebSelect
            placeholder="All"
            value={finYear}
            onValueChange={setFinYear}
            items={finYears.map((year) => ({ label: year, value: year }))}
          />
          <WebLabel>From Date</WebLabel>
          <DateField placeholder="From Date" value={fromDate} onChange={setFromDate} />
          <WebLabel>To Date</WebLabel>
          <DateField placeholder="To Date" value={toDate} onChange={setToDate} />
          <WebButton title="Search" onPress={onSearch} />
        </View>

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
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {activeTab === 'executive' ? 'No executive returns' : 'No warehouse returns'}
            </Text>
          </View>
        ) : (
          activeRows.map((row) => {
            const status = statusFromRemarks(row.remarks);
            const remark = remarksText(row);
            return (
              <View key={row._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.returnNo}>#{row.returnNumber}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: status.bg,
                        borderColor: status.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: status.fg }]}>{status.label}</Text>
                  </View>
                </View>
                <InfoRow label="LR Number" value={row.lrNumber || '-'} />
                <InfoRow
                  label={activeTab === 'executive' ? 'Initiated By' : 'Manager'}
                  value={row.createdBy?.name || '-'}
                />
                <InfoRow label="Fin Year" value={row.finYear || '-'} />
                <InfoRow label="Return Date" value={formatDateIn(row.returnDate)} />
                {remark ? <InfoRow label="Remarks" value={remark} /> : null}
                <InfoRow label="Created At" value={formatDateTimeIn(row.createdAt)} />
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32, gap: 12 },
  headerExport: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerExportText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  kpiCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiGreen: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  kpiAmber: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  kpiBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  kpiTextWrap: { flex: 1, paddingRight: 8 },
  kpiLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  kpiValue: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  returnNo: {
    ...typography.heading.h3,
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  infoLabel: {
    width: 110,
    ...typography.body.small,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
});

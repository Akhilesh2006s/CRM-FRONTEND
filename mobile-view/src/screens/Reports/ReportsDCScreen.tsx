import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput, WebLabel, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { downloadDcReport } from '../../utils/downloadDcReport';

import DateField from '../../ui/DateField';
interface DcItem {
  _id: string;
  customerName?: string; customerPhone?: string; customerAddress?: string; product?: string;
  requestedQuantity?: number; availableQuantity?: number; deliverableQuantity?: number;
  status?: string; dcDate?: string; createdAt?: string; lrNo?: string;
  employeeId?: { name?: string }; productDetails?: Array<{ total?: number }>;
  dcOrderId?: { school_name?: string; contact_mobile?: string; location?: string; zone?: string; dc_code?: string };
}

const statuses = ['all', 'created', 'po_submitted', 'sent_to_manager', 'pending_dc', 'warehouse_processing', 'completed', 'hold'];
const dateRanges = ['all', 'today', 'week', 'month'];
const displayStatus = (status?: string) => !status ? 'Pending' : status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const number = (value?: number) => Number(value || 0).toLocaleString('en-IN');

function Detail({ label, value, emphasis }: { label: string; value: React.ReactNode; emphasis?: boolean }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={[styles.detailValue, emphasis && styles.detailValueStrong]} numberOfLines={2}>{value || '—'}</Text></View>;
}

function Metric({ label, value, tone, wide = false }: { label: string; value: string; tone: string; wide?: boolean }) {
  const toneStyle: any = styles[`metric${tone[0].toUpperCase()}${tone.slice(1)}` as keyof typeof styles];
  return <View style={[styles.metric, toneStyle, wide && styles.metricWide]}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

export default function ReportsDCScreen() {
  const [items, setItems] = useState<DcItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => { loadDc(); }, []);

  const loadDc = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const data = await apiService.get(`/dc${params.toString() ? `?${params}` : ''}`);
      setItems(Array.isArray(data) ? data : data?.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load DC data'); setItems([]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadDc(); };
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase(); const today = new Date(); today.setHours(0, 0, 0, 0);
    return items.filter((dc) => {
      const dateValue = dc.dcDate || dc.createdAt; const date = dateValue ? new Date(dateValue) : undefined;
      const inRange = !date || dateFilter === 'all' || (dateFilter === 'today' ? date >= today : date >= new Date(today.getTime() - (dateFilter === 'week' ? 7 : 30) * 86400000));
      const matchesSearch = !term || [dc.customerName, dc.customerPhone, dc.product, dc.dcOrderId?.school_name, dc.dcOrderId?.contact_mobile, dc.dcOrderId?.dc_code, dc.lrNo].some((value) => value?.toLowerCase().includes(term));
      return (statusFilter === 'all' || dc.status === statusFilter) && inRange && matchesSearch;
    });
  }, [items, statusFilter, dateFilter, search]);
  const summary = useMemo(() => ({
    total: filtered.length, completed: filtered.filter((dc) => dc.status === 'completed').length,
    pending: filtered.filter((dc) => ['created', 'po_submitted', 'sent_to_manager', 'pending_dc', 'warehouse_processing'].includes(dc.status || '')).length,
    hold: filtered.filter((dc) => dc.status === 'hold').length,
    quantity: filtered.reduce((total, dc) => total + (dc.deliverableQuantity || dc.requestedQuantity || 0), 0),
    value: filtered.reduce((total, dc) => total + (dc.productDetails || []).reduce((sum, product) => sum + (product.total || 0), 0), 0),
  }), [filtered]);

  const handleExport = async () => {
    try {
      setExporting(true); const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter); if (fromDate) params.set('fromDate', fromDate); if (toDate) params.set('toDate', toDate);
      await downloadDcReport(params.toString()); if (Platform.OS === 'web') Alert.alert('Success', 'Excel file downloaded successfully.');
    } catch (error: any) { Alert.alert('Export failed', error.message || 'Failed to export DC report'); } finally { setExporting(false); }
  };

  return <ScreenShell title="DC Report" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.subtitle}>View and manage delivery challans</Text>
      <WebButton title={exporting ? 'Exporting…' : 'Export to Excel'} onPress={handleExport} loading={exporting} />
      <View style={styles.metricsGrid}>
        <Metric label="Total DCs" value={number(summary.total)} tone="blue" /><Metric label="Completed" value={number(summary.completed)} tone="green" />
        <Metric label="Pending" value={number(summary.pending)} tone="yellow" /><Metric label="On Hold" value={number(summary.hold)} tone="red" />
        <Metric label="Total Quantity" value={number(summary.quantity)} tone="purple" wide /><Metric label="Total Value" value={`₹${number(summary.value)}`} tone="sky" wide />
      </View>
      <View style={styles.filterCard}>
        <WebLabel>Search DCs</WebLabel><WebInput value={search} onChangeText={setSearch} placeholder="School, contact, code, product, or LR No" />
        <WebLabel>Status</WebLabel><WebSelect value={statusFilter} onValueChange={setStatusFilter} items={statuses.map((status) => ({ label: status === 'all' ? 'All Status' : displayStatus(status), value: status }))} />
        <WebLabel>Time</WebLabel><WebSelect value={dateFilter} onValueChange={setDateFilter} items={dateRanges.map((range) => ({ label: range === 'all' ? 'All Time' : range === 'week' ? 'Last 7 Days' : range === 'month' ? 'Last 30 Days' : 'Today', value: range }))} />
        <WebLabel>DC From</WebLabel><DateField placeholder="DC From" value={fromDate} onChange={setFromDate} />
        <WebLabel>DC To</WebLabel><DateField placeholder="DC To" value={toDate} onChange={setToDate} />
        <WebButton title="Search" onPress={loadDc} loading={loading} />
      </View>
      <Text style={styles.sectionTitle}>Delivery Challans ({filtered.length})</Text>
      {filtered.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>No DC records found</Text></View> : filtered.map((dc, index) => {
        const school = dc.dcOrderId?.school_name || dc.customerName || 'DC'; const contact = dc.dcOrderId?.contact_mobile || dc.customerPhone; const location = dc.dcOrderId?.location || dc.dcOrderId?.zone || dc.customerAddress;
        return <View key={dc._id} style={styles.card}>
          <View style={styles.cardHeader}><View style={styles.titleWrap}><Text style={styles.serial}>#{index + 1}</Text><Text style={styles.dcTitle}>{school}</Text></View><Text style={[styles.badge, dc.status === 'completed' && styles.badgeCompleted, dc.status === 'hold' && styles.badgeHold]}>{displayStatus(dc.status)}</Text></View>
          <View style={styles.detailsGrid}>
            <Detail label="DC Code" value={dc.dcOrderId?.dc_code} emphasis /><Detail label="DC Date" value={formatDate(dc.dcDate || dc.createdAt)} />
            <Detail label="Contact" value={contact} /><Detail label="Location" value={location} />
            <Detail label="Product" value={dc.product} emphasis /><Detail label="Employee" value={dc.employeeId?.name} />
            <Detail label="Requested Qty" value={number(dc.requestedQuantity)} /><Detail label="Available Qty" value={number(dc.availableQuantity)} />
            <Detail label="Deliverable Qty" value={number(dc.deliverableQuantity)} emphasis /><Detail label="LR No" value={dc.lrNo} />
          </View>
        </View>;
      })}
    </ScrollView>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  content: { flex: 1 }, contentContainer: { padding: 16, paddingBottom: 32 }, subtitle: { ...typography.body.medium, color: colors.textSecondary, marginBottom: 12 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 }, metric: { width: '48%', padding: 14, borderRadius: 12, borderWidth: 1 }, metricWide: { width: '100%' },
  metricBlue: { backgroundColor: '#eaf0ff', borderColor: '#c9d6ff' }, metricGreen: { backgroundColor: '#ecfdf3', borderColor: '#bbf7d0' }, metricYellow: { backgroundColor: '#fffbeb', borderColor: '#fde68a' }, metricRed: { backgroundColor: '#fef2f2', borderColor: '#fecaca' }, metricPurple: { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }, metricSky: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  metricLabel: { ...typography.label.medium, color: colors.textSecondary }, metricValue: { ...typography.heading.h3, color: colors.textPrimary, marginTop: 4 },
  filterCard: { backgroundColor: colors.backgroundLight, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8, marginBottom: 18 }, sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 }, empty: { padding: 30, alignItems: 'center' }, emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 12 }, titleWrap: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }, serial: { ...typography.label.small, color: colors.textSecondary }, dcTitle: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  badge: { ...typography.label.small, color: '#475569', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }, badgeCompleted: { color: '#15803d', backgroundColor: '#dcfce7' }, badgeHold: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }, detail: { width: '50%', paddingVertical: 7, paddingRight: 8 }, detailLabel: { ...typography.label.small, color: colors.textSecondary }, detailValue: { ...typography.body.medium, color: colors.textPrimary, marginTop: 2 }, detailValueStrong: { fontWeight: '700' },
});

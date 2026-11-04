import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { StatGrid, rk, matchesWords } from './ReportKit';
import { WebButton, WebInput, WebSelect } from '../../ui/WebPrimitives';
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
      const matchesSearch = !term || matchesWords(term, [dc.customerName, dc.customerPhone, dc.customerAddress, dc.product, dc.status && displayStatus(dc.status), dc.employeeId?.name, dc.dcOrderId?.school_name, dc.dcOrderId?.contact_mobile, dc.dcOrderId?.location, dc.dcOrderId?.zone, dc.dcOrderId?.dc_code, dc.lrNo, formatDate(dc.dcDate || dc.createdAt)]);
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

  return <ScreenShell title="DC Report" subtitle="View and manage delivery challans" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
    <StatGrid items={[
      { label: 'Total DCs', value: number(summary.total), tone: 'blue' },
      { label: 'Completed', value: number(summary.completed), tone: 'green' },
      { label: 'Pending', value: number(summary.pending), tone: 'amber' },
      { label: 'On Hold', value: number(summary.hold), tone: 'red' },
      { label: 'Total Quantity', value: number(summary.quantity), tone: 'purple' },
      { label: 'Total Value', value: `₹${number(summary.value)}`, tone: 'slate' },
    ]} />
    <PageSection title="Filters">
      <WebInput value={search} onChangeText={setSearch} placeholder="Search school, contact, code, product, LR No" />
      <View style={rk.row2}>
        <View style={rk.col}><WebSelect label="Status" value={statusFilter} onValueChange={setStatusFilter} items={statuses.map((status) => ({ label: status === 'all' ? 'All Status' : displayStatus(status), value: status }))} /></View>
        <View style={rk.col}><WebSelect label="Time" value={dateFilter} onValueChange={setDateFilter} items={dateRanges.map((range) => ({ label: range === 'all' ? 'All Time' : range === 'week' ? 'Last 7 Days' : range === 'month' ? 'Last 30 Days' : 'Today', value: range }))} /></View>
      </View>
      <DateField placeholder="DC From" value={fromDate} onChange={setFromDate} />
      <DateField placeholder="DC To" value={toDate} onChange={setToDate} />
      <View style={rk.btnRow}>
        <View style={rk.col}><WebButton title="Search" onPress={loadDc} loading={loading} /></View>
        <View style={rk.col}><WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={handleExport} loading={exporting} /></View>
      </View>
    </PageSection>
    <SectionTitle>{`Delivery Challans (${filtered.length})`}</SectionTitle>
    {filtered.length === 0 ? <EmptyState title="No DC records found" /> : filtered.map((dc, index) => {
      const school = dc.dcOrderId?.school_name || dc.customerName || 'DC'; const contact = dc.dcOrderId?.contact_mobile || dc.customerPhone; const location = dc.dcOrderId?.location || dc.dcOrderId?.zone || dc.customerAddress;
      return <Card key={dc._id}>
        <CardTitle title={`${index + 1}. ${school}`} badge={displayStatus(dc.status)} tone={toneFor(dc.status === 'hold' ? 'hold' : dc.status === 'completed' ? 'completed' : 'pending')} />
        <InfoRow label="DC Code" value={dc.dcOrderId?.dc_code} bold />
        <InfoRow label="DC Date" value={formatDate(dc.dcDate || dc.createdAt)} />
        <InfoRow label="Contact" value={contact} phone />
        <InfoRow label="Location" value={location} />
        <InfoRow label="Product" value={dc.product} bold />
        <InfoRow label="Employee" value={dc.employeeId?.name} />
        <InfoRow label="Requested Qty" value={number(dc.requestedQuantity)} />
        <InfoRow label="Available Qty" value={number(dc.availableQuantity)} />
        <InfoRow label="Deliverable Qty" value={number(dc.deliverableQuantity)} bold />
        <InfoRow label="LR No" value={dc.lrNo} />
      </Card>;
    })}
  </ScreenShell>;
}

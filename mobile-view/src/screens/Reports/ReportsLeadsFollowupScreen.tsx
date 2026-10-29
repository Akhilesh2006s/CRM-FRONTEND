import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { exportLeadsReport } from '../../utils/exportLeadsReport';

import DateField from '../../ui/DateField';
type Lead = {
  _id: string;
  school_name?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  status?: string;
  priority?: string;
  follow_up_date?: string;
  location?: string;
  strength?: number;
  createdAt?: string;
  remarks?: string;
  managed_by?: { _id?: string; name?: string };
  assigned_by?: { _id?: string; name?: string };
  createdBy?: { _id?: string; name?: string };
};

type Employee = { _id: string; name?: string };

const CONVERTED_OR_CLOSED_STATUSES = new Set([
  'saved',
  'completed',
  'closed',
  'hold',
  'dc_requested',
  'dc_accepted',
  'dc_approved',
  'dc_sent_to_senior',
  'in_transit',
]);

const TABLE_COLUMNS = [
  { key: 'sno', label: 'S.No', width: 56 },
  { key: 'createdOn', label: 'Created On', width: 190 },
  { key: 'zone', label: 'Zone', width: 110 },
  { key: 'assignedTo', label: 'Assigned To', width: 130 },
  { key: 'priority', label: 'Priority', width: 110 },
  { key: 'location', label: 'Location', width: 220 },
  { key: 'schoolName', label: 'School Name', width: 170 },
  { key: 'contactPerson', label: 'Contact Person', width: 150 },
  { key: 'decisionMaker', label: 'Decision Maker', width: 140 },
  { key: 'mobile', label: 'Mobile', width: 130 },
  { key: 'followUpOn', label: 'Follow-up On', width: 190 },
  { key: 'schoolStrength', label: 'School Strength', width: 120 },
  { key: 'remarks', label: 'Remarks', width: 140 },
  { key: 'status', label: 'Status', width: 110 },
] as const;

function isFollowUpLead(lead: Lead) {
  const status = String(lead.status || '').trim().toLowerCase();
  if (CONVERTED_OR_CLOSED_STATUSES.has(status)) return false;
  return status === 'pending' || status === 'processing' || status === '';
}

function normalizePriority(priority?: string) {
  if (!priority) return '';
  return priority.replace(/\s*Lead$/i, '').trim();
}

function getAssignedTo(lead: Lead) {
  return lead.managed_by?.name || lead.assigned_by?.name || lead.createdBy?.name || 'Not Assigned';
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function isFollowUpOverdue(dateStr?: string) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const dayOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return dayOnly.getTime() < todayOnly.getTime();
}

function TableCell({
  width,
  children,
  numberOfLines,
  overdue,
}: {
  width: number;
  children: React.ReactNode;
  numberOfLines?: number;
  overdue?: boolean;
}) {
  return (
    <View style={[styles.tableCell, { width }]}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text
          style={[styles.tableCellText, overdue && styles.overdueText]}
          numberOfLines={numberOfLines ?? 2}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function priorityBadge(priority?: string) {
  const p = normalizePriority(priority) || 'Hot';
  const style =
    p.toLowerCase() === 'hot'
      ? styles.badgeHot
      : p.toLowerCase() === 'warm'
        ? styles.badgeWarm
        : styles.badgeCold;
  return <Text style={[styles.badge, style]}>{p}</Text>;
}

export default function ReportsLeadsFollowupScreen() {
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [zone, setZone] = useState('');
  const [employee, setEmployee] = useState('');
  const [priority, setPriority] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allLeads, zone, employee, priority, fromDate, toDate, contactMobile, schoolName]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [leadRes, empRes] = await Promise.all([
        apiService.get<any>('/leads?limit=1000'),
        apiService.get<Employee[]>('/employees?isActive=true').catch(() => []),
      ]);

      const allData: Lead[] = Array.isArray(leadRes) ? leadRes : leadRes?.data || [];
      const followUpLeads = allData.filter(isFollowUpLead);

      setAllLeads(followUpLeads);
      setEmployees(Array.isArray(empRes) ? empRes : []);
      setZones(
        Array.from(new Set(followUpLeads.map((l) => l.zone).filter(Boolean) as string[])).sort()
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load follow-up leads');
      setAllLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allLeads];
    if (zone) filtered = filtered.filter((l) => l.zone?.toLowerCase().includes(zone.toLowerCase()));
    if (priority) {
      filtered = filtered.filter((l) => normalizePriority(l.priority) === priority);
    }
    if (contactMobile) filtered = filtered.filter((l) => l.contact_mobile?.includes(contactMobile));
    if (schoolName) {
      filtered = filtered.filter((l) => l.school_name?.toLowerCase().includes(schoolName.toLowerCase()));
    }
    if (employee) {
      filtered = filtered.filter(
        (l) =>
          l.managed_by?._id === employee ||
          l.assigned_by?._id === employee ||
          l.createdBy?._id === employee
      );
    }
    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter((l) => l.createdAt && new Date(l.createdAt) >= from);
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`);
      filtered = filtered.filter((l) => l.createdAt && new Date(l.createdAt) <= to);
    }
    filtered.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    setLeads(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportLeadsReport(
        {
          status: 'Pending,Processing',
          zone,
          employee,
          priority,
          fromDate,
          toDate,
          contactMobile,
          schoolName,
        },
        `Follow_Up_Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      if (Platform.OS === 'web') {
        Alert.alert('Success', 'Excel file downloaded successfully');
      }
    } catch (error: any) {
      Alert.alert('Export failed', error.message || 'Failed to export to Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenShell
      title="Follow Up Leads List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting}
          style={styles.exportBtn}
          activeOpacity={0.8}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={styles.exportText}>Export</Text>
            </>
          )}
        </TouchableOpacity>
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />
        <View style={styles.filterCard}>
          <WebSelect
            label="Select Zone"
            value={zone}
            onValueChange={setZone}
            placeholder="All Zones"
            items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
          />
          <WebLabel>To Date</WebLabel>
          <DateField placeholder="To Date" value={toDate} onChange={setToDate} />
          <WebLabel>By School Name</WebLabel>
          <WebInput value={schoolName} onChangeText={setSchoolName} placeholder="Enter school name" />
          <WebLabel>From Date</WebLabel>
          <DateField placeholder="From Date" value={fromDate} onChange={setFromDate} />
          <WebSelect
            label="Select Priority"
            value={priority}
            onValueChange={setPriority}
            placeholder="All Priorities"
            items={[
              { label: 'All Priorities', value: '' },
              { label: 'Hot', value: 'Hot' },
              { label: 'Warm', value: 'Warm' },
              { label: 'Cold', value: 'Cold' },
            ]}
          />
          <WebSelect
            label="Select Employee"
            value={employee}
            onValueChange={setEmployee}
            placeholder="All Employees"
            items={[
              { label: 'All Employees', value: '' },
              ...employees.map((e) => ({ label: e.name || 'Unknown', value: e._id })),
            ]}
          />
          <WebLabel>By Contact Mobile</WebLabel>
          <WebInput
            value={contactMobile}
            onChangeText={setContactMobile}
            placeholder="Enter mobile number"
            keyboardType="phone-pad"
          />
          <WebButton title="Search" onPress={applyFilters} />
        </View>

        <View style={styles.tableCard}>
          <Text style={styles.totalText}>
            Total: <Text style={styles.totalCount}>{leads.length}</Text> leads found
          </Text>
          {leads.length === 0 ? (
            <Text style={styles.emptyText}>No leads found.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ width: TABLE_COLUMNS.reduce((sum, col) => sum + col.width, 0) }}>
                <View style={styles.tableHead}>
                  {TABLE_COLUMNS.map((col) => (
                    <View key={col.key} style={[styles.tableHeadCell, { width: col.width }]}>
                      <Text style={styles.th}>{col.label}</Text>
                    </View>
                  ))}
                </View>
                {leads.map((lead, index) => (
                  <View key={lead._id} style={styles.tableRow}>
                    <TableCell width={TABLE_COLUMNS[0].width}>{index + 1}</TableCell>
                    <TableCell width={TABLE_COLUMNS[1].width}>{formatDate(lead.createdAt)}</TableCell>
                    <TableCell width={TABLE_COLUMNS[2].width}>{lead.zone || '-'}</TableCell>
                    <TableCell width={TABLE_COLUMNS[3].width}>{getAssignedTo(lead)}</TableCell>
                    <TableCell width={TABLE_COLUMNS[4].width}>{priorityBadge(lead.priority)}</TableCell>
                    <TableCell width={TABLE_COLUMNS[5].width} numberOfLines={2}>
                      {lead.location || '-'}
                    </TableCell>
                    <TableCell width={TABLE_COLUMNS[6].width} numberOfLines={2}>
                      {lead.school_name || '-'}
                    </TableCell>
                    <TableCell width={TABLE_COLUMNS[7].width} numberOfLines={2}>
                      {lead.contact_person || '-'}
                    </TableCell>
                    <TableCell width={TABLE_COLUMNS[8].width}>-</TableCell>
                    <TableCell width={TABLE_COLUMNS[9].width}>{lead.contact_mobile || '-'}</TableCell>
                    <TableCell
                      width={TABLE_COLUMNS[10].width}
                      overdue={isFollowUpOverdue(lead.follow_up_date)}
                    >
                      {lead.follow_up_date ? formatDate(lead.follow_up_date) : '-'}
                    </TableCell>
                    <TableCell width={TABLE_COLUMNS[11].width}>{lead.strength ?? 0}</TableCell>
                    <TableCell width={TABLE_COLUMNS[12].width} numberOfLines={2}>
                      {lead.remarks || '-'}
                    </TableCell>
                    <TableCell width={TABLE_COLUMNS[13].width}>{lead.status || 'Pending'}</TableCell>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  filterCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tableCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalText: { ...typography.body.medium, color: colors.textSecondary, marginBottom: 12 },
  totalCount: { fontWeight: '700', color: colors.textPrimary },
  emptyText: { textAlign: 'center', paddingVertical: 24, color: colors.textSecondary },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: colors.tableHeader,
    borderRadius: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeadCell: { paddingHorizontal: 8, justifyContent: 'center' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  th: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
  tableCell: { paddingHorizontal: 8, justifyContent: 'center' },
  tableCellText: { fontSize: 12, color: colors.textPrimary },
  overdueText: { color: colors.error, fontWeight: '600' },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    overflow: 'hidden',
  },
  badgeHot: { backgroundColor: '#fee2e2', color: '#991b1b' },
  badgeWarm: { backgroundColor: '#ffedd5', color: '#9a3412' },
  badgeCold: { backgroundColor: '#f1f5f9', color: '#334155' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  exportText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});

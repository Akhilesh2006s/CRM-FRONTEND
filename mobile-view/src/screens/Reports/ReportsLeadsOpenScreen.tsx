import React, { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
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
  managed_by?: { _id?: string; name?: string };
  assigned_by?: { _id?: string; name?: string };
  createdBy?: { _id?: string; name?: string };
};

type Employee = { _id: string; name?: string };

const CHART_COLORS = ['#3b82f6', '#ef4444', '#f97316', '#10b981', '#8b5cf6'];

const TABLE_COLUMNS = [
  { key: 'sno', label: 'S.No', width: 56 },
  { key: 'createdOn', label: 'Created On', width: 190 },
  { key: 'zone', label: 'Zone', width: 110 },
  { key: 'assignedTo', label: 'Assigned To', width: 130 },
  { key: 'priority', label: 'Priority', width: 120 },
  { key: 'location', label: 'Location', width: 220 },
  { key: 'schoolName', label: 'School Name', width: 170 },
  { key: 'contactPerson', label: 'Contact Person', width: 150 },
  { key: 'decisionMaker', label: 'Decision Maker', width: 140 },
  { key: 'mobile', label: 'Mobile', width: 130 },
  { key: 'followUpOn', label: 'Follow-up On', width: 190 },
  { key: 'schoolStrength', label: 'School Strength', width: 120 },
  { key: 'status', label: 'Status', width: 110 },
] as const;

function TableCell({
  width,
  children,
  numberOfLines,
}: {
  width: number;
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  return (
    <View style={[styles.tableCell, { width }]}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={styles.tableCellText} numberOfLines={numberOfLines ?? 2}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function getAssignedTo(lead: Lead) {
  return lead.managed_by?.name || lead.assigned_by?.name || lead.createdBy?.name || 'Not Assigned';
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function normalizePriority(priority?: string) {
  if (!priority) return '';
  return priority.replace(/\s*Lead$/i, '').trim();
}

function MetricCard({
  label,
  value,
  tint,
  icon,
}: {
  label: string;
  value: number;
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: tint }]}>
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Ionicons name={icon} size={28} color={colors.textPrimary} />
    </View>
  );
}

function BarChartCard({
  title,
  icon,
  data,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  data: { name: string; value: number }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartTitleRow}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.chartTitle}>{title}</Text>
      </View>
      {data.length === 0 ? (
        <Text style={styles.chartEmpty}>No data</Text>
      ) : (
        data.map((item, index) => (
          <View key={item.name} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${(item.value / max) * 100}%`,
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{item.value}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function PriorityChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartTitleRow}>
        <Ionicons name="trending-up-outline" size={18} color="#f97316" />
        <Text style={styles.chartTitle}>Leads by Priority</Text>
      </View>
      {data.map((item) => (
        <View key={item.name} style={styles.priorityRow}>
          <View style={[styles.priorityDot, { backgroundColor: item.color }]} />
          <Text style={styles.priorityText}>
            {item.name}: {Math.round((item.value / total) * 100)}%
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function ReportsLeadsOpenScreen() {
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
        apiService.get<any>('/leads?status=Pending&limit=1000'),
        apiService.get<Employee[]>('/employees?isActive=true').catch(() => []),
      ]);

      let allData: Lead[] = Array.isArray(leadRes) ? leadRes : leadRes?.data || [];
      allData = allData.filter((lead) => lead.status === 'Pending');

      setAllLeads(allData);
      setEmployees(Array.isArray(empRes) ? empRes : []);
      setZones(
        Array.from(new Set(allData.map((l) => l.zone).filter(Boolean) as string[])).sort()
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load open leads');
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

  const analytics = useMemo(() => {
    const zoneMap: Record<string, number> = {};
    const priorityMap: Record<string, number> = {};
    const employeeMap: Record<string, number> = {};

    allLeads.forEach((lead) => {
      const z = lead.zone || 'Unassigned';
      zoneMap[z] = (zoneMap[z] || 0) + 1;
      const p = normalizePriority(lead.priority) || 'Cold';
      priorityMap[p] = (priorityMap[p] || 0) + 1;
      const emp = getAssignedTo(lead);
      employeeMap[emp] = (employeeMap[emp] || 0) + 1;
    });

    const leadsByZone = Object.entries(zoneMap).map(([name, value]) => ({ name, value }));
    const leadsByPriority = Object.entries(priorityMap).map(([name, value]) => ({
      name,
      value,
      color: name === 'Hot' ? '#ef4444' : name === 'Warm' ? '#f97316' : '#3b82f6',
    }));
    const leadsByEmployee = Object.entries(employeeMap).map(([name, value]) => ({ name, value }));

    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const key = date.toISOString().split('T')[0];
      const count = allLeads.filter((lead) => {
        if (!lead.createdAt) return false;
        return new Date(lead.createdAt).toISOString().split('T')[0] === key;
      }).length;
      return {
        label: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        count,
      };
    });

    return {
      leadsByZone,
      leadsByPriority,
      leadsByEmployee,
      last30Days,
      summary: {
        total: allLeads.length,
        hot: allLeads.filter((l) => normalizePriority(l.priority) === 'Hot').length,
        warm: allLeads.filter((l) => normalizePriority(l.priority) === 'Warm').length,
        zones: new Set(allLeads.map((l) => l.zone).filter(Boolean)).size,
        employees: new Set(allLeads.map((l) => getAssignedTo(l))).size,
      },
    };
  }, [allLeads]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportLeadsReport(
        {
          status: 'Pending',
          zone,
          employee,
          priority,
          fromDate,
          toDate,
          contactMobile,
          schoolName,
        },
        `Open_Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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

  const priorityBadge = (value?: string) => {
    const p = normalizePriority(value);
    const style =
      p === 'Hot'
        ? styles.badgeHot
        : p === 'Warm'
          ? styles.badgeWarm
          : styles.badgeCold;
    return (
      <Text style={[styles.badge, style]}>{p ? `${p} Lead` : '-'}</Text>
    );
  };

  return (
    <ScreenShell
      title="Open Leads Analytics"
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
          <MetricCard label="Total Leads" value={analytics.summary.total} tint="#dbeafe" icon="trending-up-outline" />
          <MetricCard label="Hot Leads" value={analytics.summary.hot} tint="#fee2e2" icon="flame-outline" />
          <MetricCard label="Warm Leads" value={analytics.summary.warm} tint="#ffedd5" icon="thermometer-outline" />
          <MetricCard label="Zones" value={analytics.summary.zones} tint="#ede9fe" icon="location-outline" />
          <MetricCard label="Employees" value={analytics.summary.employees} tint="#dcfce7" icon="people-outline" />
        </ScrollView>

        <BarChartCard title="Leads by Zone" icon="location-outline" data={analytics.leadsByZone} />
        <PriorityChart data={analytics.leadsByPriority} />
        <BarChartCard title="Leads by Employee" icon="people-outline" data={analytics.leadsByEmployee} />

        <View style={styles.chartCard}>
          <View style={styles.chartTitleRow}>
            <Ionicons name="calendar-outline" size={18} color="#8b5cf6" />
            <Text style={styles.chartTitle}>Leads Created Over Time (Last 30 Days)</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.timelineRow}>
              {analytics.last30Days.map((day) => (
                <View key={day.label} style={styles.timelineItem}>
                  <View style={[styles.timelineBar, { height: Math.max(day.count * 18, 4) }]} />
                  <Text style={styles.timelineCount}>{day.count || ''}</Text>
                  <Text style={styles.timelineLabel}>{day.label}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.filterCard}>
          <View style={styles.filterGrid}>
            <WebSelect
              label="Select Zone"
              value={zone}
              onValueChange={setZone}
              placeholder="All Zones"
              items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
            />
            <WebLabel>From Date</WebLabel>
            <DateField placeholder="From Date" value={fromDate} onChange={setFromDate} />
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
            <WebLabel>To Date</WebLabel>
            <DateField placeholder="To Date" value={toDate} onChange={setToDate} />
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
            <WebLabel>By Contact Mobile</WebLabel>
            <WebInput
              value={contactMobile}
              onChangeText={setContactMobile}
              placeholder="Enter mobile number"
              keyboardType="phone-pad"
            />
            <WebLabel>By School Name</WebLabel>
            <WebInput value={schoolName} onChangeText={setSchoolName} placeholder="Enter school name" />
          </View>
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
                    <TableCell width={TABLE_COLUMNS[10].width}>
                      {lead.follow_up_date ? formatDate(lead.follow_up_date) : '-'}
                    </TableCell>
                    <TableCell width={TABLE_COLUMNS[11].width}>{lead.strength ?? 0}</TableCell>
                    <TableCell width={TABLE_COLUMNS[12].width}>{lead.status || '-'}</TableCell>
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
  metricsRow: { gap: 12, paddingBottom: 4 },
  metricCard: {
    width: 150,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  metricValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  chartCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  chartTitle: { ...typography.heading.h3, color: colors.textPrimary },
  chartEmpty: { ...typography.body.medium, color: colors.textSecondary },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  barLabel: { width: 90, ...typography.body.small, color: colors.textSecondary },
  barTrack: {
    flex: 1,
    height: 22,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 6 },
  barValue: { width: 24, textAlign: 'right', ...typography.body.small, color: colors.textPrimary },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  priorityDot: { width: 12, height: 12, borderRadius: 6 },
  priorityText: { ...typography.body.medium, color: colors.textPrimary },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 120 },
  timelineItem: { alignItems: 'center', width: 42 },
  timelineBar: { width: 16, backgroundColor: '#8b5cf6', borderRadius: 4, marginBottom: 4 },
  timelineCount: { ...typography.label.small, color: colors.textSecondary, minHeight: 14 },
  timelineLabel: { ...typography.label.small, color: colors.textMuted, marginTop: 2, fontSize: 9 },
  filterCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  filterGrid: { gap: 4 },
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
  tableHeadCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tableCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
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

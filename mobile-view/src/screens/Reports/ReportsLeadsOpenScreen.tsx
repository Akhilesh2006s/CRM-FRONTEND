import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, Badge, InfoRow, EmptyState, SectionTitle, toneFor, type Tone } from '../../ui/Kit';
import { StatGrid, rk, matchesWords } from './ReportKit';
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
      <Text style={styles.chartTitle}>{title}</Text>
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
      <Text style={styles.chartTitle}>Leads by Priority</Text>
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

/** BDEs and Zonal Managers see only their own zone(s); other roles see every zone. */
const ZONE_LIMITED_ROLES = new Set(['Executive', 'Sales Executive', 'Executive Manager']);
const ownZones = (me: any): string[] | null => {
  if (!me || !ZONE_LIMITED_ROLES.has(String(me.role || '').trim()) || me.isSuperAdmin) return null;
  const list = [me.zone, ...(Array.isArray(me.zones) ? me.zones : [])]
    .map((z: any) => String(z || '').trim().toLowerCase())
    .filter(Boolean);
  return list.length ? Array.from(new Set(list)) : null;
};

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
      const [leadRes, empRes, me] = await Promise.all([
        apiService.get<any>('/leads?status=Pending&limit=1000'),
        apiService.get<Employee[]>('/employees?isActive=true').catch(() => []),
        apiService.get('/auth/me').catch(() => null),
      ]);

      let allData: Lead[] = Array.isArray(leadRes) ? leadRes : leadRes?.data || [];
      allData = allData.filter((lead) => lead.status === 'Pending');
      const mine = ownZones(me);
      if (mine) allData = allData.filter((lead) => mine.includes(String(lead.zone || '').trim().toLowerCase()));

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
      filtered = filtered.filter((l) =>
        matchesWords(schoolName, [
          l.school_name,
          l.location,
          l.contact_person,
          l.contact_mobile,
          l.zone,
          l.status,
          normalizePriority(l.priority),
          getAssignedTo(l),
          formatDate(l.createdAt),
          l.follow_up_date ? formatDate(l.follow_up_date) : '',
        ])
      );
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

  const priorityTone = (value?: string): Tone => {
    const p = normalizePriority(value);
    return p === 'Hot' ? 'error' : p === 'Warm' ? 'warning' : 'info';
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
      <StatGrid
        items={[
          { label: 'Total Leads', value: analytics.summary.total, tone: 'blue' },
          { label: 'Hot Leads', value: analytics.summary.hot, tone: 'red' },
          { label: 'Warm Leads', value: analytics.summary.warm, tone: 'amber' },
          { label: 'Zones', value: analytics.summary.zones, tone: 'purple' },
          { label: 'Employees', value: analytics.summary.employees, tone: 'green' },
        ]}
      />

      <BarChartCard title="Leads by Zone" icon="location-outline" data={analytics.leadsByZone} />
      <PriorityChart data={analytics.leadsByPriority} />
      <BarChartCard title="Leads by Employee" icon="people-outline" data={analytics.leadsByEmployee} />

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Leads Created (Last 30 Days)</Text>
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

      <PageSection title="Filters">
        <WebInput value={schoolName} onChangeText={setSchoolName} placeholder="Search school, contact, mobile, location…" />
        <View style={rk.row2}>
          <View style={rk.col}>
            <WebSelect
              label="Zone"
              value={zone}
              onValueChange={setZone}
              placeholder="All Zones"
              items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
            />
          </View>
          <View style={rk.col}>
            <WebSelect
              label="Priority"
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
          </View>
        </View>
        <WebSelect
          label="Employee"
          value={employee}
          onValueChange={setEmployee}
          placeholder="All Employees"
          items={[
            { label: 'All Employees', value: '' },
            ...employees.map((e) => ({ label: e.name || 'Unknown', value: e._id })),
          ]}
        />
        <DateField placeholder="From Date" value={fromDate} onChange={setFromDate} />
        <DateField placeholder="To Date" value={toDate} onChange={setToDate} />
        <View style={rk.btnRow}>
          <View style={rk.col}>
            <WebButton title="Search" onPress={applyFilters} />
          </View>
          <View style={rk.col}>
            <WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={handleExport} loading={exporting} />
          </View>
        </View>
      </PageSection>

      <SectionTitle>{`Open leads (${leads.length})`}</SectionTitle>

      {leads.length === 0 ? (
        <EmptyState title="No leads found" />
      ) : (
        leads.map((lead, index) => {
          const p = normalizePriority(lead.priority);
          return (
            <Card key={lead._id}>
              <CardTitle
                title={`${index + 1}. ${lead.school_name || '-'}`}
                subtitle={lead.location || undefined}
                badge={lead.status || '-'}
                tone={toneFor(lead.status)}
              />
              {p ? (
                <InfoRow
                  label="Priority"
                  value={
                    <View style={{ flexDirection: 'row' }}>
                      <Badge label={`${p} Lead`} tone={priorityTone(lead.priority)} />
                    </View>
                  }
                />
              ) : null}
              <InfoRow label="Created on" value={formatDate(lead.createdAt)} />
              <InfoRow label="Zone" value={lead.zone} />
              <InfoRow label="Assigned to" value={getAssignedTo(lead)} />
              <InfoRow label="Contact" value={lead.contact_person} />
              <InfoRow label="Mobile" value={lead.contact_mobile} phone />
              <InfoRow label="Follow-up on" value={lead.follow_up_date ? formatDate(lead.follow_up_date) : '-'} />
              <InfoRow label="Strength" value={String(lead.strength ?? 0)} />
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  chartCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
    marginBottom: 12,
  },
  chartTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  chartEmpty: { fontSize: 13, color: colors.textTertiary },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  barLabel: { width: 96, fontSize: 13, color: colors.textSecondary },
  barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.backgroundMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barValue: { width: 32, textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  priorityText: { fontSize: 14, color: colors.textPrimary },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 },
  timelineItem: { alignItems: 'center', width: 44 },
  timelineBar: { width: 14, borderRadius: 4, backgroundColor: colors.primary },
  timelineCount: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  timelineLabel: { fontSize: 10, color: colors.textTertiary, textAlign: 'center' },
});

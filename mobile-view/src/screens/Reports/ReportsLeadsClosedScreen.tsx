import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, Badge, InfoRow, ActionRow, EmptyState, SectionTitle, type Tone } from '../../ui/Kit';
import { StatGrid, rk, matchesWords } from './ReportKit';
import { apiService } from '../../services/api';
import { exportLeadsReport } from '../../utils/exportLeadsReport';

type Lead = {
  _id: string;
  school_name?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
  location?: string;
  strength?: number;
  managed_by?: { name?: string };
  assigned_by?: { name?: string };
  createdBy?: { name?: string };
};

const CHART_COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f97316', '#8b5cf6'];

function getAssignedTo(lead: Lead) {
  return lead.managed_by?.name || lead.assigned_by?.name || lead.createdBy?.name || 'Not Assigned';
}

function normalizePriority(priority?: string) {
  if (!priority) return 'Hot';
  return priority.replace(/\s*Lead$/i, '').trim();
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
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
      {data.map((item, index) => (
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
      ))}
    </View>
  );
}

export default function ReportsLeadsClosedScreen({ navigation }: any) {
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [zone, setZone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [contactMobile, setContactMobile] = useState('');

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allLeads, zone, schoolName, contactMobile]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await apiService.get<any>('/leads?status=Closed&limit=1000');
      const entries: Lead[] = (Array.isArray(data) ? data : data?.data || []).filter(
        (l: Lead) => l.status === 'Closed'
      );
      setAllLeads(entries);
      setZones(Array.from(new Set(entries.map((l) => l.zone).filter(Boolean) as string[])).sort());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load closed leads');
      setAllLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allLeads];
    if (zone) filtered = filtered.filter((l) => l.zone?.toLowerCase().includes(zone.toLowerCase()));
    if (contactMobile) filtered = filtered.filter((l) => l.contact_mobile?.includes(contactMobile));
    if (schoolName) {
      filtered = filtered.filter((l) =>
        matchesWords(schoolName, [
          l.school_name,
          l.location,
          l.contact_person,
          l.contact_mobile,
          l.zone,
          normalizePriority(l.priority),
          getAssignedTo(l),
          formatDateTime(l.updatedAt || l.createdAt),
        ])
      );
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
      const p = normalizePriority(lead.priority);
      priorityMap[p] = (priorityMap[p] || 0) + 1;
      employeeMap[getAssignedTo(lead)] = (employeeMap[getAssignedTo(lead)] || 0) + 1;
    });

    return {
      leadsByZone: Object.entries(zoneMap).map(([name, value]) => ({ name, value })),
      leadsByPriority: Object.entries(priorityMap).map(([name, value]) => ({ name, value })),
      leadsByEmployee: Object.entries(employeeMap).map(([name, value]) => ({ name, value })),
      summary: {
        total: allLeads.length,
        hot: allLeads.filter((l) => normalizePriority(l.priority) === 'Hot').length,
        warm: allLeads.filter((l) => normalizePriority(l.priority) === 'Warm').length,
        zones: new Set(allLeads.map((l) => l.zone).filter(Boolean)).size,
        employees: new Set(allLeads.map((l) => getAssignedTo(l))).size,
        strength: allLeads.reduce((sum, l) => sum + (l.strength || 0), 0),
      },
    };
  }, [allLeads]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportLeadsReport(
        { status: 'Closed', zone, schoolName, contactMobile },
        `Closed_Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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

  const closedOn = (lead: Lead) => formatDateTime(lead.updatedAt || lead.createdAt);

  return (
    <ScreenShell
      title="Closed Leads Analytics"
      subtitle="View analytics and insights for successfully closed leads"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <TouchableOpacity onPress={handleExport} disabled={exporting} style={styles.exportBtn}>
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
          { label: 'Total Closed', value: analytics.summary.total, tone: 'green' },
          { label: 'Hot Leads', value: analytics.summary.hot, tone: 'red' },
          { label: 'Warm Leads', value: analytics.summary.warm, tone: 'amber' },
          { label: 'Zones', value: analytics.summary.zones, tone: 'purple' },
          { label: 'Employees', value: analytics.summary.employees, tone: 'blue' },
          { label: 'Total Strength', value: analytics.summary.strength, tone: 'slate' },
        ]}
      />

      <BarChartCard title="Closed Leads by Zone" icon="location-outline" data={analytics.leadsByZone} />
      <BarChartCard title="Closed Leads by Employee" icon="people-outline" data={analytics.leadsByEmployee} />

      <PageSection title="Filters">
        <WebInput value={schoolName} onChangeText={setSchoolName} placeholder="Search school, contact, mobile, location…" />
        <WebSelect
          label="Zone"
          value={zone}
          onValueChange={setZone}
          placeholder="All Zones"
          items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
        />
        <View style={rk.btnRow}>
          <View style={rk.col}>
            <WebButton title="Search" onPress={applyFilters} />
          </View>
          <View style={rk.col}>
            <WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={handleExport} loading={exporting} />
          </View>
        </View>
      </PageSection>

      <SectionTitle>{`Closed leads (${leads.length})`}</SectionTitle>

      {leads.length === 0 ? (
        <EmptyState title="No closed leads found" />
      ) : (
        leads.map((lead) => (
          <Card key={lead._id}>
            <CardTitle title={lead.school_name || 'Unnamed School'} subtitle={lead.location || undefined} badge="Closed" tone="success" />
            <InfoRow label="Contact" value={lead.contact_person} />
            <InfoRow label="Mobile" value={lead.contact_mobile} phone />
            <InfoRow
              label="Lead status"
              value={
                <View style={{ flexDirection: 'row' }}>
                  <Badge label={normalizePriority(lead.priority)} tone={priorityTone(lead.priority)} />
                </View>
              }
            />
            <InfoRow label="Closed on" value={closedOn(lead)} />
            <ActionRow>
              <WebButton title="Edit Details" variant="outline" onPress={() => navigation.navigate('LeadEdit', { id: lead._id })} />
              <WebButton title="View Details" variant="outline" onPress={() => navigation.navigate('LeadEdit', { id: lead._id })} />
            </ActionRow>
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

function priorityTone(priority?: string): Tone {
  const p = normalizePriority(priority).toLowerCase();
  return p === 'hot' ? 'error' : p === 'warm' ? 'warning' : 'info';
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
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  barLabel: { width: 96, fontSize: 13, color: colors.textSecondary },
  barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.backgroundMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barValue: { width: 32, textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.textPrimary },
});

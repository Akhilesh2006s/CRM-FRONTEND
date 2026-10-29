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

function MetricCard({
  label,
  value,
  tint,
  icon,
}: {
  label: string;
  value: string | number;
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: tint }]}>
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <Ionicons name={icon} size={26} color={colors.textPrimary} />
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
      filtered = filtered.filter((l) => l.school_name?.toLowerCase().includes(schoolName.toLowerCase()));
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton title={exporting ? 'Exporting…' : 'Export to Excel'} onPress={handleExport} loading={exporting} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
          <MetricCard label="Total Closed" value={analytics.summary.total} tint="#dcfce7" icon="checkmark-circle-outline" />
          <MetricCard label="Hot Leads" value={analytics.summary.hot} tint="#fee2e2" icon="flame-outline" />
          <MetricCard label="Warm Leads" value={analytics.summary.warm} tint="#ffedd5" icon="thermometer-outline" />
          <MetricCard label="Zones" value={analytics.summary.zones} tint="#ede9fe" icon="location-outline" />
          <MetricCard label="Employees" value={analytics.summary.employees} tint="#dbeafe" icon="people-outline" />
          <MetricCard label="Total Strength" value={analytics.summary.strength} tint="#fef9c3" icon="ribbon-outline" />
        </ScrollView>

        <BarChartCard title="Closed Leads by Zone" icon="location-outline" data={analytics.leadsByZone} />
        <BarChartCard title="Closed Leads by Employee" icon="people-outline" data={analytics.leadsByEmployee} />

        <View style={styles.filterCard}>
          <WebSelect
            label="Zone"
            value={zone}
            onValueChange={setZone}
            placeholder="All Zones"
            items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
          />
          <WebLabel>School Name</WebLabel>
          <WebInput value={schoolName} onChangeText={setSchoolName} placeholder="Search school..." />
          <WebLabel>Contact Mobile</WebLabel>
          <WebInput
            value={contactMobile}
            onChangeText={setContactMobile}
            placeholder="Search mobile..."
            keyboardType="phone-pad"
          />
          <WebButton title="Search" onPress={applyFilters} />
        </View>

        {leads.length === 0 ? (
          <Text style={styles.emptyText}>No closed leads found.</Text>
        ) : (
          leads.map((lead) => (
            <View key={lead._id} style={styles.leadCard}>
              <View style={styles.leadHeader}>
                <View style={styles.leadHeaderLeft}>
                  <Text style={styles.schoolName}>{lead.school_name || 'Unnamed School'}</Text>
                  {lead.location ? (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color="#ea580c" />
                      <Text style={styles.locationText}>{lead.location}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.closedBadge}>Closed</Text>
              </View>

              <View style={styles.contactRow}>
                <Text style={styles.infoText}>
                  Contact: <Text style={styles.infoValue}>{lead.contact_person || '-'}</Text>
                </Text>
                <Text style={styles.infoText}>
                  Mobile: <Text style={styles.infoValue}>{lead.contact_mobile || '-'}</Text>
                </Text>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.infoText}>Lead Status: </Text>
                <Text style={styles.priorityBadge}>{normalizePriority(lead.priority)}</Text>
              </View>
              <Text style={styles.infoText}>
                Closed On: <Text style={styles.infoValue}>{closedOn(lead)}</Text>
              </Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => navigation.navigate('LeadEdit', { id: lead._id })}
                >
                  <Ionicons name="create-outline" size={16} color="#b45309" />
                  <Text style={styles.editBtnText}>Edit Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => navigation.navigate('LeadEdit', { id: lead._id })}
                >
                  <Ionicons name="time-outline" size={16} color="#2563eb" />
                  <Text style={styles.viewBtnText}>View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  metricsRow: { gap: 12 },
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
  metricValue: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  chartCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  chartTitle: { ...typography.heading.h3, color: colors.textPrimary },
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
  filterCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  emptyText: { textAlign: 'center', paddingVertical: 24, color: colors.textSecondary },
  leadCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  leadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leadHeaderLeft: { flex: 1, paddingRight: 8 },
  schoolName: { fontSize: 18, fontWeight: '700', color: '#ea580c', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { ...typography.body.small, color: colors.textSecondary, flex: 1 },
  closedBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { ...typography.body.medium, color: colors.textSecondary },
  infoValue: { color: colors.textPrimary, fontWeight: '500' },
  priorityBadge: {
    backgroundColor: '#ffedd5',
    color: '#9a3412',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editBtnText: { color: '#b45309', fontWeight: '600', fontSize: 13 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  exportText: { fontSize: 12, fontWeight: '600', color: colors.primary },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { exportSalesVisitReport } from '../../utils/exportSalesVisitReport';

import DateField from '../../ui/DateField';
type Visit = {
  _id: string;
  schoolName?: string;
  schoolCode?: string;
  zone?: string;
  town?: string;
  category?: string;
  remarks?: string;
  visitDate?: string;
  createdAt?: string;
  outcome?: string;
  leadId?: string | { _id?: string };
  dcOrderId?: string | { _id?: string };
  executiveId?: { _id?: string; name?: string };
};

type Employee = { _id: string; name?: string };

function getVisitDateStr(visit: Visit) {
  return visit.visitDate || visit.createdAt;
}

function getSchoolName(visit: Visit) {
  return visit.schoolName || '-';
}

function getSchoolCode(visit: Visit) {
  return visit.schoolCode || '-';
}

function isNewSchool(visit: Visit) {
  if (visit.category === 'New Business' || visit.category === 'New School') return true;
  if (visit.dcOrderId) return false;
  return Boolean(visit.leadId);
}

function getZone(visit: Visit) {
  return visit.zone || '-';
}

function getExecutive(visit: Visit) {
  return visit.executiveId?.name || 'Not Assigned';
}

function getTown(visit: Visit) {
  return visit.town || '-';
}

function isConvertedToClient(visit: Visit) {
  const remarks = (visit.remarks || '').toLowerCase();
  return remarks.includes('converted') || visit.outcome === 'Hot';
}

function getVisitCategoryLabel(visit: Visit) {
  return visit.category || (isNewSchool(visit) ? 'New Business' : 'Follow-up');
}

function formatVisitDate(dateStr?: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getSchoolKey(visit: Visit) {
  return visit.schoolCode || getSchoolName(visit);
}

function looksLikeSchoolCode(value: string) {
  return /dc[-_]?\s*\d+/i.test(value) || /^\s*[A-Za-z]{1,8}[-_]\d+/.test(value);
}

export default function ReportsSalesVisitScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [zone, setZone] = useState('');
  const [employee, setEmployee] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const buildQuery = () => {
    const qs = new URLSearchParams();
    if (zone) qs.set('zone', zone);
    if (employee) qs.set('executiveId', employee);
    if (visitDate) {
      qs.set('fromDate', visitDate);
      qs.set('toDate', visitDate);
    }
    const term = schoolSearch.trim();
    if (term) {
      if (looksLikeSchoolCode(term)) qs.set('schoolCode', term);
      else qs.set('schoolName', term);
    }
    return qs;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const qs = buildQuery();
      const [visitData, employeeData] = await Promise.all([
        apiService.get<any>(`/visits${qs.toString() ? `?${qs.toString()}` : ''}`),
        apiService.get<any>('/employees?isActive=true').catch(() => []),
      ]);
      const entries = Array.isArray(visitData) ? visitData : visitData?.data || [];
      setVisits(entries);
      setEmployees(Array.isArray(employeeData) ? employeeData : employeeData?.data || []);
      const uniqueZones = Array.from(
        new Set(entries.map((v: Visit) => v.zone).filter(Boolean))
      ).sort() as string[];
      if (!zone) setZones(uniqueZones);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load sales visits');
      setVisits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const summary = useMemo(() => {
    const totalVisits = visits.length;
    const uniqueSchools = new Set(visits.map(getSchoolKey)).size;
    const newCount = visits.filter(isNewSchool).length;
    const followUpCount = totalVisits - newCount;
    const newPct = totalVisits ? Math.round((newCount / totalVisits) * 100) : 0;
    const followUpPct = totalVisits ? Math.round((followUpCount / totalVisits) * 100) : 0;
    return {
      totalVisits,
      uniqueSchools,
      newVsFollowUp: `${newPct}% / ${followUpPct}%`,
      leadsConverted: visits.filter(isConvertedToClient).length,
      activeZones: new Set(visits.map(getZone).filter((z) => z && z !== '-')).size,
    };
  }, [visits]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const term = schoolSearch.trim();
      await exportSalesVisitReport(
        {
          zone: zone || undefined,
          executiveId: employee || undefined,
          fromDate: visitDate || undefined,
          toDate: visitDate || undefined,
          schoolName: term && !looksLikeSchoolCode(term) ? term : undefined,
          schoolCode: term && looksLikeSchoolCode(term) ? term : undefined,
        },
        `Sales_Visit_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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
      title="Sales Visit Report"
      subtitle="School visits"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.kpiScroll}
        contentContainerStyle={styles.kpiRow}
      >
        <View style={[styles.kpiCard, styles.kpiBlue]}>
          <Text style={styles.kpiLabel}>Total Visits</Text>
          <Text style={styles.kpiValue}>{summary.totalVisits}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiGreen]}>
          <Text style={styles.kpiLabel}>Unique Schools</Text>
          <Text style={styles.kpiValue}>{summary.uniqueSchools}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiAmber]}>
          <Text style={styles.kpiLabel}>New vs Follow-up</Text>
          <Text style={styles.kpiValue}>{summary.newVsFollowUp}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiRose]}>
          <Text style={styles.kpiLabel}>Leads Converted</Text>
          <Text style={styles.kpiValue}>{summary.leadsConverted}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiPurple]}>
          <Text style={styles.kpiLabel}>Active Zones</Text>
          <Text style={styles.kpiValue}>{summary.activeZones}</Text>
        </View>
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />

        <View style={styles.filters}>
          <WebSelect
            label="Select Zone"
            value={zone}
            onValueChange={setZone}
            placeholder="All Zones"
            items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
          />
          <WebSelect
            label="Select Employee"
            value={employee}
            onValueChange={setEmployee}
            placeholder="All Employees"
            items={[
              { label: 'All Employees', value: '' },
              ...employees.map((emp) => ({ label: emp.name || 'Unknown', value: emp._id })),
            ]}
          />
          <WebLabel>Visit Date</WebLabel>
          <DateField placeholder="Visit Date" value={visitDate} onChange={setVisitDate} />
          <WebLabel>By School Name / Code</WebLabel>
          <WebInput
            placeholder="Search by School Name / Code"
            value={schoolSearch}
            onChangeText={setSchoolSearch}
          />
          <WebButton title="Search" onPress={loadData} />
        </View>

      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>Visit log</Text>
        <Text style={styles.logCount}>{visits.length} records</Text>
      </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : visits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚚</Text>
            <Text style={styles.emptyText}>No visits found</Text>
          </View>
        ) : (
          visits.map((visit, index) => (
            <View key={visit._id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.indexText}>#{index + 1}</Text>
                <Text style={styles.dateText}>{formatVisitDate(getVisitDateStr(visit))}</Text>
              </View>
              <View style={styles.executiveRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getExecutive(visit).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.executiveName}>{getExecutive(visit)}</Text>
                  <Text style={styles.zoneText}>{getZone(visit)}</Text>
                </View>
              </View>
              <View style={styles.schoolRow}>
                <Text style={styles.schoolName}>{getSchoolName(visit)}</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.schoolCode}>{getSchoolCode(visit)}</Text>
                  {isNewSchool(visit) ? <Text style={styles.newBadge}>New</Text> : null}
                </View>
              </View>
              <Text style={styles.infoLine}>Town: {getTown(visit)}</Text>
              <View style={styles.badgeRow}>
                <Text style={styles.categoryBadge}>{getVisitCategoryLabel(visit)}</Text>
                {isConvertedToClient(visit) ? (
                  <Text style={styles.convertedBadge}>Converted to Client</Text>
                ) : null}
              </View>
              <Text style={styles.infoLine}>Remarks: {visit.remarks || '-'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 24 },
  kpiScroll: { marginTop: 8 },
  kpiRow: { paddingHorizontal: 16, gap: 10 },
  kpiCard: {
    width: 150,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  kpiBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  kpiGreen: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  kpiAmber: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  kpiRose: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  kpiPurple: { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' },
  kpiLabel: { ...typography.label.small, color: colors.textSecondary, textTransform: 'uppercase' },
  kpiValue: { ...typography.heading.h3, color: colors.textPrimary, marginTop: 4 },
  filters: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  logTitle: { ...typography.heading.h3, color: colors.textPrimary },
  logCount: { ...typography.body.medium, color: colors.textSecondary },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 16 },
  emptyIcon: { fontSize: 64, marginBottom: 12 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  indexText: { ...typography.label.medium, color: colors.textSecondary },
  dateText: { ...typography.label.medium, color: colors.textSecondary },
  executiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: '#334155' },
  executiveName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  zoneText: { ...typography.label.small, color: colors.textSecondary },
  schoolRow: { marginBottom: 6 },
  schoolName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  schoolCode: { ...typography.label.small, color: colors.textSecondary },
  newBadge: {
    ...typography.label.small,
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  infoLine: { ...typography.body.medium, color: colors.textSecondary, marginTop: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  categoryBadge: {
    ...typography.label.small,
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  convertedBadge: {
    ...typography.label.small,
    color: '#047857',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
});

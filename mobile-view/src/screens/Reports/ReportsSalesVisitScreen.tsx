import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, Badge, InfoRow, EmptyState, SectionTitle } from '../../ui/Kit';
import { StatGrid, rk } from './ReportKit';
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
      <StatGrid
        items={[
          { label: 'Total Visits', value: summary.totalVisits, tone: 'blue' },
          { label: 'Unique Schools', value: summary.uniqueSchools, tone: 'green' },
          { label: 'New vs Follow-up', value: summary.newVsFollowUp, tone: 'amber' },
          { label: 'Leads Converted', value: summary.leadsConverted, tone: 'red' },
          { label: 'Active Zones', value: summary.activeZones, tone: 'purple' },
        ]}
      />

      <PageSection title="Filters">
        <WebInput placeholder="Search school name or code" value={schoolSearch} onChangeText={setSchoolSearch} />
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
              label="Employee"
              value={employee}
              onValueChange={setEmployee}
              placeholder="All Employees"
              items={[
                { label: 'All Employees', value: '' },
                ...employees.map((emp) => ({ label: emp.name || 'Unknown', value: emp._id })),
              ]}
            />
          </View>
        </View>
        <DateField placeholder="Visit Date" value={visitDate} onChange={setVisitDate} />
        <View style={rk.btnRow}>
          <View style={rk.col}>
            <WebButton title="Search" onPress={loadData} />
          </View>
          <View style={rk.col}>
            <WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={handleExport} loading={exporting} />
          </View>
        </View>
      </PageSection>

      <SectionTitle>{`Visit log (${visits.length})`}</SectionTitle>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : visits.length === 0 ? (
        <EmptyState icon="🚚" title="No visits found" />
      ) : (
        visits.map((visit, index) => (
          <Card key={visit._id}>
            <CardTitle
              title={`${index + 1}. ${getSchoolName(visit)}`}
              subtitle={[getSchoolCode(visit), formatVisitDate(getVisitDateStr(visit))].filter((x) => x && x !== '-').join(' • ')}
              badge={getVisitCategoryLabel(visit)}
              tone="info"
            />
            {isNewSchool(visit) || isConvertedToClient(visit) ? (
              <View style={styles.badgeRow}>
                {isNewSchool(visit) ? <Badge label="New" tone="info" /> : null}
                {isConvertedToClient(visit) ? <Badge label="Converted to Client" tone="success" /> : null}
              </View>
            ) : null}
            <InfoRow label="Executive" value={getExecutive(visit)} />
            <InfoRow label="Zone" value={getZone(visit)} />
            <InfoRow label="Town" value={getTown(visit)} />
            <InfoRow label="Remarks" value={visit.remarks || '-'} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
});

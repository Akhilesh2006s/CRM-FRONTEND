import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, Badge, InfoRow, EmptyState, SectionTitle, toneFor, type Tone } from '../../ui/Kit';
import { rk, matchesWords } from './ReportKit';
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

function priorityTone(priority?: string): Tone {
  const p = (normalizePriority(priority) || 'Hot').toLowerCase();
  return p === 'hot' ? 'error' : p === 'warm' ? 'warning' : 'info';
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
      filtered = filtered.filter((l) =>
        matchesWords(schoolName, [
          l.school_name,
          l.location,
          l.contact_person,
          l.contact_mobile,
          l.zone,
          l.remarks,
          l.status || 'Pending',
          normalizePriority(l.priority) || 'Hot',
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
      <PageSection title="Filters">
        <WebInput value={schoolName} onChangeText={setSchoolName} placeholder="Search school, contact, mobile, remarks…" />
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

      <SectionTitle>{`Follow-up leads (${leads.length})`}</SectionTitle>

      {leads.length === 0 ? (
        <EmptyState title="No leads found" />
      ) : (
        leads.map((lead, index) => {
          const overdue = isFollowUpOverdue(lead.follow_up_date);
          return (
            <Card key={lead._id}>
              <CardTitle
                title={`${index + 1}. ${lead.school_name || '-'}`}
                subtitle={lead.location || undefined}
                badge={lead.status || 'Pending'}
                tone={toneFor(lead.status || 'Pending')}
              />
              <InfoRow
                label="Priority"
                value={
                  <View style={{ flexDirection: 'row' }}>
                    <Badge label={normalizePriority(lead.priority) || 'Hot'} tone={priorityTone(lead.priority)} />
                  </View>
                }
              />
              <InfoRow label="Created on" value={formatDate(lead.createdAt)} />
              <InfoRow label="Zone" value={lead.zone} />
              <InfoRow label="Assigned to" value={getAssignedTo(lead)} />
              <InfoRow label="Contact" value={lead.contact_person} />
              <InfoRow label="Mobile" value={lead.contact_mobile} phone />
              <InfoRow
                label="Follow-up on"
                value={
                  lead.follow_up_date ? (
                    <Text style={[styles.value, overdue && styles.overdueText]}>
                      {formatDate(lead.follow_up_date) + (overdue ? ' (overdue)' : '')}
                    </Text>
                  ) : undefined
                }
              />
              <InfoRow label="Strength" value={String(lead.strength ?? 0)} />
              <InfoRow label="Remarks" value={lead.remarks} />
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
  value: { fontSize: 14, color: colors.textPrimary },
  overdueText: { color: colors.error, fontWeight: '700' },
});

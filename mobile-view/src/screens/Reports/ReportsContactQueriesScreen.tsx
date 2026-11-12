import React, { useEffect, useMemo, useState } from 'react';
import { View, Alert, ActivityIndicator, Platform } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, Badge, InfoRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { StatGrid, rk, matchesWords } from './ReportKit';
import { apiService } from '../../services/api';
import { exportContactQueriesReport } from '../../utils/exportContactQueriesReport';
import { fetchContactEnquiries } from '../../utils/fetchContactEnquiries';

import DateField from '../../ui/DateField';
type ContactQuery = {
  _id: string;
  school_code?: string;
  school_name?: string;
  school_type?: string;
  zone?: string;
  town?: string;
  subject?: string;
  description?: string;
  contact_mobile?: string;
  enquiry_date?: string;
  status?: string;
  executive?: { name?: string };
};

function formatEnquiryDate(dateStr?: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function extractContactName(query: ContactQuery) {
  if ((query as { contact_person?: string }).contact_person?.trim()) {
    return (query as { contact_person?: string }).contact_person!.trim();
  }
  const desc = query.description || '';
  const match = desc.match(/Contact:\s*(.+?)(?:\n|$)/i);
  if (match?.[1]) return match[1].trim();
  return '-';
}

function getDisplayStatus(status?: string) {
  if (status === 'Resolved') return 'Closed';
  return status || 'Pending';
}

function isNewSchool(query: ContactQuery) {
  return (query.school_type || '').toLowerCase() === 'new';
}

function getSchoolKey(query: ContactQuery) {
  return query.school_code || query.school_name || query._id;
}

export default function ReportsContactQueriesScreen() {
  const [allQueries, setAllQueries] = useState<ContactQuery[]>([]);
  const [queries, setQueries] = useState<ContactQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [schoolSearch, setSchoolSearch] = useState('');
  const [zone, setZone] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [enquiryFrom, setEnquiryFrom] = useState('');
  const [enquiryTo, setEnquiryTo] = useState('');

  useEffect(() => {
    loadQueries();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allQueries, schoolSearch, zone, contactMobile, enquiryFrom, enquiryTo]);

  const zones = useMemo(() => {
    return Array.from(new Set(allQueries.map((q) => q.zone).filter(Boolean))).sort() as string[];
  }, [allQueries]);

  const loadQueries = async () => {
    try {
      setLoading(true);
      const data = await fetchContactEnquiries();
      setAllQueries(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load contact enquiries');
      setAllQueries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadQueries();
  };

  const applyFilters = () => {
    let filtered = [...allQueries];
    const search = schoolSearch.trim().toLowerCase();

    if (search) {
      filtered = filtered.filter((q) =>
        matchesWords(search, [
          q.school_name,
          q.school_code,
          q.zone,
          q.town,
          q.subject,
          q.contact_mobile,
          q.executive?.name,
          extractContactName(q),
          getDisplayStatus(q.status),
          formatEnquiryDate(q.enquiry_date),
        ])
      );
    }

    if (zone) {
      filtered = filtered.filter((q) => q.zone?.toLowerCase() === zone.toLowerCase());
    }

    if (contactMobile.trim()) {
      filtered = filtered.filter((q) => q.contact_mobile?.includes(contactMobile.trim()));
    }

    if (enquiryFrom) {
      const from = new Date(enquiryFrom);
      filtered = filtered.filter((q) => q.enquiry_date && new Date(q.enquiry_date) >= from);
    }

    if (enquiryTo) {
      const to = new Date(enquiryTo + 'T23:59:59');
      filtered = filtered.filter((q) => q.enquiry_date && new Date(q.enquiry_date) <= to);
    }

    setQueries(filtered);
  };

  const summary = useMemo(() => {
    const newCount = queries.filter(isNewSchool).length;
    return {
      totalEnquiries: queries.length,
      uniqueSchools: new Set(queries.map(getSchoolKey)).size,
      newExisting: `${newCount} / ${queries.length - newCount}`,
      activeZones: new Set(queries.map((q) => q.zone).filter(Boolean)).size,
    };
  }, [queries]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportContactQueriesReport(
        {
          zone: zone || undefined,
          schoolName: schoolSearch.trim() || undefined,
          schoolCode: schoolSearch.trim() || undefined,
          fromDate: enquiryFrom || undefined,
          toDate: enquiryTo || undefined,
          contactMobile: contactMobile.trim() || undefined,
        },
        `Contact_Enquiries_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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
      title="Contact Enquiries"
      subtitle="School contact records and logged enquiries"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <StatGrid
        items={[
          { label: 'Total Enquiries', value: summary.totalEnquiries, tone: 'blue' },
          { label: 'Unique Schools', value: summary.uniqueSchools, tone: 'green' },
          { label: 'New / Existing', value: summary.newExisting, tone: 'purple' },
          { label: 'Active Zones', value: summary.activeZones, tone: 'amber' },
        ]}
      />

      <PageSection title="Filters">
        <WebInput placeholder="Search school, code, mobile, contact, subject…" value={schoolSearch} onChangeText={setSchoolSearch} />
        <WebSelect
          label="Zone"
          value={zone}
          onValueChange={setZone}
          placeholder="All Zones"
          items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
        />
        <DateField placeholder="Enquiry From" value={enquiryFrom} onChange={setEnquiryFrom} />
        <DateField placeholder="Enquiry To" value={enquiryTo} onChange={setEnquiryTo} />
        <View style={rk.btnRow}>
          <View style={rk.col}>
            <WebButton title="Search" onPress={applyFilters} />
          </View>
          <View style={rk.col}>
            <WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={handleExport} loading={exporting} />
          </View>
        </View>
      </PageSection>

      <SectionTitle>{`Enquiry log (${queries.length})`}</SectionTitle>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : queries.length === 0 ? (
        <EmptyState icon="❓" title="No enquiries found" />
      ) : (
        queries.map((query, index) => (
          <Card key={query._id}>
            <CardTitle
              title={`${index + 1}. ${query.school_name || 'School'}`}
              subtitle={[query.school_code, formatEnquiryDate(query.enquiry_date)].filter((x) => x && x !== '-').join(' • ')}
              badge={getDisplayStatus(query.status)}
              tone={toneFor(getDisplayStatus(query.status) === 'Closed' ? 'completed' : getDisplayStatus(query.status))}
            />
            {isNewSchool(query) ? (
              <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                <Badge label="New school" tone="info" />
              </View>
            ) : null}
            <InfoRow label="BDE" value={query.executive?.name} />
            <InfoRow label="Zone" value={query.zone} />
            <InfoRow label="Contact" value={extractContactName(query)} />
            <InfoRow label="Mobile" value={query.contact_mobile} phone />
            <InfoRow label="Subject" value={query.subject} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

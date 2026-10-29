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
      filtered = filtered.filter((q) => {
        const name = q.school_name?.toLowerCase() || '';
        const code = q.school_code?.toLowerCase() || '';
        return name.includes(search) || code.includes(search);
      });
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export to Excel'}
          onPress={handleExport}
          loading={exporting}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Enquiries</Text>
            <Text style={styles.kpiValue}>{summary.totalEnquiries}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Unique Schools</Text>
            <Text style={styles.kpiValue}>{summary.uniqueSchools}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>New / Existing</Text>
            <Text style={styles.kpiValue}>{summary.newExisting}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Zones</Text>
            <Text style={styles.kpiValue}>{summary.activeZones}</Text>
          </View>
        </ScrollView>

        <View style={styles.filters}>
          <WebInput
            placeholder="Search by school name or code"
            value={schoolSearch}
            onChangeText={setSchoolSearch}
          />
          <WebSelect
            label="Zone"
            value={zone}
            onValueChange={setZone}
            placeholder="All Zones"
            items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
          />
          <WebInput
            placeholder="Contact Mobile"
            value={contactMobile}
            onChangeText={setContactMobile}
            keyboardType="phone-pad"
          />
          <WebLabel>Enquiry From</WebLabel>
          <DateField placeholder="Enquiry From" value={enquiryFrom} onChange={setEnquiryFrom} />
          <WebLabel>Enquiry To</WebLabel>
          <DateField placeholder="Enquiry To" value={enquiryTo} onChange={setEnquiryTo} />
          <WebButton title="Search" onPress={applyFilters} />
        </View>

        <View style={styles.logHeader}>
          <Text style={styles.logTitle}>Enquiry log</Text>
          <Text style={styles.logCount}>{queries.length} enquiries found</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : queries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>❓</Text>
            <Text style={styles.emptyText}>No enquiries found</Text>
          </View>
        ) : (
          queries.map((query, index) => (
            <View key={query._id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.indexText}>#{index + 1}</Text>
                <Text style={styles.dateText}>{formatEnquiryDate(query.enquiry_date)}</Text>
              </View>
              <View style={styles.titleRow}>
                <Text style={styles.schoolName}>{query.school_name || 'School'}</Text>
                {isNewSchool(query) ? <Text style={styles.newBadge}>New</Text> : null}
              </View>
              <Text style={styles.schoolCode}>{query.school_code || '-'}</Text>
              <Text style={styles.infoLine}>Executive: {query.executive?.name || '-'}</Text>
              <Text style={styles.infoLine}>Zone: {query.zone || '-'}</Text>
              <Text style={styles.infoLine}>Contact: {extractContactName(query)}</Text>
              <Text style={styles.infoLine}>Mobile: {query.contact_mobile || '-'}</Text>
              <Text style={styles.infoLine}>Subject: {query.subject || '-'}</Text>
              <Text style={styles.statusBadge}>{getDisplayStatus(query.status)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 24 },
  kpiRow: { paddingHorizontal: 16, gap: 10, marginTop: 12 },
  kpiCard: {
    width: 150,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
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
    marginTop: 16,
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  indexText: { ...typography.label.medium, color: colors.textSecondary },
  dateText: { ...typography.label.medium, color: colors.textSecondary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  schoolName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  newBadge: {
    ...typography.label.small,
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  schoolCode: { ...typography.label.small, color: colors.textSecondary, marginTop: 2 },
  infoLine: { ...typography.body.medium, color: colors.textSecondary, marginTop: 4 },
  statusBadge: {
    ...typography.label.small,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#d1fae5',
    color: '#047857',
    overflow: 'hidden',
  },
});

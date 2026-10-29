import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { downloadTrainingServiceReport } from '../../utils/downloadTrainingServiceReport';

import DateField from '../../ui/DateField';
type Stats = {
  total: number;
  byStatus: { Scheduled: number; Completed: number; Cancelled: number };
  zoneStats: { _id: string; total: number; completed: number }[];
  subjectStats: { _id: string; total: number; completed: number }[];
};

const emptyByStatus = { Scheduled: 0, Completed: 0, Cancelled: 0 };

function pct(completed: number, total: number) {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function SubjectRow({
  subject,
  accent,
}: {
  subject: { _id: string; total: number; completed: number };
  accent: string;
}) {
  const percent = pct(subject.completed, subject.total);
  return (
    <View style={styles.subjectCard}>
      <View style={styles.subjectTop}>
        <Text style={styles.subjectName}>{subject._id || 'N/A'}</Text>
        <Text style={[styles.subjectTotal, { color: accent }]}>{subject.total}</Text>
      </View>
      <View style={styles.subjectMeta}>
        <Text style={styles.subjectMetaText}>Completed: {subject.completed}</Text>
        <Text style={styles.subjectMetaText}>{percent}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: accent }]} />
      </View>
    </View>
  );
}

function StatusRow({
  label,
  value,
  bg,
  fg,
}: {
  label: string;
  value: number;
  bg: string;
  fg: string;
}) {
  return (
    <View style={[styles.statusRow, { backgroundColor: bg }]}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color: fg }]}>{value}</Text>
    </View>
  );
}

export default function ReportsTrainingServiceScreen() {
  const [trainingStats, setTrainingStats] = useState<Stats | null>(null);
  const [serviceStats, setServiceStats] = useState<Stats | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [zone, setZone] = useState('');

  const loadZones = useCallback(async () => {
    try {
      const data = await apiService.get('/zones').catch(() => []);
      const list = Array.isArray(data) ? data : (data as any)?.data || [];
      const names = list
        .map((z: any) => (typeof z === 'string' ? z : z?.name))
        .filter(Boolean) as string[];
      if (names.length) {
        setZones([...new Set(names)].sort());
        return;
      }
      const orders = await apiService.get('/dc-orders').catch(() => []);
      const orderList = Array.isArray(orders) ? orders : (orders as any)?.data || [];
      const fromOrders = [
        ...new Set(orderList.map((d: any) => d.zone).filter(Boolean)),
      ] as string[];
      setZones(fromOrders.sort());
    } catch {
      setZones([]);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (zone) params.append('zone', zone);
      const qs = params.toString();
      const [training, service] = await Promise.all([
        apiService.get(`/training/stats${qs ? `?${qs}` : ''}`),
        apiService.get(`/services/stats${qs ? `?${qs}` : ''}`),
      ]);
      setTrainingStats(training || null);
      setServiceStats(service || null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load statistics');
      setTrainingStats(null);
      setServiceStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate, zone]);

  useEffect(() => {
    loadZones();
    loadStats();
  }, [loadZones]);

  const onRefresh = () => {
    setRefreshing(true);
    loadZones();
    loadStats();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (zone) params.append('zone', zone);
      await downloadTrainingServiceReport(params.toString());
      Alert.alert('Success', 'Excel file downloaded successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const trainingByStatus = trainingStats?.byStatus || emptyByStatus;
  const serviceByStatus = serviceStats?.byStatus || emptyByStatus;

  return (
    <ScreenShell
      title="Training & Service Reports"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
      headerRight={
        <TouchableOpacity onPress={handleExport} disabled={exporting} style={styles.headerExport}>
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={styles.headerExportText}>{exporting ? '…' : 'Export'}</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WebButton
          title={exporting ? 'Exporting…' : 'Export Report'}
          onPress={handleExport}
          loading={exporting}
        />

        <View style={styles.filterCard}>
          <WebLabel>From Date</WebLabel>
          <DateField placeholder="From Date" value={fromDate} onChange={setFromDate} />
          <WebLabel>To Date</WebLabel>
          <DateField placeholder="To Date" value={toDate} onChange={setToDate} />
          <WebLabel>Zone</WebLabel>
          <WebSelect
            placeholder="All Zones"
            value={zone}
            onValueChange={setZone}
            items={zones.map((z) => ({ label: z, value: z }))}
          />
          <WebButton title="Apply Filters" onPress={loadStats} />
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiText}>
            <Text style={styles.kpiLabel}>Total Trainings</Text>
            <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{trainingStats?.total || 0}</Text>
          </View>
          <Ionicons name="school-outline" size={28} color="#2563EB" />
        </View>
        <View style={styles.kpiCard}>
          <View style={styles.kpiText}>
            <Text style={styles.kpiLabel}>Completed Trainings</Text>
            <Text style={[styles.kpiValue, { color: '#16A34A' }]}>
              {trainingByStatus.Completed || 0}
            </Text>
          </View>
          <Ionicons name="checkmark-circle-outline" size={28} color="#16A34A" />
        </View>
        <View style={styles.kpiCard}>
          <View style={styles.kpiText}>
            <Text style={styles.kpiLabel}>Total Services</Text>
            <Text style={[styles.kpiValue, { color: '#9333EA' }]}>{serviceStats?.total || 0}</Text>
          </View>
          <Ionicons name="checkmark-done-outline" size={28} color="#9333EA" />
        </View>
        <View style={styles.kpiCard}>
          <View style={styles.kpiText}>
            <Text style={styles.kpiLabel}>Completed Services</Text>
            <Text style={[styles.kpiValue, { color: '#16A34A' }]}>
              {serviceByStatus.Completed || 0}
            </Text>
          </View>
          <Ionicons name="checkmark-circle-outline" size={28} color="#16A34A" />
        </View>

        {trainingStats?.zoneStats?.length ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="trending-up-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.sectionTitle}>Zone-wise Training Analysis</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.thZone]}>Zone</Text>
              <Text style={styles.th}>Total</Text>
              <Text style={styles.th}>Done</Text>
              <Text style={styles.th}>%</Text>
            </View>
            {trainingStats.zoneStats.map((z) => (
              <View key={z._id || 'na'} style={styles.tableRow}>
                <Text style={[styles.td, styles.thZone]} numberOfLines={1}>
                  {z._id || 'N/A'}
                </Text>
                <Text style={styles.td}>{z.total}</Text>
                <Text style={[styles.td, { color: '#16A34A', fontWeight: '700' }]}>
                  {z.completed}
                </Text>
                <Text style={styles.td}>{pct(z.completed, z.total)}%</Text>
              </View>
            ))}
          </View>
        ) : null}

        {trainingStats?.subjectStats?.length ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="bar-chart-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.sectionTitle}>Training by Subject</Text>
            </View>
            {trainingStats.subjectStats.map((subj) => (
              <SubjectRow key={subj._id} subject={subj} accent="#2563EB" />
            ))}
          </View>
        ) : null}

        {serviceStats?.subjectStats?.length ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="bar-chart-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.sectionTitle}>Service by Subject</Text>
            </View>
            {serviceStats.subjectStats.map((subj) => (
              <SubjectRow key={subj._id} subject={subj} accent="#9333EA" />
            ))}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Training Status Breakdown</Text>
          <StatusRow
            label="Completed"
            value={trainingByStatus.Completed || 0}
            bg="#ECFDF5"
            fg="#16A34A"
          />
          <StatusRow
            label="Scheduled"
            value={trainingByStatus.Scheduled || 0}
            bg="#FEFCE8"
            fg="#CA8A04"
          />
          <StatusRow
            label="Cancelled"
            value={trainingByStatus.Cancelled || 0}
            bg="#FEF2F2"
            fg="#DC2626"
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Service Status Breakdown</Text>
          <StatusRow
            label="Completed"
            value={serviceByStatus.Completed || 0}
            bg="#ECFDF5"
            fg="#16A34A"
          />
          <StatusRow
            label="Scheduled"
            value={serviceByStatus.Scheduled || 0}
            bg="#FEFCE8"
            fg="#CA8A04"
          />
          <StatusRow
            label="Cancelled"
            value={serviceByStatus.Cancelled || 0}
            bg="#FEF2F2"
            fg="#DC2626"
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32, gap: 12 },
  headerExport: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerExportText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 6,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiText: { flex: 1, paddingRight: 8 },
  kpiLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  kpiValue: { fontSize: 28, fontWeight: '700' },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: {
    ...typography.heading.h3,
    color: colors.textPrimary,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  th: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'right',
  },
  thZone: { flex: 1.4, textAlign: 'left' },
  td: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  subjectCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  subjectTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  subjectTotal: { fontSize: 18, fontWeight: '700' },
  subjectMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  subjectMetaText: { fontSize: 12, color: colors.textSecondary },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 2,
  },
  progressFill: { height: 8, borderRadius: 999 },
  statusRow: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  statusValue: { fontSize: 16, fontWeight: '700' },
});

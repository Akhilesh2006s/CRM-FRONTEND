import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton, WebSelect } from '../../ui/WebPrimitives';
import { StatGrid, rk } from './ReportKit';
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
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: fg }]} />
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
        <PageSection title="Filters">
          <DateField placeholder="From Date" value={fromDate} onChange={setFromDate} />
          <DateField placeholder="To Date" value={toDate} onChange={setToDate} />
          <WebSelect
            label="Zone"
            placeholder="All Zones"
            value={zone}
            onValueChange={setZone}
            items={zones.map((z) => ({ label: z, value: z }))}
          />
          <View style={rk.btnRow}>
            <View style={rk.col}>
              <WebButton title="Apply Filters" onPress={loadStats} />
            </View>
            <View style={rk.col}>
              <WebButton title={exporting ? 'Exporting…' : 'Export Report'} variant="outline" onPress={handleExport} loading={exporting} />
            </View>
          </View>
        </PageSection>

        <StatGrid
          items={[
            { label: 'Total Trainings', value: trainingStats?.total || 0, tone: 'blue' },
            { label: 'Completed Trainings', value: trainingByStatus.Completed || 0, tone: 'green' },
            { label: 'Total Services', value: serviceStats?.total || 0, tone: 'purple' },
            { label: 'Completed Services', value: serviceByStatus.Completed || 0, tone: 'green' },
          ]}
        />

        {trainingStats?.zoneStats?.length ? (
          <PageSection title="Zone-wise Training">
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
          </PageSection>
        ) : null}

        {trainingStats?.subjectStats?.length ? (
          <PageSection title="Training by Subject">
            {trainingStats.subjectStats.map((subj) => (
              <SubjectRow key={subj._id} subject={subj} accent="#2563EB" />
            ))}
          </PageSection>
        ) : null}

        {serviceStats?.subjectStats?.length ? (
          <PageSection title="Service by Subject">
            {serviceStats.subjectStats.map((subj) => (
              <SubjectRow key={subj._id} subject={subj} accent="#9333EA" />
            ))}
          </PageSection>
        ) : null}

        <PageSection title="Training Status">
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
        </PageSection>

        <PageSection title="Service Status">
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
        </PageSection>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  headerExport: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerExportText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  tableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textTertiary, textAlign: 'right' },
  thZone: { flex: 2, textAlign: 'left' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  td: { flex: 1, fontSize: 14, color: colors.textPrimary, textAlign: 'right' },
  subjectCard: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  subjectTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  subjectName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  subjectTotal: { fontSize: 16, fontWeight: '700' },
  subjectMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  subjectMetaText: { fontSize: 13, color: colors.textTertiary },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: colors.backgroundMuted, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 999 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { flex: 1, fontSize: 14, color: colors.textPrimary },
  statusValue: { fontSize: 16, fontWeight: '700' },
});

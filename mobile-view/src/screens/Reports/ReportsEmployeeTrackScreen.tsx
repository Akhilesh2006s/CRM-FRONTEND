import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, SectionTitle, Badge } from '../../ui/Kit';
import { StatGrid, rk, matchesWords } from './ReportKit';
import { apiService } from '../../services/api';
import { exportEmployeeTrackingReport } from '../../utils/exportEmployeeTrackingReport';

import DateField from '../../ui/DateField';
type TrackingData = {
  _id: string;
  employeeId?: string;
  employeeName: string;
  mobileNo: string;
  email?: string;
  zone: string;
  started: string;
  lastUsed: string;
  lastLocation: string;
  logCount: number;
  /** Battery % and GPS On/Off reported by the phone (from /tracking/latest). */
  batteryLevel?: number | null;
  charging?: boolean | null;
  gpsStatus?: 'on' | 'off';
};

type TrackingLatestRow = {
  employeeId: string;
  name?: string;
  mobile?: string;
  zone?: string;
  started?: string;
  lastUsed?: string;
  lastLocation?: { latitude?: number; longitude?: number } | string;
  pings?: number;
  batteryLevel?: number | null;
  charging?: boolean | null;
  gpsStatus?: 'on' | 'off';
};

function formatLocation(loc?: TrackingLatestRow['lastLocation']) {
  if (typeof loc === 'string' && loc.trim()) return loc;
  if (loc && typeof loc === 'object' && loc.latitude != null && loc.longitude != null) {
    return `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
  }
  return '-';
}

function mapLatestRows(rows: TrackingLatestRow[]): TrackingData[] {
  return rows.map((row) => ({
    _id: String(row.employeeId),
    employeeId: String(row.employeeId),
    employeeName: row.name || 'Unknown',
    mobileNo: row.mobile || '',
    zone: row.zone || '',
    started: row.started || '',
    lastUsed: row.lastUsed || '',
    lastLocation: formatLocation(row.lastLocation),
    logCount: Number(row.pings) || 0,
    batteryLevel: row.batteryLevel ?? null,
    charging: row.charging ?? null,
    gpsStatus: row.gpsStatus,
  }));
}

function formatActivityTimestamp(dateStr?: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function matchesDateFilter(value?: string, filterDate?: string) {
  if (!filterDate) return true;
  if (!value) return false;
  const date = new Date(value);
  const target = new Date(filterDate);
  if (Number.isNaN(date.getTime()) || Number.isNaN(target.getTime())) return false;
  return isSameCalendarDay(date, target);
}

function getLiveStatus(lastUsed?: string) {
  if (!lastUsed) return 'Idle';
  const last = new Date(lastUsed);
  if (Number.isNaN(last.getTime())) return 'Idle';
  return isSameCalendarDay(last, new Date()) ? 'Active Today' : 'Idle';
}

export default function ReportsEmployeeTrackScreen() {
  const [allRecords, setAllRecords] = useState<TrackingData[]>([]);
  const [records, setRecords] = useState<TrackingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [zone, setZone] = useState('');
  const [startedDate, setStartedDate] = useState('');
  const [lastUsedDate, setLastUsedDate] = useState('');

  useEffect(() => {
    loadTracking();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allRecords, search, zone, startedDate, lastUsedDate]);

  const zones = useMemo(() => {
    return Array.from(new Set(allRecords.map((r) => r.zone).filter(Boolean))).sort();
  }, [allRecords]);

  const loadTracking = async () => {
    try {
      setLoading(true);
      try {
        const qs = zone ? `?zone=${encodeURIComponent(zone)}` : '';
        const latest = await apiService.get<TrackingLatestRow[]>(`/tracking/latest${qs}`);
        setAllRecords(mapLatestRows(Array.isArray(latest) ? latest : []));
      } catch (_) {
        const data = await apiService.get<TrackingData[]>('/employees/tracking');
        setAllRecords(data || []);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load tracking data');
      setAllRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const viewRoute = async (rec: TrackingData) => {
    const employeeId = rec.employeeId || rec._id;
    const date =
      rec.lastUsed && !Number.isNaN(new Date(rec.lastUsed).getTime())
        ? new Date(rec.lastUsed).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    try {
      const route = await apiService.get<any>(
        `/tracking/${employeeId}/route?date=${encodeURIComponent(date)}`
      );
      Alert.alert(
        'Route summary',
        `${rec.employeeName}\nDate: ${date}\nDistance: ${route?.distanceKm ?? 0} km\nPoints: ${route?.pointCount ?? 0}`
      );
    } catch (error: any) {
      Alert.alert('Route', error?.message || 'Failed to load route');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTracking();
  };

  const applyFilters = () => {
    let filtered = [...allRecords];
    const query = search.trim().toLowerCase();

    if (query) {
      filtered = filtered.filter((rec) =>
        matchesWords(query, [
          rec.employeeName,
          rec.mobileNo,
          rec.email,
          rec.zone,
          rec.lastLocation,
          getLiveStatus(rec.lastUsed),
          formatActivityTimestamp(rec.started),
          formatActivityTimestamp(rec.lastUsed),
        ])
      );
    }

    if (zone) {
      filtered = filtered.filter((rec) => rec.zone?.toLowerCase() === zone.toLowerCase());
    }

    if (startedDate) {
      filtered = filtered.filter((rec) => matchesDateFilter(rec.started, startedDate));
    }

    if (lastUsedDate) {
      filtered = filtered.filter((rec) => matchesDateFilter(rec.lastUsed, lastUsedDate));
    }

    setRecords(filtered);
  };

  const summary = useMemo(() => {
    const totalLogs = records.reduce((sum, rec) => sum + (rec.logCount || 0), 0);
    return {
      fieldExecutives: records.length,
      totalGpsLogs: totalLogs,
      zoneCoverage: new Set(records.map((r) => r.zone).filter(Boolean)).size,
    };
  }, [records]);

  const maxLogCount = useMemo(() => Math.max(1, ...records.map((r) => r.logCount || 0)), [records]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportEmployeeTrackingReport(
        `Employee_Tracking_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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
      title="Employee Tracking Report"
      subtitle="Field executive activity, GPS logs, and last known location"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <StatGrid
        items={[
          { label: 'Field Executives', value: summary.fieldExecutives, tone: 'blue' },
          { label: 'Total GPS Logs', value: summary.totalGpsLogs, tone: 'green' },
          { label: 'Zone Coverage', value: summary.zoneCoverage, tone: 'purple' },
        ]}
      />

      <PageSection title="Filters">
        <WebInput placeholder="Search employee, mobile, zone, location…" value={search} onChangeText={setSearch} />
        <WebSelect
          label="Zone"
          value={zone}
          onValueChange={setZone}
          placeholder="All Zones"
          items={[{ label: 'All Zones', value: '' }, ...zones.map((z) => ({ label: z, value: z }))]}
        />
        <DateField placeholder="Started" value={startedDate} onChange={setStartedDate} />
        <DateField placeholder="Last Used" value={lastUsedDate} onChange={setLastUsedDate} />
        <View style={rk.btnRow}>
          <View style={rk.col}>
            <WebButton title="Search" onPress={applyFilters} />
          </View>
          <View style={rk.col}>
            <WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={handleExport} loading={exporting} />
          </View>
        </View>
      </PageSection>

      <SectionTitle>{`Tracking log (${records.length})`}</SectionTitle>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : records.length === 0 ? (
        <EmptyState icon="🛰️" title="No tracking data found" />
      ) : (
        records.map((rec, index) => {
          const liveStatus = getLiveStatus(rec.lastUsed);
          const logPct = Math.round(((rec.logCount || 0) / maxLogCount) * 100);
          return (
            <Card key={rec._id}>
              <CardTitle
                title={`${index + 1}. ${rec.employeeName}`}
                subtitle={rec.mobileNo || rec.email || undefined}
                badge={liveStatus}
                tone={liveStatus === 'Active Today' ? 'success' : 'neutral'}
              />
              <InfoRow label="Zone" value={rec.zone} />
              <InfoRow label="First check-in" value={formatActivityTimestamp(rec.started)} />
              <InfoRow label="Last active" value={formatActivityTimestamp(rec.lastUsed)} />
              <InfoRow label="Last location" value={rec.lastLocation || 'N/A'} />
              {rec.gpsStatus ? (
                <InfoRow
                  label="Battery"
                  value={rec.batteryLevel == null ? 'Not reported yet' : `${rec.batteryLevel}%${rec.charging ? ' (charging)' : ''}`}
                />
              ) : null}
              {rec.gpsStatus ? (
                <InfoRow
                  label="GPS"
                  value={<Badge label={rec.gpsStatus === 'on' ? 'On' : 'Off'} tone={rec.gpsStatus === 'on' ? 'success' : 'error'} />}
                />
              ) : null}
              <InfoRow
                label="GPS logs"
                value={
                  <View style={styles.logRow}>
                    <Text style={styles.logCount}>{rec.logCount || 0}</Text>
                    <View style={styles.logBarTrack}>
                      <View style={[styles.logBarFill, { width: `${logPct}%` }]} />
                    </View>
                  </View>
                }
              />
              <ActionRow>
                <WebButton title="View route" variant="outline" onPress={() => viewRoute(rec)} />
              </ActionRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logCount: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, minWidth: 28 },
  logBarTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: colors.backgroundMuted, overflow: 'hidden' },
  logBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
});

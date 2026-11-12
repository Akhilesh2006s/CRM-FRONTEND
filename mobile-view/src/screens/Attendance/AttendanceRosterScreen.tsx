import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, ActivityIndicator } from 'react-native';
import { attendanceBadge, attendanceTone } from '../../utils/attendanceStatus';
import { colors } from '../../theme/colors';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { WebLabel } from '../../ui/WebPrimitives';
import ScreenShell from '../../ui/ScreenShell';
import MessageBanner from '../../components/MessageBanner';
import { attendanceReasonLabel } from '../../components/AttendanceCard';
import { apiService } from '../../services/api';
import DateField from '../../ui/DateField';

/** Today's date in India as yyyy-mm-dd. */
function todayIST() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

/** yyyy-mm-dd (India day) to the UTC instants the API filters on. */
function dayRange(day: string) {
  const start = new Date(`${day}T00:00:00+05:30`);
  return { from: start.toISOString(), to: new Date(start.getTime() + 86400000 - 1).toISOString() };
}

type RosterRow = {
  _id: string;
  startTime?: string;
  endTime?: string;
  reviewStatus?: string;
  attendanceReason?: string;
  town?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  source?: 'login_selfie' | 'manual';
  employeeId?: { name?: string; empCode?: string; role?: string; zone?: string } | string;
};

const ROLE_LABELS: Record<string, string> = {
  'Executive Manager': 'Zonal Manager',
  Manager: 'Product Manager',
  Executive: 'BDE',
  'Sales BDE': 'BDE',
  Employee: 'BDE',
};

function formatEmployeeCode(value?: string | null, fallback = '—') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const withoutPrefix = raw.replace(/^VESPL/i, '');
  return `VESPL${/^\d+$/.test(withoutPrefix) ? withoutPrefix.padStart(4, '0') : withoutPrefix}`;
}

function when(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Team attendance roster — web app/dashboard/employees/attendance/page.tsx (GET /attendance/roster). */
export default function AttendanceRosterScreen() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  /** Day shown; any past day can be picked (same as web Team Attendance). */
  const [day, setDay] = useState(todayIST());
  /** Selfies opened on this screen: photo data URL, 'loading' or 'none'. */
  const [selfies, setSelfies] = useState<Record<string, string>>({});

  const toggleSelfie = async (id: string) => {
    if (selfies[id]) {
      setSelfies(({ [id]: _, ...rest }) => rest);
      return;
    }
    setSelfies((s) => ({ ...s, [id]: 'loading' }));
    try {
      const res = await apiService.get(`/attendance/${id}/photo`);
      setSelfies((s) => ({ ...s, [id]: res?.photo || 'none' }));
    } catch {
      setSelfies((s) => ({ ...s, [id]: 'none' }));
    }
  };

  const load = useCallback(async () => {
    try {
      const query = day ? `?fromDate=${encodeURIComponent(dayRange(day).from)}&toDate=${day}` : '';
      const data = await apiService.get(`/attendance/roster${query}`);
      const list: RosterRow[] = Array.isArray(data) ? data : [];
      const { from, to } = day ? dayRange(day) : { from: '', to: '' };
      setRows(day ? list.filter((r) => r.startTime && r.startTime >= from && r.startTime <= to) : list);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [day]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <ScreenShell
      title="Team Attendance"
      subtitle="Who started and ended their day."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Card>
        <WebLabel>Day</WebLabel>
        <DateField value={day} onChange={(v) => setDay(v || todayIST())} maximumDate={new Date()} />
      </Card>
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      {!error && rows.length === 0 ? <EmptyState icon="🕒" title="No attendance" message="No records for this day." /> : null}
      {rows.map((row) => {
        const employee = typeof row.employeeId === 'object' && row.employeeId ? row.employeeId : null;
        const location = [row.town, row.pincode].filter(Boolean).join(' - ') || '—';
        const hasCoords = typeof row.latitude === 'number' && typeof row.longitude === 'number';
        return (
          <Card key={row._id}>
            <CardTitle
              title={employee?.name || '—'}
              subtitle={[
                formatEmployeeCode(employee?.empCode),
                employee?.role ? ROLE_LABELS[employee.role] || employee.role : '',
                employee?.zone || '',
              ]
                .filter(Boolean)
                .join(' · ')}
              badge={attendanceBadge(row, 'Checked out', 'Checked in')}
              tone={attendanceTone(row)}
            />
            <InfoRow label="Start" value={when(row.startTime)} />
            <InfoRow label="End" value={when(row.endTime)} />
            <InfoRow label="Location" value={location} />
            <InfoRow label="Reason" value={attendanceReasonLabel(row.attendanceReason)} />
            {selfies[row._id] === 'loading' ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
            {selfies[row._id] === 'none' ? <Text style={styles.meta}>No photo saved for this check-in.</Text> : null}
            {selfies[row._id] && !['loading', 'none'].includes(selfies[row._id]) ? (
              <Image source={{ uri: selfies[row._id] }} style={styles.selfie} resizeMode="contain" />
            ) : null}
            <ActionRow>
              <TouchableOpacity style={styles.action} onPress={() => toggleSelfie(row._id)}>
                <Text style={styles.link}>
                  {selfies[row._id] ? 'Hide selfie' : 'View selfie'}
                  {row.source === 'login_selfie' ? ' (app selfie)' : ''}
                </Text>
              </TouchableOpacity>
              {hasCoords ? (
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => Linking.openURL(`https://www.google.com/maps?q=${row.latitude},${row.longitude}`).catch(() => {})}
                >
                  <Text style={styles.link}>Map</Text>
                </TouchableOpacity>
              ) : null}
            </ActionRow>
          </Card>
        );
      })}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, color: colors.textTertiary, marginTop: 8 },
  selfie: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: colors.border, marginTop: 8 },
  action: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundLight,
  },
  link: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
});

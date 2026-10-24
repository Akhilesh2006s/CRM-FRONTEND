import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, ActivityIndicator } from 'react-native';
import { colors, radii } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import MessageBanner from '../../components/MessageBanner';
import { attendanceReasonLabel } from '../../components/AttendanceCard';
import { apiService } from '../../services/api';

type RosterRow = {
  _id: string;
  startTime?: string;
  endTime?: string;
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
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Team attendance roster — web app/dashboard/employees/attendance/page.tsx (GET /attendance/roster). */
export default function AttendanceRosterScreen() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
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
      const data = await apiService.get('/attendance/roster');
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenShell
      title="Team Attendance"
      subtitle="HR, Admin and Coordinators see every employee. A head sees the people under them."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      {!error && rows.length === 0 ? <Text style={styles.empty}>No attendance records.</Text> : null}
      {rows.map((row) => {
        const employee = typeof row.employeeId === 'object' && row.employeeId ? row.employeeId : null;
        const location = [row.town, row.pincode].filter(Boolean).join(' - ') || '—';
        const hasCoords = typeof row.latitude === 'number' && typeof row.longitude === 'number';
        return (
          <View key={row._id} style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{employee?.name || '—'}</Text>
                <Text style={styles.meta}>
                  {formatEmployeeCode(employee?.empCode)}
                  {employee?.role ? ` · ${ROLE_LABELS[employee.role] || employee.role}` : ''}
                  {employee?.zone ? ` · ${employee.zone}` : ''}
                </Text>
              </View>
              <Text style={row.endTime ? styles.statusOut : styles.statusIn}>{row.endTime ? 'Checked out' : 'Checked in'}</Text>
            </View>
            <Text style={styles.meta}>
              In: {when(row.startTime)} · Out: {when(row.endTime)}
            </Text>
            <View style={styles.rowBetween}>
              <Text style={styles.meta}>
                {location} · {attendanceReasonLabel(row.attendanceReason)}
              </Text>
              {hasCoords ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://www.google.com/maps?q=${row.latitude},${row.longitude}`).catch(() => {})}
                >
                  <Text style={styles.link}>Map</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => toggleSelfie(row._id)}>
              <Text style={styles.link}>
                {selfies[row._id] ? 'Hide selfie' : 'View selfie'}
                {row.source === 'login_selfie' ? ' (app selfie)' : ''}
              </Text>
            </TouchableOpacity>
            {selfies[row._id] === 'loading' ? <ActivityIndicator /> : null}
            {selfies[row._id] === 'none' ? <Text style={styles.meta}>No photo saved for this check-in.</Text> : null}
            {selfies[row._id] && !['loading', 'none'].includes(selfies[row._id]) ? (
              <Image source={{ uri: selfies[row._id] }} style={styles.selfie} resizeMode="contain" />
            ) : null}
          </View>
        );
      })}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  statusIn: { fontSize: 12, fontWeight: '600', color: colors.success },
  statusOut: { fontSize: 12, color: colors.textSecondary },
  selfie: { width: '100%', aspectRatio: 3 / 4, borderRadius: radii.md, backgroundColor: colors.border },
  link: { fontSize: 12, color: colors.primary, textDecorationLine: 'underline' },
});

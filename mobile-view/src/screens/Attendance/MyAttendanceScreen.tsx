import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radii } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import MessageBanner from '../../components/MessageBanner';
import AttendanceCard, { attendanceReasonLabel } from '../../components/AttendanceCard';
import { apiService } from '../../services/api';

type AttendanceRow = {
  _id: string;
  startTime?: string;
  endTime?: string;
  attendanceReason?: string;
  town?: string;
};

function when(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Own check-in / check-out plus history — web app/dashboard/attendance/page.tsx */
export default function MyAttendanceScreen() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const history = await apiService.get('/attendance/history');
      setRows(Array.isArray(history) ? history : []);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenShell
      title="Attendance"
      subtitle="Check in when you start work and check out when you finish."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <AttendanceCard onChange={load} />
      <Text style={styles.sectionTitle}>History</Text>
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      {rows.length === 0 && !error ? (
        <Text style={styles.empty}>No attendance records yet.</Text>
      ) : (
        rows.map((row) => (
          <View key={row._id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.primary}>In: {when(row.startTime)}</Text>
              <Text style={styles.secondary}>Out: {when(row.endTime)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.primary}>{attendanceReasonLabel(row.attendanceReason)}</Text>
              <Text style={styles.secondary}>{row.town || '—'}</Text>
            </View>
          </View>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginTop: 8, marginBottom: 8 },
  empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
  },
  primary: { fontSize: 14, color: colors.textPrimary },
  secondary: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});

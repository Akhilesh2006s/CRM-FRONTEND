import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import MessageBanner from '../../components/MessageBanner';
import AttendanceCard, { attendanceReasonLabel } from '../../components/AttendanceCard';
import { apiService } from '../../services/api';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle } from '../../ui/Kit';

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
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
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
      subtitle="Start your day and end it when you finish."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <AttendanceCard onChange={load} />
      <SectionTitle>History</SectionTitle>
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      {rows.length === 0 && !error ? (
        <EmptyState icon="🕒" title="No attendance yet" message="Your days will show here." />
      ) : (
        rows.map((row) => (
          <Card key={row._id} style={styles.card}>
            <CardTitle
              title={attendanceReasonLabel(row.attendanceReason)}
              subtitle={row.town || undefined}
              badge={row.endTime ? 'Ended' : 'Open'}
              tone={row.endTime ? 'neutral' : 'success'}
            />
            <InfoRow label="Start" value={when(row.startTime)} />
            <InfoRow label="End" value={when(row.endTime)} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
});

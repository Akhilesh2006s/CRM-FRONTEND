import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { startDayTracking, syncDayTracking } from '../services/tracking';
import DailySelfieCheckInScreen from '../screens/Attendance/DailySelfieCheckInScreen';
import MissedExitCard from './MissedExitCard';
import LogoutButton from './LogoutButton';

/** Logins that are not employees do not mark attendance. */
const NO_CHECK_IN_ROLES = new Set(['Super Admin', 'Vendor', 'Partner', 'Franchise']);

type Missed = {
  visits: { _id: string; schoolName: string; entryAt: string }[];
  attendances: { _id: string; startTime: string }[];
  count: number;
};

/**
 * Holds the app on Start Day (selfie) until today's attendance exists. Checked again when the
 * app comes back to the foreground, so a new day asks for a new Start Day. A school check-out
 * or End Day forgotten on an earlier day must first be filled in with a reason and exit time.
 */
export default function CheckInGate({ children }: { children: React.ReactNode }) {
  const { user, checkAuth } = useAuth();
  const exempt = !user || NO_CHECK_IN_ROLES.has(String(user.role || ''));
  const [state, setState] = useState<'checking' | 'missed' | 'needed' | 'done'>(exempt ? 'done' : 'checking');
  const [missed, setMissed] = useState<Missed | null>(null);

  const check = useCallback(async () => {
    if (exempt) return setState('done');
    try {
      const pending: Missed = await apiService.get('/field-day/missed').catch(() => null);
      if (pending?.count) {
        setMissed(pending);
        return setState('missed');
      }
      const res = await apiService.get('/attendance/today');
      void syncDayTracking(res?.attendance);
      setState(res?.checkedIn ? 'done' : 'needed');
    } catch {
      // Never lock the app out when the server can't answer.
      setState((s) => (s === 'checking' ? 'done' : s));
    }
  }, [exempt]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void check();
    }, 10 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [check]);

  const report = async (path: string, reason: string, exitTime: string) => {
    try {
      await apiService.post(path, { reason, exitTime });
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e?.message || 'Could not save.');
    }
    await check();
  };

  if (state === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }
  if (state === 'missed' && missed) {
    // School check-outs first: the day can only be ended once every school is closed.
    const visit = missed.visits[0];
    const day = missed.attendances[0];
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{visit ? 'Missed school check-out' : 'Missed End Day'}</Text>
            <Text style={styles.subtitle}>
              Enter the reason and the actual exit time. This is recorded in your history for verification.
            </Text>
          </View>
          <LogoutButton />
        </View>
        {visit ? (
          <MissedExitCard
            key={visit._id}
            title={visit.schoolName}
            startAt={visit.entryAt}
            onSubmit={(reason, exitTime) => report(`/field-day/missed/visit/${visit._id}`, reason, exitTime)}
          />
        ) : day ? (
          <MissedExitCard
            key={day._id}
            title="End Day was not selected"
            startAt={day.startTime}
            onSubmit={(reason, exitTime) => report(`/field-day/missed/day/${day._id}`, reason, exitTime)}
          />
        ) : null}
        {missed.count > 1 ? <Text style={styles.more}>{missed.count - 1} more after this one.</Text> : null}
      </ScrollView>
    );
  }
  if (state === 'needed') {
    return (
      <DailySelfieCheckInScreen
        onDone={() => {
          void startDayTracking();
          // The server marks first-time setup done at check-in; refresh so nothing asks again.
          void checkAuth().catch(() => undefined);
          setState('done');
        }}
      />
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#171717' },
  subtitle: { fontSize: 14, color: '#525252', marginTop: 4 },
  more: { color: '#6B7280', textAlign: 'center' },
});

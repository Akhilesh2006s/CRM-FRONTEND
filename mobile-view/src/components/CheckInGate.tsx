import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import DailySelfieCheckInScreen from '../screens/Attendance/DailySelfieCheckInScreen';

/** Logins that are not employees do not mark attendance. */
const NO_CHECK_IN_ROLES = new Set(['Super Admin', 'Vendor', 'Partner', 'Franchise']);

/**
 * Holds the app on the selfie check-in until today's attendance exists. Checked again
 * when the app comes back to the foreground, so a new day asks for a new selfie.
 */
export default function CheckInGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const exempt = !user || NO_CHECK_IN_ROLES.has(String(user.role || ''));
  const [state, setState] = useState<'checking' | 'needed' | 'done'>(exempt ? 'done' : 'checking');

  const check = useCallback(async () => {
    if (exempt) return setState('done');
    try {
      const res = await apiService.get('/attendance/today');
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
    return () => sub.remove();
  }, [check]);

  if (state === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }
  if (state === 'needed') return <DailySelfieCheckInScreen onDone={() => setState('done')} />;
  return <>{children}</>;
}

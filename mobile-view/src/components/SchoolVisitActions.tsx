import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../services/api';
import { getCurrentLocation } from '../services/location';
import SchoolVisitForm from './SchoolVisitForm';

type OpenVisit = { _id: string; schoolName: string; schoolCode?: string; leadId?: string | null };
export type FieldDayState = { checkedIn: boolean; fieldWorkAllowed: boolean; openVisit: OpenVisit | null } | null;
export type VisitSchool = { schoolName: string; schoolCode?: string; leadId?: string };

const apiError = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;
const norm = (v?: string | null) => String(v || '').trim().toLowerCase();

/** Today's field day (Start Day, open school visit), loaded once per screen and on focus. */
export function useFieldDay() {
  const [day, setDay] = useState<FieldDayState>(null);
  const reload = useCallback(async () => {
    try {
      const data = await apiService.get('/field-day/today');
      setDay(data || null);
    } catch {
      setDay(null);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );
  return { day, reload };
}

export const sameSchool = (v: OpenVisit, s: VisitSchool) =>
  (s.leadId && v.leadId && String(v.leadId) === String(s.leadId)) ||
  (norm(s.schoolCode) && norm(v.schoolCode) === norm(s.schoolCode)) ||
  (!norm(s.schoolCode) && norm(v.schoolName) === norm(s.schoolName));

/**
 * School visit Check In right on a school card. There is no separate Check Out: once checked in,
 * the visit form's Submit & Check Out ends the visit (shown here unless the parent shows the form).
 */
export default function SchoolVisitActions({
  school,
  day,
  reload,
  formShown,
}: {
  school: VisitSchool;
  day: FieldDayState;
  reload: () => Promise<void>;
  /** The parent already shows the visit form for this school. */
  formShown?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  if (!day) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e: any) {
      Alert.alert('Could not continue', apiError(e, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const checkIn = () =>
    run(async () => {
      const here = await getCurrentLocation();
      await apiService.post('/field-day/visits/entry', {
        schoolName: school.schoolName,
        schoolCode: school.schoolCode,
        leadId: school.leadId,
        latitude: here.latitude,
        longitude: here.longitude,
        accuracy: here.accuracy,
      });
      Alert.alert('Checked in', `You are checked in at ${school.schoolName}.`);
    });

  const visit = day.openVisit;
  let body: React.ReactNode;
  if (!day.checkedIn) {
    body = <Text style={styles.note}>Start Day first to check in at this school.</Text>;
  } else if (!day.fieldWorkAllowed) {
    body = <Text style={styles.note}>School check-in needs field work approval for today.</Text>;
  } else if (visit && sameSchool(visit, school)) {
    body = formShown ? (
      <Text style={styles.note}>Checked in. Fill the visit form and tap Submit & Check Out.</Text>
    ) : (
      <SchoolVisitForm visitId={visit._id} schoolName={visit.schoolName} history={[]} onDone={reload} />
    );
  } else if (visit) {
    body = <Text style={styles.note}>Checked in at {visit.schoolName}. Check out there first.</Text>;
  } else {
    body = (
      <TouchableOpacity style={[styles.btn, styles.in]} onPress={checkIn} disabled={busy} activeOpacity={0.8}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Check In</Text>}
      </TouchableOpacity>
    );
  }
  return <View style={styles.wrap}>{body}</View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  in: { backgroundColor: '#16A34A' },
  out: { backgroundColor: '#DC2626' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: { color: '#64748B', fontSize: 13 },
});

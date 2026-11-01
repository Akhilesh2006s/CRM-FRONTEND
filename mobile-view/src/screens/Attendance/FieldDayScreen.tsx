import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput, WebLabel } from '../../ui/WebPrimitives';
import { colors, radii } from '../../theme/colors';
import { apiService } from '../../services/api';
import { getCurrentLocation } from '../../services/location';
import { takeLivePhoto } from '../../services/photo';
import { endTrip, resumeActiveTrip, startTrip, subscribeTrip, type TripVehicle } from '../../services/trip';

type TimelineEntry = {
  kind: 'trip' | 'school';
  id: string;
  sequence?: number;
  schoolName?: string;
  at: string;
  endAt?: string | null;
  minutes: number;
  distanceKm?: number;
  active: boolean;
};
type FieldDay = {
  attendance: { _id: string; mode?: 'office' | 'field'; officeName?: string; startTime: string; endTime?: string; fieldPermission?: boolean; reviewStatus?: string } | null;
  checkedIn: boolean;
  fieldWorkAllowed: boolean;
  activeTrip: { _id: string; sequence?: number; startedAt: string; distanceKm: number } | null;
  openVisit: { _id: string; schoolName: string; entryAt: string } | null;
  permission: { _id: string; status: 'pending' | 'approved' | 'rejected'; reason: string; remarks?: string } | null;
  next: { startTrip: string | null; schoolEntry: string | null; checkout: string | null };
  summary: {
    distanceKm: number;
    tripCount: number;
    schoolCount: number;
    schoolMinutes: number;
    travelMinutes: number;
    workingMinutes: number;
    timeline: TimelineEntry[];
  };
};

const VEHICLES: TripVehicle[] = ['Bike', 'Car'];

const time = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const hours = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes || 0));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

/**
 * My Field Day: Start trip → reach the school → Entry photo → Exit photo → Start the next trip ...
 * Office check-ins request field visit permission first. Distance, time at each school and working
 * hours are worked out on the server.
 */
export default function FieldDayScreen() {
  const [day, setDay] = useState<FieldDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [vehicle, setVehicle] = useState<TripVehicle>('Bike');
  const [schoolName, setSchoolName] = useState('');
  const [reason, setReason] = useState('');
  const [places, setPlaces] = useState('');
  const [liveKm, setLiveKm] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/field-day/today');
      setDay(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load your field day');
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

  useEffect(() => {
    const unsub = subscribeTrip((_t, km) => setLiveKm(km));
    void resumeActiveTrip();
    return unsub;
  }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      await load();
    } catch (e: any) {
      Alert.alert('Could not continue', e?.message || 'Something went wrong');
    } finally {
      setBusy('');
    }
  };

  const onStartTrip = () =>
    run('trip', async () => {
      await startTrip(vehicle, 'Field visit', day?.summary.schoolCount ? 'Last school' : 'Start of day');
    });

  const onEndTrip = () =>
    run('trip', async () => {
      await endTrip('');
    });

  const onSchoolEntry = () =>
    run('entry', async () => {
      const name = schoolName.trim();
      if (!name) throw new Error('Enter the school name first.');
      const photo = await takeLivePhoto();
      if (!photo) return;
      const here = await getCurrentLocation();
      await apiService.post('/field-day/visits/entry', {
        schoolName: name,
        photo,
        latitude: here.latitude,
        longitude: here.longitude,
        accuracy: here.accuracy,
      });
      setSchoolName('');
    });

  const onSchoolExit = () =>
    run('exit', async () => {
      if (!day?.openVisit) return;
      const photo = await takeLivePhoto();
      if (!photo) return;
      const here = await getCurrentLocation();
      await apiService.post(`/field-day/visits/${day.openVisit._id}/exit`, {
        photo,
        latitude: here.latitude,
        longitude: here.longitude,
        accuracy: here.accuracy,
      });
    });

  const onRequestPermission = () =>
    run('permission', async () => {
      if (!reason.trim()) throw new Error('Enter why you need to go to the field.');
      await apiService.post('/field-day/permission', { reason: reason.trim(), places: places.trim() });
      setReason('');
      setPlaces('');
      Alert.alert('Request sent', 'Your field visit request has gone to your reporting manager for approval.');
    });

  const attendance = day?.attendance;
  const summary = day?.summary;

  return (
    <ScreenShell
      title="My Field Day"
      subtitle="Start a trip, take Entry and Exit photos at each school, and repeat until you check out."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {!day?.checkedIn ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Not checked in</Text>
          <Text style={styles.muted}>
            {attendance?.endTime ? `You checked out at ${time(attendance.endTime)}.` : 'Check in for the day first (Attendance).'}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{attendance?.mode === 'office' ? `Office day · ${attendance?.officeName || 'Office'}` : 'Field day'}</Text>
            <Text style={styles.badge}>In {time(attendance?.startTime)}</Text>
          </View>
          <Text style={styles.muted}>
            {attendance?.mode === 'office'
              ? attendance?.fieldPermission
                ? 'Field visit approved: you can travel to schools today and check out in the field.'
                : 'Checked in within the office. Check out in the office, or request a field visit below.'
              : 'Checked in outside the office. Check out in the field.'}
          </Text>
        </View>
      )}

      {summary ? (
        <View style={styles.statsRow}>
          <Stat label="Distance" value={`${(summary.distanceKm + (day?.activeTrip ? Math.max(0, liveKm - (day.activeTrip.distanceKm || 0)) : 0)).toFixed(2)} km`} />
          <Stat label="Schools" value={String(summary.schoolCount)} />
          <Stat label="At schools" value={hours(summary.schoolMinutes)} />
          <Stat label="Working" value={hours(summary.workingMinutes)} />
        </View>
      ) : null}

      {day?.checkedIn && attendance?.mode === 'office' && !attendance?.fieldPermission ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Field visit permission</Text>
          {day.permission?.status === 'pending' ? (
            <Text style={styles.muted}>Waiting for approval: {day.permission.reason}</Text>
          ) : (
            <>
              {day.permission?.status === 'rejected' ? (
                <Text style={styles.error}>Rejected{day.permission.remarks ? `: ${day.permission.remarks}` : ''}. You can ask again.</Text>
              ) : null}
              <WebLabel>Reason *</WebLabel>
              <WebInput placeholder="Why do you need to go to the field?" value={reason} onChangeText={setReason} />
              <WebLabel>Schools / places</WebLabel>
              <WebInput placeholder="Where you will go" value={places} onChangeText={setPlaces} />
              <WebButton title="Request Field Visit Permission" onPress={onRequestPermission} loading={busy === 'permission'} />
            </>
          )}
        </View>
      ) : null}

      {day?.checkedIn && day.fieldWorkAllowed ? (
        <View style={styles.card}>
          {day.openVisit ? (
            <>
              <Text style={styles.cardTitle}>At {day.openVisit.schoolName}</Text>
              <Text style={styles.muted}>Entered at {time(day.openVisit.entryAt)}. Take the exit photo when you leave.</Text>
              <WebButton title="Take Exit Photo" onPress={onSchoolExit} loading={busy === 'exit'} />
            </>
          ) : day.activeTrip ? (
            <>
              <Text style={styles.cardTitle}>Trip {day.activeTrip.sequence || ''} running</Text>
              <Text style={styles.muted}>
                Started {time(day.activeTrip.startedAt)} · {liveKm.toFixed(2)} km. End the trip when you reach the school.
              </Text>
              <WebButton title="End Trip" variant="destructive" onPress={onEndTrip} loading={busy === 'trip'} />
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Next step</Text>
              <Text style={styles.muted}>Start a trip before travelling, or take the entry photo if you are already at a school.</Text>
              <View style={styles.chips}>
                {VEHICLES.map((v) => (
                  <TouchableOpacity key={v} style={[styles.chip, vehicle === v && styles.chipOn]} onPress={() => setVehicle(v)}>
                    <Text style={[styles.chipText, vehicle === v && styles.chipTextOn]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <WebButton title="Start Trip" onPress={onStartTrip} loading={busy === 'trip'} />
              <View style={styles.divider} />
              <WebLabel>School name *</WebLabel>
              <WebInput placeholder="School you have reached" value={schoolName} onChangeText={setSchoolName} />
              <WebButton title="Take Entry Photo" variant="outline" onPress={onSchoolEntry} loading={busy === 'entry'} />
            </>
          )}
        </View>
      ) : null}

      {summary?.timeline?.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today</Text>
          {summary.timeline.map((e) => (
            <View key={`${e.kind}-${e.id}`} style={styles.timelineRow}>
              <Text style={styles.timelineIcon}>{e.kind === 'trip' ? '🛵' : '🏫'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineTitle}>
                  {e.kind === 'trip' ? `Trip ${e.sequence || ''}` : e.schoolName}
                  {e.active ? ' (in progress)' : ''}
                </Text>
                <Text style={styles.muted}>
                  {time(e.at)} – {e.endAt ? time(e.endAt) : 'now'} · {hours(e.minutes)}
                  {e.kind === 'trip' ? ` · ${(e.distanceKm || 0).toFixed(2)} km` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {day?.checkedIn && day.next.checkout ? (
        <Text style={styles.hint}>Before checking out: {day.next.checkout}</Text>
      ) : null}
    </ScreenShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  muted: { fontSize: 13, color: colors.textSecondary },
  error: { fontSize: 13, color: colors.error },
  hint: { fontSize: 13, color: colors.warning, marginBottom: 12 },
  badge: { fontSize: 12, fontWeight: '600', color: colors.success },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  stat: {
    flexGrow: 1,
    minWidth: '22%',
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  timelineIcon: { fontSize: 18 },
  timelineTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});

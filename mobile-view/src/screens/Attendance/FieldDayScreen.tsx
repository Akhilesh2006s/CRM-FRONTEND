import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { WebButton, WebInput, WebLabel } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import MissedExitCard from '../../components/MissedExitCard';
import SchoolVisitForm from '../../components/SchoolVisitForm';
import DayRouteCard from '../../components/DayRouteCard';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import { getCurrentLocation } from '../../services/location';
import { takeLivePhoto } from '../../services/photo';

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
type Activity = { subject?: string; term?: string; level?: string; participants?: number; remarks?: string };
type OpenVisit = {
  _id: string;
  schoolName: string;
  schoolCode?: string;
  leadId?: string | null;
  entryAt: string;
  activityType?: 'Training' | 'Service' | '';
  activity?: Activity;
  trainingId?: string | null;
  serviceId?: string | null;
  feedbackFormName?: string;
  hasFeedbackForm?: boolean;
};
type School = { schoolName: string; schoolCode: string; leadId?: string; town?: string; zone?: string; source: string };
type Assignment = { _id: string; subject: string; term?: string; trainingLevel?: string; trainingDate?: string; serviceDate?: string };
type FieldDay = {
  attendance: { _id: string; mode?: 'office' | 'field'; officeName?: string; startTime: string; endTime?: string; fieldPermission?: boolean; modeChangedFrom?: string; modeChangedAt?: string; reviewStatus?: string } | null;
  checkedIn: boolean;
  fieldWorkAllowed: boolean;
  activeTrip: { _id: string; sequence?: number; startedAt: string; distanceKm: number } | null;
  openVisit: OpenVisit | null;
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

const SUBJECTS = ['Abacus', 'Vedic Maths', 'EEL', 'IIT', 'Financial literacy', 'Brain bytes', 'Spelling bee', 'Skill pro', 'Maths lab', 'Codechamp'];
const TERMS = ['Term 1', 'Term 2', 'Term 3'];
const MAX_FORM_BYTES = 5 * 1024 * 1024;

const time = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const hours = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes || 0));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
const apiError = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

/**
 * My Field Day: Start Day → check in at a school → update the school's work → check out → next school
 * ... → End Day. GPS runs all day, so distance comes from the tracked route. Trainers record the
 * Training / Service and upload the feedback form before checking out of each school.
 */
export default function FieldDayScreen() {
  const { user } = useAuth();
  const isTrainer = user?.role === 'Trainer';
  const [day, setDay] = useState<FieldDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState('');
  const [places, setPlaces] = useState('');
  const [query, setQuery] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [searching, setSearching] = useState(false);
  const [school, setSchool] = useState<School | null>(null);
  const [forgot, setForgot] = useState(false);

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

  // School code / name search (trainers also see their scheduled schools with an empty search).
  useEffect(() => {
    if (school) return undefined;
    const q = query.trim();
    if (!isTrainer && q.length < 2) {
      setSchools([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await apiService.get(`/field-day/schools?q=${encodeURIComponent(q)}`);
        setSchools(Array.isArray(rows) ? rows : []);
      } catch {
        setSchools([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, school, isTrainer]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      await load();
    } catch (e: any) {
      Alert.alert('Could not continue', apiError(e, 'Something went wrong'));
    } finally {
      setBusy('');
    }
  };

  const onCheckIn = () =>
    run('entry', async () => {
      if (!school) throw new Error('Select the school first.');
      const here = await getCurrentLocation();
      await apiService.post('/field-day/visits/entry', {
        schoolName: school.schoolName,
        schoolCode: school.schoolCode,
        leadId: school.leadId,
        latitude: here.latitude,
        longitude: here.longitude,
        accuracy: here.accuracy,
      });
      setSchool(null);
      setQuery('');
    });

  const onCheckOut = () =>
    run('exit', async () => {
      if (!day?.openVisit) return;
      const here = await getCurrentLocation();
      await apiService.post(`/field-day/visits/${day.openVisit._id}/exit`, {
        latitude: here.latitude,
        longitude: here.longitude,
        accuracy: here.accuracy,
      });
    });

  const onForgotCheckOut = async (missedReason: string, exitTime: string) => {
    if (!day?.openVisit) return;
    try {
      await apiService.post(`/field-day/missed/visit/${day.openVisit._id}`, { reason: missedReason, exitTime });
    } catch (e: any) {
      throw new Error(apiError(e, 'Could not save.'));
    }
    setForgot(false);
    await load();
  };

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
  const visit = day?.openVisit;

  return (
    <ScreenShell
      title="My Field Day"
      subtitle="Check in at each school, update work, check out."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {!day?.checkedIn ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Day not started</Text>
          <Text style={styles.muted}>
            {attendance?.endTime ? `You ended your day at ${time(attendance.endTime)}.` : 'Tap Start Day on the home screen first.'}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{attendance?.mode === 'office' ? `Office day · ${attendance?.officeName || 'Office'}` : 'Field day'}</Text>
            <Text style={styles.badge}>Started {time(attendance?.startTime)}</Text>
          </View>
          <Text style={styles.muted}>
            {attendance?.mode === 'office'
              ? attendance?.fieldPermission
                ? 'Field visit approved: you can visit schools today and end the day in the field.'
                : 'Day started in the office. End the day in the office, or ask to change your attendance to Field below.'
              : attendance?.modeChangedFrom === 'office'
                ? `Changed from Office to Field at ${time(attendance?.modeChangedAt)} (approved). End the day in the field.`
                : 'Day started outside the office. End the day in the field.'}
          </Text>
        </View>
      )}

      {summary ? (
        <View style={styles.statsRow}>
          <Stat label="Distance" value={`${(summary.distanceKm || 0).toFixed(2)} km`} />
          <Stat label="Schools" value={String(summary.schoolCount)} />
          <Stat label="At schools" value={hours(summary.schoolMinutes)} />
          <Stat label="Working" value={hours(summary.workingMinutes)} />
        </View>
      ) : null}

      {day?.checkedIn && attendance?.mode === 'office' && !attendance?.fieldPermission ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change attendance to Field (second half)</Text>
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
              <WebButton title="Request Change to Field" onPress={onRequestPermission} loading={busy === 'permission'} />
            </>
          )}
        </View>
      ) : null}

      {day?.checkedIn && day.fieldWorkAllowed ? (
        visit ? (
          <>
            <View style={[styles.card, styles.activeCard]}>
              <Text style={styles.cardTitle}>Checked in: {visit.schoolName}</Text>
              <Text style={styles.muted}>
                {visit.schoolCode ? `${visit.schoolCode} · ` : ''}since {time(visit.entryAt)}
              </Text>
            </View>
            {isTrainer ? <TrainerActivityForm visit={visit} onSaved={load} /> : null}
            {/* BDEs check out with the visit form's Submit & Check Out; trainers after their activity. */}
            {!isTrainer ? <SchoolVisitForm visitId={visit._id} schoolName={visit.schoolName} history={[]} onDone={load} /> : null}
            <View style={styles.card}>
              {isTrainer ? <WebButton title="Check Out of School" variant="destructive" onPress={onCheckOut} loading={busy === 'exit'} /> : null}
              <TouchableOpacity onPress={() => setForgot((f) => !f)}>
                <Text style={styles.link}>{forgot ? 'Cancel' : 'Forgot to check out? Enter the exit time'}</Text>
              </TouchableOpacity>
            </View>
            {forgot ? <MissedExitCard title={visit.schoolName} startAt={visit.entryAt} onSubmit={onForgotCheckOut} /> : null}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Check in at a school</Text>
            {school ? (
              <View style={styles.selected}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedName}>{school.schoolName}</Text>
                  <Text style={styles.muted}>{[school.schoolCode, school.town].filter(Boolean).join(' · ')}</Text>
                </View>
                <TouchableOpacity onPress={() => setSchool(null)}>
                  <Text style={styles.link}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <WebLabel>School code / name *</WebLabel>
                <WebInput placeholder="Search by school code or name" value={query} onChangeText={setQuery} autoCapitalize="none" />
                {searching ? <ActivityIndicator color={colors.primary} /> : null}
                {schools.map((s) => (
                  <TouchableOpacity key={`${s.schoolCode}-${s.schoolName}`} style={styles.result} onPress={() => setSchool(s)}>
                    <Text style={styles.resultName}>{s.schoolName}</Text>
                    <Text style={styles.muted}>
                      {[s.schoolCode || 'No code', s.town, s.source === 'training' ? 'Training scheduled' : s.source === 'service' ? 'Service scheduled' : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!searching && query.trim().length >= 2 && !schools.length ? <Text style={styles.muted}>No school found.</Text> : null}
              </>
            )}
            <WebButton title="Check In" onPress={onCheckIn} loading={busy === 'entry'} disabled={!school} />
          </View>
        )
      ) : null}

      {user?._id && (day?.attendance || summary?.timeline?.length) ? (
        <DayRouteCard employeeId={user._id} refreshKey={day} />
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
                  {e.active ? ' (checked in)' : ''}
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
        <Text style={styles.hint}>Before End Day: {day.next.checkout}</Text>
      ) : null}
    </ScreenShell>
  );
}

/** Trainer at a school: Training or Service, the mandatory details and the feedback form. */
function TrainerActivityForm({ visit, onSaved }: { visit: OpenVisit; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<'Training' | 'Service'>(visit.activityType === 'Service' ? 'Service' : 'Training');
  const [subject, setSubject] = useState(visit.activity?.subject || '');
  const [term, setTerm] = useState(visit.activity?.term || '');
  const [level, setLevel] = useState(visit.activity?.level || '');
  const [participants, setParticipants] = useState(visit.activity?.participants ? String(visit.activity.participants) : '');
  const [remarks, setRemarks] = useState(visit.activity?.remarks || '');
  const [linkedId, setLinkedId] = useState<string>(visit.trainingId || visit.serviceId || '');
  const [form, setForm] = useState<{ data: string; name: string } | null>(null);
  const [assignments, setAssignments] = useState<{ trainings: Assignment[]; services: Assignment[] }>({ trainings: [], services: [] });
  const [saving, setSaving] = useState(false);
  const saved = Boolean(visit.activityType) && Boolean(visit.hasFeedbackForm);

  useEffect(() => {
    if (!visit.schoolCode) return;
    apiService
      .get(`/field-day/assignments?schoolCode=${encodeURIComponent(visit.schoolCode)}`)
      .then((data) => setAssignments({ trainings: data?.trainings || [], services: data?.services || [] }))
      .catch(() => undefined);
  }, [visit.schoolCode]);

  const scheduled = type === 'Training' ? assignments.trainings : assignments.services;

  const pickScheduled = (a: Assignment) => {
    if (linkedId === a._id) return setLinkedId('');
    setLinkedId(a._id);
    if (a.subject) setSubject(a.subject);
    if (a.term) setTerm(a.term);
    if (a.trainingLevel) setLevel(a.trainingLevel);
  };

  const photoForm = async () => {
    try {
      const photo = await takeLivePhoto();
      if (photo) setForm({ data: photo, name: 'feedback-form.jpg' });
    } catch (e: any) {
      Alert.alert('Camera', e?.message || 'Could not open the camera');
    }
  };

  const fileForm = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      if (file.size && file.size > MAX_FORM_BYTES) throw new Error('The file is larger than 5 MB. Take a photo of the form instead.');
      const base64 = await readAsStringAsync(file.uri, { encoding: 'base64' });
      const mime = file.mimeType || (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      setForm({ data: `data:${mime};base64,${base64}`, name: file.name || 'feedback-form' });
    } catch (e: any) {
      Alert.alert('Feedback form', e?.message || 'Could not read the file');
    }
  };

  const save = async () => {
    if (!form && !visit.hasFeedbackForm) return Alert.alert('Feedback form', 'Upload the completed feedback form.');
    setSaving(true);
    try {
      await apiService.put(`/field-day/visits/${visit._id}/activity`, {
        activityType: type,
        subject,
        term,
        level,
        participants: type === 'Training' ? Number(participants) || 0 : undefined,
        remarks,
        linkedId: linkedId || undefined,
        ...(form ? { feedbackForm: form.data, feedbackFormName: form.name } : {}),
      });
      setForm(null);
      await onSaved();
      Alert.alert('Saved', 'Details saved. You can check out of the school now.');
    } catch (e: any) {
      Alert.alert('Not saved', apiError(e, 'Could not save the details'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>Training / Service details</Text>
        {saved ? <Text style={styles.badge}>Saved ✓</Text> : <Text style={styles.required}>Required</Text>}
      </View>
      <View style={styles.chips}>
        {(['Training', 'Service'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, type === t && styles.chipOn]}
            onPress={() => {
              setType(t);
              setLinkedId('');
            }}
          >
            <Text style={[styles.chipText, type === t && styles.chipTextOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {scheduled.length ? (
        <>
          <WebLabel>{`Scheduled ${type.toLowerCase()} at this school`}</WebLabel>
          {scheduled.map((a) => (
            <TouchableOpacity key={a._id} style={[styles.result, linkedId === a._id && styles.resultOn]} onPress={() => pickScheduled(a)}>
              <Text style={styles.resultName}>
                {a.subject}
                {a.term ? ` · ${a.term}` : ''}
              </Text>
              <Text style={styles.muted}>
                {new Date(a.trainingDate || a.serviceDate || '').toLocaleDateString('en-IN')}
                {linkedId === a._id ? ' · marked Completed on check-out' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      ) : null}
      <WebLabel>Product / Subject *</WebLabel>
      <View style={styles.wrapChips}>
        {SUBJECTS.map((s) => (
          <TouchableOpacity key={s} style={[styles.smallChip, subject === s && styles.chipOn]} onPress={() => setSubject(s)}>
            <Text style={[styles.smallChipText, subject === s && styles.chipTextOn]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <WebLabel>Term *</WebLabel>
      <View style={styles.wrapChips}>
        {TERMS.map((t) => (
          <TouchableOpacity key={t} style={[styles.smallChip, term === t && styles.chipOn]} onPress={() => setTerm(t)}>
            <Text style={[styles.smallChipText, term === t && styles.chipTextOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {type === 'Training' ? (
        <>
          <WebLabel>Level</WebLabel>
          <WebInput placeholder="e.g. Level 2" value={level} onChangeText={setLevel} />
          <WebLabel>Teachers / students attended *</WebLabel>
          <WebInput placeholder="Number attended" keyboardType="number-pad" value={participants} onChangeText={setParticipants} />
        </>
      ) : null}
      <WebLabel>{type === 'Training' ? 'What was covered *' : 'Service details *'}</WebLabel>
      <WebInput placeholder={type === 'Training' ? 'Topics covered in the training' : 'Work done at the school'} value={remarks} onChangeText={setRemarks} multiline />
      <WebLabel>Feedback form *</WebLabel>
      <Text style={styles.muted}>
        {form ? `Selected: ${form.name}` : visit.hasFeedbackForm ? `Uploaded: ${visit.feedbackFormName || 'feedback form'}` : 'Not uploaded yet'}
      </Text>
      <View style={styles.chips}>
        <View style={{ flex: 1 }}>
          <WebButton title="Take Photo" variant="outline" onPress={photoForm} />
        </View>
        <View style={{ flex: 1 }}>
          <WebButton title="Choose File" variant="outline" onPress={fileForm} />
        </View>
      </View>
      <WebButton title="Save Details" onPress={save} loading={saving} />
    </View>
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
    marginBottom: 12,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  muted: { fontSize: 13, color: colors.textTertiary, lineHeight: 18 },
  error: { fontSize: 13, color: colors.error },
  hint: { fontSize: 13, color: '#B45309', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 12, overflow: 'hidden' },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  stat: {
    flexGrow: 1,
    minWidth: '22%',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 8 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  smallChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#DCE3EC', backgroundColor: colors.backgroundLight },
  smallChipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  activeCard: { borderColor: colors.success, borderWidth: 1.5, backgroundColor: '#F0FDF4' },
  required: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  link: { color: colors.primaryDark, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: colors.accent },
  selectedName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  result: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EEF2F7', backgroundColor: colors.backgroundLight },
  resultOn: { borderColor: colors.primary, backgroundColor: colors.accent },
  resultName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  chip: { flex: 1, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#DCE3EC' },
  chipOn: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  timelineRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  timelineIcon: { fontSize: 18 },
  timelineTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});

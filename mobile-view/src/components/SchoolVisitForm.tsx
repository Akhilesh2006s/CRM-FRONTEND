import React, { useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { getCurrentLocation } from '../services/location';
import { colors } from '../theme/colors';
import { Badge } from '../ui/Kit';

export type VisitDetails = {
  purpose?: string;
  remarks?: string;
  booksDistributed?: number;
  booksVerified?: string;
  booksVerifiedDetails?: string;
  programStarted?: string;
  programStatus?: string;
  trainingStatus?: string;
  trainingDetails?: string;
  pagesCompleted?: number;
  finalRemarks?: string;
};

export type VisitRecord = {
  _id: string;
  entryAt?: string;
  exitAt?: string;
  durationMinutes?: number;
  status?: string;
  employeeId?: { name?: string } | null;
  visitDetails?: VisitDetails;
  submittedAt?: string;
  valid?: boolean;
  invalidReason?: string;
};

export const VISIT_PURPOSES = [
  'Book distribution',
  'Book verification',
  'Program start',
  'Training',
  'Program review',
  'Payment collection',
  'Renewal discussion',
  'Complaint / Service',
  'Follow-up',
  'Other',
];
const VERIFIED = ['Yes', 'Partly', 'No'];
const YES_NO = ['Yes', 'No'];
const PROGRAM_STATUS = ['Not started', 'Started', 'Running well', 'Needs support', 'Stopped'];
const TRAINING_STATUS = ['Not scheduled', 'Scheduled', 'In progress', 'Completed'];

const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const time = (v?: string) => (v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

/** Latest submitted value of each field (for reference while filling a new visit). */
function lastValues(history: VisitRecord[]) {
  const out: Record<string, { value: string; at?: string }> = {};
  for (const v of history) {
    const d = v.visitDetails;
    if (!d) continue;
    const put = (k: string, value: any) => {
      if (out[k] || value === undefined || value === null || String(value).trim() === '') return;
      out[k] = { value: String(value), at: v.submittedAt || v.exitAt || v.entryAt };
    };
    put('booksDistributed', d.booksDistributed);
    put('booksVerified', [d.booksVerified, d.booksVerifiedDetails].filter(Boolean).join(' – '));
    put('programStarted', [d.programStarted, d.programStatus].filter(Boolean).join(' – '));
    put('trainingStatus', [d.trainingStatus, d.trainingDetails].filter(Boolean).join(' – '));
    put('pagesCompleted', d.pagesCompleted);
  }
  return out;
}

/**
 * School visit update after check-in: purpose + remarks, the school's progress fields (all optional),
 * final remarks, then Submit — which also checks out of the school.
 */
export default function SchoolVisitForm({
  visitId,
  schoolName,
  history,
  onDone,
}: {
  visitId: string;
  schoolName: string;
  history: VisitRecord[];
  onDone: () => Promise<void> | void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const last = useMemo(() => lastValues(history), [history]);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k: string, v: string) => setF((s) => ({ ...s, [k]: s[k] === v ? '' : v }));

  const send = async (acceptInvalid: boolean) => {
    setSaving(true);
    try {
      const here = await getCurrentLocation();
      await apiService.put(`/field-day/visits/${visitId}/submit`, {
        details: {
          purpose: f.purpose,
          remarks: f.remarks,
          booksDistributed: f.booksDistributed,
          booksVerified: f.booksVerified,
          booksVerifiedDetails: f.booksVerifiedDetails,
          programStarted: f.programStarted,
          programStatus: f.programStatus,
          trainingStatus: f.trainingStatus,
          trainingDetails: f.trainingDetails,
          pagesCompleted: f.pagesCompleted,
          finalRemarks: f.finalRemarks,
        },
        latitude: here.latitude,
        longitude: here.longitude,
        accuracy: here.accuracy,
        acceptInvalid,
      });
      setF({});
      Alert.alert('Visit submitted', `Your visit to ${schoolName} is saved and you are checked out.`);
      await onDone();
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Could not submit. Try again.';
      if (/outside the permitted school location/i.test(message) && !acceptInvalid) {
        Alert.alert('Warning', `${message}\n\nIf you submit from here, this visit will be marked as an Invalid Visit.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit as Invalid Visit', style: 'destructive', onPress: () => void send(true) },
        ]);
      } else {
        Alert.alert('Could not submit', message);
      }
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    if (!f.purpose) return Alert.alert('Purpose needed', 'Choose the purpose of the visit.');
    void send(false);
  };

  return (
    <View>
      <Text style={styles.step}>Purpose of visit *</Text>
      <Chips options={VISIT_PURPOSES} value={f.purpose} onPick={(v) => toggle('purpose', v)} />
      <Field label="Remarks" value={f.remarks} onChange={(v) => set('remarks', v)} placeholder="Purpose or other details" multiline />

      <Text style={[styles.step, { marginTop: 14 }]}>School update (fill what applies)</Text>

      <Field label="Books distributed" value={f.booksDistributed} onChange={(v) => set('booksDistributed', v.replace(/[^0-9]/g, ''))} placeholder="Number of books" numeric last={last.booksDistributed} />

      <Text style={styles.label}>Client verified books</Text>
      <Chips options={VERIFIED} value={f.booksVerified} onPick={(v) => toggle('booksVerified', v)} />
      <Field value={f.booksVerifiedDetails} onChange={(v) => set('booksVerifiedDetails', v)} placeholder="Verification details (who checked, shortages…)" last={last.booksVerified} />

      <Text style={styles.label}>Program started</Text>
      <Chips options={YES_NO} value={f.programStarted} onPick={(v) => toggle('programStarted', v)} />
      <Chips options={PROGRAM_STATUS} value={f.programStatus} onPick={(v) => toggle('programStatus', v)} />
      {last.programStarted ? <Last item={last.programStarted} /> : null}

      <Text style={styles.label}>Training status</Text>
      <Chips options={TRAINING_STATUS} value={f.trainingStatus} onPick={(v) => toggle('trainingStatus', v)} />
      <Field value={f.trainingDetails} onChange={(v) => set('trainingDetails', v)} placeholder="Training details (topic, teachers trained…)" last={last.trainingStatus} />

      <Field label="Pages completed" value={f.pagesCompleted} onChange={(v) => set('pagesCompleted', v.replace(/[^0-9]/g, ''))} placeholder="Pages completed in the program" numeric last={last.pagesCompleted} />

      <Field label="Final remarks" value={f.finalRemarks} onChange={(v) => set('finalRemarks', v)} placeholder="Observations, feedback, pending work, follow-up" multiline />

      <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving} activeOpacity={0.85}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit & Check Out</Text>}
      </TouchableOpacity>
      <Text style={styles.note}>Submit saves this visit and checks you out of the school.</Text>
    </View>
  );
}

/** Earlier visits at the school, latest first. Never overwritten by a new visit. */
export function VisitHistory({ history }: { history: VisitRecord[] }) {
  if (!history.length) return <Text style={styles.muted}>No visits yet.</Text>;
  return (
    <View>
      {history.map((v) => {
        const d = v.visitDetails || {};
        const rows: [string, any][] = [
          ['Purpose', d.purpose],
          ['Remarks', d.remarks],
          ['Books distributed', d.booksDistributed],
          ['Books verified', [d.booksVerified, d.booksVerifiedDetails].filter(Boolean).join(' – ')],
          ['Program', [d.programStarted ? `Started: ${d.programStarted}` : '', d.programStatus].filter(Boolean).join(' – ')],
          ['Training', [d.trainingStatus, d.trainingDetails].filter(Boolean).join(' – ')],
          ['Pages completed', d.pagesCompleted],
          ['Final remarks', d.finalRemarks],
        ];
        return (
          <View key={v._id} style={styles.histCard}>
            <View style={styles.histTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.histTitle}>
                  {date(v.entryAt)} · {v.employeeId?.name || 'Employee'}
                </Text>
                <Text style={styles.muted}>
                  In {time(v.entryAt)}
                  {v.exitAt ? ` · Out ${time(v.exitAt)}` : ' · still inside'}
                  {v.durationMinutes ? ` · ${v.durationMinutes} min` : ''}
                </Text>
              </View>
              {v.valid === false ? <Badge label="Invalid Visit" tone="error" /> : v.submittedAt ? <Badge label="Submitted" tone="success" /> : null}
            </View>
            {rows
              .filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '')
              .map(([k, val]) => (
                <View key={k} style={styles.histRow}>
                  <Text style={styles.histKey}>{k}</Text>
                  <Text style={styles.histVal}>{String(val)}</Text>
                </View>
              ))}
            {v.valid === false && v.invalidReason ? <Text style={styles.invalid}>{v.invalidReason}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function Chips({ options, value, onPick }: { options: string[]; value?: string; onPick: (v: string) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = value === o;
        return (
          <TouchableOpacity key={o} style={[styles.chip, on && styles.chipOn]} onPress={() => onPick(o)} activeOpacity={0.8}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Last({ item }: { item: { value: string; at?: string } }) {
  return <Text style={styles.last}>Last: {item.value} ({date(item.at)})</Text>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  numeric,
  last,
}: {
  label?: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numeric?: boolean;
  last?: { value: string; at?: string };
}) {
  return (
    <View style={{ marginTop: label ? 10 : 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
        value={value || ''}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={numeric ? 'number-pad' : 'default'}
      />
      {last ? <Last item={last} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 14, fontWeight: '700', color: colors.primaryDark, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  chipOn: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: '#fff' },
  last: { fontSize: 12, color: colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  submit: { marginTop: 18, backgroundColor: colors.success, borderRadius: 10, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  note: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 6 },
  muted: { fontSize: 12, color: colors.textSecondary },
  histCard: { borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 12, padding: 12, marginTop: 10, backgroundColor: '#fff' },
  histTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  histTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  histRow: { flexDirection: 'row', paddingVertical: 2, gap: 8 },
  histKey: { width: 120, fontSize: 12, color: colors.textTertiary },
  histVal: { flex: 1, fontSize: 13, color: colors.textPrimary },
  invalid: { fontSize: 12, color: colors.error, marginTop: 4 },
});

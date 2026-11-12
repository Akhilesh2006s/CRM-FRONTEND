import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton, WebInput, WebLabel } from '../../ui/WebPrimitives';
import { Card, ChipRow } from '../../ui/Kit';
import DateField from '../../ui/DateField';
import TimeField from '../../ui/TimeField';
import { apiService } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import { colors } from '../../theme/colors';
import { PJP_PURPOSES, periodEnd, todayIst, type Pjp, type PjpItem } from '../../lib/pjp';

type School = { schoolName: string; schoolCode?: string; town?: string; zone?: string; leadId?: string };

const blankRow = (date: string, time = '10:00'): PjpItem => ({ date, time, schoolName: '', location: '', purpose: '', notes: '' });
const asDate = (k: string) => (k ? new Date(`${k}T00:00:00`) : undefined);

/** New plan, or edit one (an approved plan's change goes to the reporting manager). */
export default function PjpEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id: string | undefined = route.params?.id;
  const [initial, setInitial] = useState<Pjp | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [period, setPeriod] = useState<'Weekly' | 'Monthly'>('Weekly');
  const [from, setFrom] = useState(todayIst());
  const [to, setTo] = useState(periodEnd('Weekly', todayIst()));
  const [items, setItems] = useState<PjpItem[]>([blankRow(todayIst())]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(-1);
  const [schools, setSchools] = useState<School[]>([]);
  const approved = initial?.status === 'Approved';

  useEffect(() => {
    if (!id) return;
    apiService
      .get(`/pjp/${id}`)
      .then((p: Pjp) => {
        setInitial(p);
        setPeriod(p.period);
        setFrom(p.fromDate);
        setTo(p.toDate);
        setItems(p.items.map(({ visitStatus, actual, ...it }) => it));
      })
      .catch((e: any) => showAlert('Error', e?.message || 'Could not load the plan'))
      .finally(() => setLoading(false));
  }, [id]);

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setSchools([]);
      return;
    }
    apiService
      .get(`/field-day/schools?q=${encodeURIComponent(q.trim())}`)
      .then((r: School[]) => setSchools(Array.isArray(r) ? r.slice(0, 6) : []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const q = active >= 0 ? items[active]?.schoolName || '' : '';
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [active, items, search]);

  const setRow = (i: number, patch: Partial<PjpItem>) => setItems((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async (submit: boolean) => {
    if (approved && !reason.trim()) {
      showAlert('Error', 'Give a reason for changing the approved plan');
      return;
    }
    setSaving(true);
    try {
      const body = { period, fromDate: from, toDate: to, items, submit, reason };
      const saved: Pjp = initial ? await apiService.put(`/pjp/${initial._id}`, body) : await apiService.post('/pjp', body);
      showAlert(
        'Saved',
        approved
          ? saved.changeRequest?.status === 'Pending'
            ? 'Change sent to your reporting manager for approval'
            : 'Plan changed'
          : submit
            ? saved.status === 'Approved'
              ? 'Plan submitted and approved'
              : 'Plan submitted to your reporting manager'
            : 'Draft saved'
      );
      navigation.replace('PjpDetail', { id: saved._id });
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not save the plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell title={initial ? (approved ? 'Change PJP' : 'Edit PJP') : 'New PJP'} subtitle="Date, school, location, visit purpose and time for each visit." loading={loading}>
      <PageSection title="Plan">
        {!approved ? (
          <ChipRow
            items={[
              { key: 'Weekly', label: 'Weekly' },
              { key: 'Monthly', label: 'Monthly' },
            ]}
            value={period}
            onChange={(k) => {
              setPeriod(k as 'Weekly' | 'Monthly');
              setTo(periodEnd(k, from));
            }}
          />
        ) : null}
        <WebLabel>From</WebLabel>
        <DateField
          value={from}
          onChange={(d) => {
            setFrom(d);
            setTo(periodEnd(period, d));
          }}
          placeholder="From date"
          minimumDate={initial ? undefined : asDate(todayIst())}
        />
        <WebLabel>To</WebLabel>
        <DateField value={to} onChange={setTo} placeholder="To date" minimumDate={asDate(from)} />
      </PageSection>

      {items.map((r, i) => (
        <Card key={i}>
          <View style={styles.rowHead}>
            <Text style={styles.rowTitle}>Visit {i + 1}</Text>
            {items.length > 1 ? (
              <TouchableOpacity onPress={() => setItems((rows) => rows.filter((_, j) => j !== i))} accessibilityLabel="Remove visit">
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <DateField value={r.date} onChange={(d) => setRow(i, { date: d })} placeholder="Date" minimumDate={asDate(from)} maximumDate={asDate(to)} />
          <TimeField value={r.time} onChange={(t) => setRow(i, { time: t })} />
          <WebLabel>School name *</WebLabel>
          <WebInput
            value={r.schoolName}
            placeholder="Type to search"
            onFocus={() => setActive(i)}
            onChangeText={(t) => {
              setActive(i);
              setRow(i, { schoolName: t, schoolCode: '', leadId: undefined });
            }}
          />
          {active === i && schools.length ? (
            <View style={styles.suggest}>
              {schools.map((s) => (
                <TouchableOpacity
                  key={`${s.schoolCode}-${s.schoolName}`}
                  style={styles.suggestRow}
                  onPress={() => {
                    setRow(i, { schoolName: s.schoolName, schoolCode: s.schoolCode || '', leadId: s.leadId, location: s.town || s.zone || r.location });
                    setActive(-1);
                    setSchools([]);
                  }}
                >
                  <Text style={styles.suggestName}>{s.schoolName}</Text>
                  <Text style={styles.suggestMeta}>{[s.schoolCode, s.town || s.zone].filter(Boolean).join(' · ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <WebLabel>Location</WebLabel>
          <WebInput value={r.location || ''} placeholder="Area / town" onChangeText={(t) => setRow(i, { location: t })} />
          <WebLabel>Visit purpose *</WebLabel>
          <ChipRow items={PJP_PURPOSES.map((p) => ({ key: p, label: p }))} value={r.purpose} onChange={(k) => setRow(i, { purpose: k })} />
          <WebLabel>Notes</WebLabel>
          <WebInput value={r.notes || ''} onChangeText={(t) => setRow(i, { notes: t })} />
        </Card>
      ))}
      <View style={{ marginBottom: 12 }}>
        <WebButton
          title="Add visit"
          variant="outline"
          onPress={() => setItems((rows) => [...rows, blankRow(rows[rows.length - 1]?.date || from, rows[rows.length - 1]?.time || '10:00')])}
        />
      </View>

      {approved ? (
        <PageSection title="Reason for the change *" description="The change goes to your reporting manager for approval.">
          <WebInput value={reason} onChangeText={setReason} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
          <WebButton title={saving ? 'Sending…' : 'Send change for approval'} onPress={() => save(false)} disabled={saving} />
        </PageSection>
      ) : (
        <View style={styles.buttons}>
          <View style={{ flex: 1 }}>
            <WebButton title="Save draft" variant="outline" onPress={() => save(false)} disabled={saving} />
          </View>
          <View style={{ flex: 1 }}>
            <WebButton title={saving ? 'Saving…' : initial?.status === 'Submitted' ? 'Save' : 'Submit plan'} onPress={() => save(true)} disabled={saving} />
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  remove: { color: colors.error, fontWeight: '600' },
  suggest: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginTop: -6, marginBottom: 12 },
  suggestRow: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  suggestName: { fontSize: 14, color: colors.textPrimary },
  suggestMeta: { fontSize: 12, color: colors.textTertiary },
  buttons: { flexDirection: 'row', gap: 8, marginBottom: 24 },
});

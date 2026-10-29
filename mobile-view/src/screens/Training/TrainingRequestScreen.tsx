import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radii, spacing } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

import { ymdToDmy } from '../../utils/dateFormat';
/** Same subject list as web /dashboard/training/request (validated by the API). */
const SUBJECTS = [
  'Abacus',
  'Vedic Maths',
  'EEL',
  'IIT',
  'Financial literacy',
  'Brain bytes',
  'Spelling bee',
  'Skill pro',
  'Maths lab',
  'Codechamp',
];

type TrainingRequest = {
  _id: string;
  schoolName: string;
  schoolCode?: string;
  subject: string;
  preferredDate: string;
  remarks?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  createdAt: string;
};

type ClientSchool = {
  id: string;
  name: string;
  code: string;
  zone: string;
};

const emptyForm = {
  schoolId: '',
  schoolName: '',
  schoolCode: '',
  zone: '',
  subject: '',
  preferredDate: '',
  remarks: '',
};

function errMsg(e: any, fallback: string) {
  return e?.response?.data?.message || e?.message || fallback;
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value?: string) {
  if (!value) return new Date();
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function fmtDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusColors(status?: string) {
  switch (status) {
    case 'Approved':
      return { bg: colors.successLight, fg: colors.success };
    case 'Rejected':
      return { bg: colors.errorLight, fg: colors.error };
    default:
      return { bg: colors.warningLight, fg: colors.warning };
  }
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fieldBlock}>
        <WebLabel>{label}</WebLabel>
        {React.createElement('input', {
          type: 'date',
          value: value || '',
          onChange: (e: any) => onChange(e.target.value || ''),
          style: {
            width: '100%',
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            fontSize: 16,
            backgroundColor: '#fff',
            color: colors.textPrimary,
            boxSizing: 'border-box',
            marginBottom: 8,
          },
        })}
      </View>
    );
  }

  return (
    <View style={styles.fieldBlock}>
      <WebLabel>{label}</WebLabel>
      <TouchableOpacity style={styles.dateTouchable} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Text style={[styles.dateText, !value && styles.datePlaceholder]}>{ymdToDmy(value) || 'Tap to pick date'}</Text>
      </TouchableOpacity>
      {show && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseYmd(value)}
          mode="date"
          display="default"
          onChange={(event, d) => {
            setShow(false);
            if (event.type === 'set' && d) onChange(toYmd(d));
          }}
        />
      ) : null}
      {show && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={styles.datePickerBox}>
            <DateTimePicker
              value={parseYmd(value)}
              mode="date"
              display="spinner"
              onChange={(_, d) => {
                if (d) onChange(toYmd(d));
              }}
            />
            <WebButton title="Done" onPress={() => setShow(false)} />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export default function TrainingRequestScreen() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<TrainingRequest[]>([]);
  const [schools, setSchools] = useState<ClientSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [requests, clients] = await Promise.all([
        apiService.get('/training-requests/my').catch(() => [] as TrainingRequest[]),
        apiService.get('/training-requests/schools').catch(() => [] as ClientSchool[]),
      ]);
      setItems(Array.isArray(requests) ? requests : []);
      setSchools(Array.isArray(clients) ? clients : []);
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to load requests') });
      setItems([]);
      setSchools([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async () => {
    if (!form.schoolName.trim() || !form.subject || !form.preferredDate) {
      setBanner({ type: 'error', message: 'School, subject, and preferred date are required' });
      return;
    }
    setSubmitting(true);
    setBanner(null);
    try {
      await apiService.post('/training-requests', form);
      setBanner({ type: 'success', message: 'Training request sent to the coordinator' });
      setForm(emptyForm);
      load();
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to submit request') });
    } finally {
      setSubmitting(false);
    }
  };

  const onSelectSchool = (schoolId: string) => {
    const school = schools.find((s) => s.id === schoolId);
    setForm((f) => ({
      ...f,
      schoolId,
      schoolName: school?.name || '',
      schoolCode: school?.code || '',
      zone: school?.zone || '',
    }));
  };

  return (
    <ScreenShell
      title="Training Request"
      subtitle="Raise a training request. The coordinator will approve or reject it."
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <PageSection title="New request">
        <WebSelect
          label="School *"
          value={form.schoolId}
          onValueChange={onSelectSchool}
          disabled={loading}
          placeholder={loading ? 'Loading schools…' : 'Select school or school code'}
          items={schools.map((s) => ({
            value: s.id,
            label: s.code ? `${s.name} — ${s.code}` : s.name,
          }))}
        />
        {!loading && schools.length === 0 ? (
          <Text style={styles.hint}>No schools are saved under your clients yet.</Text>
        ) : null}

        <WebSelect
          label="Subject *"
          value={form.subject}
          onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}
          placeholder="Select subject"
          items={SUBJECTS.map((s) => ({ label: s, value: s }))}
        />

        <DateField
          label="Preferred date *"
          value={form.preferredDate}
          onChange={(v) => setForm((f) => ({ ...f, preferredDate: v }))}
        />

        <WebLabel>Remarks</WebLabel>
        <WebInput
          value={form.remarks}
          onChangeText={(v) => setForm((f) => ({ ...f, remarks: v }))}
          multiline
          numberOfLines={3}
          style={styles.textarea}
        />

        <WebButton
          title={submitting ? 'Sending…' : 'Send to coordinator'}
          onPress={onSubmit}
          disabled={submitting}
          loading={submitting}
        />
      </PageSection>

      <Text style={styles.sectionTitle}>My requests</Text>
      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No training requests yet</Text>
      ) : (
        items.map((item) => {
          const sc = statusColors(item.status);
          return (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>
                  {item.schoolName}
                  {item.schoolCode ? ` (${item.schoolCode})` : ''}
                </Text>
                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.badgeText, { color: sc.fg }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.meta}>Subject: {item.subject}</Text>
              <Text style={styles.meta}>Preferred date: {fmtDate(item.preferredDate)}</Text>
              <Text style={styles.note}>Note: {item.rejectionReason || item.remarks || '—'}</Text>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 4 },
  dateTouchable: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.backgroundLight,
  },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  datePlaceholder: { color: colors.textMuted },
  datePickerBox: { backgroundColor: colors.backgroundLight, padding: 16, marginTop: 'auto' },
  hint: { fontSize: 12, color: colors.textTertiary, marginTop: -6, marginBottom: 12 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  note: { fontSize: 13, color: colors.textTertiary, marginTop: 6 },
});

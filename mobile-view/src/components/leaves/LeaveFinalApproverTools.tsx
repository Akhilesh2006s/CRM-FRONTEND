import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch } from 'react-native';
import { colors } from '../../theme/colors';
import { WebButton } from '../../ui/WebPrimitives';
import DateField from '../../ui/DateField';
import { apiService } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import { leaveTypeLabel } from '../../lib/leaveTypes';

type MonthRow = {
  month: string;
  approvedDays: number;
  paidDays: number;
  lopDays: number;
  pendingDays: number;
  rejectedDays: number;
  presentDays: number;
  leaves: { _id: string; leaveType: string; status: string; from: string; to: string; days: number }[];
};
type History = {
  employee: { name?: string };
  year: string;
  totals: { approvedDays: number; paidDays: number; lopDays: number; pendingDays: number; rejectedDays: number; presentDays: number };
  months: MonthRow[];
};

const monthName = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dmy = (k: string) => k.split('-').reverse().join('/');
const ymd = (v: string) => new Date(new Date(v).getTime() + 330 * 60000).toISOString().slice(0, 10);
const plural = (n: number) => (n === 1 ? 'day' : 'days');

/** "Asked for …" when the final approver changed the dates. */
export function leaveDateChangeText(l: { requestedStartDate?: string; requestedEndDate?: string; requestedDays?: number }) {
  if (!l.requestedStartDate) return '';
  const a = ymd(l.requestedStartDate);
  const b = l.requestedEndDate ? ymd(l.requestedEndDate) : a;
  return `Asked for ${dmy(a)}${b !== a ? ` – ${dmy(b)}` : ''} (${l.requestedDays ?? '—'} days); dates changed at approval.`;
}

/** Employee's leave year month by month (final approver: HR / Admin / Super Admin). */
export function LeaveHistoryButton({ employeeId, name }: { employeeId: string; name?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState('');
  const show = async () => {
    setOpen(true);
    setError('');
    try {
      setData((await apiService.get(`/leaves/history?employeeId=${encodeURIComponent(employeeId)}`)) as History);
    } catch (e: any) {
      setError(e?.message || 'Could not load the leave history');
    }
  };
  return (
    <>
      <TouchableOpacity style={styles.outlineBtn} onPress={() => void show()}>
        <Text style={styles.outlineText}>Leave history</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '85%' }]}>
            <Text style={styles.title}>
              Leave history: {data?.employee?.name || name || 'Employee'} {data ? `(${data.year})` : ''}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!data && !error ? <Text style={styles.muted}>Loading…</Text> : null}
            {data ? (
              <ScrollView>
                <Text style={styles.muted}>
                  This year: {data.totals.approvedDays} days approved ({data.totals.paidDays} paid, {data.totals.lopDays} loss of pay) ·{' '}
                  {data.totals.pendingDays} pending · {data.totals.rejectedDays} rejected · {data.totals.presentDays} days present
                </Text>
                {data.months.map((m) => (
                  <View key={m.month} style={styles.month}>
                    <Text style={styles.monthName}>{monthName(m.month)}</Text>
                    <Text style={styles.small}>
                      Present {m.presentDays} · Approved {m.approvedDays} · Paid {m.paidDays} ·{' '}
                      <Text style={m.lopDays ? { color: colors.error } : undefined}>Loss of pay {m.lopDays}</Text> · Pending{' '}
                      {m.pendingDays} · Rejected {m.rejectedDays}
                    </Text>
                    {m.leaves.map((l) => (
                      <Text key={`${l._id}-${l.from}`} style={styles.muted}>
                        {leaveTypeLabel(l.leaveType)}: {dmy(l.from)}
                        {l.to !== l.from ? ` – ${dmy(l.to)}` : ''} ({l.days} {plural(l.days)}, {l.status})
                      </Text>
                    ))}
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <WebButton title="Close" variant="outline" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

/** Approve fewer days or other dates (final approver). */
export function ApproveWithChangesButton({
  leave,
  disabled,
  onDone,
}: {
  leave: { _id: string; startDate: string; endDate: string; dayType?: string; days?: number };
  disabled?: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(ymd(leave.startDate));
  const [to, setTo] = useState(ymd(leave.endDate));
  const [halfDay, setHalfDay] = useState(leave.dayType === 'Half Day');
  const [saving, setSaving] = useState(false);
  const days = halfDay ? 0.5 : from && to && to >= from ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0;
  const save = async () => {
    if (!from || (!halfDay && (!to || to < from))) {
      showAlert('Error', 'Choose the dates to approve');
      return;
    }
    setSaving(true);
    try {
      await apiService.put(`/leaves/${leave._id}/approve`, {
        status: 'Approved',
        approveStartDate: from,
        approveEndDate: halfDay ? from : to,
        approveDayType: halfDay ? 'Half Day' : 'Full Day',
      });
      showAlert('Success', `Approved for ${days} ${plural(days)}`);
      setOpen(false);
      onDone();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not approve');
    } finally {
      setSaving(false);
    }
  };
  const askedFrom = ymd(leave.startDate);
  const askedTo = ymd(leave.endDate);
  return (
    <>
      <TouchableOpacity style={styles.outlineBtn} disabled={disabled} onPress={() => setOpen(true)}>
        <Text style={styles.outlineText}>Approve with changes</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Approve fewer days or other dates</Text>
            <Text style={styles.muted}>
              Asked: {dmy(askedFrom)}
              {askedTo !== askedFrom ? ` – ${dmy(askedTo)}` : ''} ({leave.days ?? '—'} days)
            </Text>
            <View style={styles.switchRow}>
              <Text style={styles.small}>Half day only</Text>
              <Switch value={halfDay} onValueChange={setHalfDay} />
            </View>
            <Text style={styles.label}>{halfDay ? 'Date' : 'From'}</Text>
            <DateField value={from} onChange={setFrom} />
            {!halfDay ? (
              <>
                <Text style={styles.label}>To</Text>
                <DateField value={to} onChange={setTo} minimumDate={from ? new Date(`${from}T00:00:00`) : undefined} />
              </>
            ) : null}
            <Text style={styles.monthName}>
              Approve: {days} {plural(days)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setOpen(false)} disabled={saving} />
              </View>
              <View style={{ flex: 1 }}>
                <WebButton title={saving ? 'Saving…' : 'Approve'} onPress={() => void save()} disabled={saving || !days} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  outlineBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundLight,
  },
  outlineText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.backgroundLight,
    padding: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  muted: { fontSize: 12, color: colors.textTertiary },
  small: { fontSize: 13, color: colors.textSecondary },
  error: { fontSize: 13, color: colors.error },
  month: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 2 },
  monthName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

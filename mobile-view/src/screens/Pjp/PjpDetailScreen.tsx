import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, SectionTitle, Badge } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import { colors } from '../../theme/colors';
import { dmy, personName, pjpStatusLabel, pjpTone, time12, visitTone, weekday, type Pjp, type PjpItem } from '../../lib/pjp';

function ItemCard({ it, showStatus }: { it: PjpItem; showStatus: boolean }) {
  return (
    <Card>
      <View style={styles.itemHead}>
        <Text style={styles.itemWhen}>
          {weekday(it.date)} {dmy(it.date)} · {time12(it.time)}
        </Text>
        {showStatus ? <Badge label={it.visitStatus || 'Pending'} tone={visitTone(it.visitStatus)} /> : null}
      </View>
      <Text style={styles.school}>{it.schoolName}</Text>
      <InfoRow label="Location" value={it.location || '—'} />
      <InfoRow label="Visit purpose" value={it.purpose} />
      {it.notes ? <InfoRow label="Notes" value={it.notes} /> : null}
      {it.actual ? <InfoRow label="Done as" value={it.actual.kind} /> : null}
    </Card>
  );
}

/** One plan: plan vs actual, the pending change, approve / reject, and the history. */
export default function PjpDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id: string = route.params?.id;
  const [p, setP] = useState<Pjp | null>(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setP(await apiService.get(`/pjp/${id}`));
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not load the plan');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      showAlert('Done', ok);
      setRemarks('');
      await load();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };
  const decide = (action: 'approve' | 'reject') => {
    if (action === 'reject' && !remarks.trim()) {
      showAlert('Error', 'Give a reason for rejecting');
      return;
    }
    run(() => apiService.put(`/pjp/${id}/decide`, { action, remarks }), action === 'approve' ? 'Approved' : 'Rejected');
  };
  const remove = async () => {
    setBusy(true);
    try {
      await apiService.delete(`/pjp/${id}`);
      navigation.goBack();
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not delete');
    } finally {
      setBusy(false);
    }
  };

  const showStatus = p?.status === 'Approved' || p?.status === 'Submitted';
  const cr = p?.changeRequest;
  const s = p?.summary;
  return (
    <ScreenShell title="PJP" subtitle={p ? `${dmy(p.fromDate)} – ${dmy(p.toDate)}` : undefined} loading={loading}>
      {p ? (
        <>
          <Card>
            <CardTitle
              title={p.isOwn ? `My ${p.period.toLowerCase()} plan` : `${personName(p.employeeId)} · ${p.period}`}
              subtitle={p.employeeId?.role || undefined}
              badge={pjpStatusLabel(p)}
              tone={pjpTone(p)}
            />
            <InfoRow label="Approver" value={personName(p.approverId) || 'Admin / Super Admin'} />
            {p.status === 'Rejected' && p.remarks ? <InfoRow label="Reason" value={p.remarks} /> : null}
            {s ? (
              <Text style={styles.counts}>
                Planned {s.planned} · <Text style={{ color: colors.success }}>Completed {s.completed}</Text> ·{' '}
                <Text style={{ color: '#A16207' }}>Pending {s.pending}</Text> · <Text style={{ color: colors.error }}>Missed {s.missed}</Text> · Not in
                plan {s.unplanned}
              </Text>
            ) : null}
            {p.isOwn && (p.canEdit || p.canSubmit || p.canDelete) ? (
              <ActionRow>
                {p.canEdit ? (
                  <View style={{ flex: 1 }}>
                    <WebButton
                      title={p.status === 'Approved' ? 'Change plan' : 'Edit'}
                      variant="outline"
                      onPress={() => navigation.navigate('PjpEdit', { id: p._id })}
                      disabled={busy}
                    />
                  </View>
                ) : null}
                {p.canSubmit ? (
                  <View style={{ flex: 1 }}>
                    <WebButton title="Submit plan" onPress={() => run(() => apiService.post(`/pjp/${id}/submit`, {}), 'Plan submitted')} disabled={busy} />
                  </View>
                ) : null}
                {p.canDelete ? (
                  <View style={{ flex: 1 }}>
                    <WebButton title="Delete" variant="destructive" onPress={remove} disabled={busy} />
                  </View>
                ) : null}
              </ActionRow>
            ) : null}
          </Card>

          {cr && cr.status === 'Pending' ? (
            <>
              <SectionTitle>Change waiting for approval</SectionTitle>
              <Card>
                <InfoRow label="Reason" value={cr.reason || '—'} />
                {cr.fromDate && (cr.fromDate !== p.fromDate || cr.toDate !== p.toDate) ? (
                  <InfoRow label="New period" value={`${dmy(cr.fromDate)} – ${dmy(cr.toDate)}`} />
                ) : null}
              </Card>
              {cr.items.map((it, i) => (
                <ItemCard key={`cr-${i}`} it={it} showStatus={false} />
              ))}
            </>
          ) : null}
          {cr && cr.status === 'Rejected' && cr.remarks ? <Text style={styles.rejected}>Last change rejected: {cr.remarks}</Text> : null}

          {p.canDecide ? (
            <Card>
              <Text style={styles.decideTitle}>{cr?.status === 'Pending' ? 'Decide the change' : 'Decide the plan'}</Text>
              <WebInput placeholder="Remarks (required to reject)" value={remarks} onChangeText={setRemarks} multiline />
              <View style={styles.buttons}>
                <View style={{ flex: 1 }}>
                  <WebButton title="Approve" variant="success" onPress={() => decide('approve')} disabled={busy} />
                </View>
                <View style={{ flex: 1 }}>
                  <WebButton title="Reject" variant="destructive" onPress={() => decide('reject')} disabled={busy} />
                </View>
              </View>
            </Card>
          ) : null}

          <SectionTitle>{showStatus ? 'Planned vs actual' : 'Planned visits'}</SectionTitle>
          {p.items.map((it, i) => (
            <ItemCard key={it._id || i} it={it} showStatus={showStatus} />
          ))}

          {p.unplanned?.length ? (
            <>
              <SectionTitle>Visits not in the plan</SectionTitle>
              <Card>
                {p.unplanned.map((u, i) => (
                  <Text key={i} style={styles.line}>
                    {dmy(u.day)} · {u.schoolName} ({u.kind})
                  </Text>
                ))}
              </Card>
            </>
          ) : null}

          {p.history?.length ? (
            <>
              <SectionTitle>History</SectionTitle>
              <Card>
                {p.history.map((h, i) => (
                  <Text key={i} style={styles.line}>
                    {new Date(h.at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {h.action}
                    {personName(h.by) ? ` by ${personName(h.by)}` : ''}
                    {h.note ? ` — ${h.note}` : ''}
                  </Text>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemWhen: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  school: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  counts: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  rejected: { color: colors.error, marginBottom: 8 },
  decideTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  buttons: { flexDirection: 'row', gap: 8 },
  line: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
});

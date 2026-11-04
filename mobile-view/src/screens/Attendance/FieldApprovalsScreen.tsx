import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, SectionTitle } from '../../ui/Kit';
import { apiService } from '../../services/api';

type Person = { _id: string; name?: string; empCode?: string; role?: string; zone?: string };
type FieldRequest = { _id: string; employeeId: Person; day: string; reason: string; places?: string; createdAt: string };
type Review = {
  _id: string;
  employeeId: Person;
  startTime: string;
  endTime?: string;
  mode?: string;
  officeName?: string;
  checkoutMode?: string;
  checkoutOfficeName?: string;
  reviewReason?: string;
};

const when = (v?: string) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

/** Field visit requests and office/field check-out reviews waiting for this reviewer (Admin: everyone's). */
export default function FieldApprovalsScreen() {
  const [requests, setRequests] = useState<FieldRequest[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/field-day/approvals');
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
      setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load approvals');
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

  const decide = async (kind: 'request' | 'review', id: string, decision: 'approve' | 'reject') => {
    const note = (remarks[id] || '').trim();
    if (decision === 'reject' && !note) {
      Alert.alert('Remarks needed', 'Enter the reason for rejecting.');
      return;
    }
    setBusy(`${id}-${decision}`);
    try {
      const path = kind === 'request' ? `/field-day/permission/${id}/decide` : `/field-day/reviews/${id}/decide`;
      await apiService.put(path, { decision, remarks: note });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save the decision');
    } finally {
      setBusy('');
    }
  };

  const actions = (kind: 'request' | 'review', id: string) => (
    <>
      <WebInput
        placeholder="Remarks (required to reject)"
        value={remarks[id] || ''}
        onChangeText={(v) => setRemarks((r) => ({ ...r, [id]: v }))}
      />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <WebButton title="Approve" variant="success" onPress={() => decide(kind, id, 'approve')} loading={busy === `${id}-approve`} />
        </View>
        <View style={{ flex: 1 }}>
          <WebButton title="Reject" variant="destructive" onPress={() => decide(kind, id, 'reject')} loading={busy === `${id}-reject`} />
        </View>
      </View>
    </>
  );

  return (
    <ScreenShell
      title="Field Approvals"
      subtitle="Office-to-field requests and check-out reviews."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <SectionTitle>{`Office to Field requests (${requests.length})`}</SectionTitle>
      {requests.length === 0 ? <EmptyState icon="✅" title="No requests waiting" /> : null}
      {requests.map((r) => (
        <Card key={r._id}>
          <CardTitle title={r.employeeId?.name || '—'} subtitle={r.employeeId?.empCode || undefined} badge="Pending" tone="warning" />
          <InfoRow label="Asked" value={when(r.createdAt)} />
          <InfoRow label="For day" value={r.day} />
          <InfoRow label="Reason" value={r.reason} />
          <InfoRow label="Places" value={r.places} />
          <ActionRow>
            <View style={{ flex: 1 }}>{actions('request', r._id)}</View>
          </ActionRow>
        </Card>
      ))}

      <SectionTitle>{`Attendance reviews (${reviews.length})`}</SectionTitle>
      {reviews.length === 0 ? <EmptyState icon="✅" title="Nothing to review" /> : null}
      {reviews.map((a) => (
        <Card key={a._id}>
          <CardTitle title={a.employeeId?.name || '—'} subtitle={a.employeeId?.empCode || undefined} badge="Review" tone="warning" />
          <InfoRow
            label="Start"
            value={`${when(a.startTime)} (${a.mode === 'office' ? `office${a.officeName ? `: ${a.officeName}` : ''}` : 'field'})`}
          />
          <InfoRow
            label="End"
            value={`${when(a.endTime)} (${a.checkoutMode === 'office' ? `office${a.checkoutOfficeName ? `: ${a.checkoutOfficeName}` : ''}` : a.checkoutMode || 'no location'})`}
          />
          <InfoRow label="Note" value={a.reviewReason} />
          <ActionRow>
            <View style={{ flex: 1 }}>{actions('review', a._id)}</View>
          </ActionRow>
        </Card>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
});

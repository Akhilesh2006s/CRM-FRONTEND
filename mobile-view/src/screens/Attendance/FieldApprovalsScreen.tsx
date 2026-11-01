import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput } from '../../ui/WebPrimitives';
import { colors, radii } from '../../theme/colors';
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
          <WebButton title="Approve" onPress={() => decide(kind, id, 'approve')} loading={busy === `${id}-approve`} />
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
      subtitle="Field visit requests from office staff, and check-outs that did not match the check-in."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.section}>Field visit requests ({requests.length})</Text>
      {requests.length === 0 ? <Text style={styles.empty}>No requests waiting.</Text> : null}
      {requests.map((r) => (
        <View key={r._id} style={styles.card}>
          <Text style={styles.name}>
            {r.employeeId?.name || '—'} {r.employeeId?.empCode ? `· ${r.employeeId.empCode}` : ''}
          </Text>
          <Text style={styles.meta}>Asked {when(r.createdAt)} for {r.day}</Text>
          <Text style={styles.body}>Reason: {r.reason}</Text>
          {r.places ? <Text style={styles.body}>Places: {r.places}</Text> : null}
          {actions('request', r._id)}
        </View>
      ))}

      <Text style={styles.section}>Attendance reviews ({reviews.length})</Text>
      {reviews.length === 0 ? <Text style={styles.empty}>No attendance waiting for review.</Text> : null}
      {reviews.map((a) => (
        <View key={a._id} style={styles.card}>
          <Text style={styles.name}>
            {a.employeeId?.name || '—'} {a.employeeId?.empCode ? `· ${a.employeeId.empCode}` : ''}
          </Text>
          <Text style={styles.meta}>
            In {when(a.startTime)} ({a.mode === 'office' ? `office${a.officeName ? `: ${a.officeName}` : ''}` : 'field'}) · Out {when(a.endTime)} (
            {a.checkoutMode === 'office' ? `office${a.checkoutOfficeName ? `: ${a.checkoutOfficeName}` : ''}` : a.checkoutMode || 'no location'})
          </Text>
          {a.reviewReason ? <Text style={styles.body}>{a.reviewReason}</Text> : null}
          {actions('review', a._id)}
        </View>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4, marginBottom: 8 },
  empty: { color: colors.textSecondary, marginBottom: 12 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  body: { fontSize: 13, color: colors.textPrimary },
  row: { flexDirection: 'row', gap: 8 },
});

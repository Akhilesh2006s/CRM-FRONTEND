import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Alert, Linking, Text } from 'react-native';
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

type LocationRequest = {
  _id: string;
  employeeId: Person;
  schoolCode: string;
  schoolName?: string;
  latitude: number;
  longitude: number;
  createdAt: string;
};
type Kind = 'request' | 'review' | 'location';
const DECIDE_PATH: Record<Kind, (id: string) => string> = {
  request: (id) => `/field-day/permission/${id}/decide`,
  review: (id) => `/field-day/reviews/${id}/decide`,
  location: (id) => `/field-day/school-location/${id}/decide`,
};

const when = (v?: string) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

/** Field visit requests and office/field check-out reviews waiting for this reviewer (Admin: everyone's). */
export default function FieldApprovalsScreen() {
  const [requests, setRequests] = useState<FieldRequest[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [locations, setLocations] = useState<LocationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/field-day/approvals');
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
      setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
      setLocations(Array.isArray(data?.locations) ? data.locations : []);
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

  const decide = async (kind: Kind, id: string, decision: 'approve' | 'reject') => {
    const note = (remarks[id] || '').trim();
    if (decision === 'reject' && !note) {
      Alert.alert('Remarks needed', 'Enter the reason for rejecting.');
      return;
    }
    setBusy(`${id}-${decision}`);
    try {
      await apiService.put(DECIDE_PATH[kind](id), { decision, remarks: note });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save the decision');
    } finally {
      setBusy('');
    }
  };

  const actions = (kind: Kind, id: string) => (
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
      subtitle="Office-to-field requests, check-out reviews and school location updates."
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

      <SectionTitle>{`School location updates (${locations.length})`}</SectionTitle>
      {locations.length === 0 ? <EmptyState icon="✅" title="No location updates waiting" /> : null}
      {locations.map((l) => (
        <Card key={l._id}>
          <CardTitle title={l.schoolName || l.schoolCode} subtitle={l.schoolCode} badge="Pending" tone="warning" />
          <InfoRow label="Asked by" value={l.employeeId?.name || '—'} />
          <InfoRow label="Asked" value={when(l.createdAt)} />
          <InfoRow label="New location" value={`${Number(l.latitude).toFixed(6)}, ${Number(l.longitude).toFixed(6)}`} />
          <Text
            style={styles.link}
            onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`)}
          >
            Open in Google Maps
          </Text>
          <ActionRow>
            <View style={{ flex: 1 }}>{actions('location', l._id)}</View>
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
  link: { color: '#2563EB', fontWeight: '600', marginVertical: 6 },
});

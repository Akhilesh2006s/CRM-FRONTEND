import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, Badge } from '../../ui/Kit';
import { WebButton } from '../../ui/WebPrimitives';
import ScreenShell from '../../ui/ScreenShell';
import MessageBanner from '../../components/MessageBanner';
import { apiService } from '../../services/api';
import { claimTrip, type TripSummary } from '../../services/trip';

const rupees = (n: number) => `₹${(Number(n) || 0).toFixed(2)}`;
const when = (v?: string) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

/** GPS-tracked Bike / Car trips: distance, amount, and claiming them as travel expenses. */
export default function MyTripsScreen() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/trips/my');
      setTrips(Array.isArray(data) ? data : []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load trips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (trip: TripSummary) => {
    setClaiming(trip._id);
    try {
      await claimTrip(trip, trip.purpose || 'Work trip');
      Alert.alert('Expense raised', `${trip.distanceKm} km by ${trip.vehicle}: ${rupees(trip.amount)} sent for approval.`);
      await load();
    } catch (e: any) {
      Alert.alert('Could not claim', e?.response?.data?.message || e?.message || 'Try again');
    } finally {
      setClaiming('');
    }
  };

  const ended = trips.filter((t) => t.status === 'ended');
  const totalKm = ended.reduce((s, t) => s + (t.distanceKm || 0), 0);

  return (
    <ScreenShell
      title="My Trips"
      subtitle="GPS-tracked work trips, paid as travel expense."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      <Text style={styles.summary}>
        {ended.length} trip{ended.length === 1 ? '' : 's'} · {Math.round(totalKm * 100) / 100} km
      </Text>
      {!error && ended.length === 0 ? <EmptyState icon="🛵" title="No finished trips yet" /> : null}
      {ended.map((t) => (
        <Card key={t._id}>
          <CardTitle
            title={`${t.distanceKm} km · ${t.vehicle}`}
            subtitle={rupees(t.amount)}
            badge={t.expenseId ? 'Claimed' : undefined}
            tone="success"
          />
          <InfoRow label="Start" value={when(t.startedAt)} />
          <InfoRow label="End" value={when(t.endedAt)} />
          {t.fromPlace || t.toPlace ? <InfoRow label="Route" value={`${t.fromPlace || '?'} → ${t.toPlace || '?'}`} /> : null}
          <InfoRow label="Purpose" value={t.purpose} />
          {t.expenseId ? null : t.distanceKm > 0 ? (
            <ActionRow>
              <View style={{ flex: 1 }}>
                <WebButton
                  title="Claim as Travel Expense"
                  onPress={() => claim(t)}
                  loading={claiming === t._id}
                  disabled={!!claiming}
                />
              </View>
            </ActionRow>
          ) : (
            <Text style={styles.meta}>No distance recorded.</Text>
          )}
        </Card>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginBottom: 12 },
  meta: { fontSize: 13, color: colors.textTertiary, marginTop: 8 },
});

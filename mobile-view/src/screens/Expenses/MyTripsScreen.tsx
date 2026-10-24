import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { colors, radii } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import MessageBanner from '../../components/MessageBanner';
import TripCard from '../../components/TripCard';
import { apiService } from '../../services/api';
import { claimTrip, type TripSummary } from '../../services/trip';

const rupees = (n: number) => `₹${(Number(n) || 0).toFixed(2)}`;
const when = (v?: string) =>
  v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

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
      subtitle="Bike / Car work trips tracked by GPS. The km × per-km rate is paid as a travel expense."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <TripCard />
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      <Text style={styles.summary}>
        {ended.length} trip{ended.length === 1 ? '' : 's'} · {Math.round(totalKm * 100) / 100} km
      </Text>
      {!error && ended.length === 0 ? <Text style={styles.empty}>No finished trips yet.</Text> : null}
      {ended.map((t) => (
        <View key={t._id} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.name}>
              {t.distanceKm} km · {t.vehicle}
            </Text>
            <Text style={styles.amount}>{rupees(t.amount)}</Text>
          </View>
          <Text style={styles.meta}>
            {when(t.startedAt)} → {when(t.endedAt)}
          </Text>
          {t.fromPlace || t.toPlace ? (
            <Text style={styles.meta}>
              {t.fromPlace || '?'} → {t.toPlace || '?'}
            </Text>
          ) : null}
          {t.purpose ? <Text style={styles.meta}>{t.purpose}</Text> : null}
          {t.expenseId ? (
            <Text style={styles.claimed}>Claimed as expense</Text>
          ) : t.distanceKm > 0 ? (
            <TouchableOpacity style={styles.btn} onPress={() => claim(t)} disabled={!!claiming}>
              {claiming === t._id ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Claim as Travel Expense</Text>}
            </TouchableOpacity>
          ) : (
            <Text style={styles.meta}>No distance recorded.</Text>
          )}
        </View>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
  empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  amount: { fontSize: 15, fontWeight: '700', color: colors.primary },
  meta: { fontSize: 12, color: colors.textSecondary },
  claimed: { fontSize: 12, fontWeight: '600', color: colors.success },
  btn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '600' },
});

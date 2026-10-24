import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { navigateRoot } from '../navigation/navigationRef';
import {
  type TripSummary,
  type TripVehicle,
  cancelTrip,
  claimTrip,
  endTrip,
  resumeActiveTrip,
  startTrip,
  subscribeTrip,
} from '../services/trip';

const rupees = (n: number) => `₹${(Math.round(n * 100) / 100).toFixed(2)}`;

function elapsed(since: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
}

/** Dashboard card: Start Trip → live km while travelling → End Trip → claim as a travel expense. */
export default function TripCard() {
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [km, setKm] = useState(0);
  const [vehicle, setVehicle] = useState<TripVehicle>('Bike');
  const [purpose, setPurpose] = useState('');
  const [fromPlace, setFromPlace] = useState('');
  const [toPlace, setToPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState<TripSummary | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const unsub = subscribeTrip((t, live) => {
      setTrip(t);
      setKm(live);
    });
    void resumeActiveTrip();
    const timer = setInterval(() => tick((n) => n + 1), 30000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Trip', e?.response?.data?.message || e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const onStart = () =>
    run(async () => {
      if (!purpose.trim()) throw new Error('Enter the purpose of the trip (e.g. school visit).');
      setEnded(null);
      await startTrip(vehicle, purpose.trim(), fromPlace.trim());
    });

  const onEnd = () =>
    Alert.alert('End trip?', `You have travelled about ${km} km.`, [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'End Trip',
        onPress: () =>
          run(async () => {
            setEnded(await endTrip(toPlace.trim()));
            setToPlace('');
          }),
      },
    ]);

  const onCancel = () =>
    Alert.alert('Discard this trip?', 'The tracked distance will be deleted.', [
      { text: 'No', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => run(cancelTrip) },
    ]);

  const onClaim = () =>
    run(async () => {
      if (!ended) return;
      await claimTrip(ended, ended.purpose || 'Work trip');
      Alert.alert('Expense raised', `${ended.distanceKm} km by ${ended.vehicle}: ${rupees(ended.amount)} sent for approval.`);
      setEnded(null);
      setPurpose('');
      setFromPlace('');
    });

  if (trip) {
    const rate = trip.ratePerKm || 0;
    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>
            <Ionicons name={trip.vehicle === 'Bike' ? 'bicycle' : 'car'} size={16} /> Trip running
          </Text>
          <Text style={styles.live}>● Tracking</Text>
        </View>
        <Text style={styles.big}>{km} km</Text>
        <Text style={styles.meta}>
          {trip.vehicle} · {elapsed(trip.startedAt)}
          {rate ? ` · about ${rupees(km * rate)} at ₹${rate}/km` : ''}
        </Text>
        {trip.purpose ? <Text style={styles.meta}>{trip.purpose}</Text> : null}
        <Text style={styles.hint}>Keep the app open while travelling so every km is counted.</Text>
        <TextInput style={styles.input} value={toPlace} onChangeText={setToPlace} placeholder="Destination (optional)" />
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.danger, { flex: 1 }]} onPress={onEnd} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>End Trip</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.outline]} onPress={onCancel} disabled={busy}>
            <Text style={styles.outlineText}>Discard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (ended) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Trip finished</Text>
        <Text style={styles.big}>{ended.distanceKm} km</Text>
        <Text style={styles.meta}>
          You travelled {ended.distanceKm} km by {ended.vehicle}. Amount: {rupees(ended.amount)}
          {ended.ratePerKm ? ` (₹${ended.ratePerKm}/km)` : ''}.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={onClaim} disabled={busy || ended.distanceKm <= 0}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Claim as Travel Expense</Text>}
        </TouchableOpacity>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => setEnded(null)}>
            <Text style={styles.link}>Later</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateRoot('MyTrips')}>
            <Text style={styles.link}>My Trips</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Work trip</Text>
        <TouchableOpacity onPress={() => navigateRoot('MyTrips')}>
          <Text style={styles.link}>My Trips</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.meta}>Travelling by bike or car for work? Start a trip and the km is calculated from GPS.</Text>
      <View style={styles.row}>
        {(['Bike', 'Car'] as TripVehicle[]).map((v) => (
          <TouchableOpacity key={v} style={[styles.chip, vehicle === v && styles.chipOn]} onPress={() => setVehicle(v)}>
            <Text style={[styles.chipText, vehicle === v && styles.chipTextOn]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput style={styles.input} value={purpose} onChangeText={setPurpose} placeholder="Purpose * (e.g. visit to ABC School)" />
      <TextInput style={styles.input} value={fromPlace} onChangeText={setFromPlace} placeholder="Starting from (optional)" />
      <TouchableOpacity style={styles.btn} onPress={onStart} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Start Trip</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  live: { fontSize: 12, fontWeight: '600', color: colors.success },
  big: { fontSize: 32, fontWeight: '800', color: colors.primary },
  meta: { fontSize: 13, color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.textPrimary },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  danger: { backgroundColor: '#DC2626' },
  outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  outlineText: { color: colors.textPrimary, fontWeight: '600', fontSize: 15 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13, paddingVertical: 4 },
});

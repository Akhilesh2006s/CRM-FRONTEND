import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const timeLabel = (d: Date) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * A forgotten school check-out or End Day. The employee must enter the reason and the
 * actual exit time (on the same day, after the check-in) before it can be submitted.
 */
export default function MissedExitCard({
  title,
  startAt,
  onSubmit,
}: {
  title: string;
  /** Check-in time of the school visit / Start Day time. */
  startAt: string;
  onSubmit: (reason: string, exitTime: string) => Promise<void>;
}) {
  const start = new Date(startAt);
  const [exit, setExit] = useState<Date | null>(null);
  const [picking, setPicking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pickTime = (date?: Date) => {
    if (Platform.OS !== 'ios') setPicking(false);
    if (!date) return;
    // Same calendar day as the check-in; only the time is chosen.
    const next = new Date(start);
    next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    setExit(next);
  };

  const submit = async () => {
    setError('');
    if (reason.trim().length < 5) return setError('Enter the reason (at least 5 characters).');
    if (!exit) return setError('Select the actual exit time.');
    if (exit.getTime() < start.getTime()) return setError(`The exit time must be after ${timeLabel(start)}.`);
    if (exit.getTime() > Date.now()) return setError('The exit time cannot be in the future.');
    setBusy(true);
    try {
      await onSubmit(reason.trim(), exit.toISOString());
    } catch (e: any) {
      setError(e?.message || 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {dayLabel(start)} · checked in at {timeLabel(start)}
      </Text>
      <Text style={styles.label}>Reason *</Text>
      <TextInput
        style={styles.input}
        value={reason}
        onChangeText={setReason}
        placeholder="Why was the check-out missed?"
        placeholderTextColor="#9CA3AF"
        multiline
        maxLength={500}
      />
      <Text style={styles.label}>Actual exit time *</Text>
      <TouchableOpacity style={styles.input} onPress={() => setPicking(true)} accessibilityRole="button">
        <Text style={exit ? styles.value : styles.placeholder}>{exit ? timeLabel(exit) : 'Tap to select the time'}</Text>
      </TouchableOpacity>
      {picking ? (
        <View>
          <DateTimePicker
            value={exit || start}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => pickTime(date)}
          />
          {Platform.OS === 'ios' ? (
            <TouchableOpacity onPress={() => setPicking(false)}>
              <Text style={styles.link}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', padding: 14, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, minHeight: 44, color: '#111827', justifyContent: 'center' },
  value: { color: '#111827', fontSize: 15 },
  placeholder: { color: '#9CA3AF', fontSize: 15 },
  link: { color: '#2563EB', fontWeight: '600', textAlign: 'right', padding: 8 },
  error: { color: '#B91C1C', marginTop: 8 },
  button: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

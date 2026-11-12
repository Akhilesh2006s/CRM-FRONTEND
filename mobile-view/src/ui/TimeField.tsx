import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { time12 } from '../lib/pjp';

/** Time box showing 10:30 AM that opens the phone's clock. The value stays 'HH:MM'. */
export default function TimeField({ value, onChange }: { value?: string; onChange: (hhmm: string) => void }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'time',
      value: value || '',
      onChange: (e: any) => onChange(e.target.value || ''),
      style: { padding: 10, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 15, marginBottom: 12 },
    });
  }
  const [h, m] = String(value || '10:00').split(':').map(Number);
  const current = new Date();
  current.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
  return (
    <View>
      <TouchableOpacity style={styles.box} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Time">
        <Text style={[styles.text, !value && styles.placeholder]}>{value ? `Time: ${time12(value)}` : 'Time'}</Text>
        <Text>🕒</Text>
      </TouchableOpacity>
      {open ? (
        <DateTimePicker
          value={current}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, d) => {
            if (Platform.OS !== 'ios' || event.type === 'dismissed') setOpen(false);
            if (event.type === 'dismissed' || !d) return;
            onChange(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
            if (Platform.OS === 'ios') setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  text: { fontSize: 15, color: colors.textPrimary },
  placeholder: { color: colors.textMuted },
});

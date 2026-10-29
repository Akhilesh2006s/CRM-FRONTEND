import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radii } from '../theme/colors';
import { ymdToDmy } from '../utils/dateFormat';

/** Local calendar day as YYYY-MM-DD (toISOString would shift it to yesterday in IST). */
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Date box showing DD/MM/YYYY that opens the phone's calendar. The value stays
 * YYYY-MM-DD, so it replaces a text box where people typed "YYYY-MM-DD".
 */
export default function DateField({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  minimumDate,
  maximumDate,
  style,
}: {
  value?: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const shown = ymdToDmy(value);

  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value: value || '',
      'aria-label': placeholder,
      onChange: (e: any) => onChange(e.target.value || ''),
      style: { padding: 10, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 15, marginBottom: 12 },
    });
  }

  const current = /^\d{4}-\d{2}-\d{2}/.test(value || '') ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : new Date();
  return (
    <View style={style}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.box} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={placeholder}>
          <Text style={[styles.text, !shown && styles.placeholder]}>{shown ? `${placeholder.replace(/\s*\(.*\)$/, '')}: ${shown}` : placeholder}</Text>
          <Text>📅</Text>
        </TouchableOpacity>
        {shown ? (
          <TouchableOpacity onPress={() => onChange('')} accessibilityLabel="Clear date" style={styles.clear}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {open ? (
        <DateTimePicker
          value={current}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, d) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'dismissed') {
              setOpen(false);
              return;
            }
            if (d) onChange(toYmd(d));
            if (Platform.OS === 'ios') setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  text: { fontSize: 15, color: colors.textPrimary },
  placeholder: { color: colors.textMuted },
  clear: { paddingHorizontal: 8, paddingVertical: 8 },
  clearText: { color: colors.textSecondary, fontSize: 16 },
});

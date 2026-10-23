import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

/** Tickable row (checkbox + label) used by the Close Lead product config. */
export default function CheckRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
  style,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.disabled, style]}
      onPress={() => !disabled && onChange(!checked)}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, paddingRight: 8 },
  disabled: { opacity: 0.5 },
  box: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#94A3B8',
    borderRadius: 4,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontSize: 12, fontWeight: '700' },
  textWrap: { flexShrink: 1 },
  label: { fontSize: 13, color: colors.textPrimary },
  hint: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});

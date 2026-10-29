import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type TextInputProps,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { colors, radii, spacing } from '../theme/colors';

export function WebLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function WebInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.textMuted}
      style={[styles.input, props.style]}
    />
  );
}

export function WebButton({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
}) {
  const v =
    variant === 'outline'
      ? styles.btnOutline
      : variant === 'destructive'
        ? styles.btnDestructive
        : styles.btnPrimary;
  const t =
    variant === 'outline'
      ? styles.btnTextOutline
      : variant === 'destructive'
        ? styles.btnTextDestructive
        : styles.btnTextPrimary;
  return (
    <TouchableOpacity
      style={[styles.btn, v, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? <ActivityIndicator color={variant === 'outline' ? colors.primary : '#fff'} size="small" /> : <Text style={t}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function WebSelect({
  label,
  value,
  onValueChange,
  items = [],
  placeholder,
  disabled,
  compact,
}: {
  label?: string;
  value: string;
  onValueChange: (v: string) => void;
  items?: { label: string; value: string }[];
  placeholder?: string;
  disabled?: boolean;
  /** Tighter layout for data tables */
  compact?: boolean;
}) {
  const safeItems = items.filter((i) => String(i?.value ?? '').trim() !== '' && String(i?.label ?? '').trim() !== '');
  const pickerHeight = compact ? 34 : 48;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.selectWrap, compact && styles.selectWrapCompact]}>
        {label ? <WebLabel>{label}</WebLabel> : null}
        {React.createElement(
          'select',
          {
            value: value ?? '',
            disabled: !!disabled,
            onChange: (e: any) => onValueChange(e.target.value || ''),
            style: {
              width: '100%',
              padding: compact ? '6px 4px' : '10px 12px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: compact ? 12 : 15,
              backgroundColor: disabled ? '#F1F5F9' : '#FFFFFF',
              color: '#1E293B',
              marginBottom: 0,
              boxSizing: 'border-box',
              minHeight: pickerHeight,
            },
          },
          [
            React.createElement('option', { key: '__placeholder', value: '' }, placeholder || 'Select…'),
            ...safeItems.map((i) =>
              React.createElement('option', { key: String(i.value), value: i.value }, i.label)
            ),
          ]
        )}
      </View>
    );
  }

  return (
    <View style={[styles.selectWrap, compact && styles.selectWrapCompact]}>
      {label ? <WebLabel>{label}</WebLabel> : null}
      <View style={[styles.pickerBox, compact && styles.pickerBoxCompact, disabled && styles.pickerBoxDisabled]}>
        <Picker
          selectedValue={value || ''}
          onValueChange={(v) => onValueChange(v == null ? '' : String(v))}
          enabled={!disabled}
          mode={Platform.OS === 'android' ? 'dropdown' : undefined}
          // Explicit colours: on a phone in dark mode Android otherwise draws the picked value
          // white on this white box, and the options list dark.
          // No fixed height on Android: the native spinner clips the picked value when the phone's
          // font size is larger than default (e.g. "Sick Leave" cut off on the leave form).
          style={{ width: '100%', color: colors.textPrimary, ...(Platform.OS === 'android' ? {} : { height: pickerHeight }) }}
          dropdownIconColor={colors.textSecondary}
          {...(Platform.OS === 'ios' ? { itemStyle: { height: pickerHeight, fontSize: 15 } } : {})}
        >
          {/* Keep placeholder only when nothing selected — empty + selected items cause large Android gaps */}
          {!value ? (
            <Picker.Item label={placeholder || 'Select…'} value="" color={colors.textSecondary} style={{ backgroundColor: '#FFFFFF' }} />
          ) : null}
          {safeItems.map((i) => (
            <Picker.Item key={String(i.value)} label={String(i.label)} value={String(i.value)} color={colors.textPrimary} style={{ backgroundColor: '#FFFFFF' }} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHead}>
        {columns.map((c, i) => (
          <Text key={c} style={[styles.th, i === columns.length - 1 && styles.thRight]}>
            {c}
          </Text>
        ))}
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyRow}>No records.</Text>
      ) : (
        rows.map((row, ri) => (
          <View key={ri} style={styles.tr}>
            {row.map((cell, ci) => (
              <View key={ci} style={[styles.td, ci === row.length - 1 && styles.tdRight]}>
                {typeof cell === 'string' ? <Text style={styles.tdText}>{cell}</Text> : cell}
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnOutline: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border },
  btnDestructive: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.error },
  btnDisabled: { opacity: 0.5 },
  btnTextPrimary: { color: colors.primaryForeground, fontWeight: '600', fontSize: 14 },
  btnTextOutline: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  btnTextDestructive: { color: colors.error, fontWeight: '600', fontSize: 14 },
  selectWrap: { marginBottom: 12 },
  selectWrapCompact: { marginBottom: 0, width: '100%' },
  pickerBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.backgroundLight,
    overflow: 'hidden',
    justifyContent: 'center',
    minHeight: 48,
  },
  pickerBoxCompact: { minHeight: 34 },
  pickerBoxDisabled: { opacity: 0.6, backgroundColor: colors.backgroundMuted },
  table: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHead: { flexDirection: 'row', backgroundColor: colors.tableHeader, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { flex: 1, padding: 10, fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  thRight: { textAlign: 'right' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  td: { flex: 1, padding: 10, justifyContent: 'center' },
  tdRight: { alignItems: 'flex-end' },
  tdText: { fontSize: 14, color: colors.textPrimary },
  emptyRow: { padding: 16, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});

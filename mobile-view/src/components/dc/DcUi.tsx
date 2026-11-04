import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { WebButton } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';

/** True when every word of `query` appears somewhere in the given values (case-insensitive). */
export function matchesWords(query: string, values: any[]): boolean {
  const words = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = values.map((v) => String(v ?? '').toLowerCase()).join(' | ');
  return words.every((w) => text.includes(w));
}

/** One search box for list screens. */
export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder || 'Search…'}
      placeholderTextColor={colors.textMuted}
      style={ui.search}
      autoCorrect={false}
      clearButtonMode="while-editing"
    />
  );
}

/** A button that shares the row with its siblings inside an ActionRow. */
export function Act(props: React.ComponentProps<typeof WebButton>) {
  return (
    <View style={ui.act}>
      <WebButton {...props} />
    </View>
  );
}

/** Simple horizontal row for filter selects / date fields. */
export function FilterRow({ children }: { children: React.ReactNode }) {
  return <View style={ui.filterRow}>{children}</View>;
}

export function FilterCell({ children }: { children: React.ReactNode }) {
  return <View style={ui.filterCell}>{children}</View>;
}

export const ui = StyleSheet.create({
  search: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  act: { flexGrow: 1, flexBasis: 100 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterCell: { flexGrow: 1, flexBasis: 140 },
  muted: { fontSize: 13, color: colors.textTertiary },
  hint: { fontSize: 13, color: colors.textTertiary, marginBottom: 12, lineHeight: 18 },
  count: { fontSize: 13, color: colors.textTertiary, marginBottom: 8 },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';

/** Small helpers shared by the Reports and Training screens (presentation only). */

export type StatTone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
const TONE: Record<StatTone, string> = {
  blue: '#2563EB',
  green: '#15803D',
  amber: '#B45309',
  red: '#B91C1C',
  purple: '#7C3AED',
  slate: colors.textPrimary,
};

export type StatItem = { label: string; value: React.ReactNode; tone?: StatTone; onPress?: () => void; active?: boolean };

/** Neat 2-column grid of small stat cards: big number, small label. */
export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <View style={rk.grid}>
      {items.map((s) => {
        const body = (
          <>
            <Text style={[rk.statValue, { color: TONE[s.tone || 'slate'] }]} numberOfLines={1} adjustsFontSizeToFit>
              {typeof s.value === 'number' ? s.value.toLocaleString('en-IN') : s.value}
            </Text>
            <Text style={rk.statLabel} numberOfLines={2}>
              {s.label}
            </Text>
          </>
        );
        return s.onPress ? (
          <TouchableOpacity key={s.label} style={[rk.stat, s.active && rk.statActive]} onPress={s.onPress} activeOpacity={0.8}>
            {body}
          </TouchableOpacity>
        ) : (
          <View key={s.label} style={rk.stat}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** True when every word of the query appears somewhere in the given fields. */
export function matchesWords(query: string, fields: unknown[]): boolean {
  const words = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = fields
    .map((f) => (f === undefined || f === null ? '' : String(f)))
    .join(' ')
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

/** One-line muted helper / count text. */
export function Hint({ children }: { children: React.ReactNode }) {
  return <Text style={rk.hint}>{children}</Text>;
}

export const rk = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  stat: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statActive: { borderColor: colors.primary, backgroundColor: colors.accent },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  hint: { fontSize: 13, color: colors.textTertiary, marginBottom: 8 },
  /** Vertical gap between stacked filter controls. */
  stack: { gap: 8 },
  /** Two controls side by side. */
  row2: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 16,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  text: { fontSize: 14, color: colors.textPrimary },
  muted: { fontSize: 13, color: colors.textTertiary },
});

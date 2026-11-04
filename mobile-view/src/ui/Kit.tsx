import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, type ViewStyle, type StyleProp } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Simple building blocks for clean, consistent screens:
 * Card → Title / Badge → InfoRow lines → ChipRow (sections) → ActionRow (buttons).
 */

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[kit.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[kit.card, style]}>{children}</View>;
}

/** Card heading: title on the left, optional status badge on the right. */
export function CardTitle({ title, subtitle, badge, tone = 'info' }: { title: string; subtitle?: string; badge?: string; tone?: Tone }) {
  return (
    <View style={kit.titleRow}>
      <View style={{ flex: 1 }}>
        <Text style={kit.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={kit.subtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? <Badge label={badge} tone={tone} /> : null}
    </View>
  );
}

export type Tone = 'info' | 'success' | 'warning' | 'error' | 'neutral';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: '#DBEAFE', fg: '#1D4ED8' },
  success: { bg: '#DCFCE7', fg: '#15803D' },
  warning: { bg: '#FEF3C7', fg: '#B45309' },
  error: { bg: '#FEE2E2', fg: '#B91C1C' },
  neutral: { bg: '#F1F5F9', fg: '#475569' },
};

/** Picks a badge colour from a status word. */
export function toneFor(status?: string): Tone {
  const s = String(status || '').toLowerCase();
  if (/(approved|completed|complete|delivered|paid|active|closed won|won|done|success|verified)/.test(s)) return 'success';
  if (/(reject|cancel|fail|lost|overdue|inactive|error|declined)/.test(s)) return 'error';
  if (/(pending|waiting|await|hold|review|draft|requested|submitted|progress)/.test(s)) return 'warning';
  if (!s) return 'neutral';
  return 'info';
}

export function Badge({ label, tone }: { label: string; tone?: Tone }) {
  const t = TONES[tone || toneFor(label)];
  return (
    <View style={[kit.badge, { backgroundColor: t.bg }]}>
      <Text style={[kit.badgeText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** One "Label   Value" line. Phone numbers become tap-to-call. Hidden when the value is empty. */
export function InfoRow({ label, value, phone, bold }: { label: string; value?: React.ReactNode; phone?: boolean; bold?: boolean }) {
  if (value === undefined || value === null || (typeof value === 'string' && (value.trim() === '' || value.trim() === '-'))) return null;
  return (
    <View style={kit.row}>
      <Text style={kit.k}>{label}</Text>
      {phone && typeof value === 'string' ? (
        <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${value}`)}>
          <Text style={[kit.v, kit.phone]}>{value}</Text>
        </TouchableOpacity>
      ) : typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[kit.v, bold && kit.bold]}>{String(value)}</Text>
      ) : (
        <View style={{ flex: 1 }}>{value}</View>
      )}
    </View>
  );
}

/** Row of pill buttons, e.g. the sections of a school. */
export function ChipRow({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value?: string | null;
  onChange: (key: string) => void;
}) {
  return (
    <View style={kit.chipRow}>
      {items.map((c) => {
        const on = value === c.key;
        return (
          <TouchableOpacity key={c.key} style={[kit.chip, on && kit.chipOn]} onPress={() => onChange(c.key)} activeOpacity={0.8}>
            <Text style={[kit.chipText, on && kit.chipTextOn]}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Buttons at the bottom of a card, separated by a thin line. */
export function ActionRow({ children }: { children: React.ReactNode }) {
  return <View style={kit.actionRow}>{children}</View>;
}

export function EmptyState({ icon = '📭', title, message }: { icon?: string; title: string; message?: string }) {
  return (
    <View style={kit.empty}>
      <Text style={kit.emptyIcon}>{icon}</Text>
      <Text style={kit.emptyTitle}>{title}</Text>
      {message ? <Text style={kit.emptyMsg}>{message}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={kit.section}>{children}</Text>;
}

export const kit = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, maxWidth: 160 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', paddingVertical: 4, gap: 8 },
  k: { width: 110, fontSize: 13, color: colors.textTertiary },
  v: { flex: 1, fontSize: 14, color: colors.textPrimary },
  bold: { fontWeight: '700' },
  phone: { color: '#2563EB', textDecorationLine: 'underline' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E0F2FE' },
  chipOn: { backgroundColor: '#0284C7' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#0369A1' },
  chipTextOn: { color: '#FFFFFF' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  emptyMsg: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginTop: 4 },
  section: { fontSize: 13, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
});

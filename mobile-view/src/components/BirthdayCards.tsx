import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../services/api';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type MyBirthday = { date: string; isBirthday: boolean; name: string };
type BirthdayRow = {
  _id: string;
  name: string;
  empCode?: string;
  role?: string;
  department?: string;
  daysUntil: number;
  birthday: string;
  turningAge?: number | null;
};
type BirthdaysResponse = { date: string; days: number; today: BirthdayRow[]; upcoming: BirthdayRow[] };

const NON_EMPLOYEE_ROLES = ['Vendor', 'Partner', 'Franchise'];
const HR_BIRTHDAY_ROLES = ['HR Manager', 'HR Executive'];

/** Birthday wish on the signed-in employee's own dashboard (any role), on their birthday (India date). */
export function BirthdayWishCard({ role, style }: { role?: string; style?: StyleProp<ViewStyle> }) {
  const [wish, setWish] = useState<MyBirthday | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const allowed = !NON_EMPLOYEE_ROLES.includes(role || '');

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return undefined;
      let active = true;
      apiService
        .get('/employees/birthdays/me')
        .then((data: MyBirthday) => {
          if (active) setWish(data?.isBirthday ? data : null);
        })
        .catch(() => {
          if (active) setWish(null);
        });
      return () => {
        active = false;
      };
    }, [allowed]),
  );

  if (!wish || dismissedFor === wish.date) return null;
  return (
    <View style={[styles.wishCard, style]}>
      <Text style={styles.wishEmoji}>🎂</Text>
      <View style={styles.wishBody}>
        <Text style={styles.wishTitle}>Happy Birthday{wish.name ? `, ${wish.name}` : ''}! 🎉</Text>
        <Text style={styles.wishText}>Wishing you a wonderful year ahead from all of us at Viswam EduTech. Have a great day!</Text>
      </View>
      <TouchableOpacity onPress={() => setDismissedFor(wish.date)} accessibilityLabel="Dismiss birthday wish" style={styles.dismiss}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function whenText(days: number) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** HR dashboard: employees whose birthday is today and in the next 7 days (India date). */
export function EmployeeBirthdaysCard({ role }: { role?: string }) {
  const [data, setData] = useState<BirthdaysResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = HR_BIRTHDAY_ROLES.includes(role || '');

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return undefined;
      let active = true;
      apiService
        .get('/employees/birthdays?days=7')
        .then((res: BirthdaysResponse) => {
          if (active) {
            setData(res);
            setError(null);
          }
        })
        .catch((e: any) => {
          if (active) setError(e?.message || 'Could not load birthdays');
        });
      return () => {
        active = false;
      };
    }, [allowed]),
  );

  if (!allowed) return null;
  const renderRow = (row: BirthdayRow) => (
    <View key={row._id} style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>{row.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[row.empCode, row.role === 'Executive' ? 'BDE' : row.role, row.department].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.rowSide}>
        <Text style={styles.rowDate}>{row.birthday}</Text>
        <Text style={styles.rowMeta}>{row.daysUntil === 0 && row.turningAge ? `Turns ${row.turningAge}` : whenText(row.daysUntil)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>🎂 Birthdays</Text>
      {error ? <Text style={styles.empty}>{error}</Text> : null}
      {!error && !data ? <Text style={styles.empty}>Loading…</Text> : null}
      {data ? (
        <>
          <Text style={styles.subTitle}>Today</Text>
          {data.today.length ? data.today.map(renderRow) : <Text style={styles.empty}>No birthdays today.</Text>}
          <Text style={[styles.subTitle, { marginTop: 10 }]}>Next {data.days} days</Text>
          {data.upcoming.length ? data.upcoming.map(renderRow) : <Text style={styles.empty}>No upcoming birthdays.</Text>}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  wishEmoji: { fontSize: 34 },
  wishBody: { flex: 1 },
  wishTitle: { ...typography.label.large, color: colors.textPrimary, fontWeight: '700' },
  wishText: { ...typography.body.small, color: colors.textSecondary, marginTop: 2 },
  dismiss: { padding: 4 },
  dismissText: { color: colors.textMuted, fontSize: 16 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderColor: '#FBCFE8',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { ...typography.label.large, color: '#BE185D', fontWeight: '700', marginBottom: 8 },
  subTitle: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '600', marginBottom: 4 },
  empty: { ...typography.body.small, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowMain: { flex: 1 },
  rowName: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  rowMeta: { ...typography.body.small, color: colors.textMuted },
  rowSide: { alignItems: 'flex-end' },
  rowDate: { ...typography.body.medium, color: colors.textPrimary },
});

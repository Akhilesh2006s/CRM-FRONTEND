/**
 * Home page figures for the logged-in employee: revenue, clients, leads and payments
 * (total, old years' and this academic year's). GET /dashboard/my-summary.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../services/api';
import { colors } from '../theme/colors';

type Summary = {
  academicYear: string;
  revenue: number;
  clients: number;
  leads: number;
  payments: number;
  totalPayments: number;
  oldPayments: number;
  thisYearPayments: number;
};

const rupees = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function HomeSummaryCard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let live = true;
      apiService
        .get('/dashboard/my-summary')
        .then((d: Summary) => live && (setData(d), setError('')))
        .catch((e: any) => live && setError(e?.response?.data?.message || e?.message || 'Could not load'));
      return () => {
        live = false;
      };
    }, [])
  );

  const tiles: { label: string; value: string; color: string }[] = data
    ? [
        { label: `Revenue (${data.academicYear})`, value: rupees(data.revenue), color: '#0D9488' },
        { label: 'Clients', value: String(data.clients), color: '#2563EB' },
        { label: 'Leads', value: String(data.leads), color: '#EA580C' },
        { label: 'Payments', value: String(data.payments), color: '#7C3AED' },
        { label: 'Total Payments', value: rupees(data.totalPayments), color: '#16A34A' },
        { label: 'Old Payments', value: rupees(data.oldPayments), color: '#D97706' },
        { label: "This Year's Payments", value: rupees(data.thisYearPayments), color: '#0891B2' },
      ]
    : [];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>My Summary</Text>
      {!data && !error ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
      {error && !data ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.grid}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile}>
            <Text style={[styles.value, { color: t.color }]} numberOfLines={1} adjustsFontSizeToFit>
              {t.value}
            </Text>
            <Text style={styles.label}>{t.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F7', padding: 14, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48%', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 10 },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  error: { fontSize: 13, color: colors.error },
});

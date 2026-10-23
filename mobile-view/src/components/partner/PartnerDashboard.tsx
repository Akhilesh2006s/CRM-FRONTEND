/**
 * Vendor / Partner dashboard — mobile port of web components/dashboard/VendorDashboard.tsx.
 * Shows their products, stock and returns only. DCs are internal and never shown here.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type PartnerDashboardData = {
  summary?: { totalAssignedProducts?: number; totalReturns?: number };
  returnTrend?: { month: string; label: string; quantity: number }[];
};

type StockItem = {
  _id: string;
  productName: string;
  productCode?: string;
  availableQuantity: number;
  minStock?: number;
  isLowStock?: boolean;
};

const TONES = {
  indigo: { bg: '#EEF2FF', border: '#C7D2FE', fg: '#4338CA' },
  emerald: { bg: '#ECFDF5', border: '#A7F3D0', fg: '#047857' },
  amber: { bg: '#FFFBEB', border: '#FDE68A', fg: '#B45309' },
  rose: { bg: '#FFF1F2', border: '#FECDD3', fg: '#BE123C' },
} as const;

export default function PartnerDashboard({ userName, role }: { userName?: string; role?: string }) {
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [dashboard, stockRows] = await Promise.all([
        apiService.get('/partner-user/dashboard'),
        apiService.get('/partner-user/stocks').catch(() => []),
      ]);
      setData(dashboard || null);
      setStocks(Array.isArray(stockRows) ? stockRows : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lowStock = stocks.filter((s) => s.isLowStock);
  const cards: Array<{ label: string; value: number; ion: React.ComponentProps<typeof Ionicons>['name']; tone: keyof typeof TONES }> = [
    { label: 'Assigned Products', value: data?.summary?.totalAssignedProducts ?? 0, ion: 'cube-outline', tone: 'indigo' },
    {
      label: 'Units in Stock',
      value: stocks.reduce((sum, s) => sum + (Number(s.availableQuantity) || 0), 0),
      ion: 'albums-outline',
      tone: 'emerald',
    },
    { label: 'Low Stock Items', value: lowStock.length, ion: 'warning-outline', tone: 'amber' },
    { label: 'Total Returns', value: data?.summary?.totalReturns ?? 0, ion: 'refresh-outline', tone: 'rose' },
  ];
  const trend = data?.returnTrend || [];
  const maxTrend = Math.max(1, ...trend.map((t) => Number(t.quantity) || 0));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.userName}>{userName?.split(' ')[0] || 'Partner'}</Text>
        {role ? <Text style={styles.role}>{role}</Text> : null}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.panel}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.cards}>
            {cards.map((card) => {
              const t = TONES[card.tone];
              return (
                <View key={card.label} style={[styles.card, { backgroundColor: t.bg, borderColor: t.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardLabel, { color: t.fg }]}>{card.label.toUpperCase()}</Text>
                    <Text style={[styles.cardValue, { color: t.fg }]}>{card.value.toLocaleString('en-IN')}</Text>
                  </View>
                  <Ionicons name={card.ion} size={26} color={t.fg} style={{ opacity: 0.7 }} />
                </View>
              );
            })}
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Ionicons name="albums-outline" size={18} color="#059669" />
              <Text style={styles.panelTitle}>Stock of your products</Text>
            </View>
            {stocks.length === 0 ? (
              <Text style={styles.empty}>No stock records for your products yet.</Text>
            ) : (
              <>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2 }]}>Product</Text>
                  <Text style={[styles.th, styles.right]}>Available</Text>
                  <Text style={[styles.th, styles.right]}>Min Stock</Text>
                </View>
                {stocks.map((s) => (
                  <View key={s._id} style={[styles.tr, s.isLowStock && styles.trLow]}>
                    <View style={{ flex: 2, paddingRight: 6 }}>
                      <Text style={styles.product}>{s.productName}</Text>
                      <Text style={styles.code}>{s.productCode || '-'}</Text>
                    </View>
                    <Text style={[styles.td, styles.right, s.isLowStock && styles.lowText]}>{s.availableQuantity}</Text>
                    <Text style={[styles.td, styles.right, styles.muted]}>{s.minStock ?? 0}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          {trend.some((d) => d.quantity > 0) ? (
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <Ionicons name="refresh-outline" size={18} color="#E11D48" />
                <Text style={styles.panelTitle}>Return Trend</Text>
              </View>
              {trend.map((d) => {
                const pct = Math.max(2, Math.round(((Number(d.quantity) || 0) / maxTrend) * 100));
                return (
                  <View key={d.month || d.label} style={styles.barRow}>
                    <Text style={styles.barLabel}>{d.label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.barValue}>{d.quantity}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 56, paddingBottom: 32 },
  header: { marginBottom: 16 },
  greeting: { fontSize: 14, color: colors.textSecondary },
  userName: { ...typography.heading.h2, color: colors.textPrimary },
  role: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 4 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  card: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: '700' },
  panel: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  panelTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  empty: { fontSize: 13, color: colors.textSecondary },
  error: { color: colors.error, textAlign: 'center' },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6 },
  th: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  right: { textAlign: 'right' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  trLow: { backgroundColor: '#FFFBEB' },
  product: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  code: { fontSize: 11, color: colors.textTertiary },
  td: { flex: 1, fontSize: 14, color: colors.textPrimary },
  lowText: { color: '#B45309', fontWeight: '700' },
  muted: { color: colors.textSecondary },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { width: 64, fontSize: 12, color: colors.textSecondary },
  barTrack: { flex: 1, height: 10, backgroundColor: '#F1F5F9', borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#E11D48', borderRadius: 99 },
  barValue: { width: 40, textAlign: 'right', fontSize: 12, fontWeight: '600', color: colors.textPrimary },
});

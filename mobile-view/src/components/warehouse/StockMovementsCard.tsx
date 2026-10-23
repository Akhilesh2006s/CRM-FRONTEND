/**
 * Mobile port of web components/warehouse/StockMovementsCard.tsx.
 * Every automatic and manual stock change: DCs finalised by the warehouse take stock out,
 * returns accepted by the Warehouse Manager (sellable) put it back.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';

type MovementType = 'In' | 'Out' | 'Return' | 'Adjustment';

type Movement = {
  _id: string;
  at: string;
  type: MovementType;
  quantity: number;
  reason: string;
  product: string;
  series?: string;
  subject?: string;
  level?: string;
  stockNow?: number;
  by?: string;
};

const TYPE_META: Record<MovementType, { label: string; fg: string; bg: string; sign: string }> = {
  Out: { label: 'DC dispatched', fg: '#B91C1C', bg: '#FEE2E2', sign: '−' },
  Return: { label: 'Return accepted', fg: '#15803D', bg: '#DCFCE7', sign: '+' },
  In: { label: 'Stock in', fg: '#1D4ED8', bg: '#DBEAFE', sign: '+' },
  Adjustment: { label: 'Adjustment', fg: '#404040', bg: '#F5F5F5', sign: '±' },
};

const FILTERS: Array<{ value: '' | MovementType; label: string }> = [
  { value: '', label: 'All' },
  { value: 'Out', label: 'DC dispatched' },
  { value: 'Return', label: 'Returns accepted' },
  { value: 'In', label: 'Stock in' },
];

function fmtWhen(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function StockMovementsCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [type, setType] = useState<'' | MovementType>('');
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService
      .get(`/warehouse/stock-movements?limit=200${type ? `&type=${type}` : ''}`)
      .then((data: any) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, refreshKey]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Stock Movements</Text>
      <Text style={styles.hint}>
        Stock goes down automatically when the warehouse finalises a DC, and up when the Warehouse Manager accepts a sellable return.
      </Text>
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = type === f.value;
          return (
            <TouchableOpacity key={f.label} style={[styles.filterBtn, active && styles.filterBtnActive]} onPress={() => setType(f.value)}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: 16 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No stock movements yet.</Text>
      ) : (
        rows.map((m) => {
          const meta = TYPE_META[m.type] || TYPE_META.Adjustment;
          const detail = [m.series, m.subject, m.level].filter(Boolean).join(' · ');
          return (
            <View key={m._id} style={styles.row}>
              <View style={styles.rowTop}>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
                </View>
                <Text style={styles.when}>{fmtWhen(m.at)}</Text>
              </View>
              <View style={styles.rowMain}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.product}>{m.product}</Text>
                  {detail ? <Text style={styles.detail}>{detail}</Text> : null}
                </View>
                <View style={styles.qtyCol}>
                  <Text style={[styles.qty, { color: meta.fg }]}>
                    {meta.sign}
                    {m.quantity}
                  </Text>
                  <Text style={styles.stockNow}>Stock now: {m.stockNow ?? '-'}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {m.reason || '-'}
                {m.by ? ` · by ${m.by}` : ''}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 4, marginBottom: 10, lineHeight: 17 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  filterTextActive: { color: colors.primaryForeground },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 16, fontSize: 13 },
  row: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: 10 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  when: { fontSize: 11, color: colors.textTertiary },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start' },
  product: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  detail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  qtyCol: { alignItems: 'flex-end', marginLeft: 8 },
  qty: { fontSize: 16, fontWeight: '700' },
  stockNow: { fontSize: 11, color: colors.textTertiary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
});

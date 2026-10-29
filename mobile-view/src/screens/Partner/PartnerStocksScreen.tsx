import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell from '../../ui/ScreenShell';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type StockItem = { _id: string; productName: string; productCode?: string; availableQuantity?: number; reservedQuantity?: number; minStock?: number; status?: string; isLowStock?: boolean; lastUpdated?: string | null };
const qty = (value?: number) => Number(value || 0).toLocaleString('en-IN');

function Metric({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'sky' }) {
  return <View style={[styles.metric, styles[`metric${tone[0].toUpperCase()}${tone.slice(1)}` as keyof typeof styles] as any]}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>;
}

export default function PartnerStocksScreen() {
  const { user } = useAuth();
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const allowed = ['Partner', 'Vendor', 'Admin', 'Super Admin'].includes(user?.role || '');

  const load = async () => {
    try { const data = await apiService.get('/vendor-user/stocks'); setStocks(Array.isArray(data) ? data : []); }
    catch { setStocks([]); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { if (allowed) load(); else setLoading(false); }, [allowed]);

  const summary = useMemo(() => {
    const available = stocks.reduce((total, item) => total + (item.availableQuantity || 0), 0);
    const reserved = stocks.reduce((total, item) => total + (item.reservedQuantity || 0), 0);
    const low = stocks.filter((item) => item.isLowStock || item.status === 'Low Stock').length;
    const out = stocks.filter((item) => item.status === 'Out of Stock' || (item.availableQuantity || 0) === 0).length;
    return { available, reserved, low, out, products: stocks.length };
  }, [stocks]);
  const highest = Math.max(...stocks.map((stock) => stock.availableQuantity || 0), 1);

  if (!allowed) return <ScreenShell title="Stocks" loading={false}><View style={styles.accessDenied}><Text style={styles.accessTitle}>Vendor stock access</Text><Text style={styles.accessText}>Stocks are available for Partner, Vendor, Admin, and Super Admin accounts.</Text></View></ScreenShell>;

  return <ScreenShell title="Stocks" loading={loading && !refreshing} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <Text style={styles.subtitle}>{['Admin', 'Super Admin'].includes(user?.role || '') ? 'Current warehouse inventory for vendor products' : 'Current availability for your assigned products'}</Text>
      <View style={styles.metricsGrid}>
        <Metric label="Assigned Products" value={qty(summary.products)} tone="blue" /><Metric label="Available Stock" value={qty(summary.available)} tone="green" />
        <Metric label="Reserved Stock" value={qty(summary.reserved)} tone="purple" /><Metric label="Low Stock" value={qty(summary.low)} tone="yellow" />
        <Metric label="Out of Stock" value={qty(summary.out)} tone="red" /><Metric label="Available to Dispatch" value={qty(Math.max(0, summary.available - summary.reserved))} tone="sky" />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Stock Levels</Text><Text style={styles.panelSubtitle}>Available quantity by assigned product</Text>
        {stocks.length === 0 ? <Text style={styles.empty}>No stock data for your assigned products.</Text> : stocks.map((stock) => {
          const value = stock.availableQuantity || 0; const percent = Math.max(2, Math.min(100, (value / highest) * 100));
          return <View key={stock._id} style={styles.barItem}><View style={styles.barHeader}><Text style={styles.barLabel} numberOfLines={1}>{stock.productName}</Text><Text style={[styles.barValue, stock.isLowStock && styles.warningText]}>{qty(value)}</Text></View><View style={styles.barTrack}><View style={[styles.barFill, stock.isLowStock ? styles.barFillWarning : styles.barFillNormal, { width: `${percent}%` }]} /></View></View>;
        })}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Inventory Status</Text><Text style={styles.panelSubtitle}>At-a-glance stock health</Text>
        <View style={styles.statusRow}><StatusDot color="#16a34a" label="In Stock" value={stocks.filter((item) => !item.isLowStock && item.status !== 'Out of Stock' && (item.availableQuantity || 0) > 0).length} /></View>
        <View style={styles.statusRow}><StatusDot color="#d97706" label="Low Stock" value={summary.low} /></View>
        <View style={styles.statusRow}><StatusDot color="#dc2626" label="Out of Stock" value={summary.out} /></View>
      </View>

      <View style={styles.panel}><Text style={styles.panelTitle}>Active Alerts</Text>
        {summary.low === 0 && summary.out === 0 ? <Text style={styles.empty}>No active stock alerts.</Text> : stocks.filter((item) => item.isLowStock || item.status === 'Out of Stock' || (item.availableQuantity || 0) === 0).map((item) => <View key={item._id} style={styles.alert}><Text style={styles.alertTitle}>{item.productName}</Text><Text style={styles.alertText}>{item.status === 'Out of Stock' || (item.availableQuantity || 0) === 0 ? 'Out of stock — replenish this product.' : `Low stock: ${qty(item.availableQuantity)} available.`}</Text></View>)}
      </View>

      <Text style={styles.sectionTitle}>Product Stock Details</Text>
      {stocks.map((item) => <View key={item._id} style={[styles.stockCard, item.isLowStock && styles.stockCardLow]}><View style={styles.stockHeader}><View><Text style={styles.stockName}>{item.productName}</Text><Text style={styles.productCode}>{item.productCode || '—'}</Text></View><Text style={[styles.statusBadge, item.status === 'Out of Stock' && styles.statusOut, item.isLowStock && styles.statusLow]}>{item.status || 'In Stock'}</Text></View><View style={styles.stockDetails}><Detail label="Available" value={qty(item.availableQuantity)} /><Detail label="Reserved" value={qty(item.reservedQuantity)} /><Detail label="Minimum" value={qty(item.minStock)} /><Detail label="Last updated" value={item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'} /></View></View>)}
    </ScrollView>
  </ScreenShell>;
}

function StatusDot({ color, label, value }: { color: string; label: string; value: number }) { return <><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.statusLabel}>{label}</Text><Text style={styles.statusValue}>{value}</Text></>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  content: { flex: 1 }, contentContainer: { padding: 16, paddingBottom: 32 }, subtitle: { ...typography.body.medium, color: colors.textSecondary, marginBottom: 14 }, accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, accessTitle: { ...typography.heading.h3, color: colors.textPrimary }, accessText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }, metric: { width: '48%', padding: 13, borderRadius: 12, borderWidth: 1 }, metricBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }, metricGreen: { backgroundColor: '#ecfdf3', borderColor: '#bbf7d0' }, metricPurple: { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }, metricYellow: { backgroundColor: '#fffbeb', borderColor: '#fde68a' }, metricRed: { backgroundColor: '#fef2f2', borderColor: '#fecaca' }, metricSky: { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' }, metricLabel: { ...typography.label.small, color: colors.textSecondary }, metricValue: { ...typography.heading.h3, color: colors.textPrimary, marginTop: 3 },
  panel: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 14 }, panelTitle: { ...typography.heading.h3, color: colors.textPrimary }, panelSubtitle: { ...typography.label.small, color: colors.textSecondary, marginTop: 3, marginBottom: 12 }, empty: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', paddingVertical: 14 },
  barItem: { marginBottom: 12 }, barHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 }, barLabel: { ...typography.body.medium, color: colors.textPrimary, flex: 1 }, barValue: { ...typography.body.medium, color: colors.textSecondary, fontWeight: '700' }, warningText: { color: '#b45309' }, barTrack: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }, barFill: { height: '100%', borderRadius: 99 }, barFillNormal: { backgroundColor: '#14b8a6' }, barFillWarning: { backgroundColor: '#f59e0b' },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }, dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 }, statusLabel: { ...typography.body.medium, color: colors.textPrimary, flex: 1 }, statusValue: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '700' }, alert: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 }, alertTitle: { ...typography.body.medium, color: '#9a3412', fontWeight: '700' }, alertText: { ...typography.label.small, color: '#9a3412', marginTop: 3 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 10 }, stockCard: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 10 }, stockCardLow: { borderColor: '#fbbf24' }, stockHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }, stockName: { ...typography.heading.h3, color: colors.textPrimary }, productCode: { ...typography.label.small, color: colors.textSecondary, marginTop: 2 }, statusBadge: { ...typography.label.small, color: '#166534', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, overflow: 'hidden' }, statusLow: { color: '#92400e', backgroundColor: '#fef3c7' }, statusOut: { color: '#991b1b', backgroundColor: '#fee2e2' }, stockDetails: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 }, detail: { width: '50%', paddingVertical: 6 }, detailLabel: { ...typography.label.small, color: colors.textSecondary }, detailValue: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
});

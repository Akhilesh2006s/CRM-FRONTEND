import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle } from '../../ui/Kit';
import { StatGrid, matchesWords } from './ReportKit';
import { apiService } from '../../services/api';
import { downloadStockReport } from '../../utils/downloadStockReport';

interface StockItem {
  _id: string;
  productName: string;
  productCode?: string;
  category?: string;
  level?: string;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  unitPrice?: number;
  unit?: string;
  location?: string;
  status?: string;
}

function normalizeItem(item: StockItem): StockItem {
  return {
    ...item,
    currentStock: Number(item.currentStock) || 0,
    minStock: Number(item.minStock) || 0,
    maxStock: item.maxStock != null ? Number(item.maxStock) : undefined,
    unitPrice: Number(item.unitPrice) || 0,
    unit: item.unit || 'pcs',
    status: item.status || 'In Stock',
  };
}

export default function ReportsStockScreen() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadStocks();
  }, []);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  };

  const loadStocks = async () => {
    try {
      setLoading(true);
      const qs = buildQueryParams();
      const data = await apiService.get<any>(`/warehouse${qs ? `?${qs}` : ''}`);
      const entries = Array.isArray(data) ? data : data?.data || [];
      setItems(entries.map(normalizeItem));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load stock');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStocks();
  };

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort() as string[];
  }, [items]);

  const summary = useMemo(() => {
    const total = items.length;
    const inStock = items.filter((item) => item.status === 'In Stock').length;
    const lowStock = items.filter((item) => item.status === 'Low Stock').length;
    const outStock = items.filter((item) => item.status === 'Out of Stock').length;
    const totalQuantity = items.reduce((sum, item) => sum + (item.currentStock || 0), 0);
    const totalValue = items.reduce((sum, item) => sum + (item.currentStock || 0) * (item.unitPrice || 0), 0);
    return { total, inStock, lowStock, outStock, totalQuantity, totalValue };
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesSearch =
        !term ||
        matchesWords(term, [item.productName, item.productCode, item.category, item.level, item.location, item.status, item.unit]);
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [items, statusFilter, categoryFilter, search]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadStockReport(buildQueryParams());
    } catch (error: any) {
      Alert.alert('Export failed', error.message || 'Could not export stock report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenShell
      title="Stock Report"
      subtitle="View and manage warehouse inventory"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting}
          style={styles.exportBtn}
          activeOpacity={0.8}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color={colors.primary} />
              <Text style={styles.exportText}>Export to Excel</Text>
            </>
          )}
        </TouchableOpacity>
      }
    >
      <StatGrid
        items={[
          { label: 'Total Items', value: summary.total, tone: 'blue' },
          { label: 'In Stock', value: summary.inStock, tone: 'green' },
          { label: 'Low Stock', value: summary.lowStock, tone: 'amber' },
          { label: 'Out of Stock', value: summary.outStock, tone: 'red' },
          { label: 'Total Quantity', value: summary.totalQuantity.toLocaleString('en-IN'), tone: 'purple' },
          { label: 'Total Value', value: `₹${summary.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, tone: 'slate' },
        ]}
      />

      <PageSection title="Filters">
        <WebInput placeholder="Search product, code, category, location…" value={search} onChangeText={setSearch} />
        <View style={styles.filterRow}>
          <View style={styles.filterField}>
            <WebSelect
              label="Status"
              value={statusFilter}
              onValueChange={setStatusFilter}
              items={[
                { label: 'All Status', value: 'all' },
                { label: 'In Stock', value: 'In Stock' },
                { label: 'Low Stock', value: 'Low Stock' },
                { label: 'Out of Stock', value: 'Out of Stock' },
                { label: 'Discontinued', value: 'Discontinued' },
              ]}
            />
          </View>
          <View style={styles.filterField}>
            <WebSelect
              label="Category"
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              items={[
                { label: 'All Categories', value: 'all' },
                ...categories.map((cat) => ({ label: cat, value: cat })),
              ]}
            />
          </View>
        </View>
        <WebButton
          title={loading ? 'Searching…' : 'Search'}
          onPress={loadStocks}
          disabled={loading}
          loading={loading}
        />
      </PageSection>

      <SectionTitle>{`Stock items (${filtered.length})`}</SectionTitle>
      {filtered.length === 0 ? (
        <EmptyState icon="📦" title="No stock items found" />
      ) : (
        filtered.map((item) => (
          <Card key={item._id}>
            <CardTitle
              title={item.productName || '-'}
              subtitle={[item.productCode, item.category].filter(Boolean).join(' • ') || undefined}
              badge={item.status || '-'}
              tone={item.status === 'In Stock' ? 'success' : item.status === 'Low Stock' ? 'warning' : item.status === 'Out of Stock' ? 'error' : 'neutral'}
            />
            <InfoRow label="Stock" value={`${(item.currentStock || 0).toLocaleString('en-IN')} ${item.unit}`} bold />
            <InfoRow label="Min / Max" value={`${(item.minStock || 0).toLocaleString('en-IN')} / ${item.maxStock != null ? item.maxStock.toLocaleString('en-IN') : '-'}`} />
            <InfoRow label="Unit price" value={`₹${(item.unitPrice || 0).toLocaleString('en-IN')}`} />
            <InfoRow
              label="Value"
              value={`₹${((item.currentStock || 0) * (item.unitPrice || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            />
            <InfoRow label="Location" value={item.location} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterField: { flex: 1 },
});

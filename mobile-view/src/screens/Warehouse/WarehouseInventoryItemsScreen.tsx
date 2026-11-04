import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

type WarehouseItem = {
  _id: string;
  productName?: string;
  category?: string;
  level?: string;
  location?: string;
  specs?: string;
  subject?: string;
  itemType?: string;
  supplier?: string;
  currentStock?: number;
};

function cell(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

export default function WarehouseInventoryItemsScreen({ navigation }: any) {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/warehouse');
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load inventory items');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items.filter((it) => {
      const text = [it.productName, it.category, it.level || it.location, it.specs, it.subject, it.itemType || it.supplier, it.currentStock]
        .map((v) => (v === undefined || v === null ? '' : String(v)))
        .join(' ')
        .toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [items, query]);

  return (
    <ScreenShell
      title="Inventory List"
      subtitle="Warehouse • Products"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <TouchableOpacity
          onPress={() => navigation.navigate('WarehouseInventoryItemNew')}
          style={styles.addBtn}
          hitSlop={8}
          accessibilityLabel="Add new item"
        >
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      }
    >
      <WebInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search product, category, level, vendor…"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
      />

      {filtered.length === 0 ? (
        <EmptyState icon="📦" title="No inventory items found" />
      ) : (
        filtered.map((item, idx) => (
          <Card key={item._id} onPress={() => navigation.navigate('WarehouseInventoryItemEdit', { id: item._id })}>
            <CardTitle
              title={`#${idx + 1} ${item.productName || 'N/A'}`}
              badge={`Qty ${item.currentStock !== undefined && item.currentStock !== null ? String(item.currentStock) : '0'}`}
              tone={Number(item.currentStock) > 0 ? 'success' : 'neutral'}
            />
            <InfoRow label="Category" value={cell(item.category)} />
            <InfoRow label="Level" value={cell(item.level || item.location)} />
            <InfoRow label="Specs" value={cell(item.specs)} />
            <InfoRow label="Subject" value={cell(item.subject)} />
            <InfoRow label="Vendor" value={cell(item.itemType || item.supplier)} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  addBtn: { padding: 4 },
  search: { marginBottom: 12 },
});

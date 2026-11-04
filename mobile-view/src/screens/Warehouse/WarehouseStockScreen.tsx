import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StockMovementsCard from '../../components/warehouse/StockMovementsCard';

function cell(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

export default function WarehouseStockScreen({ navigation }: any) {
  const { user } = useAuth();
  const isWarehouseExecutive = user?.role === 'Warehouse Executive';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('');
  const [batchLot, setBatchLot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [movementsKey, setMovementsKey] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/warehouse');
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load stock');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setMovementsKey((k) => k + 1);
    loadData();
  };

  const openAddQty = (item: any) => {
    setSelectedItem(item);
    setQuantity('');
    setBatchLot('');
    setModalVisible(true);
  };

  const submitAddQty = async () => {
    if (!selectedItem) return;
    const amount = parseFloat(quantity);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Enter a valid quantity');
      return;
    }

    if (isWarehouseExecutive && !batchLot.trim()) {
      Alert.alert('Error', 'Batch / lot number is required');
      return;
    }

    setSubmitting(true);
    try {
      if (isWarehouseExecutive) {
        await apiService.post('/warehouse/stock-requests', {
          productId: selectedItem._id,
          productName: selectedItem.productName,
          category: selectedItem.category,
          level: selectedItem.level,
          specs: selectedItem.specs,
          subject: selectedItem.subject,
          supplier: selectedItem.supplier || selectedItem.vendor,
          quantity: amount,
          batchLot: batchLot.trim(),
          unit: selectedItem.unit || 'pcs',
          location: selectedItem.location || 'Main Warehouse',
          stockDate: new Date().toISOString(),
        });
        Alert.alert('Submitted', 'Pending Manager Approval. Stock is added only after the Warehouse Manager approves it.');
      } else {
        await apiService.post('/warehouse/stock', {
          productId: selectedItem._id,
          quantity: amount,
          movementType: 'In',
          reason: 'Manual add',
        });
        Alert.alert('Success', 'Quantity added successfully');
        setMovementsKey((k) => k + 1);
        loadData();
      }
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add quantity');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items.filter((i) => {
      const text = [i.productName, i.category, i.level, i.specs, i.subject, i.location, i.currentStock]
        .filter((v) => v !== undefined && v !== null)
        .join(' ')
        .toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [items, search]);

  return (
    <ScreenShell title="Inventory Qty List" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      <WebInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search product, category, level, specs, subject…"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {filtered.length === 0 ? (
        <EmptyState icon="📦" title="No items found" />
      ) : (
        filtered.map((item, idx) => (
          <Card key={item._id}>
            <CardTitle
              title={`#${idx + 1} ${item.productName || '-'}`}
              badge={`Qty ${item.currentStock ?? 0}`}
              tone={Number(item.currentStock) > 0 ? 'success' : 'neutral'}
            />
            <InfoRow label="Category" value={cell(item.category)} />
            <InfoRow label="Level" value={cell(item.level || item.location)} />
            <InfoRow label="Specs" value={cell(item.specs)} />
            <InfoRow label="Subject" value={cell(item.subject)} />
            <ActionRow>
              <WebButton title="Add Item Qty" variant="outline" onPress={() => openAddQty(item)} />
            </ActionRow>
          </Card>
        ))
      )}

      <StockMovementsCard refreshKey={movementsKey} />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Item Qty</Text>
            <Text style={styles.modalSubtitle}>{selectedItem?.productName || 'Item'}</Text>
            <WebLabel>Quantity *</WebLabel>
            <WebInput value={quantity} onChangeText={setQuantity} placeholder="Enter quantity" keyboardType="decimal-pad" />
            {isWarehouseExecutive ? (
              <>
                <WebLabel>Batch / Lot *</WebLabel>
                <WebInput value={batchLot} onChangeText={setBatchLot} placeholder="Batch / lot number" />
                <Text style={styles.helper}>Stock is added after Warehouse Manager approval.</Text>
              </>
            ) : null}
            <View style={styles.modalButtons}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setModalVisible(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <WebButton title="Add" onPress={submitAddQty} loading={submitting} disabled={submitting} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: 12 },
  helper: { fontSize: 13, color: colors.textTertiary, marginTop: -6, marginBottom: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
});

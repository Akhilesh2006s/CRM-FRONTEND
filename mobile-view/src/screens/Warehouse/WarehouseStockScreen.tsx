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
import { WebInput } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.productName, i.category, i.level, i.specs, i.subject, i.location]
        .filter(Boolean)
        .some((v) => v!.toString().toLowerCase().includes(q)),
    );
  }, [items, search]);

  return (
    <ScreenShell
      title="Inventory Qty List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.searchSection}>
        <Text style={styles.searchLabel}>Search</Text>
        <WebInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by product, category, level, specs, subject"
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found.</Text>
          </View>
        ) : (
          filtered.map((item, idx) => (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.serial}>#{idx + 1}</Text>
                <Text style={styles.productName}>{item.productName || '-'}</Text>
                <Text style={styles.qtyLabel}>
                  Available Qty:{' '}
                  <Text style={styles.qtyValue}>{item.currentStock ?? 0}</Text>
                </Text>
              </View>

              <View style={styles.grid}>
                <InfoCell label="Product Category" value={cell(item.category)} />
                <InfoCell label="Level" value={cell(item.level || item.location)} />
                <InfoCell label="Specs" value={cell(item.specs)} />
                <InfoCell label="Subject" value={cell(item.subject)} />
              </View>

              <TouchableOpacity style={styles.addQtyButton} onPress={() => openAddQty(item)}>
                <Text style={styles.addQtyButtonText}>Add Item Qty</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Item Qty</Text>
            <Text style={styles.modalSubtitle}>{selectedItem?.productName || 'Item'}</Text>
            <WebInput
              style={styles.modalInput}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Enter quantity"
              keyboardType="decimal-pad"
            />
            {isWarehouseExecutive ? (
              <WebInput
                style={styles.modalInput}
                value={batchLot}
                onChangeText={setBatchLot}
                placeholder="Batch / lot number"
              />
            ) : null}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, submitting && styles.modalSubmitButtonDisabled]}
                onPress={submitAddQty}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textLight} />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  searchLabel: { ...typography.label.medium, color: colors.textPrimary },
  searchInput: {
    ...typography.body.medium,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
  },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  emptyContainer: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: { marginBottom: 12 },
  serial: { ...typography.label.small, color: colors.textSecondary, marginBottom: 4 },
  productName: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 4 },
  qtyLabel: { ...typography.body.small, color: colors.textSecondary },
  qtyValue: { fontWeight: '700', color: colors.textPrimary },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  infoCell: { width: '47%' },
  infoLabel: { ...typography.label.small, color: colors.textSecondary, marginBottom: 2 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary },
  addQtyButton: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  addQtyButtonText: { ...typography.label.medium, color: '#FFFFFF', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { ...typography.heading.h2, color: colors.textPrimary, marginBottom: 8 },
  modalSubtitle: { ...typography.body.medium, color: colors.textSecondary, marginBottom: 20 },
  modalInput: {
    ...typography.body.medium,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
  },
  modalCancelButtonText: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '600' },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: { opacity: 0.6 },
  modalSubmitButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
});

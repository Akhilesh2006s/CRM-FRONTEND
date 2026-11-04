import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function WarehouseStockAddScreen({ navigation }: any) {
  const { user } = useAuth();
  const isWarehouseExecutive = user?.role === 'Warehouse Executive';
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('');
  const [batchLot, setBatchLot] = useState('');
  const [reason, setReason] = useState('Manual add');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/warehouse');
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem) {
      Alert.alert('Error', 'Please select an item');
      return;
    }
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
          notes: reason,
        });
        Alert.alert('Submitted', 'Pending Manager Approval', [
          { text: 'OK', onPress: () => navigation.navigate('WarehouseStockApprovals') },
        ]);
      } else {
        await apiService.post('/warehouse/stock', {
          productId: selectedItem._id,
          quantity: amount,
          movementType: 'In',
          reason: reason || 'Manual add',
        });
        Alert.alert('Success', 'Quantity added successfully', [
          { text: 'OK', onPress: () => navigation.navigate('WarehouseStock') },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add quantity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title="Add Item Qty" loading={loading}>
      <PageSection title="Item">
        <WebSelect
          label="Select Item *"
          value={selectedItem?._id || ''}
          onValueChange={(v) => setSelectedItem(items.find((i) => i._id === v) || null)}
          items={items.map((item) => ({ value: item._id, label: `${item.productName || 'N/A'} - Stock: ${item.currentStock || 0}` }))}
          placeholder="Select an item"
        />
        {selectedItem ? <Text style={styles.helper}>Current stock: {selectedItem.currentStock || 0}</Text> : null}
      </PageSection>
      <PageSection title="Quantity">
        <FormField label="Quantity *" value={quantity} onChangeText={setQuantity} placeholder="Enter quantity" keyboardType="decimal-pad" />
        {isWarehouseExecutive ? (
          <FormField label="Batch / Lot *" value={batchLot} onChangeText={setBatchLot} placeholder="Batch or lot number" />
        ) : null}
        <FormField label="Reason" value={reason} onChangeText={setReason} placeholder="Enter reason" />
        {isWarehouseExecutive ? <Text style={styles.helper}>Goes to the Warehouse Manager for approval.</Text> : null}
      </PageSection>
      <WebButton
        title={isWarehouseExecutive ? 'Submit for Approval' : 'Add Quantity'}
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
      />
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: any }) {
  return (
    <View>
      <WebLabel>{label}</WebLabel>
      <WebInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} />
    </View>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 13, color: colors.textTertiary, marginTop: -4 },
});

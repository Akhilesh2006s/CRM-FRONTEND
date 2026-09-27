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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading items...</Text>
      </View>
    );
  }

  return (
    <ScreenShell
      title="Add Item Qty"
      loading={loading}
    >
<ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Select Item *</Text>
          <ScrollView style={styles.optionsContainer}>
            {items.map((item) => (
              <TouchableOpacity
                key={item._id}
                style={[styles.option, selectedItem?._id === item._id && styles.optionSelected]}
                onPress={() => setSelectedItem(item)}
              >
                <Text style={[styles.optionText, selectedItem?._id === item._id && styles.optionTextSelected]}>
                  {item.productName || 'N/A'} - Stock: {item.currentStock || 0}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <FormField label="Quantity *" value={quantity} onChangeText={setQuantity} placeholder="Enter quantity" keyboardType="decimal-pad" />
        {isWarehouseExecutive ? (
          <FormField label="Batch / Lot *" value={batchLot} onChangeText={setBatchLot} placeholder="Batch or lot number" />
        ) : null}
        <FormField label="Reason" value={reason} onChangeText={setReason} placeholder="Enter reason" />
        <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
          </TouchableOpacity>
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary },
  optionsContainer: { maxHeight: 300 },
  option: { padding: 12, marginBottom: 8, backgroundColor: colors.backgroundLight, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  optionSelected: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  optionText: { ...typography.body.medium, color: colors.textPrimary },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  submitButton: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
});



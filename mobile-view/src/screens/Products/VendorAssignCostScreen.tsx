import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import { EmptyState } from '../../ui/Kit';
import { colors } from '../../theme/colors';

export default function VendorAssignCostScreen({ route }: any) {
  const { id: partnerId } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/products/active');
        setProducts(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const assignments = products
        .filter((p) => costs[p._id])
        .map((p) => ({ productId: p._id, cost: Number(costs[p._id]) }));
      await apiService.put(`/partners/${partnerId}/products`, { products: assignments });
      Alert.alert('Saved', 'Product costs updated');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell title="Vendor Assign Cost" subtitle="Assign costs per product" loading={loading}>
      <PageSection title="Product costs">
        {products.length === 0 ? (
          <EmptyState icon="📦" title="No active products" />
        ) : (
          products.map((item) => (
            <View key={item._id} style={styles.row}>
              <Text style={styles.name}>{item.productName || item.name}</Text>
              <WebInput
                style={styles.costInput}
                placeholder="Cost"
                keyboardType="decimal-pad"
                value={costs[item._id] || ''}
                onChangeText={(v) => setCosts((c) => ({ ...c, [item._id]: v }))}
              />
            </View>
          ))
        )}
      </PageSection>
      <WebButton title="Save assignments" onPress={save} loading={saving} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  name: { flex: 1, fontSize: 15, color: colors.textPrimary },
  costInput: { width: 110, marginBottom: 0, marginVertical: 6, minHeight: 44, paddingVertical: 8 },
});

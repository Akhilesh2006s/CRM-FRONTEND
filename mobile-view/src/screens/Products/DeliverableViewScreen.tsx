import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { navigateRoot } from '../../navigation/navigationRef';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, EmptyState } from '../../ui/Kit';
import { WebButton } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';

export default function DeliverableViewScreen({ route }: any) {
  const { productId, productName: nameParam } = route.params || {};
  const [productName, setProductName] = useState(nameParam || '');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!productId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [product, data] = await Promise.all([
        apiService.get(`/products/${productId}`).catch(() => null),
        apiService.get(`/deliverables/by-product/${productId}`),
      ]);
      if (product?.productName) setProductName(product.productName);
      setItems(Array.isArray(data) ? data : data?.deliverables || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScreenShell title="Deliverables" subtitle={productName} loading={loading}>
      <WebButton
        title="+ Add deliverable"
        onPress={() => navigateRoot('DeliverableAdd', { productId, productName })}
      />
      <View style={{ height: 12 }} />
      {items.length === 0 ? (
        <EmptyState icon="📦" title="No deliverables mapped" />
      ) : (
        items.map((item, idx) => (
          <Card key={item._id || String(idx)}>
            <CardTitle title={item.deliverableName || item.name || '—'} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { Card, CardTitle, ActionRow, EmptyState } from '../../ui/Kit';
import { navigateRoot } from '../../navigation/navigationRef';

export default function DeliverablesListScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/products');
        const list = Array.isArray(data) ? data : data?.data || [];
        setProducts(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScreenShell title="Deliverables List" subtitle="Product deliverables" loading={loading}>
      {products.length === 0 ? (
        <EmptyState icon="📦" title="No products found" />
      ) : (
        products.map((item) => (
          <Card key={String(item._id)}>
            <CardTitle title={item.productName || '—'} />
            <ActionRow>
              <WebButton
                title="View deliverables"
                variant="outline"
                onPress={() =>
                  navigateRoot('DeliverableView', {
                    productId: item._id,
                    productName: item.productName,
                  })
                }
              />
              <WebButton
                title="+ Add deliverable"
                variant="outline"
                onPress={() =>
                  navigateRoot('DeliverableAdd', {
                    productId: item._id,
                    productName: item.productName,
                  })
                }
              />
            </ActionRow>
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

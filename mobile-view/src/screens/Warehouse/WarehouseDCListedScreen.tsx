import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ChipRow, EmptyState, toneFor } from '../../ui/Kit';
import { apiService } from '../../services/api';

export default function WarehouseDCListedScreen({ navigation }: any) {
  const [dcs, setDcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'dc_accepted' | 'dc_completed' | 'dc_on_hold'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      let endpoint = '/dc-orders';
      if (filter !== 'all') {
        endpoint += `?status=${filter}`;
      }
      const data = await apiService.get(endpoint);
      setDcs(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load DCs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const statusLabel = (status?: string) =>
    status === 'dc_completed' ? 'Completed' : status === 'dc_accepted' ? 'Accepted' : status === 'dc_on_hold' ? 'On Hold' : status || 'Pending';

  return (
    <ScreenShell title="DC Listed" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      <ChipRow
        items={(['all', 'dc_accepted', 'dc_completed', 'dc_on_hold'] as const).map((k) => ({
          key: k,
          label: k === 'all' ? 'All' : statusLabel(k),
        }))}
        value={filter}
        onChange={(k) => setFilter(k as typeof filter)}
      />
      <View style={styles.list}>
        {dcs.length === 0 ? (
          <EmptyState icon="📋" title="No DCs found" />
        ) : (
          dcs.map((dc) => (
            <Card key={dc._id} onPress={() => navigation.navigate('WarehouseDCAtWarehouseDetail', { id: dc._id })}>
              <CardTitle
                title={dc.customerName || dc.saleId?.customerName || 'N/A'}
                badge={statusLabel(dc.status)}
                tone={toneFor(statusLabel(dc.status))}
              />
              <InfoRow label="Product" value={dc.product || dc.saleId?.product || '-'} />
              <InfoRow label="Quantity" value={String(dc.requestedQuantity || dc.saleId?.quantity || '-')} />
              {dc.dcDate ? <InfoRow label="DC Date" value={formatDate(dc.dcDate)} /> : null}
            </Card>
          ))
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 12 },
});

import React, { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton, DataTable } from '../../ui/WebPrimitives';

export default function DCPendingScreen({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/dc?status=pending_dc');
      const data = Array.isArray(response) ? response : (response?.data || []);
      const pendingOnly = (data as any[]).filter((d: any) => d.status === 'pending_dc');
      setItems(pendingOnly);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load pending DCs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <ScreenShell
      title="Pending DC"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <PageSection title="Pending delivery challans">
        <DataTable
          columns={['School', 'Status', '']}
          rows={items.map((item) => [
            item.customerName || item.dcOrderId?.school_name || 'N/A',
            item.status || 'Pending',
            <WebButton
              key={item._id}
              title="Open"
              onPress={() => navigation.navigate('DCPendingOpen', { dcId: item._id })}
            />,
          ])}
        />
      </PageSection>
    </ScreenShell>
  );
}

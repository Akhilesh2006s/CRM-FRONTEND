import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { uniqueProductNames } from '../../lib/crm/productNames';

export default function WarehouseDCAtWarehouseScreen({ navigation }: any) {
  const [dcs, setDcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Only DCs with status sent_to_manager appear here; once processed (completed) or on hold they disappear
      const data = await apiService.get('/dc/pending-warehouse');
      const arr = Array.isArray(data) ? data : (data?.data ?? []);
      setDcs(arr as any[]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load DCs at warehouse');
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const stageLabel = (stage?: string) =>
    stage === 'awaiting_receipt'
      ? 'Incoming'
      : stage === 'accepted'
        ? 'Action Required'
        : stage === 'pending_approval'
          ? 'Pending Approval'
          : stage === 'returned'
            ? 'Returned'
            : 'At Warehouse';

  return (
    <ScreenShell title="DC At Warehouse" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      {dcs.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No DCs at Warehouse"
          message="All delivery challans have been processed or there are no pending orders"
        />
      ) : (
        dcs.map((dc) => {
          const label = stageLabel(dc.warehouseStage);
          const open = () => navigation.navigate('WarehouseDCAtWarehouseDetail', { id: dc._id });
          const qty =
            (Array.isArray(dc.productDetails) && dc.productDetails.length
              ? dc.productDetails.reduce((sum: number, p: any) => sum + Math.max(Number(p.quantity) || 0, Number(p.strength) || 0), 0)
              : 0) || dc.requestedQuantity || dc.saleId?.quantity || '0';
          const requested = dc.managerRequestedAt || dc.sentToManagerAt || dc.createdAt;
          return (
            <Card key={dc._id} onPress={open}>
              <CardTitle
                title={dc.customerName || dc.dcOrderId?.school_name || dc.saleId?.customerName || 'Unknown Customer'}
                subtitle={dc.dcOrderId?.zone || dc.zone || undefined}
                badge={label}
                tone={label === 'Action Required' ? 'warning' : label === 'Returned' ? 'error' : 'info'}
              />
              <InfoRow label="Product" value={uniqueProductNames(dc.productDetails).join(', ') || dc.product || dc.saleId?.product || 'N/A'} />
              <InfoRow label="Quantity" value={String(qty)} />
              {requested ? <InfoRow label="Requested on" value={formatDate(requested)} /> : null}
              <ActionRow>
                <WebButton title="Update & Submit" onPress={open} />
              </ActionRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

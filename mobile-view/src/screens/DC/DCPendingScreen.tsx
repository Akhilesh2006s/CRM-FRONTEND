import React, { useState, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { Act } from '../../components/dc/DcUi';

function lineQty(p: any): number {
  for (const raw of [p?.quantity, p?.strength, p?.qty]) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function productsSummary(dc: any): string {
  const details = Array.isArray(dc?.productDetails) ? dc.productDetails : [];
  if (details.length > 0) {
    return details
      .map((p: any) => {
        const name = p.product || p.productName || p.product_name || 'Product';
        return `${name} - ${lineQty(p)}`;
      })
      .join(', ');
  }
  if (dc?.product && dc?.requestedQuantity) {
    return `${dc.product} - ${dc.requestedQuantity}`;
  }
  return '-';
}

function totalQty(dc: any): number | string {
  if (Number(dc?.requestedQuantity) > 0) return Number(dc.requestedQuantity);
  const details = Array.isArray(dc?.productDetails) ? dc.productDetails : [];
  if (details.length > 0) {
    const sum = details.reduce((s: number, p: any) => s + lineQty(p), 0);
    return sum > 0 ? sum : '-';
  }
  return '-';
}

function getDCNumber(dc: any): string {
  if (dc?.createdAt) {
    const year = new Date(dc.createdAt).getFullYear();
    const shortYear = year.toString().slice(-2);
    const nextYear = (year + 1).toString().slice(-2);
    const dcId = String(dc._id || '').slice(-4);
    return `${shortYear}-${nextYear}/${dcId}`;
  }
  return `DC-${String(dc?._id || '').slice(-6)}`;
}

function getSchoolCode(dc: any): string {
  const order = dc?.dcOrderId;
  if (order && typeof order === 'object') {
    const code = String(order.school_code || order.dc_code || '').trim();
    return code || '-';
  }
  return '-';
}

function getCustomerName(dc: any): string {
  return (
    dc?.customerName ||
    dc?.saleId?.customerName ||
    (typeof dc?.dcOrderId === 'object' ? dc.dcOrderId?.school_name : '') ||
    '-'
  );
}

function getCustomerPhone(dc: any): string {
  return (
    dc?.customerPhone ||
    (typeof dc?.dcOrderId === 'object' ? dc.dcOrderId?.contact_mobile : '') ||
    '-'
  );
}

export default function DCPendingScreen({ navigation }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/dc?status=pending_dc');
      const data = Array.isArray(response) ? response : response?.data || [];
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
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openDC = (dcId: string) => {
    navigation.navigate('DCPendingOpen', { dcId });
  };

  return (
    <ScreenShell
      title="Pending DC List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {items.length === 0 && !loading ? (
        <EmptyState title="No pending DCs" message="New DC requests will appear here." />
      ) : (
        <View>
          {items.map((item) => (
            <Card key={item._id} onPress={() => openDC(item._id)}>
              <CardTitle title={getCustomerName(item)} subtitle={`DC ${getDCNumber(item)}`} badge={`Qty ${String(totalQty(item))}`} tone="info" />
              <InfoRow label="School code" value={getSchoolCode(item)} bold />
              <InfoRow label="Phone" value={getCustomerPhone(item)} phone />
              <InfoRow label="Products" value={productsSummary(item)} />
              <ActionRow>
                <Act title="Open DC" onPress={() => openDC(item._id)} />
              </ActionRow>
            </Card>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

/**
 * Executive Manager: list of pending PO change requests (assigned to this manager only). Tap card → Detail to Approve/Reject.
 */
import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { apiService, getApiUrl } from '../../services/api';

export default function POChangeRequestsScreen({ navigation }: any) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const endpoint = '/executive-managers/po-change-requests';
    const fullUrl = `${getApiUrl()}${endpoint}`;
    try {
      setLoading(true);
      const data = await apiService.get(endpoint);
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load PO change requests';
      Alert.alert('Error', `${msg}\n\nURL: ${fullUrl}`);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <ScreenShell
      title="PO Change Requests"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
{list.length === 0 ? (
        <EmptyState
          icon="📄"
          title="No pending PO change requests"
          message="Requests are routed only to the Zonal Manager assigned to each BDE."
        />
      ) : (
        list.map((order) => {
          const req = order.poChangeRequest;
          const requestedAt = req?.requestedAt ? new Date(req.requestedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
          const executiveName = req?.requestedBy?.name || req?.requestedBy?.email || 'Executive';
          const open = () => navigation.navigate('POChangeRequestDetail', { orderId: order._id });
          return (
            <Card key={order._id} onPress={open}>
              <CardTitle title={order.school_name || '—'} badge="Pending" tone="warning" />
              <InfoRow label="BDE" value={executiveName} />
              <InfoRow label="Requested" value={requestedAt} />
              <InfoRow label="Reason" value={req?.remarks || ''} />
              <ActionRow>
                <WebButton title="Review request" variant="outline" onPress={open} />
              </ActionRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

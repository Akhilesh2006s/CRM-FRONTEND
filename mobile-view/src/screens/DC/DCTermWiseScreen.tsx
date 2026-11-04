import React, { useState, useCallback } from 'react';
import { Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, toneFor } from '../../ui/Kit';
import { SearchBar, Act, matchesWords, ui } from '../../components/dc/DcUi';
import { apiService } from '../../services/api';
import { isTransportComplete, TRANSPORT_REQUIRED_MESSAGE } from '../../utils/dcTransport';
import { showAlert } from '../../utils/showAlert';
import { navigateRoot } from '../../navigation/navigationRef';
import { useAuth } from '../../context/AuthContext';
import TermWiseEditPOModal from '../../components/dc/TermWiseEditPOModal';
import { termWiseProductLabel } from '../../lib/termWiseDc';

function getOrderId(dc: any): string | null {
  if (dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId._id) return dc.dcOrderId._id;
  if (typeof dc.dcOrderId === 'string') return dc.dcOrderId;
  return null;
}

function getSchoolName(dc: any): string {
  const order = dc.dcOrderId;
  if (order && typeof order === 'object') {
    return order.school_name || order.schoolName || dc.customerName || '-';
  }
  return dc.customerName || '-';
}

function getSchoolCode(dc: any): string {
  const order = dc.dcOrderId;
  if (order && typeof order === 'object') {
    return order.school_code || order.dc_code || '-';
  }
  return '-';
}

function getPhone(dc: any): string {
  return (
    dc.customerPhone ||
    (typeof dc.dcOrderId === 'object' ? dc.dcOrderId?.contact_mobile : '') ||
    '-'
  );
}

/** Rows Close Lead routed to this Term-Wise DC (web: closeLeadDestination === TERM_WISE_DC). */
function getTerm2Products(dc: any): string {
  return termWiseProductLabel(dc);
}

function formatStatus(status?: string): string {
  if (!status) return 'Created';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DCTermWiseScreen({ navigation }: any) {
  const [dcs, setDcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editDc, setEditDc] = useState<any | null>(null);
  const { user } = useAuth();
  const bde = { name: user?.name, mobile: (user as any)?.mobile || (user as any)?.phone };

  useFocusEffect(
    useCallback(() => {
      loadDCs();
    }, [])
  );

  const loadDCs = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/dc?status=scheduled_for_later');
      const arr = Array.isArray(data) ? data : data?.data ?? [];
      setDcs((arr as any[]).filter((d: any) => d.status === 'scheduled_for_later'));
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to load term-wise DCs');
      setDcs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDCs();
  };

  const filtered = dcs.filter((dc) =>
    matchesWords(searchQuery, [
      getSchoolName(dc),
      getSchoolCode(dc),
      dc.saleId?.customerName,
      getPhone(dc),
      getTerm2Products(dc),
      dc.status,
      formatStatus(dc.status),
    ]),
  );

  return (
    <ScreenShell
      title="Term-Wise DC"
      subtitle="Term 2 clients from Close Lead"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <SearchBar placeholder="Search school, code, phone, product, status…" value={searchQuery} onChangeText={setSearchQuery} />
      {filtered.length > 0 ? <Text style={ui.count}>Term 2 · {filtered.length} client(s)</Text> : null}
      {filtered.length === 0 ? (
        <EmptyState icon="📄" title="No clients found" message="Term 2 clients from Close Lead appear here." />
      ) : (
        filtered.map((dc) => {
          const orderId = getOrderId(dc);
          const createdDate = dc.createdAt
            ? new Date(dc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '-';
          const turnedDate =
            typeof dc.dcOrderId === 'object' && dc.dcOrderId?.createdAt
              ? new Date(dc.dcOrderId.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : createdDate;
          const status = formatStatus(dc.status);

          return (
            <Card key={dc._id}>
              <CardTitle title={getSchoolName(dc)} badge={status} tone={toneFor(status)} />
              <InfoRow label="School code" value={getSchoolCode(dc)} bold />
              <InfoRow label="Phone" value={getPhone(dc)} phone />
              <InfoRow label="Product" value={getTerm2Products(dc)} />
              <InfoRow label="Created" value={createdDate} />
              <InfoRow label="Client since" value={turnedDate} />
              <ActionRow>
                {dc.poPhotoUrl || orderId ? (
                  <Act
                    title="Edit PO"
                    variant="outline"
                    onPress={() => {
                      if (!orderId) {
                        showAlert('Error', 'Cannot edit: DC Order not found');
                        return;
                      }
                      setEditDc(dc);
                    }}
                  />
                ) : null}
                <Act
                  title="Request DC"
                  onPress={async () => {
                    const orderId = getOrderId(dc);
                    if (!orderId) {
                      showAlert('Error', 'DC Order not found for this client.');
                      return;
                    }
                    try {
                      const order = await apiService.get(`/dc-orders/${orderId}`);
                      if (!isTransportComplete(order)) {
                        showAlert('Transport required', TRANSPORT_REQUIRED_MESSAGE);
                        return;
                      }
                      if (!navigateRoot('DCTermWiseRequestDC', { dcId: dc._id })) {
                        navigation.navigate('DCTermWiseRequestDC', { dcId: dc._id });
                      }
                    } catch (e: any) {
                      showAlert('Error', e?.message || 'Failed to check transport details');
                    }
                  }}
                />
              </ActionRow>
            </Card>
          );
        })
      )}
      <TermWiseEditPOModal
        dc={editDc}
        bde={bde}
        onClose={() => setEditDc(null)}
        onSaved={() => {
          setEditDc(null);
          loadDCs();
        }}
      />
    </ScreenShell>
  );
}


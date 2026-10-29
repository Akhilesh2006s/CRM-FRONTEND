import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
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

  const filtered = searchQuery.trim()
    ? dcs.filter((dc) => {
        const q = searchQuery.toLowerCase();
        return (
          getSchoolName(dc).toLowerCase().includes(q) ||
          (dc.saleId?.customerName || '').toLowerCase().includes(q) ||
          getPhone(dc).toLowerCase().includes(q) ||
          getTerm2Products(dc).toLowerCase().includes(q) ||
          (dc.status || '').toLowerCase().includes(q)
        );
      })
    : dcs;

  return (
    <ScreenShell
      title="Term-Wise DC"
      subtitle="Term-Wise DC rows (paired Level 2 / Term 2 from Close Lead)"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.searchContainer}>
        <WebInput
          style={styles.searchInput}
          placeholder="Search by client, phone, product, or status..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <View style={styles.contentContainer}>
        {filtered.length > 0 ? (
          <Text style={styles.countText}>Term 2 · Total: {filtered.length} client(s)</Text>
        ) : null}
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No clients found.</Text>
          </View>
        ) : (
          filtered.map((dc, idx) => {
            const orderId = getOrderId(dc);
            const createdDate = dc.createdAt
              ? new Date(dc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '-';
            const turnedDate =
              typeof dc.dcOrderId === 'object' && dc.dcOrderId?.createdAt
                ? new Date(dc.dcOrderId.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : createdDate;

            return (
              <View key={dc._id} style={styles.card}>
                <Text style={styles.cardTitle}>{getSchoolName(dc)}</Text>
                <View style={styles.metaGrid}>
                  <MetaRow label="School Code" value={getSchoolCode(dc)} />
                  <MetaRow label="Phone" value={getPhone(dc)} />
                  <MetaRow label="Product" value={getTerm2Products(dc)} />
                  <MetaRow label="Status" value={formatStatus(dc.status)} />
                  <MetaRow label="Created" value={createdDate} />
                  <MetaRow label="Client Turned" value={turnedDate} />
                </View>
                <View style={styles.cardActions}>
                  {dc.poPhotoUrl || orderId ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn]}
                      onPress={() => {
                        if (!orderId) {
                          showAlert('Error', 'Cannot edit: DC Order not found');
                          return;
                        }
                        setEditDc(dc);
                      }}
                    >
                      <Text style={[styles.actionBtnText, styles.editBtnText]}>Edit PO</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.requestBtn]}
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
                  >
                    <Text style={[styles.actionBtnText, styles.requestBtnText]}>Request DC</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: { paddingBottom: 8 },
  searchInput: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contentContainer: { paddingBottom: 16 },
  countText: { ...typography.body.small, color: colors.textSecondary, marginBottom: 10 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
  metaGrid: { marginBottom: 12 },
  metaRow: { flexDirection: 'row', marginBottom: 6 },
  metaLabel: { ...typography.body.small, color: colors.textSecondary, width: 110 },
  metaValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1, fontWeight: '500' },
  cardActions: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  editBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  requestBtn: { backgroundColor: colors.primary },
  actionBtnText: { ...typography.label.small, fontWeight: '600' },
  editBtnText: { color: colors.textPrimary },
  requestBtnText: { color: colors.textLight },
});

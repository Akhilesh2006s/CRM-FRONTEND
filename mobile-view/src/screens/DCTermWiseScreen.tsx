import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

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

function getTerm2Products(dc: any): string {
  if (dc.productDetails && Array.isArray(dc.productDetails)) {
    const term2 = dc.productDetails.filter((p: any) => (p.term || 'Term 1') === 'Term 2');
    if (term2.length > 0) {
      return term2
        .map((p: any) => p.product || p.productName || '')
        .filter(Boolean)
        .join(', ');
    }
  }
  if (typeof dc.dcOrderId === 'object' && Array.isArray(dc.dcOrderId?.products)) {
    const term2 = dc.dcOrderId.products.filter((p: any) => (p.term || 'Term 1') === 'Term 2');
    if (term2.length > 0) {
      return term2.map((p: any) => p.product_name || p.product || '').filter(Boolean).join(', ');
    }
  }
  return dc.product || '-';
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
      Alert.alert('Error', error.message || 'Failed to load term-wise DCs');
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
          getPhone(dc).includes(q) ||
          getTerm2Products(dc).toLowerCase().includes(q) ||
          (dc.status || '').toLowerCase().includes(q)
        );
      })
    : dcs;

  return (
    <ScreenShell
      title="Term-Wise DC"
      subtitle="View clients with Term 2 products"
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
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No term-wise DCs found</Text>
          </View>
        ) : (
          filtered.map((dc, idx) => {
            const orderId = getOrderId(dc);
            const createdDate = dc.createdAt
              ? new Date(dc.createdAt).toLocaleDateString('en-IN')
              : '-';
            const turnedDate =
              typeof dc.dcOrderId === 'object' && dc.dcOrderId?.createdAt
                ? new Date(dc.dcOrderId.createdAt).toLocaleDateString('en-IN')
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
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={() => {
                      if (!orderId) {
                        Alert.alert('Error', 'DC Order not found for this client.');
                        return;
                      }
                      navigation.navigate('ClientEditPO', { orderId, dcId: dc._id });
                    }}
                  >
                    <Text style={[styles.actionBtnText, styles.editBtnText]}>Edit PO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.requestBtn]}
                    onPress={() => navigation.navigate('DCTermWiseRequestDC', { dcId: dc._id })}
                  >
                    <Text style={[styles.actionBtnText, styles.requestBtnText]}>Request DC</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  searchContainer: { padding: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
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

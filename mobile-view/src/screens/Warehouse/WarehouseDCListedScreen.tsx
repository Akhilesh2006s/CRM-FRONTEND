import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
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

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'dc_completed':
        return colors.success;
      case 'dc_accepted':
        return colors.info;
      case 'dc_on_hold':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <ScreenShell
      title="DC Listed"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['all', 'dc_accepted', 'dc_completed', 'dc_on_hold'] as const).map((filterType) => (
            <TouchableOpacity key={filterType} style={[styles.filterTab, filter === filterType && styles.filterTabActive]} onPress={() => setFilter(filterType)}>
              <Text style={[styles.filterTabText, filter === filterType && styles.filterTabTextActive]}>
                {filterType === 'all' ? 'All' : filterType === 'dc_accepted' ? 'Accepted' : filterType === 'dc_completed' ? 'Completed' : 'On Hold'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {dcs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No DCs found</Text>
          </View>
        ) : (
          dcs.map((dc) => (
            <TouchableOpacity
              key={dc._id}
              style={styles.card}
              onPress={() => navigation.navigate('WarehouseDCAtWarehouseDetail', { id: dc._id })}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.customerName}>{dc.customerName || dc.saleId?.customerName || 'N/A'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(dc.status) + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: getStatusColor(dc.status) }]}>
                    {dc.status === 'dc_completed' ? 'Completed' : dc.status === 'dc_accepted' ? 'Accepted' : dc.status === 'dc_on_hold' ? 'On Hold' : dc.status || 'Pending'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Product:</Text>
                  <Text style={styles.infoValue}>{dc.product || dc.saleId?.product || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Quantity:</Text>
                  <Text style={styles.infoValue}>{dc.requestedQuantity || dc.saleId?.quantity || '-'}</Text>
                </View>
                {dc.dcDate && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>DC Date:</Text>
                    <Text style={styles.infoValue}>{formatDate(dc.dcDate)}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  filterContainer: { backgroundColor: colors.backgroundLight, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterTab: { paddingHorizontal: 20, paddingVertical: 8, marginHorizontal: 6, borderRadius: 20, backgroundColor: colors.background },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { ...typography.label.medium, color: colors.textSecondary },
  filterTabTextActive: { color: colors.textLight, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { ...typography.label.small, fontWeight: '600' },
  cardBody: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 100 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
});



import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

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
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  return (
    <ScreenShell
      title="DC At Warehouse"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {dcs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
            </View>
            <Text style={styles.emptyTitle}>No DCs at Warehouse</Text>
            <Text style={styles.emptySubtitle}>All delivery challans have been processed or there are no pending orders</Text>
          </View>
        ) : (
          <>
            {dcs.map((dc, index) => (
              <TouchableOpacity
                key={dc._id}
                style={styles.card}
                onPress={() => navigation.navigate('WarehouseDCAtWarehouseDetail', { id: dc._id })}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardHeader}>
                    <View style={styles.customerInfo}>
                      <View style={styles.customerIconContainer}>
                        <Text style={styles.customerIcon}>🏢</Text>
                      </View>
                      <View style={styles.customerDetails}>
                        <Text style={styles.customerName} numberOfLines={1}>
                          {dc.customerName || dc.dcOrderId?.school_name || dc.saleId?.customerName || 'Unknown Customer'}
                        </Text>
                        {(dc.dcOrderId?.zone || dc.zone) && (
                          <Text style={styles.zoneText}>📍 {dc.dcOrderId?.zone || dc.zone}</Text>
                        )}
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: colors.info + '15' }]}>
                      <View style={[styles.statusDot, { backgroundColor: colors.info }]} />
                      <Text style={[styles.statusBadgeText, { color: colors.info }]}>
                        {dc.warehouseStage === 'awaiting_receipt'
                          ? 'Incoming'
                          : dc.warehouseStage === 'accepted'
                            ? 'Action Required'
                            : dc.warehouseStage === 'pending_approval'
                              ? 'Pending Approval'
                              : dc.warehouseStage === 'returned'
                                ? 'Returned'
                                : 'At Warehouse'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.cardBody}>
                  <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoIcon}>📦</Text>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Product</Text>
                        <Text style={styles.infoValue} numberOfLines={2}>
                          {dc.product || (dc.productDetails?.[0]?.product) || dc.saleId?.product || 'N/A'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.infoItem}>
                      <Text style={styles.infoIcon}>🔢</Text>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Quantity</Text>
                        <Text style={styles.infoValue}>
                          {dc.requestedQuantity ?? dc.saleId?.quantity ?? '0'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {(dc.managerRequestedAt || dc.sentToManagerAt || dc.createdAt) && (
                    <View style={styles.dateContainer}>
                      <Text style={styles.dateIcon}>📅</Text>
                      <Text style={styles.dateLabel}>Requested on </Text>
                      <Text style={styles.dateValue}>{formatDate(dc.managerRequestedAt || dc.sentToManagerAt || dc.createdAt)}</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.cardFooter}>
                  <View style={styles.updateButton}>
                    <Text style={styles.updateButtonText}>Update & Submit</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 16, ...typography.body.large, color: colors.textSecondary, fontWeight: '500' },
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 50, 
    paddingBottom: 24, 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  backButton: { 
    width: 44, 
    height: 44, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitleContainer: { flex: 1, alignItems: 'center', marginHorizontal: 12 },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, fontWeight: '700' },
  headerSubtitle: { ...typography.body.small, color: 'rgba(255, 255, 255, 0.9)', marginTop: 4, fontWeight: '500' },
  placeholder: { width: 44 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 30 },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { ...typography.heading.h2, color: colors.textPrimary, marginBottom: 8, fontWeight: '700' },
  emptySubtitle: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  card: { 
    backgroundColor: colors.backgroundLight, 
    borderRadius: 20, 
    marginBottom: 16, 
    shadowColor: colors.shadowDark, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.12, 
    shadowRadius: 16, 
    elevation: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardTop: {
    padding: 20,
    paddingBottom: 16,
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
  },
  customerInfo: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  customerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerIcon: {
    fontSize: 24,
  },
  customerDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  customerName: { 
    ...typography.heading.h3, 
    color: colors.textPrimary, 
    fontWeight: '700',
    marginBottom: 4,
  },
  zoneText: {
    ...typography.body.small,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.info + '30',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusBadgeText: { 
    ...typography.label.small, 
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    marginVertical: 4,
  },
  cardBody: { 
    padding: 20,
    paddingTop: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 16,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: { 
    ...typography.label.small, 
    color: colors.textSecondary, 
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
  },
  infoValue: { 
    ...typography.body.medium, 
    color: colors.textPrimary, 
    fontWeight: '600',
    lineHeight: 20,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  dateIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  dateLabel: {
    ...typography.body.small,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  dateValue: {
    ...typography.body.small,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  cardFooter: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 4,
  },
  updateButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  updateButtonText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});


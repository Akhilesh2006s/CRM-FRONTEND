/**
 * Hold DC screen - matches navbar-landing Hold DC page.
 * Loads from GET /warehouse/hold-dc/list (DcOrder holds) + GET /dc/hold (DC model holds).
 * Move to DC@Warehouse: DcOrder → POST /warehouse/dc/:id/hold; DC model → PUT /dc/:id { status: 'pending_dc', holdReason: '' }.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

type HoldRow = {
  _id: string;
  dcNo: string;
  dcDate?: string;
  dcFinYear?: string;
  schoolType?: string;
  schoolName?: string;
  schoolCode?: string;
  zone?: string;
  executive?: string;
  holdRemarks?: string;
  isDcOrder?: boolean;
};

export default function WarehouseHoldDCScreen({ navigation }: any) {
  const [rows, setRows] = useState<HoldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dcOrderHolds, dcHolds] = await Promise.all([
        apiService.get('/warehouse/hold-dc/list').catch(() => []),
        apiService.get('/dc/hold').catch(() => []),
      ]);

      const dcOrderList = Array.isArray(dcOrderHolds) ? dcOrderHolds : [];
      const dcList = Array.isArray(dcHolds) ? dcHolds : [];

      const markedDcOrder: HoldRow[] = dcOrderList.map((hold: any) => ({
        _id: hold._id,
        dcNo: hold.dcNo || hold.dc_code || `DC-${(hold._id || '').slice(-6)}`,
        dcDate: hold.dcDate || hold.createdAt,
        dcFinYear: hold.dcFinYear || '',
        schoolType: hold.schoolType || hold.school_type || '',
        schoolName: hold.schoolName || hold.school_name || '',
        schoolCode: hold.schoolCode || hold.school_code || '',
        zone: hold.zone || '',
        executive: hold.executive || (hold.assigned_to?.name || hold.assigned_to?.email) || '',
        holdRemarks: hold.holdRemarks || hold.remarks || '',
        isDcOrder: true,
      }));

      const transformedDC: HoldRow[] = dcList.map((dc: any) => ({
        _id: dc._id,
        dcNo: dc._id ? `DC-${dc._id.slice(-6)}` : '',
        dcDate: dc.dcDate || dc.createdAt,
        dcFinYear: '',
        schoolType: dc.dcOrderId?.school_type || '',
        schoolName: dc.dcOrderId?.school_name || dc.customerName || '',
        schoolCode: dc.dcOrderId?.school_code || dc.dcOrderId?.dc_code || '',
        zone: dc.dcOrderId?.zone || '',
        executive: dc.employeeId?.name || dc.employeeId?.email || '',
        holdRemarks: dc.holdReason || '',
        isDcOrder: false,
      }));

      setRows([...markedDcOrder, ...transformedDC]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load hold DCs');
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

  const moveToWarehouse = async (row: HoldRow) => {
    setMovingId(row._id);
    try {
      if (row.isDcOrder) {
        await apiService.post(`/warehouse/dc-order/${row._id}/move-to-warehouse`, {});
        setRows((prev) => prev.filter((r) => r._id !== row._id));
        Alert.alert(
          'Moved to DC @ Warehouse',
          'The order will appear in the DC @ Warehouse list.',
          [
            { text: 'Stay' },
            {
              text: 'Open DC @ Warehouse',
              onPress: () => navigation.navigate('WarehouseDCAtWarehouse'),
            },
          ]
        );
      } else {
        // DC model: set status to sent_to_manager so it appears in DC @ Warehouse list
        await apiService.put(`/dc/${row._id}`, {
          status: 'sent_to_manager',
          holdReason: '',
        });
        setRows((prev) => prev.filter((r) => r._id !== row._id));
        Alert.alert(
          'Moved to DC @ Warehouse',
          'The DC will appear in the DC @ Warehouse list.',
          [
            { text: 'Stay' },
            {
              text: 'Open DC @ Warehouse',
              onPress: () => navigation.navigate('WarehouseDCAtWarehouse'),
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to move DC to warehouse');
    } finally {
      setMovingId(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  return (
    <ScreenShell
      title="Hold DC List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {rows.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>⏸️</Text>
            <Text style={styles.emptyText}>No DCs on hold</Text>
          </View>
        ) : (
          rows.map((r, idx) => (
            <View key={r._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.dcNo}>#{idx + 1} {r.dcNo}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (colors.warning || '#f59e0b') + '25' }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.warning || '#f59e0b' }]}>On Hold</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>DC Date:</Text>
                  <Text style={styles.infoValue}>{formatDate(r.dcDate)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>School Type:</Text>
                  <Text style={styles.infoValue}>{r.schoolType || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>School Name:</Text>
                  <Text style={styles.infoValue}>{r.schoolName || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>School Code:</Text>
                  <Text style={styles.infoValue}>{r.schoolCode || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Zone:</Text>
                  <Text style={styles.infoValue}>{r.zone || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Executive:</Text>
                  <Text style={styles.infoValue}>{r.executive || '-'}</Text>
                </View>
                {r.holdRemarks ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Hold Remarks:</Text>
                    <Text style={styles.infoValue}>{r.holdRemarks}</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.moveButton, movingId === r._id && styles.moveButtonDisabled]}
                onPress={() => moveToWarehouse(r)}
                disabled={!!movingId}
              >
                {movingId === r._id ? (
                  <ActivityIndicator size="small" color={colors.textLight} />
                ) : (
                  <Text style={styles.moveButtonText}>Move to DC@Warehouse</Text>
                )}
              </TouchableOpacity>
            </View>
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
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dcNo: { ...typography.heading.h3, color: colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { ...typography.label.small, fontWeight: '600' },
  cardBody: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 110 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  moveButton: {
    backgroundColor: colors.error || '#dc2626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  moveButtonDisabled: { opacity: 0.6 },
  moveButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
});

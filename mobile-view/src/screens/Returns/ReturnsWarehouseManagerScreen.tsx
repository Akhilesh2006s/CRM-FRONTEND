import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

type DcOrderRef = {
  _id?: string;
  dc_code?: string;
  school_name?: string;
  school_code?: string;
};

type StockReturn = {
  _id: string;
  returnId?: string;
  returnNumber?: number;
  lrNumber?: string;
  finYear?: string;
  schoolCode?: string;
  remarks?: string;
  executiveRemarks?: string;
  dcOrderId?: string | DcOrderRef;
  status?: string;
  executiveName?: string;
  customerName?: string;
  returnDate?: string;
  verifiedBy?: { name?: string };
};

type SortKey =
  | 'returnNo'
  | 'lrNo'
  | 'finYear'
  | 'schoolName'
  | 'schoolCode'
  | 'executive'
  | 'returnDate'
  | 'remarks'
  | 'status';

function formatReturnDate(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toISOString().slice(0, 10);
}

function resolveSchoolName(row: StockReturn): string {
  const dc = row.dcOrderId;
  if (dc && typeof dc === 'object' && dc.school_name) return dc.school_name;
  return row.customerName || '-';
}

function resolveSchoolCode(row: StockReturn): string {
  if (row.schoolCode?.trim()) return row.schoolCode.trim();
  const dc = row.dcOrderId;
  if (dc && typeof dc === 'object' && dc.school_code) return dc.school_code;
  return '-';
}

function resolveRemarks(row: StockReturn): string {
  return (row.remarks || row.executiveRemarks || '').trim() || '-';
}

function statusStyle(status: string) {
  if (status === 'Pending Manager Approval' || status === 'WAREHOUSE_MANAGER_PENDING') return { bg: '#FEF3C7', fg: '#92400E' };
  if (status === 'Received') return { bg: '#DBEAFE', fg: '#1E40AF' };
  if (status === 'Partially Approved') return { bg: '#F3E8FF', fg: '#6B21A8' };
  if (status === 'Stock Updated' || status === 'Approved') return { bg: '#DCFCE7', fg: '#166534' };
  if (status === 'Rejected') return { bg: '#FEE2E2', fg: '#991B1B' };
  return { bg: '#F1F5F9', fg: '#334155' };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ReturnsWarehouseManagerScreen({ navigation }: any) {
  const [returns, setReturns] = useState<StockReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('returnDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadReturns = useCallback(async () => {
    try {
      setLoading(true);
      const url = pendingOnly
        ? '/stock-returns/warehouse-manager/list?pending=true'
        : '/stock-returns/warehouse-manager/list';
      const response = await apiService.get(url);
      const returnsList = Array.isArray(response) ? response : (response as any)?.data || [];
      setReturns(
        returnsList.map((r: any) => ({
          ...r,
          status: r.status || 'Submitted',
        })),
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load returns');
      setReturns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pendingOnly]);

  useFocusEffect(
    useCallback(() => {
      loadReturns();
    }, [loadReturns]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReturns();
  };

  const sortedReturns = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const list = [...returns];
    list.sort((a, b) => {
      let av = '';
      let bv = '';
      switch (sortKey) {
        case 'returnNo':
          av = String(a.returnNumber ?? a.returnId ?? '');
          bv = String(b.returnNumber ?? b.returnId ?? '');
          break;
        case 'lrNo':
          av = a.lrNumber || '';
          bv = b.lrNumber || '';
          break;
        case 'finYear':
          av = a.finYear || '';
          bv = b.finYear || '';
          break;
        case 'schoolName':
          av = resolveSchoolName(a);
          bv = resolveSchoolName(b);
          break;
        case 'schoolCode':
          av = resolveSchoolCode(a);
          bv = resolveSchoolCode(b);
          break;
        case 'executive':
          av = a.executiveName || '';
          bv = b.executiveName || '';
          break;
        case 'returnDate':
          av = a.returnDate || '';
          bv = b.returnDate || '';
          break;
        case 'remarks':
          av = resolveRemarks(a);
          bv = resolveRemarks(b);
          break;
        case 'status':
          av = a.status || '';
          bv = b.status || '';
          break;
        default:
          break;
      }
      if (sortKey === 'returnNo') {
        const an = Number(av);
        const bn = Number(bv);
        if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * dir;
      }
      return av.localeCompare(bv, undefined, { sensitivity: 'base' }) * dir;
    });
    return list;
  }, [returns, sortKey, sortDir]);

  return (
    <ScreenShell
      title="Return Stock List"
      subtitle="Warehouse manager — review field executive vs warehouse executive quantities"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, pendingOnly && styles.filterTabActive]}
            onPress={() => setPendingOnly(true)}
          >
            <Text style={[styles.filterTabText, pendingOnly && styles.filterTabTextActive]}>
              Pending review
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, !pendingOnly && styles.filterTabActive]}
            onPress={() => setPendingOnly(false)}
          >
            <Text style={[styles.filterTabText, !pendingOnly && styles.filterTabTextActive]}>
              All returns
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sortCard}>
          <WebLabel>Sort by</WebLabel>
          <WebSelect
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
            items={[
              { label: 'Return No', value: 'returnNo' },
              { label: 'LR No', value: 'lrNo' },
              { label: 'Fin Year', value: 'finYear' },
              { label: 'School Name', value: 'schoolName' },
              { label: 'School Code', value: 'schoolCode' },
              { label: 'Executive', value: 'executive' },
              { label: 'Return Date', value: 'returnDate' },
              { label: 'Remarks', value: 'remarks' },
              { label: 'Status', value: 'status' },
            ]}
          />
          <TouchableOpacity
            style={styles.sortDirBtn}
            onPress={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            <Ionicons
              name={sortDir === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'}
              size={16}
              color="#0F172A"
            />
            <Text style={styles.sortDirText}>
              {sortDir === 'asc' ? 'Ascending' : 'Descending'}
            </Text>
          </TouchableOpacity>
        </View>

        {sortedReturns.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No returns found</Text>
          </View>
        ) : (
          sortedReturns.map((row, index) => {
            const status = row.status === 'WAREHOUSE_MANAGER_PENDING' ? 'Pending Manager Approval' : row.status || '-';
            const badge = statusStyle(status);
            return (
              <View key={row._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.returnNo}>
                    #{row.returnNumber ?? row.returnId ?? index + 1}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.fg }]}>{status}</Text>
                  </View>
                </View>
                <InfoRow label="S.No" value={String(index + 1)} />
                <InfoRow label="LR No" value={row.lrNumber || '-'} />
                <InfoRow label="Fin Year" value={row.finYear || '-'} />
                <InfoRow label="School Name" value={resolveSchoolName(row)} />
                <InfoRow label="School Code" value={resolveSchoolCode(row)} />
                <InfoRow label="Executive" value={row.executiveName || '-'} />
                <InfoRow label="Return Date" value={formatReturnDate(row.returnDate)} />
                <InfoRow label="Remarks" value={resolveRemarks(row)} />

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    navigation.navigate('StockReturnWarehouseManagerReview', {
                      returnId: row._id,
                    })
                  }
                >
                  <Ionicons name="create-outline" size={18} color="#B45309" />
                  <Text style={styles.actionBtnText}>Review</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32, gap: 12 },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  sortCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
  },
  sortDirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  sortDirText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  returnNo: {
    ...typography.heading.h3,
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  infoLabel: {
    width: 110,
    ...typography.body.small,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
  actionBtn: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
});

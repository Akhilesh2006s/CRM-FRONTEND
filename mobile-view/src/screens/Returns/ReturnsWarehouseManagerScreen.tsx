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
import { WebSelect, WebLabel, WebButton } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, ChipRow, toneFor } from '../../ui/Kit';
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
      subtitle="Review field vs warehouse executive quantities"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ChipRow
        items={[
          { key: 'pending', label: 'Pending review' },
          { key: 'all', label: 'All returns' },
        ]}
        value={pendingOnly ? 'pending' : 'all'}
        onChange={(k) => setPendingOnly(k === 'pending')}
      />
      <View style={{ height: 12 }} />
      <View style={styles.sortRow}>
        <View style={{ flex: 1 }}>
          <WebSelect
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
            placeholder="Sort by"
            items={[
              { label: 'Sort: Return No', value: 'returnNo' },
              { label: 'Sort: LR No', value: 'lrNo' },
              { label: 'Sort: Fin Year', value: 'finYear' },
              { label: 'Sort: School Name', value: 'schoolName' },
              { label: 'Sort: School Code', value: 'schoolCode' },
              { label: 'Sort: Executive', value: 'executive' },
              { label: 'Sort: Return Date', value: 'returnDate' },
              { label: 'Sort: Remarks', value: 'remarks' },
              { label: 'Sort: Status', value: 'status' },
            ]}
          />
        </View>
        <TouchableOpacity style={styles.sortDirBtn} onPress={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
          <Ionicons name={sortDir === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'} size={16} color={colors.textPrimary} />
          <Text style={styles.sortDirText}>{sortDir === 'asc' ? 'Asc' : 'Desc'}</Text>
        </TouchableOpacity>
      </View>

      {sortedReturns.length === 0 ? (
        <EmptyState icon="↩️" title="No returns found" />
      ) : (
        sortedReturns.map((row, index) => {
          const status = row.status === 'WAREHOUSE_MANAGER_PENDING' ? 'Pending Manager Approval' : row.status || '-';
          return (
            <Card key={row._id}>
              <CardTitle
                title={`#${row.returnNumber ?? row.returnId ?? index + 1}`}
                subtitle={resolveSchoolName(row) !== '-' ? resolveSchoolName(row) : undefined}
                badge={status}
                tone={toneFor(status)}
              />
              <InfoRow label="S.No" value={String(index + 1)} />
              <InfoRow label="LR No" value={row.lrNumber || '-'} />
              <InfoRow label="Fin Year" value={row.finYear || '-'} />
              <InfoRow label="School Code" value={resolveSchoolCode(row)} />
              <InfoRow label="Executive" value={row.executiveName || '-'} />
              <InfoRow label="Return Date" value={formatReturnDate(row.returnDate)} />
              <InfoRow label="Remarks" value={resolveRemarks(row)} />
              <ActionRow>
                <WebButton
                  title="Review"
                  onPress={() =>
                    navigation.navigate('StockReturnWarehouseManagerReview', {
                      returnId: row._id,
                    })
                  }
                />
              </ActionRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sortRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sortDirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundLight,
  },
  sortDirText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
});

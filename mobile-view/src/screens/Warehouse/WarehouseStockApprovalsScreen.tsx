import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending Manager Approval',
  approved: 'Stock Confirmed',
  rejected: 'Rejected',
  returned: 'Returned for Correction',
};

export default function WarehouseStockApprovalsScreen() {
  const { user } = useAuth();
  const isManager = user?.role === 'Warehouse Manager' || user?.role === 'Admin' || user?.role === 'Super Admin';
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remarks, setRemarks] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get(isManager ? '/warehouse/stock-requests?status=pending' : '/warehouse/stock-requests');
      setRows(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load stock approvals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isManager]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const decide = async (id: string, action: 'approve' | 'reject' | 'return') => {
    if ((action === 'reject' || action === 'return') && !remarks.trim()) {
      Alert.alert('Remarks required', 'Enter remarks before rejecting or returning stock.');
      return;
    }
    try {
      await apiService.post(`/warehouse/stock-requests/${id}/decision`, { action, remarks });
      setRemarks('');
      Alert.alert(
        'Updated',
        action === 'approve' ? 'Stock confirmed and added to inventory.' : 'Stock request updated.'
      );
      load();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to update this request');
    }
  };

  return (
    <ScreenShell title={isManager ? 'Pending Stock Approvals' : 'My Stock Requests'} loading={loading && !refreshing} refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {isManager ? (
          <TextInput
            style={styles.input}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Remarks for reject or return"
            placeholderTextColor={colors.textMuted}
          />
        ) : null}
        {rows.length === 0 && !loading ? <Text style={styles.empty}>No stock requests.</Text> : null}
        {rows.map((row) => (
          <View key={row._id} style={styles.card}>
            <Text style={styles.title}>{row.productName}</Text>
            <Text style={styles.meta}>{row.quantity} {row.unit || 'pcs'} · Batch {row.batchLot || '-'}</Text>
            <Text style={styles.meta}>{row.location || '-'} · {row.supplier || '-'}</Text>
            <Text style={styles.status}>{STATUS_LABEL[row.status] || row.status}</Text>
            {row.reviewRemarks ? <Text style={styles.meta}>Remarks: {row.reviewRemarks}</Text> : null}
            {isManager && row.status === 'pending' ? (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.approve} onPress={() => decide(row._id, 'approve')}>
                  <Text style={styles.actionText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.neutral} onPress={() => decide(row._id, 'return')}>
                  <Text style={styles.neutralText}>Return</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reject} onPress={() => decide(row._id, 'reject')}>
                  <Text style={styles.actionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundLight,
  },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 24 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  status: { marginTop: 8, fontWeight: '600', color: colors.primary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approve: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  reject: { backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  neutral: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  actionText: { color: '#fff', fontWeight: '600' },
  neutralText: { color: colors.textPrimary, fontWeight: '600' },
});

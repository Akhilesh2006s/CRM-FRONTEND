import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

import DateField from '../../ui/DateField';
type WarehouseReturn = {
  _id: string;
  returnNumber: number;
  returnDate?: string;
  createdAt?: string;
  status?: string;
  createdBy?: { name?: string };
  remarks?: string;
  lrNumber?: string;
  finYear?: string;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ReturnsWarehouseScreen() {
  const [returns, setReturns] = useState<WarehouseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    returnDate: '',
    remarks: '',
    lrNumber: '',
    finYear: '',
  });

  const loadReturns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/stock-returns/warehouse');
      const rows = Array.isArray(response) ? response : (response as any)?.data || [];
      // Pending warehouse-list rows only — Closed means already submitted from this page
      setReturns(rows.filter((r: WarehouseReturn) => r.status !== 'Closed'));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load returns');
      setReturns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReturns();
    }, [loadReturns]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReturns();
  };

  const createReturn = async () => {
    if (!form.returnDate) {
      Alert.alert('Validation', 'Please select Return Date');
      return;
    }

    setCreating(true);
    try {
      const created = await apiService.post('/stock-returns/warehouse', form);
      Alert.alert('Success', `Return #${created.returnNumber} created`);
      setForm({ returnDate: '', remarks: '', lrNumber: '', finYear: '' });
      loadReturns();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit return');
    } finally {
      setCreating(false);
    }
  };

  const submitReturn = async (returnId: string, returnNumber: number) => {
    if (!returnId) return;
    setSubmittingId(returnId);
    try {
      await apiService.put(`/stock-returns/${returnId}/warehouse-submit`, {});
      Alert.alert('Return submitted', `Return #${returnNumber} submitted successfully`);
      await loadReturns();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit return');
    } finally {
      setSubmittingId(null);
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

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '-';
    }
  };

  return (
    <ScreenShell
      title="Warehouse Returns"
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
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Submit New Return</Text>
          <WebLabel>Return Date *</WebLabel>
          <DateField placeholder="Return Date *" value={form.returnDate} onChange={(text) => setForm({ ...form, returnDate: text })} />
          <WebLabel>LR No (optional)</WebLabel>
          <WebInput
            placeholder="e.g. C062455"
            value={form.lrNumber}
            onChangeText={(text) => setForm({ ...form, lrNumber: text })}
          />
          <WebLabel>Fin Year (optional)</WebLabel>
          <WebInput
            placeholder="e.g. 2025-26"
            value={form.finYear}
            onChangeText={(text) => setForm({ ...form, finYear: text })}
          />
          <WebLabel>Remarks</WebLabel>
          <WebInput
            placeholder="Reason/notes or items summary"
            value={form.remarks}
            onChangeText={(text) => setForm({ ...form, remarks: text })}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />
          <WebButton
            title={creating ? 'Submitting…' : 'Submit Warehouse Return'}
            onPress={createReturn}
            disabled={creating || !form.returnDate}
            loading={creating}
          />
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>All Warehouse Returns</Text>
          {loading && returns.length === 0 ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : returns.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No returns</Text>
            </View>
          ) : (
            returns.map((ret) => (
              <View key={ret._id} style={styles.returnCard}>
                <Text style={styles.returnNumber}>#{ret.returnNumber}</Text>
                <InfoRow label="Return Date" value={formatDate(ret.returnDate)} />
                <InfoRow label="LR No" value={ret.lrNumber || '-'} />
                <InfoRow label="Fin Year" value={ret.finYear || '-'} />
                <InfoRow label="Submitted By" value={ret.createdBy?.name || '-'} />
                <InfoRow label="Remarks" value={ret.remarks || '-'} />
                <InfoRow label="Created" value={formatDateTime(ret.createdAt)} />
                <View style={styles.actionWrap}>
                  <WebButton
                    title={submittingId === ret._id ? 'Submitting…' : 'Submit'}
                    onPress={() => submitReturn(ret._id, ret.returnNumber)}
                    disabled={loading || submittingId === ret._id}
                    loading={submittingId === ret._id}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32, gap: 12 },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 6,
  },
  formTitle: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  listTitle: {
    ...typography.heading.h3,
    color: colors.textPrimary,
  },
  loader: { padding: 20 },
  emptyContainer: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  returnCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  returnNumber: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 8,
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
  actionWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
});

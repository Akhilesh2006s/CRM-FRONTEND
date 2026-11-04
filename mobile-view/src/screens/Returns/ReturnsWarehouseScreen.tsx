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
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
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
    <ScreenShell title="Warehouse Returns" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      <PageSection title="Submit New Return">
        <WebLabel>Return Date *</WebLabel>
        <DateField placeholder="Return Date *" value={form.returnDate} onChange={(text) => setForm({ ...form, returnDate: text })} />
        <View style={{ height: 14 }} />
        <WebLabel>LR No</WebLabel>
        <WebInput
          placeholder="e.g. C062455 (optional)"
          value={form.lrNumber}
          onChangeText={(text) => setForm({ ...form, lrNumber: text })}
        />
        <WebLabel>Fin Year</WebLabel>
        <WebInput
          placeholder="e.g. 2025-26 (optional)"
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
      </PageSection>

      <SectionTitle>All Warehouse Returns</SectionTitle>
      {loading && returns.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : returns.length === 0 ? (
        <EmptyState icon="↩️" title="No returns" />
      ) : (
        returns.map((ret) => (
          <Card key={ret._id}>
            <CardTitle title={`#${ret.returnNumber}`} badge={ret.status || undefined} tone={toneFor(ret.status)} />
            <InfoRow label="Return Date" value={formatDate(ret.returnDate)} />
            <InfoRow label="LR No" value={ret.lrNumber || '-'} />
            <InfoRow label="Fin Year" value={ret.finYear || '-'} />
            <InfoRow label="Submitted By" value={ret.createdBy?.name || '-'} />
            <InfoRow label="Remarks" value={ret.remarks || '-'} />
            <InfoRow label="Created" value={formatDateTime(ret.createdAt)} />
            <ActionRow>
              <WebButton
                title={submittingId === ret._id ? 'Submitting…' : 'Submit'}
                onPress={() => submitReturn(ret._id, ret.returnNumber)}
                disabled={loading || submittingId === ret._id}
                loading={submittingId === ret._id}
              />
            </ActionRow>
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  loader: { padding: 20 },
});

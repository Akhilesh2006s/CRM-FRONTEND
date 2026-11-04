import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

export default function PaymentApprovedScreen({ navigation }: any) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/payments?status=Approved');
      setPayments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load approved payments');
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

  const formatAmount = (amount?: number) => {
    if (!amount) return '₹0';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <ScreenShell title="Approved Payments" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      {payments.length === 0 ? (
        <EmptyState icon="✅" title="No approved payments found" />
      ) : (
        payments.map((payment) => (
          <Card key={payment._id}>
            <CardTitle title={payment.customerName || 'N/A'} badge="Approved" tone="success" />
            <InfoRow label="Amount" value={<Text style={styles.amountText}>{formatAmount(payment.amount)}</Text>} />
            <InfoRow label="Date" value={formatDate(payment.paymentDate)} />
            <InfoRow label="Method" value={payment.paymentMethod || '-'} />
            {payment.approvedAt ? <InfoRow label="Approved" value={formatDate(payment.approvedAt)} /> : null}
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  amountText: { fontSize: 15, color: colors.success, fontWeight: '700' },
});

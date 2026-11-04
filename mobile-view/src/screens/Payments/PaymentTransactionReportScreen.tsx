import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ChipRow, EmptyState, toneFor } from '../../ui/Kit';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

import DateField from '../../ui/DateField';
export default function PaymentTransactionReportScreen({ navigation }: any) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    paymentMode: 'all',
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.paymentMode !== 'all') params.append('paymentMode', filters.paymentMode);
      
      const data = await apiService.get(`/payments?${params.toString()}`);
      setPayments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load transaction report');
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

  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <ScreenShell title="Transaction Report" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      <PageSection title="Filters">
        <DateField placeholder="Start date" value={filters.startDate} onChange={(text: string) => setFilters((f) => ({ ...f, startDate: text }))} />
        <DateField placeholder="End date" value={filters.endDate} onChange={(text: string) => setFilters((f) => ({ ...f, endDate: text }))} />
        <ChipRow
          items={[
            { key: 'all', label: 'All' },
            { key: 'Approved', label: 'Approved' },
            { key: 'Pending', label: 'Pending' },
          ]}
          value={filters.status}
          onChange={(k) => setFilters((f) => ({ ...f, status: k }))}
        />
        <View style={{ height: 12 }} />
        <WebButton title="Apply Filters" onPress={loadData} />
      </PageSection>
      {totalAmount > 0 && (
        <Card>
          <InfoRow label="Total Amount" value={<Text style={styles.summaryAmount}>{formatAmount(totalAmount)}</Text>} />
          <InfoRow label="Transactions" value={String(payments.length)} />
        </Card>
      )}
      {payments.length === 0 ? (
        <EmptyState icon="📊" title="No transactions found" />
      ) : (
        payments.map((payment) => (
          <Card key={payment._id}>
            <CardTitle
              title={payment.customerName || 'N/A'}
              badge={payment.status || 'Pending'}
              tone={toneFor(payment.status || 'Pending')}
            />
            <InfoRow label="Amount" value={<Text style={styles.amountText}>{formatAmount(payment.amount)}</Text>} />
            <InfoRow label="Date" value={formatDate(payment.paymentDate)} />
            <InfoRow label="Method" value={payment.paymentMethod || '-'} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summaryAmount: { fontSize: 17, color: colors.primaryDark, fontWeight: '700' },
  amountText: { fontSize: 15, color: colors.success, fontWeight: '700' },
});

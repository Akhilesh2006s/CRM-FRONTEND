import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
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
    <ScreenShell
      title="Transaction Report"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<View style={styles.filterContainer}>
        <DateField placeholder="Start date" value={filters.startDate} onChange={(text: string) => setFilters((f) => ({ ...f, startDate: text }))} style={styles.filterInput} />
        <DateField placeholder="End date" value={filters.endDate} onChange={(text: string) => setFilters((f) => ({ ...f, endDate: text }))} style={styles.filterInput} />
        <View style={styles.filterTabs}>
          <TouchableOpacity style={[styles.filterTab, filters.status === 'all' && styles.filterTabActive]} onPress={() => setFilters((f) => ({ ...f, status: 'all' }))}>
            <Text style={[styles.filterTabText, filters.status === 'all' && styles.filterTabTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterTab, filters.status === 'Approved' && styles.filterTabActive]} onPress={() => setFilters((f) => ({ ...f, status: 'Approved' }))}>
            <Text style={[styles.filterTabText, filters.status === 'Approved' && styles.filterTabTextActive]}>Approved</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterTab, filters.status === 'Pending' && styles.filterTabActive]} onPress={() => setFilters((f) => ({ ...f, status: 'Pending' }))}>
            <Text style={[styles.filterTabText, filters.status === 'Pending' && styles.filterTabTextActive]}>Pending</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={loadData}>
          <Text style={styles.searchButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
      {totalAmount > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Amount:</Text>
          <Text style={styles.summaryAmount}>{formatAmount(totalAmount)}</Text>
          <Text style={styles.summaryCount}>{payments.length} transactions</Text>
        </View>
      )}
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        ) : (
          payments.map((payment) => (
            <View key={payment._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.customerName}>{payment.customerName || 'N/A'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (payment.status === 'Approved' ? colors.success : payment.status === 'Pending' ? colors.warning : colors.textSecondary) + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: payment.status === 'Approved' ? colors.success : payment.status === 'Pending' ? colors.warning : colors.textSecondary }]}>
                    {payment.status || 'Pending'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Amount:</Text>
                  <Text style={[styles.infoValue, styles.amountText]}>{formatAmount(payment.amount)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date:</Text>
                  <Text style={styles.infoValue}>{formatDate(payment.paymentDate)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Method:</Text>
                  <Text style={styles.infoValue}>{payment.paymentMethod || '-'}</Text>
                </View>
              </View>
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
  placeholder: { width: 40 },
  filterContainer: { backgroundColor: colors.backgroundLight, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterInput: { ...typography.body.medium, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary, marginBottom: 12 },
  filterTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.background },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { ...typography.label.medium, color: colors.textSecondary },
  filterTabTextActive: { color: colors.textLight, fontWeight: '600' },
  searchButton: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  searchButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  summaryCard: { backgroundColor: colors.primary, margin: 16, borderRadius: 16, padding: 20, alignItems: 'center' },
  summaryLabel: { ...typography.body.medium, color: colors.textLight, opacity: 0.9, marginBottom: 8 },
  summaryAmount: { ...typography.heading.h1, color: colors.textLight, fontWeight: 'bold', marginBottom: 4 },
  summaryCount: { ...typography.body.medium, color: colors.textLight, opacity: 0.9 },
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
  amountText: { ...typography.heading.h3, color: colors.success, fontWeight: '600' },
});



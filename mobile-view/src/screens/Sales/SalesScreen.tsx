import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { apiService } from '../../services/api';

export default function SalesScreen({ navigation }: any) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/sales');
      setSales(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load sales');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSales();
  };

  const totalRevenue = sales.reduce((s, a) => s + (a.totalAmount || 0), 0);
  const pendingCount = sales.filter(s => s.status === 'Pending').length;

  return (
    <ScreenShell
      title="Sales"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Sales</Text>
          <Text style={styles.statValue}>{sales.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={[styles.statValue, { color: colors.warning }]}>{pendingCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Revenue</Text>
          <Text style={[styles.statValue, { color: colors.success }]}>₹{totalRevenue.toFixed(0)}</Text>
        </View>
      </View>

      <SectionTitle>Recent Sales</SectionTitle>
      {sales.length === 0 ? (
        <EmptyState icon="🧾" title="No sales yet." />
      ) : (
        sales.slice(0, 20).map((sale) => (
          <Card key={sale._id} style={{ paddingVertical: 12 }}>
            <CardTitle title={`₹${sale.totalAmount || 0}`} badge={sale.status || 'Sale'} tone={toneFor(sale.status)} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 12,
  },
  statLabel: { fontSize: 13, color: colors.textTertiary, marginBottom: 4 },
  statValue: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
});

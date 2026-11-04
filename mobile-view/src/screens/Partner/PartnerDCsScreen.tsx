import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, toneFor } from '../../ui/Kit';
import { colors } from '../../theme/colors';

type VendorDC = {
  _id: string;
  dcDate: string;
  status: string;
  school: { name: string; code: string; zone: string };
  totalQuantity: number;
  totalPrice: number;
  products: { productName: string; quantity: number }[];
};

export default function PartnerDCsScreen() {
  const [dcs, setDcs] = useState<VendorDC[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiService.get('/vendor-user/dcs');
      setDcs(Array.isArray(data) ? data : []);
    } catch {
      setDcs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return dcs;
    const q = search.toLowerCase();
    return dcs.filter(
      (d) =>
        d.school?.name?.toLowerCase().includes(q) ||
        d.school?.code?.toLowerCase().includes(q) ||
        d.status?.toLowerCase().includes(q)
    );
  }, [dcs, search]);

  return (
    <ScreenShell title="My DCs"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}>
      <WebInput placeholder="Search school, code, status..." value={search} onChangeText={setSearch} />
      {filtered.length === 0 ? (
        <EmptyState icon="📦" title="No DCs found" />
      ) : (
        filtered.map((item) => (
          <Card key={item._id}>
            <CardTitle
              title={item.school?.name || '—'}
              subtitle={[item.school?.code, item.school?.zone].filter(Boolean).join(' · ') || undefined}
              badge={item.status || undefined}
              tone={toneFor(item.status)}
            />
            <InfoRow label="Quantity" value={String(item.totalQuantity ?? '')} />
            <InfoRow label="Amount" value={`₹${item.totalPrice?.toLocaleString?.() ?? item.totalPrice}`} bold />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', marginTop: 32, color: colors.textSecondary },
});

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { useAuth } from '../../context/AuthContext';

type Dashboard = {
  manager: { name: string };
  products: Array<{ name: string }>;
  schools: Array<{
    schoolName: string;
    schoolCode: string;
    products: Array<{ name: string; relationship: string }>;
    bdeName: string;
    deliveryStatus: string;
  }>;
  bdes: Array<{ _id: string; name: string; email: string; phone: string; zone: string; schools: string[] }>;
  deliveries: Array<{ id: string; schoolName: string; products: string[]; status: string }>;
  trainers: Array<{ _id: string; name: string; completionRate: number; completed: number; feedbackOnFile: number }>;
};

export default function ProductManagerScreen({ embedded, managerId }: { embedded?: boolean; managerId?: string; navigation?: any }) {
  const { user } = useAuth();
  const id = managerId || user?._id;
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    apiService
      .get(`/product-manager/${id}/dashboard`)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Failed to load assigned products');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const body = loading ? (
    <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
  ) : error ? (
    <Text style={styles.error}>{error}</Text>
  ) : !data ? null : (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{data.manager?.name || 'Product Manager'}</Text>
      <Text style={styles.meta}>
        {(data.products || []).map((item) => item.name).join(', ') || 'No products assigned yet'}
      </Text>
      <Text style={styles.section}>Schools ({data.schools?.length || 0})</Text>
      {(data.schools || []).map((school) => (
        <View key={`${school.schoolCode}-${school.schoolName}`} style={styles.card}>
          <Text style={styles.cardTitle}>{school.schoolName}</Text>
          <Text style={styles.meta}>
            {(school.products || []).map((item) => `${item.name} (${item.relationship})`).join(', ')}
          </Text>
          <Text style={styles.meta}>
            {school.bdeName || 'No BDE'} · {school.deliveryStatus}
          </Text>
        </View>
      ))}
      <Text style={styles.section}>BDEs ({data.bdes?.length || 0})</Text>
      {(data.bdes || []).map((bde) => (
        <View key={bde._id} style={styles.card}>
          <Text style={styles.cardTitle}>{bde.name}</Text>
          <Text style={styles.meta}>{[bde.email, bde.phone, bde.zone].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.meta}>{(bde.schools || []).filter(Boolean).join(', ')}</Text>
        </View>
      ))}
      <Text style={styles.section}>Delivery ({data.deliveries?.length || 0})</Text>
      {(data.deliveries || []).slice(0, 40).map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.cardTitle}>{row.schoolName}</Text>
          <Text style={styles.meta}>{(row.products || []).join(', ')} · {row.status}</Text>
        </View>
      ))}
      <Text style={styles.section}>Trainers</Text>
      {(data.trainers || []).map((trainer) => (
        <View key={trainer._id} style={styles.card}>
          <Text style={styles.cardTitle}>{trainer.name}</Text>
          <Text style={styles.meta}>
            {trainer.completionRate}% complete · {trainer.completed} done · {trainer.feedbackOnFile} feedback forms
          </Text>
        </View>
      ))}
    </ScrollView>
  );

  if (embedded) return <View style={{ flex: 1 }}>{body}</View>;
  return <ScreenShell title="My Products">{body}</ScreenShell>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  section: { marginTop: 18, marginBottom: 8, fontWeight: '700', color: colors.textPrimary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontWeight: '600', color: colors.textPrimary },
  meta: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  error: { color: colors.error, padding: 16 },
});
